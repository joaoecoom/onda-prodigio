var constants = require('./constants');
var identity = require('./identity');
var attribution = require('./attribution');
var metaCapi = require('./meta-capi');
var ga4Mp = require('./ga4-mp');
var vturbConversion = require('./vturb-conversion');
var currency = require('./currency');
var metaUserData = require('./meta-user-data');
var offerTracking = require('./offer-tracking');

async function resolveTrackingForPaymentIntent(paymentIntent) {
    return offerTracking.resolveServerTrackingFromMetadata((paymentIntent && paymentIntent.metadata) || {});
}

function buildMetaContents(items) {
    return items.map(function (item) {
        return {
            id: item.item_id,
            quantity: item.quantity,
            item_price: currency.convertItemPriceForMeta(item.price),
        };
    });
}

function buildMetaCustomData(metadata, items, valueInfo) {
    return {
        currency: valueInfo.currency,
        value: valueInfo.value,
        content_ids: items.map(function (item) {
            return item.item_id;
        }),
        contents: buildMetaContents(items),
        content_name: metadata.ad_name || metadata.utm_content || metadata.campaign_name || 'Onda Prodígio',
    };
}

/**
 * @param {import('stripe').Stripe.PaymentIntent} paymentIntent
 * @param {import('http').IncomingMessage} req
 */
