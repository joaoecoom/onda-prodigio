var attribution = require('../tracking/attribution');

function parseOrderBumps(rawValue) {
    if (!rawValue) {
        return [];
    }

    return String(rawValue)
        .split(',')
        .map(function (item) {
            return item.trim();
        })
        .filter(Boolean);
}

function isLiveStripeSale(paymentIntent) {
    var metadata = paymentIntent.metadata || {};

    if (paymentIntent.status !== 'succeeded') {
        return false;
    }

    if (metadata.stripe_mode === 'test' || metadata.checkout === 'checkout9-test') {
        return false;
    }

    return true;
}

function isLiveCheckoutSale(paymentIntent) {
    var metadata = paymentIntent.metadata || {};

    return isLiveStripeSale(paymentIntent) && metadata.checkout === 'checkout9';
}

function isOndaProdigioProductSale(paymentIntent) {
    if (!isLiveStripeSale(paymentIntent)) {
        return false;
    }

    var metadata = paymentIntent.metadata || {};

    if (metadata.checkout !== 'checkout9') {
        return false;
    }

    if (metadata.upsell || metadata.parent_payment_intent) {
        return false;
    }

    if (metadata.checkout_type === 'standalone') {
        return false;
    }

    return true;
}

function getOndaProdigioProductRevenueEur(paymentIntent) {
    return Number((Number(paymentIntent.amount || 0) / 100).toFixed(2));
}

function getSaleSource(metadata) {
    metadata = metadata || {};

    if (metadata.checkout === 'checkout9') {
        return 'funil';
    }

    if (
        metadata.checkout_type === 'standalone' ||
        String(metadata.checkout || '').indexOf('comprar-') === 0
    ) {
        return 'comunidade';
    }

    if (metadata.upsell || metadata.parent_payment_intent) {
        return 'upsell';
    }

    return 'outro';
}

function getSaleSourceLabel(source) {
    if (source === 'funil') {
        return 'Funil';
    }

    if (source === 'comunidade') {
        return 'Comunidade';
    }

    if (source === 'upsell') {
        return 'Upsell';
    }

    return 'Outro';
}

function isTrafficSale(sale) {
    if (sale.source === 'funil' || sale.source === 'upsell') {
        return true;
    }

    if (sale.utm_source === 'facebook' || sale.utm_medium === 'paid') {
        return true;
    }

    return sale.has_attribution && sale.campaign_name !== 'Desconhecido';
}

function summarizeSale(paymentIntent) {
    var metadata = paymentIntent.metadata || {};
    var campaignName = metadata.campaign_name || metadata.utm_campaign || '';
    var adsetName = metadata.adset_name || metadata.utm_term || '';
    var adsetId = metadata.adset_id || '';
    var adName = metadata.ad_name || metadata.utm_content || '';
    var adId = metadata.ad_id || '';
    var source = getSaleSource(metadata);
    var hasAttribution = Boolean(
        campaignName ||
        adsetName ||
        adsetId ||
        adName ||
        adId ||
        metadata.fbc ||
        metadata.fbclid
    );

    return {
        payment_intent: paymentIntent.id,
        created: new Date(paymentIntent.created * 1000).toISOString(),
        amount_eur: Number((paymentIntent.amount / 100).toFixed(2)),
        email: metadata.email || paymentIntent.receipt_email || '',
        campaign_name: campaignName || 'Desconhecido',
        campaign_id: metadata.campaign_id || '',
        adset_name: adsetName || (adsetId ? 'Conjunto ' + adsetId : 'Sem conjunto'),
        adset_id: adsetId,
        ad_name: adName || 'Desconhecido',
        ad_id: adId,
        ad_label: attribution.getPrimaryAdLabel(metadata) || 'Desconhecido',
        utm_source: metadata.utm_source || '',
        utm_medium: metadata.utm_medium || '',
        utm_campaign: metadata.utm_campaign || '',
        utm_content: metadata.utm_content || '',
        order_bumps: parseOrderBumps(metadata.order_bumps),
        has_attribution: hasAttribution,
        has_fbc: Boolean(metadata.fbc),
        source: source,
        source_label: getSaleSourceLabel(source),
        checkout: metadata.checkout || '',
        product_id: metadata.product_id || metadata.upsell || '',
        is_traffic: false,
    };
}

function makeGroupKey(parts) {
    return parts
        .map(function (part) {
            return String(part || '').trim().toLowerCase();
        })
        .filter(Boolean)
        .join('::') || 'desconhecido';
}

function ensureCampaign(groups, sale) {
    var campaignKey = makeGroupKey([sale.campaign_id, sale.campaign_name]);

    if (!groups[campaignKey]) {
        groups[campaignKey] = {
            key: campaignKey,
            name: sale.campaign_name,
            campaign_id: sale.campaign_id,
            sales: 0,
            revenue_eur: 0,
            adsets: {},
        };
    }

    return groups[campaignKey];
}

