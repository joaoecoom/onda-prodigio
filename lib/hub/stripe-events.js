'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');

async function claimStripeEvent(event) {
    var admin = getSupabaseAdmin();

    if (!event || !event.id) {
        return { ok: false, skipped: true, reason: 'missing_event' };
    }

    var admin = getSupabaseAdmin();

    if (!admin) {
        return { ok: false, skipped: true, reason: 'no_database' };
    }

    var paymentIntentId = '';
    var offerId = '';
    var obj = event.data && event.data.object ? event.data.object : null;

    if (obj) {
        if (typeof obj.payment_intent === 'string') {
            paymentIntentId = obj.payment_intent;
        } else if (obj.object === 'payment_intent') {
            paymentIntentId = obj.id || '';
        }

        if (obj.metadata && obj.metadata.offer_id) {
            offerId = String(obj.metadata.offer_id).trim();
        }
    }

    var insertResult = await admin
        .from('hub_stripe_events')
        .insert({
            event_id: event.id,
            event_type: event.type || 'unknown',
            offer_id: offerId || null,
            payment_intent_id: paymentIntentId || null,
        })
        .select('event_id')
        .single();

    if (insertResult.error) {
        if (insertResult.error.code === '23505') {
            return {
                ok: true,
                already_processed: true,
            };
        }

        throw new Error(insertResult.error.message || 'Não foi possível registar evento Stripe.');
    }

    return {
        ok: true,
        already_processed: false,
        event_id: insertResult.data.event_id,
    };
}

module.exports = {
    claimStripeEvent: claimStripeEvent,
};
