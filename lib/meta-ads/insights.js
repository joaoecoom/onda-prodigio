var client = require('./client');
var config = require('./config');
var exchange = require('./exchange');
var metaCache = require('./cache');
var metricsTimezone = require('../metrics/timezone');

var PURCHASE_ACTION_TYPES = {
    purchase: true,
    'offsite_conversion.fb_pixel_purchase': true,
    omni_purchase: true,
};

var INITIATE_CHECKOUT_ACTION_TYPES = {
    initiate_checkout: true,
    'offsite_conversion.fb_pixel_initiate_checkout': true,
    omni_initiated_checkout: true,
};

var LANDING_PAGE_VIEW_ACTION_TYPES = {
    landing_page_view: true,
    omni_landing_page_view: true,
};

var INSIGHT_FIELDS = [
    'spend',
    'impressions',
    'clicks',
    'reach',
    'frequency',
    'cpc',
    'cpm',
    'ctr',
    'inline_link_clicks',
    'inline_link_click_ctr',
    'cost_per_inline_link_click',
    'actions',
    'action_values',
    'cost_per_action_type',
].join(',');

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

function pickCostPerAction(costPerActionType, allowedTypes) {
    if (!Array.isArray(costPerActionType)) {
        return null;
    }

    for (var i = 0; i < costPerActionType.length; i += 1) {
        var entry = costPerActionType[i];

        if (allowedTypes[entry.action_type]) {
            var value = Number(entry.value || 0);
            return Number.isFinite(value) ? value : null;
        }
    }

    return null;
}

function safeRatio(numerator, denominator, multiplier) {
    var base = Number(denominator || 0);

    if (!base) {
        return null;
    }

    return Number(((Number(numerator || 0) / base) * (multiplier || 1)).toFixed(2));
}

function emptyMetrics(accountCurrency) {
    return {
        spend_original: 0,
        spend_eur: 0,
        currency: accountCurrency,
        impressions: 0,
        clicks: 0,
        reach: 0,
        frequency: null,
        cpc_all: null,
        cpc_link: null,
        cpm: null,
        ctr_all: null,
        ctr_link: null,
        inline_link_clicks: 0,
        landing_page_views: 0,
        cost_per_landing_page_view: null,
        meta_purchases: 0,
        meta_purchase_value_eur: 0,
        meta_purchase_value_original: 0,
        initiate_checkout: 0,
        cost_per_purchase: null,
        cost_per_initiate_checkout: null,
    };
}

function mapInsightMetrics(row, accountCurrency) {
    var spendOriginal = Number(row.spend || 0);
    var spendEur = exchange.convertToEur(spendOriginal, accountCurrency);
    var impressions = Number(row.impressions || 0);
    var clicks = Number(row.clicks || 0);
    var inlineLinkClicks = Number(row.inline_link_clicks || 0);
    var landingPageViews = pickActionMetric(row.actions, LANDING_PAGE_VIEW_ACTION_TYPES);
    var initiateCheckout = pickActionMetric(row.actions, INITIATE_CHECKOUT_ACTION_TYPES);
    var metaPurchases = pickActionMetric(row.actions, PURCHASE_ACTION_TYPES);
    var metaPurchaseValueOriginal = pickActionMetric(row.action_values, PURCHASE_ACTION_TYPES);
    var costPerPurchase = pickCostPerAction(row.cost_per_action_type, PURCHASE_ACTION_TYPES);
    var costPerInitiateCheckout = pickCostPerAction(row.cost_per_action_type, INITIATE_CHECKOUT_ACTION_TYPES);
    var cpcAll = row.cpc ? Number(Number(row.cpc).toFixed(2)) : safeRatio(spendOriginal, clicks, 1);
    var cpcLink = row.cost_per_inline_link_click
        ? Number(Number(row.cost_per_inline_link_click).toFixed(2))
        : safeRatio(spendOriginal, inlineLinkClicks, 1);
    var cpm = row.cpm ? Number(Number(row.cpm).toFixed(2)) : safeRatio(spendOriginal, impressions, 1000);
    var costPerLandingPageView = safeRatio(spendOriginal, landingPageViews, 1);

    return {
        spend_original: Number(spendOriginal.toFixed(2)),
        spend_eur: spendEur,
        currency: accountCurrency,
        impressions: impressions,
        clicks: clicks,
        reach: Number(row.reach || 0),
        frequency: row.frequency ? Number(Number(row.frequency).toFixed(2)) : null,
        cpc_all: cpcAll,
        cpc_all_eur: safeRatio(spendEur, clicks, 1),
        cpc_link: cpcLink,
        cpc_link_eur: safeRatio(spendEur, inlineLinkClicks, 1),
        cpm: cpm,
        cpm_eur: safeRatio(spendEur, impressions, 1000),
        ctr_all: row.ctr ? Number(Number(row.ctr).toFixed(2)) : safeRatio(clicks, impressions, 100),
        ctr_link: row.inline_link_click_ctr
            ? Number(Number(row.inline_link_click_ctr).toFixed(2))
            : safeRatio(inlineLinkClicks, impressions, 100),
        inline_link_clicks: inlineLinkClicks,
        landing_page_views: landingPageViews,
        cost_per_landing_page_view: costPerLandingPageView,
        cost_per_landing_page_view_eur: safeRatio(spendEur, landingPageViews, 1),
        meta_purchases: metaPurchases,
        meta_purchase_value_eur: exchange.convertToEur(metaPurchaseValueOriginal, accountCurrency),
        meta_purchase_value_original: Number(metaPurchaseValueOriginal.toFixed(2)),
        initiate_checkout: initiateCheckout,
        cost_per_purchase: costPerPurchase,
        cost_per_purchase_eur: costPerPurchase !== null
            ? Number(exchange.convertToEur(costPerPurchase, accountCurrency).toFixed(2))
            : safeRatio(spendEur, metaPurchases, 1),
        cost_per_initiate_checkout: costPerInitiateCheckout,
        cost_per_initiate_checkout_eur: costPerInitiateCheckout !== null
            ? Number(exchange.convertToEur(costPerInitiateCheckout, accountCurrency).toFixed(2))
            : safeRatio(spendEur, initiateCheckout, 1),
    };
}

