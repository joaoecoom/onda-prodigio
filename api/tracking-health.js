var metaCapi = require('../lib/tracking/meta-capi');
var gtmServer = require('../lib/tracking/gtm-server');

module.exports = async function handler(_req, res) {
    var result = {
        env: {
            hasMetaPixelId: Boolean(process.env.META_PIXEL_ID),
            hasMetaAccessToken: Boolean(process.env.META_ACCESS_TOKEN),
            hasGa4ApiSecret: Boolean(process.env.GA4_API_SECRET),
            hasGa4MeasurementId: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
            hasGtmWebId: Boolean(process.env.NEXT_PUBLIC_GTM_ID),
            hasGtmServerContainer: Boolean(process.env.GTM_SERVER_CONTAINER),
            hasServerContainerUrl: Boolean(process.env.SERVER_CONTAINER_URL),
            hasStripeWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        },
        metaCapi: null,
        stape: null,
    };

    if (process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN) {
        try {
            result.metaCapi = await metaCapi.sendMetaEvent({
                eventName: 'InitiateCheckout',
                eventId: 'healthcheck_ic_' + Date.now(),
                user: {
                    clientIpAddress: '8.8.8.8',
                    clientUserAgent: 'OndaProdigioTrackingHealth/1.0',
                },
                customData: {
                    currency: 'EUR',
                    value: 9,
                    content_name: 'tracking_healthcheck',
                },
            });
        } catch (error) {
            result.metaCapi = {
                ok: false,
                error: error.message,
                metaResponse: error.metaResponse || null,
            };
        }
    } else {
        result.metaCapi = {
            ok: false,
            error: 'META_PIXEL_ID ou META_ACCESS_TOKEN em falta na Vercel.',
        };
    }

    try {
        result.stape = await gtmServer.sendGtmServerEvent({
            eventName: 'purchase',
            payload: {
                event_id: 'healthcheck_stape_' + Date.now(),
                currency: 'EUR',
                value: 9,
            },
        });
    } catch (error) {
        result.stape = {
            ok: false,
            error: error.message,
        };
    }

    if (result.stape && result.stape.skipped) {
        result.stape.hint = 'SERVER_CONTAINER_URL em falta na Vercel.';
    } else if (result.stape && result.stape.ok) {
        result.stape.hint = 'Stape respondeu OK.';
    } else if (result.stape && result.stape.error && result.stape.error.indexOf('400') !== -1) {
        result.stape.hint = 'HTTP 400 = Data Client não instalado ou não publicado no GTM Server (Stape).';
    }

    return res.status(200).json(result);
};