function ensureAdset(campaign, sale) {
    var adsetKey = makeGroupKey([sale.adset_id, sale.adset_name]);

    if (!campaign.adsets[adsetKey]) {
        campaign.adsets[adsetKey] = {
            key: adsetKey,
            name: sale.adset_name,
            adset_id: sale.adset_id,
            sales: 0,
            revenue_eur: 0,
            ads: {},
        };
    }

    return campaign.adsets[adsetKey];
}

function ensureAd(adset, sale) {
    var adKey = makeGroupKey([sale.ad_id, sale.ad_name, sale.ad_label]);

    if (!adset.ads[adKey]) {
        adset.ads[adKey] = {
            key: adKey,
            name: sale.ad_name !== 'Desconhecido' ? sale.ad_name : sale.ad_label,
            ad_id: sale.ad_id,
            ad_label: sale.ad_label,
            sales: 0,
            revenue_eur: 0,
        };
    }

    return adset.ads[adKey];
}

function addTotals(group, sale) {
    group.sales += 1;
    group.revenue_eur = Number((group.revenue_eur + sale.amount_eur).toFixed(2));
}

function sortBySalesDesc(items) {
    return items.sort(function (a, b) {
        if (b.sales !== a.sales) {
            return b.sales - a.sales;
        }

        return b.revenue_eur - a.revenue_eur;
    });
}

function buildHierarchy(sales) {
    var campaigns = {};

    sales.forEach(function (sale) {
        var campaign = ensureCampaign(campaigns, sale);
        var adset = ensureAdset(campaign, sale);
        var ad = ensureAd(adset, sale);

        addTotals(campaign, sale);
        addTotals(adset, sale);
        addTotals(ad, sale);
    });

    return sortBySalesDesc(Object.values(campaigns).map(function (campaign) {
        return {
            key: campaign.key,
            name: campaign.name,
            campaign_id: campaign.campaign_id,
            sales: campaign.sales,
            revenue_eur: campaign.revenue_eur,
            adsets: sortBySalesDesc(Object.values(campaign.adsets).map(function (adset) {
                return {
                    key: adset.key,
                    name: adset.name,
                    adset_id: adset.adset_id,
                    sales: adset.sales,
                    revenue_eur: adset.revenue_eur,
                    ads: sortBySalesDesc(Object.values(adset.ads)),
                };
            })),
        };
    }));
}

function buildReport(paymentIntents) {
    var sales = paymentIntents
        .filter(isOndaProdigioProductSale)
        .map(function (paymentIntent) {
            var sale = summarizeSale(paymentIntent);
            sale.amount_eur = getOndaProdigioProductRevenueEur(paymentIntent);
            sale.is_traffic = isTrafficSale(sale);
            return sale;
        })
        .sort(function (a, b) {
            return b.created.localeCompare(a.created);
        });

    var trafficSales = sales.filter(function (sale) {
        return sale.is_traffic;
    });

    var attributedSales = sales.filter(function (sale) {
        return sale.has_attribution && sale.campaign_name !== 'Desconhecido';
    }).length;

    var totalRevenue = sales.reduce(function (sum, sale) {
        return sum + sale.amount_eur;
    }, 0);

    var trafficRevenue = trafficSales.reduce(function (sum, sale) {
        return sum + sale.amount_eur;
    }, 0);

    var otherSalesCount = sales.length - trafficSales.length;
    var otherRevenue = Number((totalRevenue - trafficRevenue).toFixed(2));

    return {
        summary: {
            total_sales: sales.length,
            total_revenue_eur: Number(totalRevenue.toFixed(2)),
            traffic_sales: trafficSales.length,
            traffic_revenue_eur: Number(trafficRevenue.toFixed(2)),
            other_sales: otherSalesCount,
            other_revenue_eur: otherRevenue,
            attributed_sales: attributedSales,
            unknown_sales: sales.length - attributedSales,
            with_fbc: sales.filter(function (sale) {
                return sale.has_fbc;
            }).length,
            generated_at: new Date().toISOString(),
        },
        campaigns: buildHierarchy(sales),
        traffic_campaigns: buildHierarchy(trafficSales),
        recent_sales: sales.slice(0, 50),
        note: 'Apenas vendas do produto Onda Prodígio (checkout9), sem upsells pós-compra, comunidade nem outros produtos. Receita = total cobrado no Stripe (produto + order bumps do checkout). «Tráfego» = UTMs Meta ou funil pago.',
    };
}

module.exports = {
    summarizeSale: summarizeSale,
    isLiveStripeSale: isLiveStripeSale,
    isLiveCheckoutSale: isLiveCheckoutSale,
    isOndaProdigioProductSale: isOndaProdigioProductSale,
    getOndaProdigioProductRevenueEur: getOndaProdigioProductRevenueEur,
    isTrafficSale: isTrafficSale,
    getSaleSource: getSaleSource,
    buildReport: buildReport,
};