function sumNullableValues(values) {
    var filtered = values.filter(function (value) {
        return value !== null && value !== undefined && Number.isFinite(Number(value));
    });

    if (!filtered.length) {
        return null;
    }

    return Number((filtered.reduce(function (acc, value) {
        return acc + Number(value);
    }, 0) / filtered.length).toFixed(2));
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

async function listAdsetsForCampaign(campaignId) {
    return fetchPaginated(function () {
        return client.graphGet('/' + campaignId + '/adsets', {
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
                campaign_id: adset.campaign_id || campaignId,
                daily_budget: adset.daily_budget ? Number(adset.daily_budget) / 100 : null,
                lifetime_budget: adset.lifetime_budget ? Number(adset.lifetime_budget) / 100 : null,
                updated_time: adset.updated_time || '',
            };
        });
    });
}

async function listAdsForAdset(adsetId, campaignId) {
    return fetchPaginated(function () {
        return client.graphGet('/' + adsetId + '/ads', {
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
                adset_id: ad.adset_id || adsetId,
                campaign_id: ad.campaign_id || campaignId || '',
                updated_time: ad.updated_time || '',
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

function mergeActionLists(actionLists) {
    var totals = {};

    actionLists.forEach(function (actions) {
        (actions || []).forEach(function (action) {
            if (!action || !action.action_type) {
                return;
            }

            totals[action.action_type] = (totals[action.action_type] || 0) + Number(action.value || 0);
        });
    });

    return Object.keys(totals).map(function (actionType) {
        return {
            action_type: actionType,
            value: String(totals[actionType]),
        };
    });
}

function mergeInsightRows(rows) {
    var merged = {
        spend: 0,
        impressions: 0,
        clicks: 0,
        inline_link_clicks: 0,
        actions: [],
        action_values: [],
    };

    rows.forEach(function (row) {
        merged.spend += Number(row.spend || 0);
        merged.impressions += Number(row.impressions || 0);
        merged.clicks += Number(row.clicks || 0);
        merged.inline_link_clicks += Number(row.inline_link_clicks || 0);

        if (Array.isArray(row.actions)) {
            merged.actions.push(row.actions);
        }

        if (Array.isArray(row.action_values)) {
            merged.action_values.push(row.action_values);
        }
    });

    return {
        spend: String(Number(merged.spend.toFixed(2))),
        impressions: String(merged.impressions),
        clicks: String(merged.clicks),
        inline_link_clicks: String(merged.inline_link_clicks),
        actions: mergeActionLists(merged.actions),
        action_values: mergeActionLists(merged.action_values),
        reach: '0',
        frequency: null,
    };
}

function parseHourlyBucketStart(row) {
    var label = String(
        row.hourly_stats_aggregated_by_advertiser_time_zone ||
        row.hourly_stats_aggregated_by_audience_time_zone ||
        ''
    );
    var match = /(\d{2}):00:00/.exec(label);

    if (!match) {
        return null;
    }

    return Number(match[1]);
}

function getFieldsByLevel(level) {
    return {
        campaign: 'campaign_id,campaign_name,' + INSIGHT_FIELDS,
        adset: 'campaign_id,adset_id,adset_name,' + INSIGHT_FIELDS,
        ad: 'campaign_id,adset_id,ad_id,ad_name,' + INSIGHT_FIELDS,
    }[level];
}

function mapInsightRowByLevel(row, metrics, level) {
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
}

async function getInsightsByLevelHourly(accountId, from, to, level, accountCurrency, filterOptions) {
    var actId = config.toActId(accountId);
    var currency = accountCurrency || (await getAccountDetails(accountId)).currency;
    var timeRange = JSON.stringify({ since: from, until: to });
    var accountTimezone = filterOptions.accountTimezone;
    var startUnix = filterOptions.startUnix;
    var endUnix = filterOptions.endUnix;
    var idField = level === 'campaign' ? 'campaign_id' : (level === 'adset' ? 'adset_id' : 'ad_id');
    var rows = await fetchPaginated(function () {
        return client.graphGet('/' + actId + '/insights', {
            level: level,
            fields: getFieldsByLevel(level),
            time_range: timeRange,
            time_increment: 1,
            breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone',
            limit: 500,
        });
    });
    var grouped = {};

    rows.forEach(function (row) {
        var entityId = row[idField];
        var hour = parseHourlyBucketStart(row);
        var dateStart = row.date_start;

        if (!entityId || hour === null || !dateStart) {
            return;
        }

        var hourUnix = metricsTimezone.getHourStartUnix(dateStart, hour, accountTimezone);

        if (hourUnix < startUnix || hourUnix > endUnix) {
            return;
        }

        if (!grouped[entityId]) {
            grouped[entityId] = {
                template: row,
                rows: [],
            };
        }

        grouped[entityId].rows.push(row);
    });

    return Object.keys(grouped).map(function (entityId) {
        var entry = grouped[entityId];
        var mergedRow = mergeInsightRows(entry.rows);
        var metrics = mapInsightMetrics(mergedRow, currency);

        return mapInsightRowByLevel(entry.template, metrics, level);
    });
}

async function getInsightsByLevel(accountId, from, to, level, accountCurrency, filterOptions) {
    if (filterOptions && filterOptions.useHourlyFilter) {
        return getInsightsByLevelHourly(accountId, from, to, level, accountCurrency, filterOptions);
    }

    var actId = config.toActId(accountId);
    var currency = accountCurrency || (await getAccountDetails(accountId)).currency;
    var timeRange = JSON.stringify({ since: from, until: to });

    var rows = await fetchPaginated(function () {
        return client.graphGet('/' + actId + '/insights', {
            level: level,
            fields: getFieldsByLevel(level),
            time_range: timeRange,
            limit: 500,
        });
    });

    return rows.map(function (row) {
        var metrics = mapInsightMetrics(row, currency);

        return mapInsightRowByLevel(row, metrics, level);
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
    var summary = nodes.reduce(function (acc, node) {
        acc.spend_eur = Number((acc.spend_eur + node.spend_eur).toFixed(2));
        acc.spend_original = Number((acc.spend_original + node.spend_original).toFixed(2));
        acc.impressions += node.impressions;
        acc.clicks += node.clicks;
        acc.reach += node.reach;
        acc.inline_link_clicks += node.inline_link_clicks;
        acc.landing_page_views += node.landing_page_views;
        acc.meta_purchases += node.meta_purchases;
        acc.meta_purchase_value_eur = Number((acc.meta_purchase_value_eur + node.meta_purchase_value_eur).toFixed(2));
        acc.meta_purchase_value_original = Number((acc.meta_purchase_value_original + node.meta_purchase_value_original).toFixed(2));
        acc.initiate_checkout += node.initiate_checkout;
        acc.frequency_values.push(node.frequency);
        acc.ctr_all_values.push(node.ctr_all);
        acc.ctr_link_values.push(node.ctr_link);
        acc.cpc_all_values.push(node.cpc_all);
        acc.cpc_link_values.push(node.cpc_link);
        acc.cpm_values.push(node.cpm);
        acc.currency = accountCurrency;
        return acc;
    }, Object.assign(emptyMetrics(accountCurrency), {
        frequency_values: [],
        ctr_all_values: [],
        ctr_link_values: [],
        cpc_all_values: [],
        cpc_link_values: [],
        cpm_values: [],
    }));

    summary.frequency = sumNullableValues(summary.frequency_values);
    summary.ctr_all = safeRatio(summary.clicks, summary.impressions, 100);
    summary.ctr_link = safeRatio(summary.inline_link_clicks, summary.impressions, 100);
    summary.cpc_all = safeRatio(summary.spend_original, summary.clicks, 1);
    summary.cpc_all_eur = safeRatio(summary.spend_eur, summary.clicks, 1);
    summary.cpc_link = safeRatio(summary.spend_original, summary.inline_link_clicks, 1);
    summary.cpc_link_eur = safeRatio(summary.spend_eur, summary.inline_link_clicks, 1);
    summary.cpm = safeRatio(summary.spend_original, summary.impressions, 1000);
    summary.cpm_eur = safeRatio(summary.spend_eur, summary.impressions, 1000);
    summary.cost_per_landing_page_view = safeRatio(summary.spend_original, summary.landing_page_views, 1);
    summary.cost_per_landing_page_view_eur = safeRatio(summary.spend_eur, summary.landing_page_views, 1);
    summary.cost_per_purchase = safeRatio(summary.spend_original, summary.meta_purchases, 1);
    summary.cost_per_purchase_eur = safeRatio(summary.spend_eur, summary.meta_purchases, 1);
    summary.cost_per_initiate_checkout = safeRatio(summary.spend_original, summary.initiate_checkout, 1);
    summary.cost_per_initiate_checkout_eur = safeRatio(summary.spend_eur, summary.initiate_checkout, 1);

    delete summary.frequency_values;
    delete summary.ctr_all_values;
    delete summary.ctr_link_values;
    delete summary.cpc_all_values;
    delete summary.cpc_link_values;
    delete summary.cpm_values;

    return summary;
}

function sortBySpendDesc(items) {
    return items.sort(function (a, b) {
        return b.spend_eur - a.spend_eur;
    });
}

async function fillMissingStructure(campaignRows, adsetInsightRows, adInsightRows, empty) {
    var adsetInsightsById = indexById(adsetInsightRows);
    var adInsightsById = indexById(adInsightRows);
    var campaignsNeedingStructure = campaignRows.filter(function (campaign) {
        return !campaign.adsets.length;
    });

    if (!campaignsNeedingStructure.length) {
        return;
    }

    var adsetsByCampaign = await Promise.all(campaignsNeedingStructure.map(function (campaign) {
        return listAdsetsForCampaign(campaign.id).then(function (adsets) {
            return {
                campaignId: campaign.id,
                adsets: adsets,
            };
        });
    }));

    var allAdsets = [];

    adsetsByCampaign.forEach(function (entry) {
        allAdsets = allAdsets.concat(entry.adsets);
    });

    var adsByAdset = await Promise.all(allAdsets.map(function (adset) {
        return listAdsForAdset(adset.id, adset.campaign_id).then(function (ads) {
            return {
                adsetId: adset.id,
                ads: ads,
            };
        });
    }));

    var adsMap = {};

    adsByAdset.forEach(function (entry) {
        adsMap[entry.adsetId] = entry.ads;
    });

    campaignsNeedingStructure.forEach(function (campaign) {
        var entry = adsetsByCampaign.find(function (item) {
            return item.campaignId === campaign.id;
        });
        var adsetEntities = entry ? entry.adsets : [];

        campaign.adsets = adsetEntities.map(function (entity) {
            var node = buildEntityNode(entity, adsetInsightsById[entity.id] || empty, 'adset');
            node.ads = sortBySpendDesc((adsMap[entity.id] || []).map(function (ad) {
                return buildEntityNode(ad, adInsightsById[ad.id] || empty, 'ad');
            }));
            return node;
        });

        sortBySpendDesc(campaign.adsets);
    });
}

async function fillMissingAds(campaignRows, adInsightRows, empty) {
    var adInsightsById = indexById(adInsightRows);
    var adsetsNeedingAds = [];

    campaignRows.forEach(function (campaign) {
        campaign.adsets.forEach(function (adset) {
            if (!adset.ads.length) {
                adsetsNeedingAds.push(adset);
            }
        });
    });

    if (!adsetsNeedingAds.length) {
        return;
    }

    await Promise.all(adsetsNeedingAds.map(function (adset) {
        return listAdsForAdset(adset.id, adset.campaign_id).then(function (ads) {
            adset.ads = sortBySpendDesc(ads.map(function (ad) {
                return buildEntityNode(ad, adInsightsById[ad.id] || empty, 'ad');
            }));
        });
    }));
}

async function getCampaignReport(accountId, from, to, options) {
    var skipCache = options && options.skipCache;

    if (!skipCache) {
        var cached = metaCache.getCachedReport(accountId, from, to, metaCache.getReportTtl(from, to));

        if (cached) {
            return cached;
        }
    }

    var accountDetails = await getAccountDetails(accountId);
    var currency = accountDetails.currency;
    var empty = emptyMetrics(currency);
    var metaDateRange = metricsTimezone.resolveMetaDateRange(from, to, accountDetails.timezone_name);
    var metaFrom = metaDateRange.since;
    var metaTo = metaDateRange.until;
    var insightFilterOptions = metaDateRange.use_hourly_filter ? {
        useHourlyFilter: true,
        startUnix: metaDateRange.start_unix,
        endUnix: metaDateRange.end_unix,
        accountTimezone: metaDateRange.account_timezone,
    } : null;

    var results = await Promise.all([
        listCampaigns(accountId),
        getInsightsByLevel(accountId, metaFrom, metaTo, 'campaign', currency, insightFilterOptions),
        getInsightsByLevel(accountId, metaFrom, metaTo, 'adset', currency, insightFilterOptions),
        getInsightsByLevel(accountId, metaFrom, metaTo, 'ad', currency, insightFilterOptions),
    ]);

    var campaignEntities = indexById(results[0]);
    var campaignInsightRows = results[1];
    var adsetInsightRows = results[2];
    var adInsightRows = results[3];

    var statusResults = await Promise.all([
        client.batchFetchObjects(
            adsetInsightRows.map(function (row) {
                return row.id;
            }),
            'id,name,status,effective_status,campaign_id'
        ),
        client.batchFetchObjects(
            adInsightRows.map(function (row) {
                return row.id;
            }),
            'id,name,status,effective_status,adset_id,campaign_id'
        ),
    ]);
    var adsetStatusMap = statusResults[0];
    var adStatusMap = statusResults[1];

    var adsByAdset = {};

    adInsightRows.forEach(function (insight) {
        var entity = adStatusMap[insight.id] || {};
        var node = buildEntityNode({
            id: insight.id,
            name: entity.name || insight.name,
            status: entity.status || 'UNKNOWN',
            effective_status: entity.effective_status || 'UNKNOWN',
            adset_id: insight.adset_id,
            campaign_id: insight.campaign_id,
        }, insight, 'ad');

        if (!adsByAdset[insight.adset_id]) {
            adsByAdset[insight.adset_id] = [];
        }

        adsByAdset[insight.adset_id].push(node);
    });

    var adsetsByCampaign = {};

    adsetInsightRows.forEach(function (insight) {
        var entity = adsetStatusMap[insight.id] || {};
        var node = buildEntityNode({
            id: insight.id,
            name: entity.name || insight.name,
            status: entity.status || 'UNKNOWN',
            effective_status: entity.effective_status || 'UNKNOWN',
            campaign_id: insight.campaign_id,
        }, insight, 'adset');
        node.ads = (adsByAdset[insight.id] || []).sort(function (a, b) {
            return b.spend_eur - a.spend_eur;
        });

        if (!adsetsByCampaign[insight.campaign_id]) {
            adsetsByCampaign[insight.campaign_id] = [];
        }

        adsetsByCampaign[insight.campaign_id].push(node);
    });

    var campaignRows = campaignInsightRows.map(function (insight) {
        var entity = campaignEntities[insight.id] || {};
        var node = buildEntityNode({
            id: insight.id,
            name: entity.name || insight.name,
            status: entity.status || 'UNKNOWN',
            effective_status: entity.effective_status || 'UNKNOWN',
        }, insight, 'campaign');
        node.adsets = (adsetsByCampaign[insight.id] || []).sort(function (a, b) {
            return b.spend_eur - a.spend_eur;
        });
        return node;
    });

    results[0].forEach(function (entity) {
        var exists = campaignRows.some(function (row) {
            return row.id === entity.id;
        });

        if (!exists && String(entity.effective_status || entity.status).toUpperCase() === 'ACTIVE') {
            var node = buildEntityNode(entity, empty, 'campaign');
            node.adsets = [];
            campaignRows.push(node);
        }
    });

    sortBySpendDesc(campaignRows);

    campaignRows.forEach(function (campaign) {
        sortBySpendDesc(campaign.adsets);
        campaign.adsets.forEach(function (adset) {
            sortBySpendDesc(adset.ads);
        });
    });

    var summary = summarizeNodes(campaignRows, currency);
    var report = {
        account: accountDetails,
        summary: Object.assign(summary, {
            currency: currency,
            timezone_name: accountDetails.timezone_name,
        }),
        campaigns: campaignRows,
        date_range: metaDateRange,
    };

    metaCache.setCachedReport(accountId, from, to, report);
    return report;
}

module.exports = {
    normalizeName: normalizeName,
    getAccountDetails: getAccountDetails,
    getCampaignReport: getCampaignReport,
};
