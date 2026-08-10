var metricsAuth = require('../lib/metrics/auth');
var stripeSales = require('../lib/metrics/stripe-sales');
var metaConfig = require('../lib/meta-ads/config');
var metaClient = require('../lib/meta-ads/client');
var metaInsights = require('../lib/meta-ads/insights');
var metaMerge = require('../lib/meta-ads/merge');
var metaStatus = require('../lib/meta-ads/status');
var metaCache = require('../lib/meta-ads/cache');

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string' && req.body.trim()) {
        return JSON.parse(req.body);
    }

    return {};
}

async function handleMetaHealth(res) {
    var tokenInfo = await metaClient.debugAccessToken();
    var accounts = metaConfig.getConfiguredAccounts();
    var accountChecks = [];

    if (tokenInfo.is_valid && tokenInfo.missing_scopes.length === 0) {
        for (var i = 0; i < accounts.length; i += 1) {
            try {
                var details = await metaInsights.getAccountDetails(accounts[i].id);
                accountChecks.push({
                    id: details.id,
                    label: accounts[i].label || details.name,
                    ok: true,
                    currency: details.currency,
                    timezone_name: details.timezone_name,
                });
            } catch (error) {
                accountChecks.push({
                    id: accounts[i].id,
                    label: accounts[i].label || ('Conta ' + accounts[i].id),
                    ok: false,
                    error: error.message,
                });
            }
        }
    }

    return res.status(200).json({
        meta_connection: Object.assign({}, tokenInfo, {
            ok: Boolean(tokenInfo.is_valid && !tokenInfo.missing_scopes.length),
        }),
        accounts: accounts,
        account_checks: accountChecks,
    });
}

async function handleMetaAccounts(res) {
    var tokenInfo = await metaClient.debugAccessToken();
    var configured = metaConfig.getConfiguredAccounts();
    var accounts = [];

    for (var i = 0; i < configured.length; i += 1) {
        var entry = configured[i];

        if (tokenInfo.is_valid && tokenInfo.missing_scopes.length === 0) {
            try {
                var details = await metaInsights.getAccountDetails(entry.id);
                accounts.push({
                    id: details.id,
                    label: entry.label || details.name,
                    name: details.name,
                    currency: details.currency,
                    timezone_name: details.timezone_name,
                    account_status: details.account_status,
                });
                continue;
            } catch (error) {
                accounts.push({
                    id: entry.id,
                    label: entry.label || ('Conta ' + entry.id),
                    error: error.message,
                });
                continue;
            }
        }

        accounts.push({
            id: entry.id,
            label: entry.label || ('Conta ' + entry.id),
        });
    }

    return res.status(200).json({
        meta_connection: tokenInfo,
        accounts: accounts,
    });
}

async function resolveDateRange(query) {
    var bounds = stripeSales.resolveDateBounds(query);
    var from = bounds.from;
    var to = bounds.to;

    if (!from || !to) {
        var today = new Date();
        var fallbackTo = today.toISOString().slice(0, 10);
        var fallbackFromDate = new Date(today);
        fallbackFromDate.setDate(fallbackFromDate.getDate() - 29);
        from = from || fallbackFromDate.toISOString().slice(0, 10);
        to = to || fallbackTo;
    }

    return { from: from, to: to };
}

function getActiveAccountId(query) {
    return metaConfig.normalizeAccountId(query.account_id) ||
        metaConfig.getConfiguredAccounts()[0].id;
}

function buildMetaConnection(hasToken, error) {
    return {
        has_token: hasToken,
        is_valid: hasToken && !error,
        ok: hasToken && !error,
        missing_scopes: [],
        error: error || '',
    };
}

