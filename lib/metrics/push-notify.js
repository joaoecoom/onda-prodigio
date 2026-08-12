var webpush = require('web-push');
var pushSubscriptions = require('./push-subscriptions');
var salesReport = require('./sales-report');

var configured = false;

function isPushConfigured() {
    return Boolean(
        process.env.VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY
    );
}

function ensureConfigured() {
    if (configured || !isPushConfigured()) {
        return isPushConfigured();
    }

    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:suporte.angelacampos@gmail.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    configured = true;
    return true;
}

function getPublicKey() {
    return String(process.env.VAPID_PUBLIC_KEY || '').trim();
}

function buildSalePayload(sale) {
    var amount = Number(sale.amount_eur || 0).toFixed(2);
    var source = sale.source_label || 'Stripe';
    var campaign = sale.campaign_name && sale.campaign_name !== 'Desconhecido'
        ? sale.campaign_name
        : '';

    return {
        title: 'Nova venda · €' + amount,
        body: campaign ? (source + ' · ' + campaign) : source,
        tag: sale.payment_intent || ('sale-' + Date.now()),
        url: '/metricas/',
    };
}

function isDeadSubscriptionError(error) {
    if (!error) {
        return false;
    }

    var status = Number(error.statusCode || 0);

    return status === 404 || status === 410;
}

async function sendToSubscription(subscriptionRow, payload) {
    if (!ensureConfigured()) {
        return { ok: false, skipped: true, reason: 'vapid_missing' };
    }

    var subscription = subscriptionRow.subscription_json;

    if (!subscription || !subscription.endpoint) {
        return { ok: false, skipped: true, reason: 'invalid_subscription' };
    }

    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
            TTL: 86400,
            urgency: 'high',
        });

        return { ok: true, endpoint: subscription.endpoint };
    } catch (error) {
        if (isDeadSubscriptionError(error)) {
            await pushSubscriptions.removeSubscription(subscription.endpoint);
            return { ok: false, removed: true, endpoint: subscription.endpoint };
        }

        return {
            ok: false,
            endpoint: subscription.endpoint,
            error: error.message || 'Push falhou.',
        };
    }
}

async function notifySaleFromPaymentIntent(paymentIntent) {
    if (!salesReport.isLiveStripeSale(paymentIntent)) {
        return { ok: true, skipped: true, reason: 'not_live_sale' };
    }

    if (!ensureConfigured()) {
        return { ok: true, skipped: true, reason: 'vapid_missing' };
    }

    var sale = salesReport.summarizeSale(paymentIntent);
    var payload = buildSalePayload(sale);
    var subscriptions = await pushSubscriptions.listSubscriptions();

    if (!subscriptions.length) {
        return { ok: true, skipped: true, reason: 'no_subscribers', payload: payload };
    }

    var results = await Promise.all(subscriptions.map(function (row) {
        return sendToSubscription(row, payload);
    }));

    var sent = results.filter(function (result) {
        return result.ok;
    }).length;

    return {
        ok: true,
        sent: sent,
        total: subscriptions.length,
        payload: payload,
        results: results,
    };
}

module.exports = {
    isPushConfigured: isPushConfigured,
    getPublicKey: getPublicKey,
    buildSalePayload: buildSalePayload,
    notifySaleFromPaymentIntent: notifySaleFromPaymentIntent,
};
