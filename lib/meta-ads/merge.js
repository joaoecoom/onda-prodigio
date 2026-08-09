var insights = require('./insights');

function indexStripeCampaigns(stripeCampaigns) {
    var map = {};

    (stripeCampaigns || []).forEach(function (campaign) {
        var keys = [
            insights.normalizeName(campaign.name),
            insights.normalizeName(campaign.campaign_id),
        ].filter(Boolean);

        keys.forEach(function (key) {
            if (!map[key]) {
                map[key] = {
                    stripe_sales: 0,
                    stripe_revenue_eur: 0,
                    stripe_campaign_name: campaign.name,
                };
            }

            map[key].stripe_sales += Number(campaign.sales || 0);
            map[key].stripe_revenue_eur = Number((map[key].stripe_revenue_eur + Number(campaign.revenue_eur || 0)).toFixed(2));
        });
    });

    return map;
}

function findStripeMatch(metaCampaign, stripeIndex) {
    var keys = [
        insights.normalizeName(metaCampaign.name),
        insights.normalizeName(metaCampaign.id),
        insights.normalizeName(metaCampaign.campaign_id),
    ].filter(Boolean);

    for (var i = 0; i < keys.length; i += 1) {
        if (stripeIndex[keys[i]]) {
            return stripeIndex[keys[i]];
        }
    }

    return {
        stripe_sales: 0,
        stripe_revenue_eur: 0,
        stripe_campaign_name: '',
    };
}

function mergeReports(stripeReport, metaReport) {
    var stripeIndex = indexStripeCampaigns(stripeReport && stripeReport.campaigns);
    var mergedCampaigns = (metaReport && metaReport.campaigns ? metaReport.campaigns : []).map(function (campaign) {
        var stripeMatch = findStripeMatch(campaign, stripeIndex);
        var roasReal = campaign.spend_eur > 0
            ? Number((stripeMatch.stripe_revenue_eur / campaign.spend_eur).toFixed(2))
            : null;

        return Object.assign({}, campaign, {
            stripe_sales: stripeMatch.stripe_sales,
            stripe_revenue_eur: stripeMatch.stripe_revenue_eur,
            stripe_campaign_name: stripeMatch.stripe_campaign_name,
            roas_real: roasReal,
        });
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
