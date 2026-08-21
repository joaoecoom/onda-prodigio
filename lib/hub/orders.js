'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var productsService = require('../comunidade/products-service');

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

async function upsertOrderFromPaymentIntent(paymentIntent) {
    var admin = getSupabaseAdmin();

    if (!admin || !paymentIntent || !paymentIntent.id) {
        return { skipped: true, reason: 'missing_payment_intent' };
    }

    var metadata = paymentIntent.metadata || {};
    var offerId = String(metadata.offer_id || '').trim();
    var productId = String(metadata.product_id || '').trim();
    var email = normalizeEmail(metadata.email || paymentIntent.receipt_email || '');

    if (!offerId || !productId || !email) {
        return { skipped: true, reason: 'missing_offer_product_or_email' };
    }

    await productsService.assertProductBelongsToOffer(productId, offerId);

    var row = {
        offer_id: offerId,
        product_id: productId,
        stripe_payment_intent_id: paymentIntent.id,
        customer_email: email,
        amount_cents: Number(paymentIntent.amount) || 0,
        currency: String(paymentIntent.currency || 'eur').toLowerCase(),
        status: paymentIntent.status === 'succeeded' ? 'paid' : 'failed',
        metadata: metadata,
        updated_at: new Date().toISOString(),
    };

    var result = await admin
        .from('hub_orders')
        .upsert(row, { onConflict: 'stripe_payment_intent_id' })
        .select('id, offer_id, product_id, stripe_payment_intent_id, status')
        .single();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível guardar a order.');
    }

    return {
        ok: true,
        order: result.data,
        created: true,
    };
}

async function markOrderRefundedFromCharge(charge) {
    if (!charge) {
        return { skipped: true, reason: 'missing_charge' };
    }

    var paymentIntentId = typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : (charge.payment_intent && charge.payment_intent.id) || '';

    if (!paymentIntentId) {
        return { skipped: true, reason: 'missing_payment_intent' };
    }

    var admin = getSupabaseAdmin();

    if (!admin) {
        return { skipped: true, reason: 'no_database' };
    }

    var existing = await admin
        .from('hub_orders')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

    if (existing.error) {
        throw new Error(existing.error.message || 'Não foi possível carregar order.');
    }

    if (!existing.data) {
        return { skipped: true, reason: 'order_not_found', payment_intent_id: paymentIntentId };
    }

    if (existing.data.status === 'refunded') {
        return {
            ok: true,
            skipped: true,
            reason: 'already_refunded',
            order: existing.data,
        };
    }

    var metadata = Object.assign({}, existing.data.metadata || {}, {
        refund_charge_id: charge.id || '',
        refunded_at: new Date().toISOString(),
    });

    var updateResult = await admin
        .from('hub_orders')
        .update({
            status: 'refunded',
            metadata: metadata,
            updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntentId)
        .select('id, offer_id, product_id, stripe_payment_intent_id, status, amount_cents')
        .single();

    if (updateResult.error) {
        throw new Error(updateResult.error.message || 'Não foi possível actualizar refund.');
    }

    return {
        ok: true,
        order: updateResult.data,
        refunded: true,
    };
}

module.exports = {
    upsertOrderFromPaymentIntent: upsertOrderFromPaymentIntent,
    markOrderRefundedFromCharge: markOrderRefundedFromCharge,
};
