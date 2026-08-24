'use strict';

/**
 * Stripe catalog helpers — create/update products + prices for an offer.
 * Idempotent via metadata.offer_id + lookup_key.
 */

var Stripe = require('stripe');
var offerRuntime = require('./offer-runtime-config');
var offerProvisioning = require('./offer-provisioning');
var orderBumps = require('./order-bumps');
var { getSupabaseAdmin } = require('../supabase-admin');

function pickSecret(integrations, mode) {
    var isTest = mode === 'test';
    var secret = isTest
        ? (integrations.stripe_test_secret_key || integrations.stripe_secret_key)
        : (integrations.stripe_secret_key || integrations.stripe_test_secret_key);

    return String(secret || '').trim();
}

async function getStripeClientForOffer(offerId, mode) {
    var integrations = await offerRuntime.getOfferRuntimeIntegrations(offerId);
    var secret = pickSecret(integrations, mode || 'test');

    if (!secret) {
        var err = new Error('Stripe não configurado para esta oferta. Guarda a secret key em Integrações.');
        err.code = 'STRIPE_NOT_CONFIGURED';
        throw err;
    }

    return {
        stripe: new Stripe(secret),
        mode: mode === 'live' ? 'live' : 'test',
        integrations: integrations,
    };
}

function buildLookupKey(offerId, kind, suffix) {
    return [
        'hub',
        String(offerId || '').trim().toLowerCase(),
        kind,
        String(suffix || 'main').trim().toLowerCase(),
    ].join('-').replace(/[^a-z0-9_-]/g, '-');
}

async function findPriceByLookupKey(stripe, lookupKey) {
    var existing = await stripe.prices.list({
        lookup_keys: [lookupKey],
        active: true,
        limit: 1,
    });

    return existing.data && existing.data[0] ? existing.data[0] : null;
}

async function ensureProductAndPrice(options) {
    var offerId = String(options.offerId || '').trim();
    var mode = options.mode === 'live' ? 'live' : 'test';
    var amountCents = parseInt(options.amount_cents, 10);
    var currency = String(options.currency || 'eur').trim().toLowerCase();
    var name = String(options.name || offerId).trim();
    var kind = String(options.kind || 'main').trim();
    var bumpId = String(options.bump_id || 'main').trim();

    if (!Number.isFinite(amountCents) || amountCents < 50) {
        throw new Error('amount_cents inválido (mínimo 50).');
    }

    var client = await getStripeClientForOffer(offerId, mode);
    var stripe = client.stripe;
    var lookupKey = buildLookupKey(offerId, kind, bumpId);
    var existingPrice = await findPriceByLookupKey(stripe, lookupKey);

    if (existingPrice &&
        existingPrice.unit_amount === amountCents &&
        String(existingPrice.currency || '').toLowerCase() === currency) {
        return {
            ok: true,
            existed: true,
            product_id: typeof existingPrice.product === 'string'
                ? existingPrice.product
                : (existingPrice.product && existingPrice.product.id) || '',
            price_id: existingPrice.id,
            lookup_key: lookupKey,
            amount_cents: amountCents,
            currency: currency,
            mode: mode,
        };
    }

    var productId = '';

    if (existingPrice) {
        productId = typeof existingPrice.product === 'string'
            ? existingPrice.product
            : (existingPrice.product && existingPrice.product.id) || '';
    }

    if (!productId) {
        var product = await stripe.products.create({
            name: name,
            metadata: {
                offer_id: offerId,
                hub_kind: kind,
                bump_id: bumpId,
            },
        });
        productId = product.id;
    } else {
        try {
            await stripe.products.update(productId, { name: name });
        } catch (_) {
            /* name update is best-effort */
        }
    }

    var price = await stripe.prices.create({
        product: productId,
        unit_amount: amountCents,
        currency: currency,
        lookup_key: lookupKey,
        transfer_lookup_key: Boolean(existingPrice),
        metadata: {
            offer_id: offerId,
            hub_kind: kind,
            bump_id: bumpId,
        },
    });

    if (existingPrice && existingPrice.id !== price.id) {
        try {
            await stripe.prices.update(existingPrice.id, { active: false });
        } catch (_) {
            /* archive old price best-effort */
        }
    }

    return {
        ok: true,
        existed: false,
        product_id: productId,
        price_id: price.id,
        lookup_key: lookupKey,
        amount_cents: amountCents,
        currency: currency,
        mode: mode,
    };
}

