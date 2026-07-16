var constants = require('./constants');
var identity = require('./identity');
var metaCapi = require('./meta-capi');
var ga4Mp = require('./ga4-mp');
var gtmServer = require('./gtm-server');

/**
 * @param {import('stripe').Stripe.PaymentIntent} paymentIntent
 * @param {import('http').IncomingMessage} req
 */
async function sendPurchaseFromPaymentIntent(paymentIntent, req) {
    var metadata = paymentIntent.metadata || {};
    var orderBumps = constants.parseOrderBumps(metadata.order_bumps);
    var items = constants.buildTrackingItems(orderBumps);
    var value = constants.centsToValue(paymentIntent.amount);
    var eventId = metadata.purchase_event_id || ('purchase_' + paymentIntent.id);
    var eventTime = identity.getEventTimeSeconds(paymentIntent.created);
    var email = paymentIntent.receipt_email || metadata.email || '';
    var phone = metadata.phone || '';
    var phoneCountry = metadata.phone_country || metadata.country || 'PT';
    var clientId = metadata.ga_client_id || ('server.' + paymentIntent.id);
    var user = {
        email: email,
        phone: phone,
        phoneCountry: phoneCountry,
        fbp: metadata.fbp || '',
        fbc: metadata.fbc || '',
        externalId: identity.buildExternalId(email, phone, phoneCountry),
        clientIpAddress: getClientIp(req),
        clientUserAgent: metadata.client_user_agent || req.headers['user-agent'] || '',
    };

    var ecommerce = {
        transaction_id: paymentIntent.id,
        currency: String(paymentIntent.currency || 'eur').toUpperCase(),
        value: value,
        items: items,
    };

    var sharedPayload = {
        event_id: eventId,
        event_time: eventTime,
        ecommerce: ecommerce,
        user: {
            email: email,
            phone: phone,
            fbp: user.fbp,
            fbc: user.fbc,
            external_id: user.externalId,
        },
    };

    var results = {
        meta: null,
        ga4: null,
        gtmServer: null,
    };

    try {
        results.meta = await metaCapi.sendMetaEvent({
            eventName: 'Purchase',
            eventId: eventId,
            eventTime: eventTime,
            user: user,
            customData: {
                currency: ecommerce.currency,
                value: value,
                order_id: paymentIntent.id,
                content_ids: items.map(function (item) {
                    return item.item_id;
                }),
                contents: items.map(function (item) {
                    return {
                        id: item.item_id,
                        quantity: item.quantity,
                        item_price: item.price,
                    };
                }),
            },
        });
    } catch (error) {
        console.error('Meta Purchase falhou:', paymentIntent.id, error.message);
        results.meta = {
            ok: false,
            error: error.message,
            metaResponse: error.metaResponse || null,
        };
    }

    try {
        results.ga4 = await ga4Mp.sendGa4Event({
            eventName: 'purchase',
            clientId: clientId,
            params: {
                transaction_id: paymentIntent.id,
                currency: ecommerce.currency,
                value: value,
                items: items,
                event_id: eventId,
            },
        });
    } catch (error) {
        console.error('GA4 Purchase falhou:', paymentIntent.id, error.message);
        results.ga4 = {
            ok: false,
            error: error.message,
        };
    }

    try {
        results.gtmServer = await gtmServer.sendGtmServerEvent({
            eventName: 'purchase',
            payload: sharedPayload,
        });
    } catch (error) {
        results.gtmServer = {
            error: error.message,
        };
    }

    return results;
}

/**
 * @param {import('stripe').Stripe.PaymentIntent} paymentIntent
 * @param {import('http').IncomingMessage} req
 */
async function sendPaymentFailedFromPaymentIntent(paymentIntent, req) {
    var metadata = paymentIntent.metadata || {};
    var eventId = metadata.purchase_event_id
        ? metadata.purchase_event_id + '_failed'
        : ('payment_failed_' + paymentIntent.id);
    var eventTime = identity.getEventTimeSeconds(Math.floor(Date.now() / 1000));
    var email = paymentIntent.receipt_email || metadata.email || '';
    var phone = metadata.phone || '';
    var phoneCountry = metadata.phone_country || metadata.country || 'PT';
    var clientId = metadata.ga_client_id || ('server.' + paymentIntent.id);
    var user = {
        email: email,
        phone: phone,
        phoneCountry: phoneCountry,
        fbp: metadata.fbp || '',
        fbc: metadata.fbc || '',
        externalId: identity.buildExternalId(email, phone, phoneCountry),
        clientIpAddress: getClientIp(req),
        clientUserAgent: metadata.client_user_agent || req.headers['user-agent'] || '',
    };

    var value = constants.centsToValue(paymentIntent.amount);
    var results = {
        meta: null,
        ga4: null,
        gtmServer: null,
    };

    results.meta = await metaCapi.sendMetaEvent({
        eventName: 'PaymentFailed',
        eventId: eventId,
        eventTime: eventTime,
        user: user,
        customData: {
            currency: String(paymentIntent.currency || 'eur').toUpperCase(),
            value: value,
            order_id: paymentIntent.id,
        },
    });

    results.ga4 = await ga4Mp.sendGa4Event({
        eventName: 'payment_failed',
        clientId: clientId,
        params: {
            transaction_id: paymentIntent.id,
            currency: String(paymentIntent.currency || 'eur').toUpperCase(),
            value: value,
            event_id: eventId,
        },
    });

    try {
        results.gtmServer = await gtmServer.sendGtmServerEvent({
            eventName: 'payment_failed',
            payload: {
                event_id: eventId,
                event_time: eventTime,
                transaction_id: paymentIntent.id,
            },
        });
    } catch (error) {
        results.gtmServer = {
            error: error.message,
        };
    }

    return results;
}

function getClientIp(req) {
    var forwarded = req.headers['x-forwarded-for'];

    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
        return String(forwarded[0]).split(',')[0].trim();
    }

    return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '';
}

function buildStripeTrackingMetadata(tracking, userAgent) {
    var metadata = {};

    if (!tracking || typeof tracking !== 'object') {
        return metadata;
    }

    if (tracking.fbp) {
        metadata.fbp = identity.sanitizeMetadataValue(tracking.fbp, 200);
    }

    if (tracking.fbc) {
        metadata.fbc = identity.sanitizeMetadataValue(tracking.fbc, 200);
    }

    if (tracking.purchase_event_id) {
        metadata.purchase_event_id = identity.sanitizeMetadataValue(tracking.purchase_event_id, 200);
    }

    if (tracking.ga_client_id) {
        metadata.ga_client_id = identity.sanitizeMetadataValue(tracking.ga_client_id, 100);
    }

    if (userAgent) {
        metadata.client_user_agent = identity.sanitizeMetadataValue(userAgent, 500);
    }

    return metadata;
}

module.exports = {
    sendPurchaseFromPaymentIntent: sendPurchaseFromPaymentIntent,
    sendPaymentFailedFromPaymentIntent: sendPaymentFailedFromPaymentIntent,
    buildStripeTrackingMetadata: buildStripeTrackingMetadata,
};
