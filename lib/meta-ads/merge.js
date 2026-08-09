var insights = require('./insights');

function emptyStripeMatch() {
    return {
        stripe_sales: 0,
        stripe_revenue_eur: 0,
    };
}

function addStripeTotals(target, addition) {
    target.stripe_sales += Number(addition.stripe_sales || 0);
    target.stripe_revenue_eur = Number((target.stripe_revenue_eur + Number(addition.stripe_revenue_eur || 0)).toFixed(2));
}

function indexStripeNodes(items, extraKeysFn) {
    var map = {};

    (items || []).forEach(function (item) {
        var stats = {
            stripe_sales: Number(item.sales || 0),
            stripe_revenue_eur: Number(item.revenue_eur || 0),
        };
        var keys = [
            insights.normalizeName(item.name),
            insights.normalizeName(item.campaign_id || item.adset_id || item.ad_id || item.key),
        ];

        if (typeof extraKeysFn === 'function') {
            keys = keys.concat(extraKeysFn(item) || []);
        }

        keys.filter(Boolean).forEach(function (key) {
            if (!map[key]) {
                map[key] = emptyStripeMatch();
            }

            addStripeTotals(map[key], stats);
        });
    });

    return map;
}

function findStripeMatch(node, maps) {
    var keys = [
        insights.normalizeName(node.name),
        insights.normalizeName(node.id),
        insights.normalizeName(node.campaign_id),
        insights.normalizeName(node.adset_id),
    ].filter(Boolean);

    for (var i = 0; i < keys.length; i += 1) {
        if (maps[keys[i]]) {
            return maps[keys[i]];
        }
    }

    return emptyStripeMatch();
}

function attachStripeMetrics(node, maps, level) {
    var stripeMatch = findStripeMatch(node, maps[level] || {});
    var roasReal = node.spend_eur > 0
        ? Number((stripeMatch.stripe_revenue_eur / node.spend_eur).toFixed(2))
        : null;
    var merged = Object.assign({}, node, {
        stripe_sales: stripeMatch.stripe_sales,
        stripe_revenue_eur: stripeMatch.stripe_revenue_eur,
        roas_real: roasReal,
    });

    if (merged.adsets) {
        merged.adsets = merged.adsets.map(function (adset) {
            return attachStripeMetrics(adset, maps, 'adset');
        });
    }

    if (merged.ads) {
        merged.ads = merged.ads.map(function (ad) {
            return attachStripeMetrics(ad, maps, 'ad');
        });
    }

    return merged;
}

function flattenStripeAds(stripeCampaigns) {
    var ads = [];
    var adsets = [];
    var campaigns = stripeCampaigns || [];

    campaigns.forEach(function (campaign) {
        (campaign.adsets || []).forEach(function (adset) {
            adsets.push(adset);
            (adset.ads || []).forEach(function (ad) {
                ads.push(ad);
            });
        });
    });

    return {
        campaign: campaigns,
        adset: adsets,
        ad: ads,
    };
}

function mergeReports(stripeReport, metaReport) {
    var stripeCampaigns = stripeReport && stripeReport.campaigns ? stripeReport.campaigns : [];
    var flattened = flattenStripeAds(stripeCampaigns);
    var maps = {
        campaign: indexStripeNodes(flattened.campaign),
        adset: indexStripeNodes(flattened.adset, function (item) {
            return [insights.normalizeName(item.adset_id)];
        }),
        ad: indexStripeNodes(flattened.ad, function (item) {
            return [
                insights.normalizeName(item.ad_id),
                insights.normalizeName(item.ad_label),
            ];
        }),
    };

    var mergedCampaigns = (metaReport && metaReport.campaigns ? metaReport.campaigns : []).map(function (campaign) {
        return attachStripeMetrics(campaign, maps, 'campaign');
    });

    var stripeSummary = stripeReport && stripeReport.summary ? stripeReport.summary : {};
    var metaSummary = metaReport && metaReport.summary ? metaReport.summary : {};

    return {
        account: metaReport ? metaReport.account : null,
        summary: {
            stripe_sales: stripeSummary.total_sales || 0,
            stripe_revenue_eur: stripeSummary.total_revenue_eur || 0,
            meta_spend_eur: metaSummary.spend_eur || 0,
            meta_spend_original: metaSummary.spend_original || 0,
            meta_currency: metaSummary.currency || 'EUR',
            meta_purchases: metaSummary.meta_purchases || 0,
            roas_real: metaSummary.spend_eur > 0
                ? Number(((stripeSummary.total_revenue_eur || 0) / metaSummary.spend_eur).toFixed(2))
                : null,
            timezone_name: metaSummary.timezone_name || '',
        },
        campaigns: mergedCampaigns,
    };
}

module.exports = {
    mergeReports: mergeReports,
};