async function configureOfferCheckoutCatalog(options) {
    var offerId = String(options.offerId || '').trim();
    var mode = options.mode === 'live' ? 'live' : 'test';
    var currency = String(options.currency || 'eur').trim().toLowerCase();
    var mainAmount = parseInt(options.amount_cents, 10);
    var bumps = Array.isArray(options.bumps) ? options.bumps : [];
    var offerName = String(options.name || offerId).trim();

    var main = await ensureProductAndPrice({
        offerId: offerId,
        mode: mode,
        amount_cents: mainAmount,
        currency: currency,
        name: offerName,
        kind: 'main',
        bump_id: 'main',
    });

    var checkoutPatch = {
        amount_cents: mainAmount,
        currency: currency,
        label: offerName,
    };

    if (mode === 'test') {
        checkoutPatch.stripe_test_price_id = main.price_id;
    } else {
        checkoutPatch.stripe_price_id = main.price_id;
    }

    // Persist price ids directly on checkout row.
    var supabase = getSupabaseAdmin();

    if (supabase) {
        var updates = {
            amount_cents: mainAmount,
            currency: currency,
            label: 'Checkout Principal',
            updated_at: new Date().toISOString(),
        };

        if (mode === 'test') {
            updates.stripe_test_price_id = main.price_id;
        } else {
            updates.stripe_price_id = main.price_id;
        }

        await supabase
            .from('hub_offer_checkouts')
            .update(updates)
            .eq('offer_id', offerId)
            .eq('checkout_id', 'main');
    } else {
        await offerProvisioning.updateMainCheckout(offerId, Object.assign({}, checkoutPatch, {
            skipCommerceSync: true,
        }));
    }

    var bumpResults = [];

    for (var i = 0; i < bumps.length; i += 1) {
        var bump = bumps[i] || {};
        var bumpAmount = parseInt(bump.amount_cents, 10);
        var bumpId = String(bump.bump_id || ('bump-' + (i + 1))).trim();
        var bumpLabel = String(bump.label || bumpId).trim();

        var ensured = await ensureProductAndPrice({
            offerId: offerId,
            mode: mode,
            amount_cents: bumpAmount,
            currency: currency,
            name: offerName + ' — ' + bumpLabel,
            kind: 'bump',
            bump_id: bumpId,
        });

        var productId = offerId + '-' + bumpId;
        var existingProduct = await supabase
            .from('products')
            .select('id')
            .eq('id', productId)
            .maybeSingle();

        if (!existingProduct.data) {
            await supabase.from('products').insert({
                id: productId,
                name: bumpLabel,
                description: '',
                image_url: null,
                sort_order: (i + 1) * 10,
                offer_id: offerId,
            });
        }

        await orderBumps.upsertOrderBump(offerId, {
            bump_id: bumpId,
            product_id: productId,
            label: bumpLabel,
            amount_cents: bumpAmount,
            sort_order: (i + 1) * 10,
            is_active: true,
        }, { skipCommerceSync: true });

        bumpResults.push(Object.assign({}, ensured, {
            bump_id: bumpId,
            label: bumpLabel,
            product_id: productId,
        }));
    }

    return {
        ok: true,
        offer_id: offerId,
        mode: mode,
        main: main,
        bumps: bumpResults,
    };
}

async function ensureWebhookEndpoint(options) {
    var offerId = String(options.offerId || '').trim();
    var mode = options.mode === 'live' ? 'live' : 'test';
    var endpointUrl = String(options.url || '').trim();

    if (!endpointUrl) {
        endpointUrl = String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '').replace(/\/$/, '') +
            '/api/stripe-webhook?offer=' + encodeURIComponent(offerId);
    }

    var client = await getStripeClientForOffer(offerId, mode);
    var stripe = client.stripe;
    var existing = await stripe.webhookEndpoints.list({ limit: 100 });
    var match = (existing.data || []).find(function (row) {
        return row.url === endpointUrl;
    });

    var enabledEvents = options.events || [
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'payment_intent.canceled',
        'charge.refunded',
        'checkout.session.completed',
    ];

    if (match) {
        var updated = await stripe.webhookEndpoints.update(match.id, {
            enabled_events: enabledEvents,
            description: 'HUB DR — ' + offerId,
        });

        return {
            ok: true,
            existed: true,
            id: updated.id,
            url: updated.url,
            secret: null,
            note: 'Webhook já existia — secret não é re-exposto pela API Stripe. Guarda o secret actual em Integrações se já o tiveres.',
        };
    }

    var created = await stripe.webhookEndpoints.create({
        url: endpointUrl,
        enabled_events: enabledEvents,
        description: 'HUB DR — ' + offerId,
        metadata: { offer_id: offerId },
    });

    if (created.secret) {
        var integrationsStore = require('./integrations-store');
        await integrationsStore.saveOfferIntegrations(offerId, {
            stripe_webhook_secret: created.secret,
        });
    }

    return {
        ok: true,
        existed: false,
        id: created.id,
        url: created.url,
        secret_saved: Boolean(created.secret),
    };
}

module.exports = {
    getStripeClientForOffer: getStripeClientForOffer,
    ensureProductAndPrice: ensureProductAndPrice,
    configureOfferCheckoutCatalog: configureOfferCheckoutCatalog,
    ensureWebhookEndpoint: ensureWebhookEndpoint,
    buildLookupKey: buildLookupKey,
};
