'use strict';

var Stripe = require('stripe');
var stripeSales = require('../metrics/stripe-sales');
var salesReport = require('../metrics/sales-report');
var reportingRange = require('../metrics/reporting-range');
var timezone = require('../metrics/timezone');
var cache = require('../metrics/cache');
var offers = require('./offers');
var metaMetrics = require('./meta-metrics');
var orderMetrics = require('./order-metrics');

var OVERVIEW_TTL_MS = 60 * 1000;

function formatIsoDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function resolveHubMetricsRange(query) {
    var days = parseInt(query && query.days, 10);

    if (Number.isFinite(days) && days > 0) {
        var today = new Date();
        var fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        fromDate.setDate(fromDate.getDate() - days);

        return reportingRange.resolveReportingRange({
            from: formatIsoDate(fromDate),
            to: formatIsoDate(today),
        });
    }

    return reportingRange.resolveReportingRange(query || {});
}

function buildCheckoutToOfferMap(offerList) {
    var map = {};

    offerList.forEach(function (offer) {
        (offer.checkouts || []).forEach(function (checkout) {
            if (checkout.checkout_id) {
                map[checkout.checkout_id] = offer.slug;
            }
        });
    });

    return map;
}

function buildOfferIdMap(offerList) {
    var map = {};

    offerList.forEach(function (offer) {
        map[offer.id] = offer.slug;
    });

    return map;
}

function buildKnownSlugs(offerList) {
    var map = {};

    offerList.forEach(function (offer) {
        map[offer.slug] = true;
    });

    return map;
}

function resolveDefaultOfferSlug(offerList) {
    var active = offerList.find(function (offer) {
        return offer.status === 'active';
    });

    if (active) {
        return active.slug;
    }

    return offerList.length ? offerList[0].slug : 'onda-prodigio';
}

function resolvePaymentOfferSlug(paymentIntent, context) {
    var metadata = paymentIntent.metadata || {};
    var slug = offers.normalizeSlug(metadata.offer_slug || '');

    if (slug && context.knownSlugs[slug]) {
        return slug;
    }

    var offerId = String(metadata.offer_id || '').trim();

    if (offerId && context.idToSlug[offerId]) {
        return context.idToSlug[offerId];
    }

    var checkoutId = String(metadata.checkout || '').trim();

    if (checkoutId && context.checkoutToSlug[checkoutId]) {
        return context.checkoutToSlug[checkoutId];
    }

    if (salesReport.isDashboardSale(paymentIntent)) {
        return context.defaultSlug;
    }

    return null;
}

function paymentIntentToSale(paymentIntent) {
    var sale = salesReport.summarizeSale(paymentIntent);
    sale.amount_eur = salesReport.getOndaProdigioProductRevenueEur(paymentIntent);
    sale.is_traffic = salesReport.isTrafficSale(sale);
    return sale;
}

function summarizeSalesMetrics(sales) {
    var trafficSales = sales.filter(function (sale) {
        return sale.is_traffic;
    });
    var revenue = sales.reduce(function (sum, sale) {
        return sum + sale.amount_eur;
    }, 0);
    var trafficRevenue = trafficSales.reduce(function (sum, sale) {
        return sum + sale.amount_eur;
    }, 0);

    return {
        sales: sales.length,
        revenue_eur: Number(revenue.toFixed(2)),
        traffic_sales: trafficSales.length,
        traffic_revenue_eur: Number(trafficRevenue.toFixed(2)),
        other_sales: sales.length - trafficSales.length,
        other_revenue_eur: Number((revenue - trafficRevenue).toFixed(2)),
    };
}

function buildMetricsContext(offerList) {
    return {
        knownSlugs: buildKnownSlugs(offerList),
        idToSlug: buildOfferIdMap(offerList),
        checkoutToSlug: buildCheckoutToOfferMap(offerList),
        defaultSlug: resolveDefaultOfferSlug(offerList),
    };
}

function groupSalesByOffer(paymentIntents, context, offerList) {
    var buckets = {};
    var unassigned = [];

    offerList.forEach(function (offer) {
        buckets[offer.slug] = [];
    });

    paymentIntents.forEach(function (paymentIntent) {
        if (!salesReport.isDashboardSale(paymentIntent)) {
            return;
        }

        var sale = paymentIntentToSale(paymentIntent);
        var slug = resolvePaymentOfferSlug(paymentIntent, context);

        if (!slug || !buckets[slug]) {
            unassigned.push(sale);
            return;
        }

        buckets[slug].push(sale);
    });

    if (unassigned.length && buckets[context.defaultSlug]) {
        buckets[context.defaultSlug] = buckets[context.defaultSlug].concat(unassigned);
    }

    return buckets;
}