async function sendPurchaseFromPaymentIntent(paymentIntent, req) {
    var metadata = paymentIntent.metadata || {};
    var tracking = await resolveTrackingForPaymentIntent(paymentIntent);
    var items = constants.buildTrackingItemsFromPayment(metadata, paymentIntent.amount);
    var valueInfo = currency.convertEurCentsForMeta(paymentIntent.amount);
    var eventId = 'purchase_' + paymentIntent.id;
    var eventTime = identity.getEventTimeSeconds(paymentIntent.created);
    var user = metaUserData.buildMetaUserFromPaymentMetadata(metadata, req);
    var clientId = metadata.ga_client_id || ('server.' + paymentIntent.id);

    var results = {
        meta: null,
        ga4: null,
        gtmServer: null,
        vturb: null,
    };

    try {
        results.meta = await metaCapi.sendMetaEvent({
            eventName: 'Purchase',
            eventId: eventId,
            eventTime: eventTime,
            user: user,
            tracking: tracking,
            customData: Object.assign({
                order_id: paymentIntent.id,
            }, buildMetaCustomData(metadata, items, valueInfo)),
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
            tracking: tracking,
            params: {
                transaction_id: paymentIntent.id,
                currency: valueInfo.currency,
                value: valueInfo.value,
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

    results.gtmServer = {
        skipped: true,
        reason: 'Stape desactivado para Purchase — evita duplicar Meta CAPI (webhook já envia directo).',
    };

    try {
        results.vturb = await vturbConversion.sendFromPaymentIntent(paymentIntent, req);
    } catch (error) {
        console.error('VTurb Purchase falhou:', paymentIntent.id, error.message);
        results.vturb = {
            ok: false,
            error: error.message,
        };
    }

    return results;
}

/**
 * Lead + InitiateCheckout CAPI quando o checkout sincroniza dados (update-payment-intent).
 * @param {import('stripe').Stripe.PaymentIntent} paymentIntent
 * @param {import('http').IncomingMessage} req
 */
async function sendFunnelMetaEventsIfNeeded(paymentIntent, req) {
    var metadata = paymentIntent.metadata || {};
    var tracking = await resolveTrackingForPaymentIntent(paymentIntent);
    var user = metaUserData.buildMetaUserFromPaymentMetadata(metadata, req);
    var results = {
        lead: null,
        initiateCheckout: null,
    };

    if (!user.email) {
        return results;
    }

    var orderBumps = constants.parseOrderBumps(metadata.order_bumps);
    var items = constants.buildTrackingItemsFromPayment(metadata, paymentIntent.amount);
    var valueInfo = currency.convertEurCentsForMeta(paymentIntent.amount);
    var customData = buildMetaCustomData(metadata, items, valueInfo);
    var results = {
        lead: null,
        initiateCheckout: null,
    };

    if (user.email && metadata.meta_cap_lead_sent !== '1') {
        try {
            results.lead = await metaCapi.sendMetaEvent({
                eventName: 'Lead',
                eventId: 'lead_' + paymentIntent.id,
                user: user,
                tracking: tracking,
                customData: customData,
            });
        } catch (error) {
            console.error('Meta Lead CAPI falhou:', paymentIntent.id, error.message);
            results.lead = {
                ok: false,
                error: error.message,
            };
        }
    }

    if (metadata.meta_cap_ic_sent !== '1') {
        try {
            results.initiateCheckout = await metaCapi.sendMetaEvent({
                eventName: 'InitiateCheckout',
                eventId: 'initiate_checkout_' + paymentIntent.id,
                user: user,
                tracking: tracking,
                customData: customData,
            });
        } catch (error) {
            console.error('Meta InitiateCheckout CAPI falhou:', paymentIntent.id, error.message);
            results.initiateCheckout = {
                ok: false,
                error: error.message,
            };
        }
    }

    return results;
}

function getFunnelMetaMetadataFlags(funnelResults) {
    var metadata = {};

    if (funnelResults.lead && funnelResults.lead.ok) {
        metadata.meta_cap_lead_sent = '1';
    }

    if (funnelResults.initiateCheckout && funnelResults.initiateCheckout.ok) {
        metadata.meta_cap_ic_sent = '1';
    }

    return metadata;
}

/**
 * @param {import('stripe').Stripe.PaymentIntent} paymentIntent
 * @param {import('http').IncomingMessage} req
 */
async function sendPaymentFailedFromPaymentIntent(paymentIntent, req) {
    var metadata = paymentIntent.metadata || {};
    var tracking = await resolveTrackingForPaymentIntent(paymentIntent);
    var eventId = metadata.purchase_event_id
        ? metadata.purchase_event_id + '_failed'
        : ('payment_failed_' + paymentIntent.id);
    var eventTime = identity.getEventTimeSeconds(Math.floor(Date.now() / 1000));
    var user = metaUserData.buildMetaUserFromPaymentMetadata(metadata, req);
    var clientId = metadata.ga_client_id || ('server.' + paymentIntent.id);
    var valueInfo = currency.convertEurCentsForMeta(paymentIntent.amount);
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
        tracking: tracking,
        customData: {
            currency: valueInfo.currency,
            value: valueInfo.value,
            order_id: paymentIntent.id,
        },
    });

    results.ga4 = await ga4Mp.sendGa4Event({
        eventName: 'payment_failed',
        clientId: clientId,
        tracking: tracking,
        params: {
            transaction_id: paymentIntent.id,
            currency: valueInfo.currency,
            value: valueInfo.value,
            event_id: eventId,
        },
    });

    results.gtmServer = {
        skipped: true,
        reason: 'Stape desactivado para payment_failed — evita duplicar Meta CAPI.',
    };

    return results;
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

    Object.assign(metadata, attribution.buildAttributionMetadata(tracking));

    if (tracking.offer_id) {
        metadata.offer_id = identity.sanitizeMetadataValue(tracking.offer_id, 80);
    }

    if (tracking.offer_slug) {
        metadata.offer_slug = identity.sanitizeMetadataValue(tracking.offer_slug, 80);
    }

    if (tracking.funnel_slug) {
        metadata.funnel_slug = identity.sanitizeMetadataValue(tracking.funnel_slug, 80);
    }

    if (tracking.page_slug) {
        metadata.page_slug = identity.sanitizeMetadataValue(tracking.page_slug, 80);
    }

    return metadata;
}

module.exports = {
    sendPurchaseFromPaymentIntent: sendPurchaseFromPaymentIntent,
    sendFunnelMetaEventsIfNeeded: sendFunnelMetaEventsIfNeeded,
    getFunnelMetaMetadataFlags: getFunnelMetaMetadataFlags,
    sendPaymentFailedFromPaymentIntent: sendPaymentFailedFromPaymentIntent,
    buildStripeTrackingMetadata: buildStripeTrackingMetadata,
};
