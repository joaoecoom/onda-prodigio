var metricsAuth = require('../lib/metrics/auth');
var stripeSales = require('../lib/metrics/stripe-sales');
var metaConfig = require('../lib/meta-ads/config');
var metaClient = require('../lib/meta-ads/client');
var metaInsights = require('../lib/meta-ads/insights');
var metaMerge = require('../lib/meta-ads/merge');
var metaStatus = require('../lib/meta-ads/status');
var metaCache = require('../lib/meta-ads/cache');
var adminMembers = require('../lib/admin/members');
var stripeFailedPayments = require('../lib/metrics/stripe-failed-payments');
var failedPaymentQueue = require('../lib/comunidade/failed-payment-recovery-queue');
var vturbAnalytics = require('../lib/metrics/vturb-analytics');
var pushNotify = require('../lib/metrics/push-notify');
var pushSubscriptions = require('../lib/metrics/push-subscriptions');
var reportingRange = require('../lib/metrics/reporting-range');

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
    return reportingRange.resolveReportingRange(query || {});
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
    var skipVturb = String(req.query.skip_vturb || '') === '1';
    var metaMode = String(req.query.meta_mode || 'full').trim();
    var hasToken = Boolean(metaClient.getAccessToken());

    var fetchMetaReport = metaMode === 'summary'
        ? metaInsights.getAccountSummaryReport
        : metaInsights.getCampaignReport;

    var metaPromise = hasToken && metaConfig.isAllowedAccountId(accountId)
        ? fetchMetaReport(accountId, from, to, { skipCache: skipCache }).catch(function (error) {
            return { __error: error.message || 'Meta API falhou.' };
        })
        : Promise.resolve({
            __error: hasToken ? 'Conta Meta não autorizada.' : 'META_ACCESS_TOKEN em falta.',
        });

    var results = await Promise.all([
        stripeSales.buildStripeReport(req.query),
        metaPromise,
        skipVturb
            ? Promise.resolve({ ok: false, configured: false, skipped: true, summary: null })
            : vturbAnalytics.buildVturbReport(req.query),
    ]);

    var stripeReport = results[0];
    var metaResult = results[1];
    var vturbReport = results[2];
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
        vturb: vturbReport,
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
    var vturbReport = await vturbAnalytics.buildVturbReport(req.query);

    if (!hasToken) {
        return res.status(200).json({
            stripe: stripeReport,
            meta: null,
            merged: null,
            vturb: vturbReport,
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
            vturb: vturbReport,
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
            vturb: vturbReport,
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
            vturb: vturbReport,
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

async function handleAdminMembers(res) {
    try {
        var report = await adminMembers.listMembersReport();
        return res.status(200).json(report);
    } catch (error) {
        console.error('Admin members falhou:', error);
        return res.status(500).json({
            error: error.message || 'Não foi possível carregar membros.',
        });
    }
}

async function handleAdminPost(req, res, action) {
    var body = await readJsonBody(req);

    try {
        if (action === 'admin_grant') {
            var grantMemberId = typeof body.member_id === 'string' ? body.member_id.trim() : '';
            var grantProductId = typeof body.product_id === 'string' ? body.product_id.trim() : '';

            if (!grantMemberId || !grantProductId) {
                return res.status(400).json({ error: 'member_id e product_id são obrigatórios.' });
            }

            var grantResult = await adminMembers.grantProductAccess(grantMemberId, grantProductId);
            return res.status(200).json(grantResult);
        }

        if (action === 'admin_revoke') {
            var revokeMemberId = typeof body.member_id === 'string' ? body.member_id.trim() : '';
            var revokeProductId = typeof body.product_id === 'string' ? body.product_id.trim() : '';

            if (!revokeMemberId || !revokeProductId) {
                return res.status(400).json({ error: 'member_id e product_id são obrigatórios.' });
            }

            var revokeResult = await adminMembers.revokeProductAccess(revokeMemberId, revokeProductId);
            return res.status(200).json(revokeResult);
        }

        if (action === 'admin_resend_email') {
            var resendMemberId = typeof body.member_id === 'string' ? body.member_id.trim() : '';

            if (!resendMemberId) {
                return res.status(400).json({ error: 'member_id é obrigatório.' });
            }

            var resendResult = await adminMembers.resendAccessEmail(resendMemberId, {
                retroactive: body.retroactive === true,
            });
            return res.status(200).json(resendResult);
        }

        if (action === 'admin_resend_never_logged_in') {
            var batchResult = await adminMembers.resendAccessToNeverLoggedIn({
                retroactive: body.retroactive !== false,
            });
            return res.status(200).json(batchResult);
        }

        if (action === 'admin_send_next_never_logged_in_whatsapp') {
            var whatsappResult = await adminMembers.sendNextNeverLoggedInWhatsApp();
            return res.status(200).json(whatsappResult);
        }

        if (action === 'admin_send_next_failed_payment_whatsapp') {
            var failedWhatsAppResult = await failedPaymentQueue.processNextFailedPaymentRecovery();
            return res.status(200).json(failedWhatsAppResult);
        }

        if (action === 'admin_enqueue_failed_payment_backfill') {
            var backfillResult = await failedPaymentQueue.enqueueBackfillSinceJuly15();
            return res.status(200).json(backfillResult);
        }

        if (action === 'admin_create_member') {
            var createResult = await adminMembers.createMemberManually({
                email: body.email,
                full_name: body.full_name,
                product_ids: body.product_ids,
                send_email: body.send_email,
            });
            return res.status(200).json(createResult);
        }

        return res.status(400).json({ error: 'Acção admin inválida.' });
    } catch (error) {
        console.error('Admin POST falhou:', error);
        return res.status(500).json({
            error: error.message || 'Pedido admin falhou.',
        });
    }
}

async function handlePushConfig(res) {
    return res.status(200).json({
        enabled: pushNotify.isPushConfigured(),
        vapid_public_key: pushNotify.getPublicKey(),
    });
}

async function handlePushSubscribe(req, res) {
    var body = await readJsonBody(req);
    var subscription = body.subscription;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Subscrição push em falta.' });
    }

    try {
        var result = await pushSubscriptions.upsertSubscription(
            subscription,
            req.headers['user-agent'] || ''
        );

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Push falhou.' });
    }
}

async function handlePushUnsubscribe(req, res) {
    var body = await readJsonBody(req);
    var endpoint = body.subscription && body.subscription.endpoint
        ? body.subscription.endpoint
        : body.endpoint;

    try {
        var result = await pushSubscriptions.removeSubscription(endpoint);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Push falhou.' });
    }
}

async function handleSetupCheckout19Price(res) {
    var Stripe = require('stripe');
    var CHECKOUT9_PRODUCT_ID = 'prod_Usue5319DfN1il';
    var CHECKOUT19_LOOKUP_KEY = 'onda-prodigio-checkout19';
    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        return res.status(500).json({ error: 'STRIPE_SECRET_KEY em falta.' });
    }

    var stripe = new Stripe(secretKey);

    try {
        var existing = await stripe.prices.list({
            limit: 20,
            active: true,
            lookup_keys: [CHECKOUT19_LOOKUP_KEY],
        });

        if (existing.data && existing.data.length) {
            var current = existing.data[0];

            return res.status(200).json({
                ok: true,
                existed: true,
                product_id: current.product,
                price_id: current.id,
                unit_amount: current.unit_amount,
                lookup_key: current.lookup_key,
            });
        }

        var price = await stripe.prices.create({
            product: CHECKOUT9_PRODUCT_ID,
            unit_amount: 1900,
            currency: 'eur',
            lookup_key: CHECKOUT19_LOOKUP_KEY,
            metadata: {
                checkout: 'checkout19',
            },
        });

        return res.status(200).json({
            ok: true,
            existed: false,
            product_id: price.product,
            price_id: price.id,
            unit_amount: price.unit_amount,
            lookup_key: price.lookup_key,
        });
    } catch (error) {
        console.error('Setup checkout19 price falhou:', error);
        return res.status(500).json({
            error: error.message || 'Não foi possível criar o preço €19.',
        });
    }
}

module.exports = async function handler(req, res) {
    var action = String(req.query.action || 'stripe').trim();
    var isPublicHubPagePreview = req.method === 'GET' && action === 'hub_page_preview';
    var isPublicHubPageDomain = req.method === 'GET' && action === 'hub_page_domain';
    var isPublicHubQuizSubmit = req.method === 'POST' && action === 'hub_quiz_submit';

    if (!isPublicHubPagePreview && !isPublicHubPageDomain && !isPublicHubQuizSubmit && !metricsAuth.isAuthorized(req)) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    if (req.method === 'POST') {
        if (action === 'meta_status') {
            return handleMetaStatus(req, res);
        }

        if (action === 'push_subscribe') {
            return handlePushSubscribe(req, res);
        }

        if (action === 'push_unsubscribe') {
            return handlePushUnsubscribe(req, res);
        }

        if (action === 'setup_checkout19_price') {
            return handleSetupCheckout19Price(res);
        }

        if (action.indexOf('admin_') === 0) {
            return handleAdminPost(req, res, action);
        }

        if (action === 'hub_create_offer') {
            return require('../lib/hub/handlers/create-offer')(req, res);
        }

        if (action === 'hub_delete_offer') {
            return require('../lib/hub/handlers/delete-offer')(req, res);
        }

        if (action === 'hub_save_offer_settings') {
            return require('../lib/hub/handlers/save-offer-settings')(req, res);
        }

        if (action === 'hub_save_integrations') {
            return require('../lib/hub/handlers/save-integrations')(req, res);
        }

        if (action === 'hub_save_meta_accounts') {
            return require('../lib/hub/handlers/save-meta-accounts')(req, res);
        }

        if (action === 'hub_import_integrations') {
            return require('../lib/hub/handlers/import-integrations')(req, res);
        }

        if (action === 'hub_ai_task_create') {
            return require('../lib/hub/handlers/ai-tasks')(req, res);
        }

        if (action === 'hub_page_render') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_builder_save') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_builder_cross_offer') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_template_materialize') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_builder_ai') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_builder_ai_agent') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_builder_screenshot') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_builder_publish') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_revision_restore') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_funnel_create') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_provision_offer' ||
            action === 'hub_validate_offer' ||
            action === 'hub_launch_offer') {
            return require('../lib/hub/handlers/offer-operations')(req, res);
        }

        if (action === 'hub_page_create') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_quiz_save' || action === 'hub_quiz_submit' || action === 'hub_quiz_publish') {
            return require('../lib/hub/handlers/quiz')(req, res);
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        if (action === 'admin_members') {
            return handleAdminMembers(res);
        }

        if (action === 'admin_never_logged_in_whatsapp_targets') {
            var targets = await adminMembers.listNeverLoggedInWhatsAppTargets();
            return res.status(200).json(targets);
        }

        if (action === 'admin_failed_payments') {
            var failedReport = await stripeFailedPayments.buildFailedPaymentsReport(req.query);
            return res.status(200).json(failedReport);
        }

        if (action === 'meta_health') {
            return handleMetaHealth(res);
        }

        if (action === 'meta_accounts') {
            return handleMetaAccounts(res);
        }

        if (action === 'combined') {
            return await handleCombined(req, res);
        }

        if (action === 'sales_pulse') {
            var pulseReport = await stripeSales.buildSalesPulse(req.query);
            return res.status(200).json(pulseReport);
        }

        if (action === 'push_config') {
            return handlePushConfig(res);
        }

        if (action === 'push_test') {
            var testResult = await pushNotify.notifyTestSale();
            return res.status(200).json(testResult);
        }

        if (action === 'meta') {
            return handleMeta(req, res);
        }

        if (action === 'hub_offers') {
            return require('../lib/hub/handlers/offers-list')(req, res);
        }

        if (action === 'hub_metrics_overview' || action === 'hub_metrics') {
            return require('../lib/hub/handlers/metrics-overview')(req, res);
        }

        if (action === 'hub_offer') {
            return require('../lib/hub/handlers/offer-detail')(req, res);
        }

        if (action === 'hub_health') {
            return require('../lib/hub/handlers/health')(req, res);
        }

        if (action === 'hub_launch_health') {
            return require('../lib/hub/handlers/launch-health')(req, res);
        }

        if (action === 'hub_offer_wizard') {
            return require('../lib/hub/handlers/offer-operations')(req, res);
        }

        if (action === 'hub_module') {
            return require('../lib/hub/handlers/module-data')(req, res);
        }

        if (action === 'hub_ai_task') {
            return require('../lib/hub/handlers/ai-tasks')(req, res);
        }

        if (action === 'hub_ai_tasks') {
            return require('../lib/hub/handlers/ai-tasks')(req, res);
        }

        if (action === 'hub_page_preview') {
            return require('../lib/hub/handlers/page-preview')(req, res);
        }

        if (action === 'hub_page_domain') {
            return require('../lib/hub/handlers/page-domain')(req, res);
        }

        if (action === 'hub_page_tree') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_funnel_list') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_list') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_templates') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_page_revisions') {
            return require('../lib/hub/handlers/page-builder')(req, res);
        }

        if (action === 'hub_quiz_get') {
            return require('../lib/hub/handlers/quiz')(req, res);
        }

        return handleStripe(req, res);
    } catch (error) {
        console.error('API métricas falhou:', error);
        return res.status(500).json({
            error: error.message || 'Pedido falhou.',
        });
    }
};