function buildRecentSales(allSales, offerNameBySlug, limit) {
    return allSales
        .slice()
        .sort(function (a, b) {
            return b.created.localeCompare(a.created);
        })
        .slice(0, limit || 12)
        .map(function (sale) {
            return {
                payment_intent: sale.payment_intent,
                created: sale.created,
                amount_eur: sale.amount_eur,
                email: sale.email,
                offer_slug: sale.offer_slug,
                offer_name: offerNameBySlug[sale.offer_slug] || sale.offer_slug,
                source: sale.source,
                source_label: sale.source_label,
                is_traffic: sale.is_traffic,
                campaign_name: sale.campaign_name,
            };
        });
}

async function fetchStripePaymentIntents(bounds, query) {
    var secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();

    if (!secretKey) {
        return {
            paymentIntents: [],
            stripe_configured: false,
        };
    }

    var stripe = new Stripe(secretKey);
    var paymentIntents = await stripeSales.fetchPaymentIntents(stripe, bounds);

    if (bounds.minTimestamp > 0 || Number.isFinite(bounds.maxTimestamp)) {
        paymentIntents = paymentIntents.filter(function (paymentIntent) {
            return paymentIntent.created >= bounds.minTimestamp &&
                paymentIntent.created <= bounds.maxTimestamp;
        });
    }

    return {
        paymentIntents: paymentIntents,
        stripe_configured: true,
    };
}

function enrichMetricsWithCommercial(metrics, metaForOffer) {
    var spend = metaForOffer ? metaForOffer.spend_eur : 0;
    var orders = metrics.orders || metrics.sales || 0;

    metrics.orders = orders;
    metrics.aov_eur = metrics.aov_eur != null
        ? metrics.aov_eur
        : (orders > 0 ? Number((metrics.revenue_eur / orders).toFixed(2)) : null);
    metrics.cpa_eur = metaMetrics.computeCpa(spend, orders);
    metrics.roas = metaMetrics.computeRoas(metrics.revenue_eur, spend);

    return metrics;
}

function buildOfferMetricsEntry(offer, hubSales, stripeSales, metaForOffer) {
    var mergedSales = orderMetrics.mergeSalesLists(hubSales, stripeSales);
    var hubSummary = orderMetrics.summarizeOrderMetrics(hubSales);
    var stripeSummary = summarizeSalesMetrics(stripeSales);
    var metrics = orderMetrics.mergeSalesMetrics(hubSummary, stripeSummary);

    enrichMetricsWithCommercial(metrics, metaForOffer);

    return Object.assign({
        id: offer.id,
        name: offer.name,
        slug: offer.slug,
        status: offer.status,
        meta_spend_eur: metaForOffer.spend_eur,
        meta_clicks: metaForOffer.clicks,
        meta_accounts_count: metaForOffer.accounts_count,
        epc: metaMetrics.computeEpc(metrics.revenue_eur, metaForOffer.clicks),
    }, metrics, {
        _merged_sales: mergedSales,
    });
}

async function buildHubMetricsOverview(query) {
    var bounds = resolveHubMetricsRange(query || {});
    var cacheKey = cache.getCacheKey([
        'hub-metrics-overview',
        bounds.from,
        bounds.to,
        String(query && query.days || '30'),
    ]);
    var cached = cache.getCached(cacheKey, OVERVIEW_TTL_MS);

    if (cached && String(query && query.refresh || '') !== '1') {
        return cached;
    }

    var offerList = await offers.listOffers();
    var publicOffers = offerList.map(function (offer) {
        return offers.toPublicOffer(offer);
    });
    var context = buildMetricsContext(offerList);
    var stripeResult = await fetchStripePaymentIntents(bounds, query || {});
    var hubOrdersResult = await orderMetrics.fetchHubOrders(bounds);
    var stripeBuckets = groupSalesByOffer(stripeResult.paymentIntents, context, offerList);
    var hubBuckets = orderMetrics.groupOrdersByOfferSlug(hubOrdersResult.orders, offerList);
    var metaPayload = await metaMetrics.buildMetaMetricsForOffers(offerList, bounds);
    var offerNameBySlug = {};

    publicOffers.forEach(function (offer) {
        offerNameBySlug[offer.slug] = offer.name;
    });

    var offerMetrics = publicOffers.map(function (offer) {
        var metaForOffer = (metaPayload.by_offer && metaPayload.by_offer[offer.slug]) || {
            spend_eur: 0,
            clicks: 0,
            impressions: 0,
            accounts_count: 0,
            accounts: [],
        };

        return buildOfferMetricsEntry(
            offer,
            hubBuckets[offer.slug] || [],
            stripeBuckets[offer.slug] || [],
            metaForOffer
        );
    });

    var allSales = [];

    offerMetrics.forEach(function (entry) {
        (entry._merged_sales || []).forEach(function (sale) {
            sale.offer_slug = entry.slug;
            allSales.push(sale);
        });
        delete entry._merged_sales;
    });

    var totals = orderMetrics.mergeSalesMetrics(
        orderMetrics.summarizeOrderMetrics(allSales.filter(function (sale) { return sale.is_hub_order; })),
        summarizeSalesMetrics(allSales.filter(function (sale) { return !sale.is_hub_order; }))
    );
    enrichMetricsWithCommercial(totals, metaPayload.totals);
    totals.active_offers = publicOffers.filter(function (offer) {
        return offer.status === 'active';
    }).length;
    totals.offers_count = publicOffers.length;
    totals.meta_spend_eur = metaPayload.totals.spend_eur;
    totals.meta_clicks = metaPayload.totals.clicks;
    totals.epc = metaMetrics.computeEpc(totals.revenue_eur, metaPayload.totals.clicks);

    var payload = {
        period: {
            from: bounds.from,
            to: bounds.to,
            timezone: bounds.timezone || timezone.getReportingTimezone(),
            days: parseInt(query && query.days, 10) || null,
        },
        totals: totals,
        offers: offerMetrics,
        meta: metaPayload,
        recent_sales: buildRecentSales(allSales, offerNameBySlug, 12),
        generated_at: new Date().toISOString(),
        stripe_configured: stripeResult.stripe_configured,
        hub_orders_configured: hubOrdersResult.configured,
    };

    cache.setCached(cacheKey, payload);
    return payload;
}

