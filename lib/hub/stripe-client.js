'use strict';

var Stripe = require('stripe');
var offerContext = require('./offer-context');
var offers = require('./offers');
var funnelCheckoutConfig = require('../funnel-checkout-config');
var hubConfig = require('./config');

function resolveOfferHint(req, body) {
    var payload = body && typeof body === 'object' ? body : {};
    var query = req && req.query ? req.query : {};
    var headers = req && req.headers ? req.headers : {};
    var hostHeader = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim();
    var tracking = payload.tracking && typeof payload.tracking === 'object' ? payload.tracking : {};

    return {
        offer_id: String(
            payload.offer_id ||
            tracking.offer_id ||
            query.offer_id ||
            ''
        ).trim(),
        slug: offers.normalizeSlug(
            payload.offer_slug ||
            payload.offer ||
            tracking.offer_slug ||
            query.offer ||
            query.slug ||
            ''
        ),
        domain: hostHeader ? hubConfig.normalizeHost(hostHeader) : '',
    };
}

function pickOfferCheckout(offer, checkoutId, mode) {
    var checkouts = offer && offer.checkouts ? offer.checkouts : [];
    var resolvedId = checkoutId === 'main'
        ? 'main'
        : funnelCheckoutConfig.resolveCheckoutId(checkoutId);
    var match = checkouts.find(function (row) {
        return row.checkout_id === resolvedId;
    });

    if (match) {
        return match;
    }

    if (resolvedId === 'main') {
        return checkouts.find(function (row) {
            return row.checkout_id === 'main';
        }) || checkouts[0] || null;
    }

    if (mode === 'test' && resolvedId === 'checkout9-test') {
        return checkouts.find(function (row) {
            return row.checkout_id === 'checkout9';
        }) || null;
    }

    return null;
}

function buildCheckoutSettings(checkoutId, mode, offerCheckout) {
    var funnel = funnelCheckoutConfig.getCheckoutConfig(checkoutId, mode);
    var isTest = mode === 'test';

    if (!offerCheckout) {
        return {
            checkoutId: funnel.checkoutId,
            amountCents: funnel.amountCents,
            priceId: funnel.priceId,
            checkoutPath: funnel.checkoutPath,
            thankYouPath: funnel.thankYouPath,
            label: funnel.label,
            sourceCheckoutId: funnel.sourceCheckoutId,
        };
    }

    var amount = parseInt(offerCheckout.amount_cents, 10);
    var priceId = isTest
        ? (offerCheckout.stripe_test_price_id || offerCheckout.stripe_price_id || '')
        : (offerCheckout.stripe_price_id || '');

    return {
        checkoutId: funnel.checkoutId,
        amountCents: Number.isFinite(amount) && amount >= 50 ? amount : funnel.amountCents,
        priceId: priceId || funnel.priceId,
        checkoutPath: offerCheckout.path || funnel.checkoutPath,
        thankYouPath: funnel.thankYouPath,
        label: offerCheckout.label || funnel.label,
        sourceCheckoutId: funnel.sourceCheckoutId,
    };
}

function buildStripeSettings(mode, checkoutId, integrations, offer, offerCheckout) {
    var isTest = mode === 'test';
    var checkout = buildCheckoutSettings(checkoutId, mode, offerCheckout);
    var safeIntegrations = integrations || {};

    return {
        mode: isTest ? 'test' : 'live',
        secretKey: isTest
            ? String(safeIntegrations.stripe_test_secret_key || '').trim()
            : String(safeIntegrations.stripe_secret_key || '').trim(),
        publishableKey: isTest
            ? String(safeIntegrations.stripe_test_publishable_key || '').trim()
            : String(safeIntegrations.stripe_publishable_key || '').trim(),
        webhookSecret: String(safeIntegrations.stripe_webhook_secret || '').trim(),
        paymentMethodConfiguration: isTest
            ? (process.env.STRIPE_TEST_PAYMENT_METHOD_CONFIGURATION || 'pmc_1PjO9dAAQoQG6ncipbkkjfr9')
            : (process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION || 'pmc_1OuDi3AAQoQG6nciqBp2JYfG'),
        amountCents: checkout.amountCents,
        priceId: checkout.priceId,
        checkoutId: checkout.checkoutId,
        checkoutPath: checkout.checkoutPath,
        thankYouPath: checkout.thankYouPath,
        sourceCheckoutId: checkout.sourceCheckoutId,
        offerId: offer ? offer.id : '',
        offerSlug: offer ? offer.slug : '',
        offerName: offer ? offer.name : 'Onda Prodígio',
    };
}

function buildOfferMetadata(settings) {
    var metadata = {};

    if (settings && settings.offerId) {
        metadata.offer_id = settings.offerId;
    }

    if (settings && settings.offerSlug) {
        metadata.offer_slug = settings.offerSlug;
    }

    return metadata;
}

