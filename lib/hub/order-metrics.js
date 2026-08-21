'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var attribution = require('../tracking/attribution');
var salesReport = require('../metrics/sales-report');

function centsToEur(cents) {
    return Number((Number(cents || 0) / 100).toFixed(2));
}

function extractAttributionFields(metadata) {
    var meta = metadata || {};
    var fields = {};

    attribution.ATTRIBUTION_FIELDS.forEach(function (field) {
        if (meta[field]) {
            fields[field] = meta[field];
        }
    });

    if (meta.fbc) {
        fields.fbc = meta.fbc;
    }

    if (meta.fbp) {
        fields.fbp = meta.fbp;
    }

    return fields;
}

function orderRowToSale(row, offerSlug) {
    var meta = row.metadata || {};
    var attr = extractAttributionFields(meta);
    var campaignName = attr.campaign_name || attr.utm_campaign || '';
    var adsetName = attr.adset_name || attr.utm_term || '';
    var adName = attr.ad_name || attr.utm_content || '';
    var hasAttribution = Boolean(
        campaignName ||
        adsetName ||
        adName ||
        attr.fbclid ||
        attr.fbc
    );

    var sale = {
        payment_intent: row.stripe_payment_intent_id,
        order_id: row.id,
        created: row.created_at,
        amount_eur: centsToEur(row.amount_cents),
        email: row.customer_email,
        offer_slug: offerSlug,
        offer_id: row.offer_id,
        product_id: row.product_id,
        source: 'offer_checkout',
        source_label: 'Checkout universal',
        checkout: meta.checkout || 'main',
        currency: row.currency || 'eur',
        status: row.status,
        campaign_name: campaignName || 'Desconhecido',
        campaign_id: attr.campaign_id || '',
        adset_name: adsetName || 'Sem conjunto',
        adset_id: attr.adset_id || '',
        ad_name: adName || 'Desconhecido',
        ad_id: attr.ad_id || '',
        ad_label: attribution.getPrimaryAdLabel(meta) || 'Checkout universal',
        utm_source: attr.utm_source || '',
        utm_medium: attr.utm_medium || '',
        utm_campaign: attr.utm_campaign || '',
        utm_content: attr.utm_content || '',
        fbclid: attr.fbclid || '',
        has_attribution: hasAttribution,
        has_fbc: Boolean(attr.fbc),
        is_traffic: false,
        is_hub_order: true,
    };

    sale.is_traffic = salesReport.isTrafficSale(sale);
    return salesReport.normalizeSaleAttribution(sale);
}

async function fetchHubOrders(bounds) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        return {
            orders: [],
            configured: false,
        };
    }

    var fromIso = new Date(bounds.minTimestamp * 1000).toISOString();
    var toIso = new Date(bounds.maxTimestamp * 1000).toISOString();
    var result = await admin
        .from('hub_orders')
        .select('*')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .in('status', ['paid', 'refunded'])
        .order('created_at', { ascending: false });

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível carregar hub_orders.');
    }

    return {
        orders: result.data || [],
        configured: true,
    };
}

function groupOrdersByOfferSlug(orders, offerList) {
    var idToSlug = {};
    var buckets = {};

    offerList.forEach(function (offer) {
        idToSlug[offer.id] = offer.slug;
        buckets[offer.slug] = [];
    });

    orders.forEach(function (row) {
        var slug = idToSlug[row.offer_id];

        if (!slug || !buckets[slug]) {
            return;
        }

        buckets[slug].push(orderRowToSale(row, slug));
    });

    return buckets;
}

function summarizeOrderMetrics(sales) {
    var paidSales = sales.filter(function (sale) {
        return sale.status !== 'refunded';
    });
    var refundedSales = sales.filter(function (sale) {
        return sale.status === 'refunded';
    });
    var revenue = paidSales.reduce(function (sum, sale) {
        return sum + sale.amount_eur;
    }, 0);
    var refunds = refundedSales.reduce(function (sum, sale) {
        return sum + sale.amount_eur;
    }, 0);
    var trafficSales = paidSales.filter(function (sale) {
        return sale.is_traffic;
    });
    var trafficRevenue = trafficSales.reduce(function (sum, sale) {
        return sum + sale.amount_eur;
    }, 0);
    var orders = paidSales.length;

    return {
        sales: orders,
        orders: orders,
        revenue_eur: Number(revenue.toFixed(2)),
        gross_revenue_eur: Number(revenue.toFixed(2)),
        refunds_eur: Number(refunds.toFixed(2)),
        net_revenue_eur: Number((revenue - refunds).toFixed(2)),
        aov_eur: orders > 0 ? Number((revenue / orders).toFixed(2)) : null,
        traffic_sales: trafficSales.length,
        traffic_revenue_eur: Number(trafficRevenue.toFixed(2)),
        other_sales: orders - trafficSales.length,
        other_revenue_eur: Number((revenue - trafficRevenue).toFixed(2)),
    };
}

function mergeSalesMetrics(primary, secondary) {
    var sales = (primary.sales || 0) + (secondary.sales || 0);
    var revenue = Number(((primary.revenue_eur || 0) + (secondary.revenue_eur || 0)).toFixed(2));
    var trafficSales = (primary.traffic_sales || 0) + (secondary.traffic_sales || 0);
    var trafficRevenue = Number(
        ((primary.traffic_revenue_eur || 0) + (secondary.traffic_revenue_eur || 0)).toFixed(2)
    );
    var refunds = Number(((primary.refunds_eur || 0) + (secondary.refunds_eur || 0)).toFixed(2));
    var gross = Number(((primary.gross_revenue_eur || primary.revenue_eur || 0) +
        (secondary.gross_revenue_eur || secondary.revenue_eur || 0)).toFixed(2));

    return {
        sales: sales,
        orders: sales,
        revenue_eur: revenue,
        gross_revenue_eur: gross,
        refunds_eur: refunds,
        net_revenue_eur: Number((gross - refunds).toFixed(2)),
        aov_eur: sales > 0 ? Number((revenue / sales).toFixed(2)) : null,
        traffic_sales: trafficSales,
        traffic_revenue_eur: trafficRevenue,
        other_sales: sales - trafficSales,
        other_revenue_eur: Number((revenue - trafficRevenue).toFixed(2)),
    };
}

function mergeSalesLists(hubSales, stripeSales) {
    var seen = {};
    var merged = [];

    hubSales.forEach(function (sale) {
        if (sale.payment_intent) {
            seen[sale.payment_intent] = true;
        }

        merged.push(sale);
    });

    stripeSales.forEach(function (sale) {
        if (sale.payment_intent && seen[sale.payment_intent]) {
            return;
        }

        merged.push(sale);
    });

    return merged.sort(function (a, b) {
        return String(b.created).localeCompare(String(a.created));
    });
}

module.exports = {
    extractAttributionFields: extractAttributionFields,
    orderRowToSale: orderRowToSale,
    fetchHubOrders: fetchHubOrders,
    groupOrdersByOfferSlug: groupOrdersByOfferSlug,
    summarizeOrderMetrics: summarizeOrderMetrics,
    mergeSalesMetrics: mergeSalesMetrics,
    mergeSalesLists: mergeSalesLists,
};
