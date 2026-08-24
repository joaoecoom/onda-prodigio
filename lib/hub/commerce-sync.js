'use strict';

/**
 * Sync Hub commerce (main checkout + order bumps) → Stripe catalog + webhook.
 * Best-effort when Stripe keys are missing; never blocks Hub DB writes.
 */

var { getSupabaseAdmin } = require('../supabase-admin');
var stripeCatalog = require('./stripe-catalog');
var orderBumps = require('./order-bumps');

async function loadOfferCheckout(offerId) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var offerResult = await supabase
        .from('hub_offers')
        .select('id, slug, name, primary_product_id')
        .eq('id', offerId)
        .maybeSingle();

    if (offerResult.error) {
        throw new Error(offerResult.error.message || 'Oferta indisponível.');
    }

    if (!offerResult.data) {
        throw new Error('Oferta não encontrada.');
    }

    var checkoutResult = await supabase
        .from('hub_offer_checkouts')
        .select('*')
        .eq('offer_id', offerId)
        .eq('checkout_id', 'main')
        .maybeSingle();

    if (checkoutResult.error) {
        throw new Error(checkoutResult.error.message || 'Checkout indisponível.');
    }

    return {
        offer: offerResult.data,
        checkout: checkoutResult.data || null,
    };
}

async function syncOfferCommerce(offerId, options) {
    var opts = options || {};
    var mode = opts.mode === 'live' ? 'live' : 'test';
    var ensureWebhook = opts.ensureWebhook !== false;
    var id = String(offerId || '').trim();

    if (!id) {
        throw new Error('offerId em falta.');
    }

    var loaded = await loadOfferCheckout(id);
    var offer = loaded.offer;
    var checkout = loaded.checkout;

    if (!checkout) {
        return {
            ok: false,
            skipped: true,
            reason: 'checkout_missing',
        };
    }

    var amountCents = parseInt(checkout.amount_cents, 10);
    var currency = String(checkout.currency || 'eur').trim().toLowerCase();
    var offerName = String(offer.name || offer.slug || id).trim();

    var main;
    var bumpsSynced = [];

    try {
        main = await stripeCatalog.ensureProductAndPrice({
            offerId: id,
            mode: mode,
            amount_cents: amountCents,
            currency: currency,
            name: offerName,
            kind: 'main',
            bump_id: 'main',
        });
    } catch (error) {
        if (error && error.code === 'STRIPE_NOT_CONFIGURED') {
            return {
                ok: false,
                skipped: true,
                reason: 'stripe_not_configured',
                message: error.message,
            };
        }

        throw error;
    }

    var supabase = getSupabaseAdmin();
    var pricePatch = {
        updated_at: new Date().toISOString(),
    };

    if (mode === 'test') {
        pricePatch.stripe_test_price_id = main.price_id;
    } else {
        pricePatch.stripe_price_id = main.price_id;
    }

    if (supabase) {
        await supabase
            .from('hub_offer_checkouts')
            .update(pricePatch)
            .eq('offer_id', id)
            .eq('checkout_id', 'main');
    }

    var bumps = await orderBumps.listOrderBumps(id, { activeOnly: false });

    for (var i = 0; i < bumps.length; i += 1) {
        var bump = bumps[i];

        if (!bump || bump.is_active === false) {
            continue;
        }

        var ensured = await stripeCatalog.ensureProductAndPrice({
            offerId: id,
            mode: mode,
            amount_cents: bump.amount_cents,
            currency: currency,
            name: offerName + ' — ' + (bump.label || bump.bump_id),
            kind: 'bump',
            bump_id: bump.bump_id,
        });

        bumpsSynced.push({
            bump_id: bump.bump_id,
            label: bump.label,
            price_id: ensured.price_id,
            product_id: ensured.product_id,
            existed: ensured.existed,
        });
    }

    var webhook = null;

    if (ensureWebhook) {
        try {
            webhook = await stripeCatalog.ensureWebhookEndpoint({
                offerId: id,
                mode: mode,
            });
        } catch (error) {
            webhook = {
                ok: false,
                error: error.message || 'webhook_failed',
                code: error.code || null,
            };
        }
    }

    return {
        ok: true,
        offer_id: id,
        mode: mode,
        main: main,
        bumps: bumpsSynced,
        webhook: webhook,
    };
}

async function syncOfferCommerceSafe(offerId, options) {
    try {
        return await syncOfferCommerce(offerId, options);
    } catch (error) {
        return {
            ok: false,
            error: error.message || 'commerce_sync_failed',
            code: error.code || null,
        };
    }
}

module.exports = {
    syncOfferCommerce: syncOfferCommerce,
    syncOfferCommerceSafe: syncOfferCommerceSafe,
};
