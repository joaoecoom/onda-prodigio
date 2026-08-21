'use strict';

var metaInsights = require('../meta-ads/insights');
var metaAccountsStore = require('./meta-accounts-store');

function emptyMetaTotals() {
    return {
        spend_eur: 0,
        clicks: 0,
        impressions: 0,
        accounts_count: 0,
    };
}

function buildUniqueAccountMap(offerList) {
    var map = {};

    offerList.forEach(function (offer) {
        (offer.meta_accounts || []).forEach(function (account) {
            var accountId = metaAccountsStore.normalizeAccountId(account.account_id);

            if (!accountId) {
                return;
            }

            if (!map[accountId]) {
                map[accountId] = {
                    account_id: accountId,
                    label: account.label || '',
                    offer_slugs: [],
                };
            }

            if (map[accountId].offer_slugs.indexOf(offer.slug) === -1) {
                map[accountId].offer_slugs.push(offer.slug);
            }

            if (!map[accountId].label && account.label) {
                map[accountId].label = account.label;
            }
        });
    });

    return map;
}

function hasMetaAccessToken() {
    return Boolean(
        String(process.env.META_ACCESS_TOKEN || process.env.META_ADS_ACCESS_TOKEN || '').trim()
    );
}

async function fetchAccountSummaries(accountMap, from, to) {
    var accountIds = Object.keys(accountMap);
    var results = {};

    await Promise.all(accountIds.map(async function (accountId) {
        try {
            var report = await metaInsights.getAccountSummaryReport(accountId, from, to, {
                skipCache: false,
            });
            var summary = report.summary || {};

            results[accountId] = {
                ok: true,
                account_id: accountId,
                label: (report.account && report.account.label) || accountMap[accountId].label || accountId,
                spend_eur: Number(summary.spend_eur || 0),
                clicks: Number(summary.clicks || 0),
                impressions: Number(summary.impressions || 0),
                offer_slugs: accountMap[accountId].offer_slugs,
            };
        } catch (error) {
            results[accountId] = {
                ok: false,
                account_id: accountId,
                label: accountMap[accountId].label || accountId,
                spend_eur: 0,
                clicks: 0,
                impressions: 0,
                offer_slugs: accountMap[accountId].offer_slugs,
                error: error.message || 'Meta API falhou.',
            };
        }
    }));

    return results;
}

function summarizeOfferMeta(offer, accountResults) {
    var spend = 0;
    var clicks = 0;
    var impressions = 0;
    var accounts = [];

    (offer.meta_accounts || []).forEach(function (account) {
        var accountId = metaAccountsStore.normalizeAccountId(account.account_id);
        var result = accountResults[accountId];

        if (!result) {
            return;
        }

        accounts.push({
            account_id: accountId,
            label: account.label || result.label || accountId,
            spend_eur: result.spend_eur,
            ok: result.ok,
            error: result.error || null,
        });

        if (result.ok) {
            spend += result.spend_eur;
            clicks += result.clicks;
            impressions += result.impressions;
        }
    });

    return {
        spend_eur: Number(spend.toFixed(2)),
        clicks: clicks,
        impressions: impressions,
        accounts: accounts,
        accounts_count: accounts.length,
    };
}

function computeRoas(revenueEur, spendEur) {
    var revenue = Number(revenueEur || 0);
    var spend = Number(spendEur || 0);

    if (!spend) {
        return null;
    }

    return Number((revenue / spend).toFixed(2));
}

function computeCpa(spendEur, orders) {
    var spend = Number(spendEur || 0);
    var orderCount = Number(orders || 0);

    if (!spend || !orderCount) {
        return null;
    }

    return Number((spend / orderCount).toFixed(2));
}

function computeEpc(revenueEur, clicks) {
    var revenue = Number(revenueEur || 0);
    var clickCount = Number(clicks || 0);

    if (!clickCount) {
        return null;
    }

    return Number((revenue / clickCount).toFixed(2));
}

async function buildMetaMetricsForOffers(offerList, bounds) {
    var accountMap = buildUniqueAccountMap(offerList);
    var accountIds = Object.keys(accountMap);

    if (!accountIds.length) {
        return {
            configured: false,
            has_token: hasMetaAccessToken(),
            totals: emptyMetaTotals(),
            by_offer: {},
            accounts: [],
        };
    }

    if (!hasMetaAccessToken()) {
        return {
            configured: false,
            has_token: false,
            totals: emptyMetaTotals(),
            by_offer: {},
            accounts: accountIds.map(function (accountId) {
                return {
                    account_id: accountId,
                    label: accountMap[accountId].label || accountId,
                    offer_slugs: accountMap[accountId].offer_slugs,
                    ok: false,
                    error: 'META_ACCESS_TOKEN em falta.',
                };
            }),
        };
    }

    var accountResults = await fetchAccountSummaries(accountMap, bounds.from, bounds.to);
    var byOffer = {};
    var totals = emptyMetaTotals();

    offerList.forEach(function (offer) {
        byOffer[offer.slug] = summarizeOfferMeta(offer, accountResults);
    });

    accountIds.forEach(function (accountId) {
        var result = accountResults[accountId];

        if (result && result.ok) {
            totals.spend_eur = Number((totals.spend_eur + result.spend_eur).toFixed(2));
            totals.clicks += result.clicks;
            totals.impressions += result.impressions;
            totals.accounts_count += 1;
        }
    });

    return {
        configured: true,
        has_token: true,
        totals: totals,
        by_offer: byOffer,
        accounts: accountIds.map(function (accountId) {
            return accountResults[accountId];
        }),
    };
}

module.exports = {
    buildUniqueAccountMap: buildUniqueAccountMap,
    buildMetaMetricsForOffers: buildMetaMetricsForOffers,
    computeRoas: computeRoas,
    computeCpa: computeCpa,
    computeEpc: computeEpc,
    summarizeOfferMeta: summarizeOfferMeta,
};
