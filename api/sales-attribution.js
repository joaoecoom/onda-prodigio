var metricsAuth = require('../lib/metrics/auth');
var stripeSales = require('../lib/metrics/stripe-sales');
var metaConfig = require('../lib/meta-ads/config');
var metaClient = require('../lib/meta-ads/client');
var metaInsights = require('../lib/meta-ads/insights');
var metaMerge = require('../lib/meta-ads/merge');
var metaStatus = require('../lib/meta-ads/status');

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

async function handleCombined(req, res) {
    var accountId = metaConfig.normalizeAccountId(req.query.account_id) ||
        metaConfig.getConfiguredAccounts()[0].id;
    var bounds = stripeSales.resolveDateBounds(req.query);
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

    var stripeReport = await stripeSales.buildStripeReport(req.query);
    var tokenInfo = await metaClient.debugAccessToken();
    var metaReport = null;
    var merged = null;
    var metaError = '';

    if (tokenInfo.is_valid && tokenInfo.missing_scopes.length === 0) {
        try {
            if (!metaConfig.isAllowedAccountId(accountId)) {
                throw new Error('Conta Meta não autorizada.');
            }

            metaReport = await metaInsights.getCampaignReport(accountId, from, to);
            merged = metaMerge.mergeReports(stripeReport, metaReport);
        } catch (error) {
            metaError = error.message;
        }
    } else {
        metaError = tokenInfo.error || 'Token Meta inválido ou sem permissões ads_read/ads_management.';
    }

    return res.status(200).json({
        stripe: stripeReport,
        meta: metaReport,
        merged: merged,
        meta_connection: Object.assign({}, tokenInfo, {
            ok: Boolean(tokenInfo.is_valid && !tokenInfo.missing_scopes.length && !metaError),
            error: metaError,
        }),
        date_range: {
            from: from,
            to: to,
        },
        accounts: metaConfig.getConfiguredAccounts(),
        active_account_id: accountId,
    });
}

async function handleMetaStatus(req, res) {
    var body = await readJsonBody(req);

    try {
        var result = await metaStatus.updateObjectStatus(body);
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
        return res.status(200).json(report);
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

        return handleStripe(req, res);
    } catch (error) {
        console.error('API métricas falhou:', error);
        return res.status(500).json({
            error: error.message || 'Pedido falhou.',
        });
    }
};