async function handleCombined(req, res) {
    var accountId = getActiveAccountId(req.query);
    var dateRange = await resolveDateRange(req.query);
    var from = dateRange.from;
    var to = dateRange.to;
    var skipCache = String(req.query.refresh || '') === '1';
    var hasToken = Boolean(metaClient.getAccessToken());

    var metaPromise = hasToken && metaConfig.isAllowedAccountId(accountId)
        ? metaInsights.getCampaignReport(accountId, from, to, { skipCache: skipCache }).catch(function (error) {
            return { __error: error.message || 'Meta API falhou.' };
        })
        : Promise.resolve({
            __error: hasToken ? 'Conta Meta não autorizada.' : 'META_ACCESS_TOKEN em falta.',
        });

    var results = await Promise.all([
        stripeSales.buildStripeReport(req.query),
        metaPromise,
    ]);

    var stripeReport = results[0];
    var metaResult = results[1];
    var metaReport = null;
    var merged = null;
    var metaError = '';

    if (metaResult && metaResult.__error) {
        metaError = metaResult.__error;
    } else {
        metaReport = metaResult;
        merged = metaMerge.mergeReports(stripeReport, metaReport);
    }

    return res.status(200).json({
        stripe: stripeReport,
        meta: metaReport,
        merged: merged,
        meta_connection: buildMetaConnection(hasToken, metaError),
        date_range: {
            from: from,
            to: to,
        },
        accounts: metaConfig.getConfiguredAccounts(),
        active_account_id: accountId,
    });
}

async function handleMeta(req, res) {
    var accountId = getActiveAccountId(req.query);
    var dateRange = await resolveDateRange(req.query);
    var from = dateRange.from;
    var to = dateRange.to;
    var skipCache = String(req.query.refresh || '') === '1';
    var hasToken = Boolean(metaClient.getAccessToken());

    var stripeReport = await stripeSales.buildStripeReport(req.query);

    if (!hasToken) {
        return res.status(200).json({
            stripe: stripeReport,
            meta: null,
            merged: null,
            meta_connection: buildMetaConnection(false, 'META_ACCESS_TOKEN em falta.'),
            date_range: { from: from, to: to },
            accounts: metaConfig.getConfiguredAccounts(),
            active_account_id: accountId,
        });
    }

    if (!metaConfig.isAllowedAccountId(accountId)) {
        return res.status(200).json({
            stripe: stripeReport,
            meta: null,
            merged: null,
            meta_connection: buildMetaConnection(true, 'Conta Meta não autorizada.'),
            date_range: { from: from, to: to },
            accounts: metaConfig.getConfiguredAccounts(),
            active_account_id: accountId,
        });
    }

    try {
        var metaReport = await metaInsights.getCampaignReport(accountId, from, to, { skipCache: skipCache });
        var merged = metaMerge.mergeReports(stripeReport, metaReport);

        return res.status(200).json({
            stripe: stripeReport,
            meta: metaReport,
            merged: merged,
            meta_connection: buildMetaConnection(true, ''),
            date_range: { from: from, to: to },
            accounts: metaConfig.getConfiguredAccounts(),
            active_account_id: accountId,
        });
    } catch (error) {
        return res.status(200).json({
            stripe: stripeReport,
            meta: null,
            merged: null,
            meta_connection: buildMetaConnection(true, error.message || 'Meta API falhou.'),
            date_range: { from: from, to: to },
            accounts: metaConfig.getConfiguredAccounts(),
            active_account_id: accountId,
        });
    }
}

async function handleMetaStatus(req, res) {
    var body = await readJsonBody(req);

    try {
        var result = await metaStatus.updateObjectStatus(body);
        metaCache.clearAccountReports(result.account_id);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            error: error.message,
            meta: error.meta || null,
        });
    }
}

async function handleStripe(req, res) {
    try {
        var report = await stripeSales.buildStripeReport(req.query);
        return res.status(200).json(Object.assign({}, report, {
            accounts: metaConfig.getConfiguredAccounts(),
            active_account_id: getActiveAccountId(req.query),
        }));
    } catch (error) {
        console.error('Relatório Stripe falhou:', error);
        return res.status(500).json({
            error: error.message || 'Relatório falhou.',
        });
    }
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    var action = String(req.query.action || 'stripe').trim();

    if (req.method === 'POST') {
        if (action === 'meta_status') {
            return handleMetaStatus(req, res);
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        if (action === 'meta_health') {
            return handleMetaHealth(res);
        }

        if (action === 'meta_accounts') {
            return handleMetaAccounts(res);
        }

        if (action === 'combined') {
            return handleCombined(req, res);
        }

        if (action === 'meta') {
            return handleMeta(req, res);
        }

        return handleStripe(req, res);
    } catch (error) {
        console.error('API métricas falhou:', error);
        return res.status(500).json({
            error: error.message || 'Pedido falhou.',
        });
    }
};