async function resolveStripeContext(req, body, options) {
    var stripeEnv = require('../stripe-env');
    var mode = stripeEnv.resolveStripeMode(req, body);
    var checkoutId = stripeEnv.resolveCheckoutId(req, body);
    var hint = resolveOfferHint(req, body);
    var opts = options || {};
    var offerRecord = null;

    try {
        offerRecord = await offerContext.resolveOfferContext(hint, {
            allowDefault: opts.allowDefault !== false,
            includeSecrets: true,
        });
    } catch (error) {
        if (error.code !== 'OFFER_NOT_FOUND') {
            throw error;
        }
    }

    if (!offerRecord) {
        var legacy = stripeEnv.getStripeClient(mode, checkoutId);

        return {
            offer: null,
            settings: legacy.settings,
            stripe: legacy.stripe,
            error: legacy.error,
        };
    }

    var offerCheckout = pickOfferCheckout(offerRecord, checkoutId, mode);
    var settings = buildStripeSettings(
        mode,
        checkoutId,
        offerRecord.integrations || {},
        offerRecord,
        offerCheckout
    );

    if (!settings.secretKey) {
        return {
            offer: offerRecord,
            settings: settings,
            stripe: null,
            error: mode === 'test' ? 'STRIPE_TEST_SECRET_KEY em falta.' : 'STRIPE_SECRET_KEY em falta.',
        };
    }

    return {
        offer: offerRecord,
        settings: settings,
        stripe: new Stripe(settings.secretKey),
        error: null,
    };
}

async function resolveStripeContextFromMetadata(metadata, modeHint) {
    var meta = metadata && typeof metadata === 'object' ? metadata : {};
    var mode = meta.stripe_mode === 'test' || modeHint === 'test' ? 'test' : 'live';
    var checkoutId = funnelCheckoutConfig.resolveCheckoutId(meta.checkout || 'checkout9');
    var hint = {
        offer_id: String(meta.offer_id || '').trim(),
        slug: offers.normalizeSlug(meta.offer_slug || ''),
        domain: '',
    };

    if (!hint.offer_id && !hint.slug) {
        return null;
    }

    try {
        return await resolveStripeContext(
            { query: {}, headers: {} },
            { mode: mode, checkout_id: checkoutId, offer_id: hint.offer_id, offer_slug: hint.slug },
            { allowDefault: false }
        );
    } catch (error) {
        if (error.code === 'OFFER_NOT_FOUND') {
            return null;
        }

        throw error;
    }
}

async function listWebhookSecrets() {
    var secrets = [];
    var globalSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();

    if (globalSecret) {
        secrets.push({ source: 'env', secret: globalSecret });
    }

    var offersList = await offers.listOffers();

    for (var i = 0; i < offersList.length; i += 1) {
        var offer = offersList[i];
        var integrations = await offers.getOfferIntegrations(offer.id, { includeSecrets: true });
        var offerSecret = String(integrations.stripe_webhook_secret || '').trim();

        if (!offerSecret || offerSecret === globalSecret) {
            continue;
        }

        secrets.push({
            source: offer.slug || offer.id,
            secret: offerSecret,
        });
    }

    return secrets;
}

async function verifyWebhookEvent(rawBody, signature, req) {
    if (!signature) {
        return { error: 'Assinatura Stripe em falta.' };
    }

    var query = req && req.query ? req.query : {};
    var offerSlug = offers.normalizeSlug(query.offer || query.slug || '');

    if (offerSlug) {
        try {
            var offerContextResult = await offerContext.resolveOfferContext({ slug: offerSlug }, {
                allowDefault: false,
                includeSecrets: true,
            });
            var offerSecret = String((offerContextResult.integrations || {}).stripe_webhook_secret || '').trim();

            if (offerSecret) {
                var offerStripeKey = String(
                    (offerContextResult.integrations || {}).stripe_secret_key || process.env.STRIPE_SECRET_KEY || ''
                ).trim();

                if (offerStripeKey) {
                    var offerStripe = new Stripe(offerStripeKey);

                    return {
                        event: offerStripe.webhooks.constructEvent(rawBody, signature, offerSecret),
                        stripe: offerStripe,
                        offer: offerContextResult,
                    };
                }
            }
        } catch (error) {
            if (error.code !== 'OFFER_NOT_FOUND') {
                throw error;
            }
        }
    }

    var globalSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    var globalKey = String(process.env.STRIPE_SECRET_KEY || '').trim();

    if (globalSecret && globalKey) {
        try {
            var globalStripe = new Stripe(globalKey);

            return {
                event: globalStripe.webhooks.constructEvent(rawBody, signature, globalSecret),
                stripe: globalStripe,
                offer: null,
            };
        } catch (globalError) {
            // fall through to per-offer secrets
        }
    }

    var candidates = await listWebhookSecrets();

    for (var i = 0; i < candidates.length; i += 1) {
        var candidate = candidates[i];

        if (candidate.source === 'env') {
            continue;
        }

        try {
            var fallbackStripe = new Stripe(globalKey || process.env.STRIPE_SECRET_KEY);
            var event = fallbackStripe.webhooks.constructEvent(rawBody, signature, candidate.secret);

            return {
                event: event,
                stripe: fallbackStripe,
                offer: null,
            };
        } catch (candidateError) {
            // try next secret
        }
    }

    return { error: 'Webhook inválido.' };
}

module.exports = {
    resolveOfferHint: resolveOfferHint,
    pickOfferCheckout: pickOfferCheckout,
    buildCheckoutSettings: buildCheckoutSettings,
    buildStripeSettings: buildStripeSettings,
    buildOfferMetadata: buildOfferMetadata,
    resolveStripeContext: resolveStripeContext,
    resolveStripeContextFromMetadata: resolveStripeContextFromMetadata,
    listWebhookSecrets: listWebhookSecrets,
    verifyWebhookEvent: verifyWebhookEvent,
};
