var client = require('./client');
var config = require('./config');
var exchange = require('./exchange');

var PURCHASE_ACTION_TYPES = {
    purchase: true,
    'offsite_conversion.fb_pixel_purchase': true,
    omni_purchase: true,
};

var INSIGHT_FIELDS = 'spend,impressions,clicks,actions,action_values';

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

function emptyMetrics(accountCurrency) {
    return {
        spend_original: 0,
        spend_eur: 0,
        currency: accountCurrency,
        impressions: 0,
        clicks: 0,
        meta_purchases: 0,
        meta_purchase_value_eur: 0,
    };
}

function mapInsightMetrics(row, accountCurrency) {
    var spendOriginal = Number(row.spend || 0);

    return {
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

async function fetchPaginated(initialFetch) {
    var items = [];
    var nextUrl = null;
    var page = 0;

    while (page < 10) {
        var body = nextUrl
            ? await fetch(nextUrl).then(function (response) {
                return response.json();
            })
            : await initialFetch();

        if (body.error) {
            throw new Error(body.error.message || 'Meta API falhou.');
        }

        items = items.concat(body.data || []);
        nextUrl = body.paging && body.paging.next ? body.paging.next : null;

        if (!nextUrl) {
            break;
        }

        page += 1;
    }

    return items;
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

    return fetchPaginated(function () {
        return client.graphGet('/' + actId + '/campaigns', {
            fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,updated_time',
            limit: 100,
        });
    }).then(function (rows) {
        return rows.map(function (campaign) {
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
    });
}

async function listAdsets(accountId) {
    var actId = config.toActId(accountId);

    return fetchPaginated(function () {
        return client.graphGet('/' + actId + '/adsets', {
            fields: 'id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,updated_time',
            limit: 100,
        });
    }).then(function (rows) {
        return rows.map(function (adset) {
            return {
                id: adset.id,
                name: adset.name || 'Sem conjunto',
                status: adset.status || '',
                effective_status: adset.effective_status || '',
                campaign_id: adset.campaign_id || '',
                daily_budget: adset.daily_budget ? Number(adset.daily_budget) / 100 : null,
                lifetime_budget: adset.lifetime_budget ? Number(adset.lifetime_budget) / 100 : null,
                updated_time: adset.updated_time || '',
            };
        });
    });
}

async function listAds(accountId) {
    var actId = config.toActId(accountId);

    return fetchPaginated(function () {
        return client.graphGet('/' + actId + '/ads', {
            fields: 'id,name,status,effective_status,adset_id,campaign_id,updated_time',
            limit: 100,
        });
    }).then(function (rows) {
        return rows.map(function (ad) {
            return {
                id: ad.id,
                name: ad.name || 'Sem anúncio',
                status: ad.status || '',
                effective_status: ad.effective_status || '',
                adset_id: ad.adset_id || '',
                campaign_id: ad.campaign_id || '',
                updated_time: ad.updated_time || '',
            };
        });
    });
}

function indexValues(map) {
    return Object.keys(map || {}).map(function (key) {
        return map[key];
    });
}

async function getInsightsByLevel(accountId, from, to, level, accountCurrency) {
    var actId = config.toActId(accountId);
    var currency = accountCurrency || (await getAccountDetails(accountId)).currency;
    var timeRange = JSON.stringify({ since: from, until: to });
    var fieldsByLevel = {
        campaign: 'campaign_id,campaign_name,' + INSIGHT_FIELDS,
        adset: 'campaign_id,adset_id,adset_name,' + INSIGHT_FIELDS,
        ad: 'campaign_id,adset_id,ad_id,ad_name,' + INSIGHT_FIELDS,
    };

    var rows = await fetchPaginated(function () {
        return client.graphGet('/' + actId + '/insights', {
            level: level,
            fields: fieldsByLevel[level],
            time_range: timeRange,
            limit: 500,
        });
    });

    return rows.map(function (row) {
        var metrics = mapInsightMetrics(row, currency);

        if (level === 'campaign') {
            return Object.assign(metrics, {
                id: row.campaign_id,
                name: row.campaign_name || 'Sem nome',
            });
        }

        if (level === 'adset') {
            return Object.assign(metrics, {
                id: row.adset_id,
                name: row.adset_name || 'Sem conjunto',
                campaign_id: row.campaign_id || '',
            });
        }

        return Object.assign(metrics, {
            id: row.ad_id,
            name: row.ad_name || 'Sem anúncio',
            adset_id: row.adset_id || '',
            campaign_id: row.campaign_id || '',
        });
    });
}

function indexById(rows) {
    var map = {};

    rows.forEach(function (row) {
        map[row.id] = row;
    });

    return map;
}

function buildEntityNode(entity, metrics, objectType) {
    return Object.assign({}, metrics, {
        id: entity.id,
        name: entity.name,
        status: entity.status,
        effective_status: entity.effective_status,
        object_type: objectType,
        normalized_name: normalizeName(entity.name),
        campaign_id: entity.campaign_id || '',
        adset_id: entity.adset_id || '',
    });
}

function summarizeNodes(nodes, accountCurrency) {
    return nodes.reduce(function (acc, node) {
        acc.spend_eur = Number((acc.spend_eur + node.spend_eur).toFixed(2));
        acc.spend_original = Number((acc.spend_original + node.spend_original).toFixed(2));
        acc.impressions += node.impressions;
        acc.clicks += node.clicks;
        acc.meta_purchases += node.meta_purchases;
        acc.meta_purchase_value_eur = Number((acc.meta_purchase_value_eur + node.meta_purchase_value_eur).toFixed(2));
        acc.currency = accountCurrency;
        return acc;
    }, emptyMetrics(accountCurrency));
}

async function getCampaignReport(accountId, from, to) {
    var accountDetails = await getAccountDetails(accountId);
    var currency = accountDetails.currency;
    var empty = emptyMetrics(currency);

    var results = await Promise.all([
        listCampaigns(accountId),
        listAdsets(accountId),
        listAds(accountId),
        getInsightsByLevel(accountId, from, to, 'campaign', currency),
        getInsightsByLevel(accountId, from, to, 'adset', currency),
        getInsightsByLevel(accountId, from, to, 'ad', currency),
    ]);

    var campaigns = results[0];
    var adsets = results[1];
    var ads = results[2];
    var campaignInsights = indexById(results[3]);
    var adsetInsights = indexById(results[4]);
    var adInsights = indexById(results[5]);

    var adsByAdset = {};
    var adsetsByCampaign = {};

    ads.forEach(function (ad) {
        var metrics = adInsights[ad.id] || empty;
        var node = buildEntityNode(ad, metrics, 'ad');

        if (!adsByAdset[ad.adset_id]) {
            adsByAdset[ad.adset_id] = [];
        }

        adsByAdset[ad.adset_id].push(node);
    });

    adsets.forEach(function (adset) {
        var metrics = adsetInsights[adset.id] || empty;
        var node = buildEntityNode(adset, metrics, 'adset');
        node.ads = (adsByAdset[adset.id] || []).sort(function (a, b) {
            return b.spend_eur - a.spend_eur;
        });

        if (!adsetsByCampaign[adset.campaign_id]) {
            adsetsByCampaign[adset.campaign_id] = [];
        }

        adsetsByCampaign[adset.campaign_id].push(node);
    });

    var campaignRows = campaigns.map(function (campaign) {
        var metrics = campaignInsights[campaign.id] || empty;
        var node = buildEntityNode(campaign, metrics, 'campaign');
        node.adsets = (adsetsByCampaign[campaign.id] || []).sort(function (a, b) {
            return b.spend_eur - a.spend_eur;
        });
        return node;
    });

    indexValues(adsetInsights).forEach(function (insight) {
        var campaign = campaignRows.find(function (row) {
            return row.id === insight.campaign_id;
        });

        if (!campaign) {
            return;
        }

        var exists = campaign.adsets.some(function (adset) {
            return adset.id === insight.id;
        });

        if (!exists) {
            campaign.adsets.push(buildEntityNode({
                id: insight.id,
                name: insight.name,
                status: 'UNKNOWN',
                effective_status: 'UNKNOWN',
                campaign_id: insight.campaign_id,
            }, insight, 'adset'));
        }
    });

    indexValues(adInsights).forEach(function (insight) {
        var campaign = campaignRows.find(function (row) {
            return row.id === insight.campaign_id;
        });

        if (!campaign) {
            return;
        }

        var adset = campaign.adsets.find(function (row) {
            return row.id === insight.adset_id;
        });

        if (!adset) {
            adset = buildEntityNode({
                id: insight.adset_id,
                name: 'Conjunto ' + insight.adset_id,
                status: 'UNKNOWN',
                effective_status: 'UNKNOWN',
                campaign_id: insight.campaign_id,
            }, empty, 'adset');
            adset.ads = [];
            campaign.adsets.push(adset);
        }

        var adExists = adset.ads.some(function (ad) {
            return ad.id === insight.id;
        });

        if (!adExists) {
            adset.ads.push(buildEntityNode({
                id: insight.id,
                name: insight.name,
                status: 'UNKNOWN',
                effective_status: 'UNKNOWN',
                adset_id: insight.adset_id,
                campaign_id: insight.campaign_id,
            }, insight, 'ad'));
        }
    });

    indexValues(campaignInsights).forEach(function (insight) {
        var exists = campaignRows.some(function (row) {
            return row.id === insight.id;
        });

        if (!exists) {
            campaignRows.push(buildEntityNode({
                id: insight.id,
                name: insight.name,
                status: 'UNKNOWN',
                effective_status: 'UNKNOWN',
            }, insight, 'campaign'));
            campaignRows[campaignRows.length - 1].adsets = [];
        }
    });

    campaignRows.sort(function (a, b) {
        return b.spend_eur - a.spend_eur;
    });

    campaignRows.forEach(function (campaign) {
        campaign.adsets.sort(function (a, b) {
            return b.spend_eur - a.spend_eur;
        });
        campaign.adsets.forEach(function (adset) {
            adset.ads.sort(function (a, b) {
                return b.spend_eur - a.spend_eur;
            });
        });
    });

    var summary = summarizeNodes(campaignRows, currency);

    return {
        account: accountDetails,
        summary: Object.assign(summary, {
            currency: currency,
            timezone_name: accountDetails.timezone_name,
        }),
        campaigns: campaignRows,
    };
}

module.exports = {
    normalizeName: normalizeName,
    getAccountDetails: getAccountDetails,
    getCampaignReport: getCampaignReport,
};
