var insights = require('./insights');
var exchange = require('./exchange');

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

function getStripeIndexKey(idValue, nameValue) {
    var id = insights.normalizeName(idValue);

    if (id) {
        return 'id:' + id;
    }

    return 'name:' + insights.normalizeName(nameValue);
}

function indexStripeNodes(items, idField, nameField, extraKeysFn) {
    var map = {};

    (items || []).forEach(function (item) {
        var stats = {
            stripe_sales: Number(item.sales || 0),
            stripe_revenue_eur: Number(item.revenue_eur || 0),
        };
        var keys = [
            getStripeIndexKey(item[idField], item[nameField] || item.name),
        ];

        if (typeof extraKeysFn === 'function') {
            keys = keys.concat(extraKeysFn(item) || []);
        }

        var seen = {};

        keys.filter(Boolean).forEach(function (key) {
            if (seen[key]) {
                return;
            }

            seen[key] = true;

            if (!map[key]) {
                map[key] = emptyStripeMatch();
            }

            addStripeTotals(map[key], stats);
        });
    });

    return map;
}

function findStripeMatch(node, map, level) {
    var keys = [];

    if (level === 'campaign') {
        keys = [
            getStripeIndexKey(node.id, ''),
            getStripeIndexKey(node.campaign_id, ''),
            getStripeIndexKey('', node.name),
        ];
    } else if (level === 'adset') {
        keys = [
            getStripeIndexKey(node.id, ''),
            getStripeIndexKey(node.adset_id, ''),
            getStripeIndexKey('', node.name),
        ];
    } else if (level === 'ad') {
        keys = [
            getStripeIndexKey(node.id, ''),
            getStripeIndexKey('', node.name),
        ];
    } else {
        keys = [
            getStripeIndexKey(node.id, ''),
            getStripeIndexKey('', node.name),
        ];
    }

    for (var i = 0; i < keys.length; i += 1) {
        if (keys[i] === 'name:' || keys[i] === 'id:') {
            continue;
        }

        if (map[keys[i]]) {
            return map[keys[i]];
        }
    }

    return emptyStripeMatch();
}

function sumStripeNodes(nodes) {
    return (nodes || []).reduce(function (acc, node) {
        addStripeTotals(acc, node);
        return acc;
    }, emptyStripeMatch());
}

function rollupStripeMetrics(node) {
    var merged = Object.assign({}, node);

    if (merged.adsets && merged.adsets.length) {
        merged.adsets = merged.adsets.map(rollupStripeMetrics);
        var adsetTotals = sumStripeNodes(merged.adsets);
        merged.stripe_sales = adsetTotals.stripe_sales;
        merged.stripe_revenue_eur = adsetTotals.stripe_revenue_eur;
    } else if (merged.ads && merged.ads.length) {
        merged.ads = merged.ads.map(rollupStripeMetrics);
        var adTotals = sumStripeNodes(merged.ads);
        merged.stripe_sales = adTotals.stripe_sales;
        merged.stripe_revenue_eur = adTotals.stripe_revenue_eur;
    }

    merged.roas_real = merged.spend_eur > 0
        ? Number((merged.stripe_revenue_eur / merged.spend_eur).toFixed(2))
        : null;

    return merged;
}

function attachStripeMetrics(node, maps, level) {
    var levelMap = maps[level] || {};
    var stripeMatch = findStripeMatch(node, levelMap, level);
    var merged = Object.assign({}, node, {
        stripe_sales: stripeMatch.stripe_sales,
        stripe_revenue_eur: stripeMatch.stripe_revenue_eur,
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

    return rollupStripeMetrics(merged);
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
        campaign: indexStripeNodes(flattened.campaign, 'campaign_id', 'name'),
        adset: indexStripeNodes(flattened.adset, 'adset_id', 'name'),
        ad: indexStripeNodes(flattened.ad, 'ad_id', 'name', function (item) {
            var primaryKey = getStripeIndexKey(item.ad_id, item.name);
            var labelKey = getStripeIndexKey('', item.ad_label);

            if (labelKey === 'name:' || labelKey === primaryKey) {
                return [];
            }

            return [labelKey];
        }),
    };

    var mergedCampaigns = (metaReport && metaReport.campaigns ? metaReport.campaigns : []).map(function (campaign) {
        return attachStripeMetrics(campaign, maps, 'campaign');
    });

    var stripeSummary = stripeReport && stripeReport.summary ? stripeReport.summary : {};
    var metaSummary = metaReport && metaReport.summary ? metaReport.summary : {};
    var metaCurrency = metaSummary.currency || 'EUR';

    return {
        account: metaReport ? metaReport.account : null,
        summary: {
            stripe_sales: stripeSummary.total_sales || 0,
            stripe_revenue_eur: stripeSummary.total_revenue_eur || 0,
            meta_spend_eur: metaSummary.spend_eur || 0,
            meta_spend_original: metaSummary.spend_original || 0,
            meta_currency: metaCurrency,
            meta_eur_per_unit: exchange.getEurPerUnit(metaCurrency),
            meta_purchases: metaSummary.meta_purchases || 0,
            meta_purchase_value_eur: metaSummary.meta_purchase_value_eur || 0,
            meta_purchase_value_original: metaSummary.meta_purchase_value_original || 0,
            impressions: metaSummary.impressions || 0,
            reach: metaSummary.reach || 0,
            frequency: metaSummary.frequency,
            clicks: metaSummary.clicks || 0,
            inline_link_clicks: metaSummary.inline_link_clicks || 0,
            landing_page_views: metaSummary.landing_page_views || 0,
            initiate_checkout: metaSummary.initiate_checkout || 0,
            ctr_all: metaSummary.ctr_all,
            ctr_link: metaSummary.ctr_link,
            cpc_all: metaSummary.cpc_all,
            cpc_link: metaSummary.cpc_link,
            cpm: metaSummary.cpm,
            cost_per_landing_page_view: metaSummary.cost_per_landing_page_view,
            cost_per_purchase: metaSummary.cost_per_purchase,
            cost_per_initiate_checkout: metaSummary.cost_per_initiate_checkout,
            roas_real: metaSummary.spend_eur > 0
                ? Number(((stripeSummary.total_revenue_eur || 0) / metaSummary.spend_eur).toFixed(2))
                : null,
            timezone_name: metaSummary.timezone_name || '',
        },
        date_range: metaReport && metaReport.date_range ? metaReport.date_range : null,
        campaigns: mergedCampaigns,
    };
}

module.exports = {
    mergeReports: mergeReports,
};
