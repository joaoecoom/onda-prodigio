var identity = require('./identity');

function getWebhookUrl() {
    return (process.env.VTURB_CONVERSION_WEBHOOK_URL || '').trim();
}

function isValidConversionKey(value) {
    return typeof value === 'string' && value.indexOf('v3_') === 0 && value.length > 10;
}

function formatOrderCreatedAt(unixSeconds) {
    if (unixSeconds) {
        return new Date(Number(unixSeconds) * 1000).toISOString();
    }

    return new Date().toISOString();
}

function getClientIp(req) {
    var forwarded = req && req.headers && req.headers['x-forwarded-for'];

    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
        return String(forwarded[0]).split(',')[0].trim();
    }

    return req && req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '';
}

/**
 * @param {{
 *   conversion_key: string,
 *   order_amount_cents: number,
 *   currency?: string,
 *   product_name?: string,
 *   category?: string,
 *   order_created_at?: string,
 *   order_ip?: string,
 * }} payload
 */
async function sendConversion(payload) {
    var webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
        return {
            ok: false,
            skipped: true,
            reason: 'VTURB_CONVERSION_WEBHOOK_URL em falta.',
        };
    }

    if (!payload || !isValidConversionKey(payload.conversion_key)) {
        return {
            ok: false,
            skipped: true,
            reason: 'conversion_key VTurb (vtid v3_...) em falta.',
        };
    }

    var body = {
        order_amount_cents: String(Math.max(0, Math.round(Number(payload.order_amount_cents || 0)))),
        currency: String(payload.currency || 'EUR').toUpperCase(),
        conversion_key: payload.conversion_key,
        product_name: payload.product_name || 'Onda Prodígio',
        category: payload.category || 'initial_sale',
        order_created_at: payload.order_created_at || new Date().toISOString(),
        order_ip: payload.order_ip || '',
    };

    try {
        var response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        var responseText = await response.text();

        return {
            ok: response.ok,
            status: response.status,
            body: responseText.slice(0, 500),
        };
    } catch (error) {
        console.error('VTurb conversion falhou:', error.message);

        return {
            ok: false,
            error: error.message,
        };
    }
}

/**
 * @param {import('stripe').Stripe.PaymentIntent} paymentIntent
 * @param {import('http').IncomingMessage} req
 */
async function sendFromPaymentIntent(paymentIntent, req) {
    var metadata = paymentIntent.metadata || {};
    var conversionKey = metadata.vtid || '';

    return sendConversion({
        conversion_key: conversionKey,
        order_amount_cents: paymentIntent.amount,
        currency: String(paymentIntent.currency || 'eur').toUpperCase(),
        product_name: metadata.product || 'Onda Prodígio',
        category: metadata.upsell ? 'upsell' : 'initial_sale',
        order_created_at: formatOrderCreatedAt(paymentIntent.created),
        order_ip: getClientIp(req),
    });
}

/**
 * @param {import('stripe').Stripe.Checkout.Session} session
 * @param {import('http').IncomingMessage} req
 */
async function sendFromCheckoutSession(session, req) {
    var metadata = session.metadata || {};
    var conversionKey = metadata.vtid || '';
    var upsellConfig = require('../upsell-config');
    var upsell = upsellConfig.getUpsell(metadata.upsell || metadata.product_id || '');
    var productName = upsell ? upsell.name : (metadata.product_id || 'Upsell Onda Prodígio');

    return sendConversion({
        conversion_key: conversionKey,
        order_amount_cents: session.amount_total || 0,
        currency: String(session.currency || 'eur').toUpperCase(),
        product_name: productName,
        category: 'upsell',
        order_created_at: formatOrderCreatedAt(session.created),
        order_ip: getClientIp(req),
    });
}

function sanitizeConversionKey(value) {
    if (!isValidConversionKey(value)) {
        return '';
    }

    return identity.sanitizeMetadataValue(value, 500);
}

module.exports = {
    sendConversion: sendConversion,
    sendFromPaymentIntent: sendFromPaymentIntent,
    sendFromCheckoutSession: sendFromCheckoutSession,
    isValidConversionKey: isValidConversionKey,
    sanitizeConversionKey: sanitizeConversionKey,
};