async function buildHubMetricsForOffer(slug, query) {
    var normalizedSlug = offers.normalizeSlug(slug);

    if (!normalizedSlug) {
        throw new Error('Oferta inválida.');
    }

    var offerRecord = await offers.getOfferBySlug(normalizedSlug);

    if (!offerRecord) {
        throw new Error('Oferta não encontrada.');
    }

    var bounds = resolveHubMetricsRange(query || {});
    var cacheKey = cache.getCacheKey([
        'hub-metrics-offer',
        normalizedSlug,
        bounds.from,
        bounds.to,
        String(query && query.days || '30'),
    ]);
    var cached = cache.getCached(cacheKey, OVERVIEW_TTL_MS);

    if (cached && String(query && query.refresh || '') !== '1') {
        return cached;
    }

    var offerList = await offers.listOffers();
    var context = buildMetricsContext(offerList);
    var stripeResult = await fetchStripePaymentIntents(bounds, query || {});
    var hubOrdersResult = await orderMetrics.fetchHubOrders(bounds);
    var stripeBuckets = groupSalesByOffer(stripeResult.paymentIntents, context, offerList);
    var hubBuckets = orderMetrics.groupOrdersByOfferSlug(hubOrdersResult.orders, offerList);
    var hubSales = hubBuckets[normalizedSlug] || [];
    var stripeSales = stripeBuckets[normalizedSlug] || [];
    var mergedSales = orderMetrics.mergeSalesLists(hubSales, stripeSales);
    var publicOffer = offers.toPublicOffer(offerRecord);
    var metaPayload = await metaMetrics.buildMetaMetricsForOffers(offerList, bounds);
    var metaForOffer = (metaPayload.by_offer && metaPayload.by_offer[normalizedSlug]) || {
        spend_eur: 0,
        clicks: 0,
        impressions: 0,
        accounts_count: 0,
        accounts: [],
    };
    var metrics = buildOfferMetricsEntry(
        publicOffer,
        hubSales,
        stripeSales,
        metaForOffer
    );
    delete metrics._merged_sales;

    var payload = {
        offer: {
            id: publicOffer.id,
            name: publicOffer.name,
            slug: publicOffer.slug,
            status: publicOffer.status,
            meta_accounts: publicOffer.meta_accounts || [],
        },
        period: {
            from: bounds.from,
            to: bounds.to,
            timezone: bounds.timezone || timezone.getReportingTimezone(),
            days: parseInt(query && query.days, 10) || null,
        },
        metrics: metrics,
        meta: metaForOffer,
        recent_sales: buildRecentSales(mergedSales.map(function (sale) {
            sale.offer_slug = normalizedSlug;
            return sale;
        }), {}, 8),
        generated_at: new Date().toISOString(),
        stripe_configured: stripeResult.stripe_configured,
        hub_orders_configured: hubOrdersResult.configured,
        meta_configured: metaPayload.configured,
    };

    cache.setCached(cacheKey, payload);
    return payload;
}

module.exports = {
    resolveHubMetricsRange: resolveHubMetricsRange,
    buildCheckoutToOfferMap: buildCheckoutToOfferMap,
    buildOfferIdMap: buildOfferIdMap,
    resolvePaymentOfferSlug: resolvePaymentOfferSlug,
    summarizeSalesMetrics: summarizeSalesMetrics,
    paymentIntentToSale: paymentIntentToSale,
    enrichMetricsWithCommercial: enrichMetricsWithCommercial,
    buildOfferMetricsEntry: buildOfferMetricsEntry,
    buildHubMetricsOverview: buildHubMetricsOverview,
    buildHubMetricsForOffer: buildHubMetricsForOffer,
};
