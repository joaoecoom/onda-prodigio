var client = require('./client');
var config = require('./config');
var exchange = require('./exchange');

var PURCHASE_ACTION_TYPES = {
    purchase: true,
    'offsite_conversion.fb_pixel_purchase': true,
    omni_purchase: true,
};

function normalizeName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function pickActionMetric(actions, allowedTypes) {
    if (!Array.isArray(actions)) {
        return 0;
    }

    var total = 0;

    actions.forEach(function (action) {
        if (allowedTypes[action.action_type]) {
            total += Number(action.value || 0);
        }
    });

    return total;
}

function mapInsightRow(row, accountCurrency) {
    var spendOriginal = Number(row.spend || 0);

    return {
        campaign_id: row.campaign_id || '',
        campaign_name: row.campaign_name || 'Sem nome',
        spend_original: Number(spendOriginal.toFixed(2)),
        spend_eur: exchange.convertToEur(spendOriginal, accountCurrency),
        currency: accountCurrency,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        meta_purchases: pickActionMetric(row.actions, PURCHASE_ACTION_TYPES),
        meta_purchase_value_eur: exchange.convertToEur(
            pickActionMetric(row.action_values, PURCHASE_ACTION_TYPES),
            accountCurrency
        ),
    };
}

async function getAccountDetails(accountId) {
    var actId = config.toActId(accountId);
    var configured = config.getAccountConfig(accountId);
    var body = await client.graphGet('/' + actId, {
        fields: 'id,account_id,name,currency,timezone_name,timezone_offset_hours_utc,account_status,business_name',
    });

    return {
        id: body.account_id || config.normalizeAccountId(accountId),
        act_id: actId,
        name: body.name || (configured && configured.label) || ('Conta ' + accountId),
        label: (configured && configured.label) || body.name || ('Conta ' + accountId),
        currency: body.currency || 'EUR',
        timezone_name: body.timezone_name || 'UTC',
        timezone_offset_hours_utc: body.timezone_offset_hours_utc,
        account_status: body.account_status,
        business_name: body.business_name || '',
    };
}

async function listCampaigns(accountId) {
    var actId = config.toActId(accountId);
    var campaigns = [];
    var nextUrl = null;
    var page = 0;

    while (page < 10) {
        var body = nextUrl
            ? await fetch(nextUrl).then(function (response) {
                return response.json();
            })
            : await client.graphGet('/' + actId + '/campaigns', {
                fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,updated_time',
                limit: 100,
            });

        campaigns = campaigns.concat(body.data || []);
        nextUrl = body.paging && body.paging.next ? body.paging.next : null;

        if (!nextUrl) {
            break;
        }

        page += 1;
    }

    return campaigns.map(function (campaign) {
        return {
            id: campaign.id,
            name: campaign.name || 'Sem nome',
            status: campaign.status || '',
            effective_status: campaign.effective_status || '',
            daily_budget: campaign.daily_budget ? Number(campaign.daily_budget) / 100 : null,
            lifetime_budget: campaign.lifetime_budget ? Number(campaign.lifetime_budget) / 100 : null,
            updated_time: campaign.updated_time || '',
        };
    });
}

async function getCampaignInsights(accountId, from, to) {
    var actId = config.toActId(accountId);
    var account = await getAccountDetails(accountId);
    var timeRange = JSON.stringify({
        since: from,
        until: to,
    });
    var insights = [];
    var nextUrl = null;
    var page = 0;

    while (page < 10) {
        var body = nextUrl
            ? await fetch(nextUrl).then(function (response) {
                return response.json();
            })
            : await client.graphGet('/' + actId + '/insights', {
                level: 'campaign',
                fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values',
                time_range: timeRange,
                limit: 100,
            });

        insights = insights.concat(body.data || []);
        nextUrl = body.paging && body.paging.next ? body.paging.next : null;

        if (!nextUrl) {
            break;
        }

        page += 1;
    }

    return {
        account: account,
        insights: insights.map(function (row) {
            return mapInsightRow(row, account.currency);
        }),
    };
}

async function getCampaignReport(accountId, from, to) {
    var accountDetails = await getAccountDetails(accountId);
    var campaigns = await listCampaigns(accountId);
    var insightBundle = await getCampaignInsights(accountId, from, to);
    var insightById = {};

    insightBundle.insights.forEach(function (row) {
        insightById[row.campaign_id] = row;
    });

    var rows = campaigns.map(function (campaign) {
        var insight = insightById[campaign.id] || {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            spend_original: 0,
            spend_eur: 0,
            currency: accountDetails.currency,
            impressions: 0,
            clicks: 0,
            meta_purchases: 0,
            meta_purchase_value_eur: 0,
        };

        return Object.assign({}, insight, {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            effective_status: campaign.effective_status,
            daily_budget: campaign.daily_budget,
            lifetime_budget: campaign.lifetime_budget,
            updated_time: campaign.updated_time,
            normalized_name: normalizeName(campaign.name),
        });
    });

    insightBundle.insights.forEach(function (insight) {
        var exists = rows.some(function (row) {
            return row.id === insight.campaign_id;
        });

        if (!exists) {
            rows.push({
                id: insight.campaign_id,
                name: insight.campaign_name,
                status: 'UNKNOWN',
                effective_status: 'UNKNOWN',
                normalized_name: normalizeName(insight.campaign_name),
                daily_budget: null,
                lifetime_budget: null,
                updated_time: '',
                spend_original: insight.spend_original,
                spend_eur: insight.spend_eur,
                currency: insight.currency,
                impressions: insight.impressions,
                clicks: insight.clicks,
                meta_purchases: insight.meta_purchases,
                meta_purchase_value_eur: insight.meta_purchase_value_eur,
            });
        }
    });

    var summary = rows.reduce(function (acc, row) {
        acc.spend_eur = Number((acc.spend_eur + row.spend_eur).toFixed(2));
        acc.spend_original = Number((acc.spend_original + row.spend_original).toFixed(2));
        acc.impressions += row.impressions;
        acc.clicks += row.clicks;
        acc.meta_purchases += row.meta_purchases;
        acc.meta_purchase_value_eur = Number((acc.meta_purchase_value_eur + row.meta_purchase_value_eur).toFixed(2));
        return acc;
    }, {
        spend_eur: 0,
        spend_original: 0,
        impressions: 0,
        clicks: 0,
        meta_purchases: 0,
        meta_purchase_value_eur: 0,
    });

    return {
        account: accountDetails,
        summary: Object.assign(summary, {
            currency: accountDetails.currency,
            timezone_name: accountDetails.timezone_name,
        }),
        campaigns: rows.sort(function (a, b) {
            return b.spend_eur - a.spend_eur;
        }),
    };
}

module.exports = {
    normalizeName: normalizeName,
    getAccountDetails: getAccountDetails,
    getCampaignReport: getCampaignReport,
};
