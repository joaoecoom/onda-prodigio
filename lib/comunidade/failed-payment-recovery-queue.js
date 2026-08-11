var Stripe = require('stripe');
var supabaseAdmin = require('../supabase-admin');
var stripeFailedPayments = require('../metrics/stripe-failed-payments');
var stripeSales = require('../metrics/stripe-sales');
var sendFailedPaymentWhatsApp = require('./send-failed-payment-whatsapp');
var phoneUtils = require('../whatsapp/phone');

var DELAY_MS = 45 * 1000;
var BACKFILL_FROM = '2026-07-15';
var BACKFILL_SPACING_MS = 12 * 60 * 1000;

function delayMs() {
    var env = parseInt(process.env.FAILED_PAYMENT_WHATSAPP_DELAY_MS || '', 10);
    return Number.isFinite(env) && env >= 0 ? env : DELAY_MS;
}

function contactKey(email, phoneDigits) {
    var normalizedEmail = email ? supabaseAdmin.normalizeEmail(email) : '';
    if (normalizedEmail) {
        return 'email:' + normalizedEmail;
    }

    return phoneDigits ? 'phone:' + phoneDigits : '';
}

async function cancelPendingForContact(admin, email, phoneDigits, reason) {
    var normalizedEmail = email ? supabaseAdmin.normalizeEmail(email) : '';

    if (normalizedEmail) {
        await admin
            .from('failed_payment_recovery_queue')
            .update({
                status: 'cancelled',
                skip_reason: reason || 'superseded',
                processed_at: new Date().toISOString(),
            })
            .eq('status', 'pending')
            .eq('email', normalizedEmail);
    }

    if (phoneDigits) {
        await admin
            .from('failed_payment_recovery_queue')
            .update({
                status: 'cancelled',
                skip_reason: reason || 'superseded',
                processed_at: new Date().toISOString(),
            })
            .eq('status', 'pending')
            .eq('phone', phoneDigits);
    }
}

/**
 * @param {{ paymentIntent: object, admin?: object, immediate?: boolean }} options
 */
async function enqueueFailedPaymentRecovery(options) {
    var paymentIntent = options.paymentIntent;

    if (!paymentIntent || !paymentIntent.id) {
        return { skipped: true, reason: 'missing_data' };
    }

    var metadata = paymentIntent.metadata || {};

    if (metadata.stripe_mode === 'test' || metadata.checkout === 'checkout9-test') {
        return { skipped: true, reason: 'test_mode' };
    }

    if (!stripeFailedPayments.isFailedCheckoutPayment(paymentIntent)) {
        return { skipped: true, reason: 'not_failed_checkout' };
    }

    var admin = options.admin || supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        return { skipped: true, reason: 'missing_admin' };
    }

    var email = metadata.email || metadata.customer_email || paymentIntent.receipt_email || '';
    var normalizedEmail = email ? supabaseAdmin.normalizeEmail(email) : '';
    var phoneDigits = phoneUtils.normalizePhoneForWhatsApp(
        metadata.phone || '',
        metadata.phone_country || metadata.country || 'PT'
    );

    if (!phoneDigits) {
        return { skipped: true, reason: 'missing_phone' };
    }

    if (normalizedEmail && await sendFailedPaymentWhatsApp.memberAlreadyPurchased(admin, normalizedEmail)) {
        return { skipped: true, reason: 'already_purchased' };
    }

    if (await sendFailedPaymentWhatsApp.wasRecoveryAlreadySent(admin, paymentIntent.id)) {
        return { skipped: true, reason: 'already_sent' };
    }

    var existingQueue = await admin
        .from('failed_payment_recovery_queue')
        .select('id, status')
        .eq('payment_intent_id', paymentIntent.id)
        .maybeSingle();

    if (existingQueue.data) {
        return { skipped: true, reason: 'already_queued', queue_id: existingQueue.data.id };
    }

    await cancelPendingForContact(admin, normalizedEmail, phoneDigits, 'superseded_by_new_failure');

    var sendAfter = new Date(Date.now() + (options.immediate ? 0 : delayMs())).toISOString();

    var insertResult = await admin
        .from('failed_payment_recovery_queue')
        .insert({
            payment_intent_id: paymentIntent.id,
            email: normalizedEmail || null,
            phone: phoneDigits,
            phone_country: metadata.phone_country || metadata.country || 'PT',
            full_name: metadata.full_name || null,
            send_after: sendAfter,
            status: 'pending',
        })
        .select('id, send_after')
        .single();

    if (insertResult.error) {
        throw insertResult.error;
    }

    return {
        ok: true,
        queued: true,
        queue_id: insertResult.data.id,
        payment_intent_id: paymentIntent.id,
        send_after: insertResult.data.send_after,
    };
}

async function markQueueItem(admin, queueId, status, skipReason) {
    await admin
        .from('failed_payment_recovery_queue')
        .update({
            status: status,
            skip_reason: skipReason || null,
            processed_at: new Date().toISOString(),
        })
        .eq('id', queueId);
}

async function buildPaymentIntentForQueue(stripe, queueItem) {
    if (!stripe) {
        return null;
    }

    try {
        return await stripe.paymentIntents.retrieve(queueItem.payment_intent_id);
    } catch (error) {
        return {
            id: queueItem.payment_intent_id,
            status: 'requires_payment_method',
            metadata: {
                email: queueItem.email || '',
                phone: queueItem.phone || '',
                phone_country: queueItem.phone_country || 'PT',
                full_name: queueItem.full_name || '',
                checkout: 'checkout9',
            },
        };
    }
}

async function processNextFailedPaymentRecovery() {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var pendingResult = await admin
        .from('failed_payment_recovery_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('send_after', new Date().toISOString())
        .order('send_after', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (pendingResult.error) {
        throw pendingResult.error;
    }

    if (!pendingResult.data) {
        var countResult = await admin
            .from('failed_payment_recovery_queue')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');

        return {
            ok: true,
            done: true,
            sent: null,
            pending_count: countResult.count || 0,
        };
    }

    var queueItem = pendingResult.data;
    var secretKey = process.env.STRIPE_SECRET_KEY;
    var stripe = secretKey ? new Stripe(secretKey) : null;
    var paymentIntent = await buildPaymentIntentForQueue(stripe, queueItem);

    if (paymentIntent && paymentIntent.status === 'succeeded') {
        await markQueueItem(admin, queueItem.id, 'skipped', 'payment_succeeded');
        return {
            ok: true,
            done: false,
            sent: null,
            skipped: {
                payment_intent_id: queueItem.payment_intent_id,
                reason: 'payment_succeeded',
            },
            pending_count: null,
        };
    }

    if (queueItem.email && await sendFailedPaymentWhatsApp.memberAlreadyPurchased(admin, queueItem.email)) {
        await markQueueItem(admin, queueItem.id, 'skipped', 'already_purchased');
        return {
            ok: true,
            done: false,
            sent: null,
            skipped: {
                email: queueItem.email,
                reason: 'already_purchased',
            },
            pending_count: null,
        };
    }

    var sendResult = await sendFailedPaymentWhatsApp.sendFailedPaymentRecovery({
        admin: admin,
        paymentIntent: paymentIntent,
    });

    if (sendResult.ok) {
        await markQueueItem(admin, queueItem.id, 'sent', null);
    } else if (sendResult.skipped) {
        await markQueueItem(admin, queueItem.id, 'skipped', sendResult.reason || 'skipped');
    } else {
        await markQueueItem(admin, queueItem.id, 'failed', sendResult.reason || 'send_failed');
        return {
            ok: false,
            done: false,
            sent: null,
            reason: sendResult.reason || 'send_failed',
            pending_count: null,
        };
    }

    var remaining = await admin
        .from('failed_payment_recovery_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

    return {
        ok: true,
        done: false,
        sent: sendResult.ok ? {
            email: sendResult.email || queueItem.email || '',
            phone: sendResult.phone || queueItem.phone,
            payment_intent_id: queueItem.payment_intent_id,
            message_id: sendResult.message_id || '',
        } : null,
        skipped: sendResult.skipped ? {
            email: queueItem.email || '',
            phone: queueItem.phone,
            reason: sendResult.reason || 'skipped',
        } : null,
        pending_count: Math.max(0, (remaining.count || 0)),
    };
}

async function enqueueBackfillItem(options) {
    var paymentIntent = options.paymentIntent;
    var admin = options.admin;
    var metadata = paymentIntent.metadata || {};
    var normalizedEmail = metadata.email || metadata.customer_email || paymentIntent.receipt_email || '';
    normalizedEmail = normalizedEmail ? supabaseAdmin.normalizeEmail(normalizedEmail) : '';
    var phoneDigits = phoneUtils.normalizePhoneForWhatsApp(
        metadata.phone || '',
        metadata.phone_country || metadata.country || 'PT'
    );

    if (!phoneDigits) {
        return { skipped: true, reason: 'missing_phone' };
    }

    if (normalizedEmail && await sendFailedPaymentWhatsApp.memberAlreadyPurchased(admin, normalizedEmail)) {
        return { skipped: true, reason: 'already_purchased' };
    }

    if (await sendFailedPaymentWhatsApp.wasRecoveryAlreadySent(admin, paymentIntent.id)) {
        return { skipped: true, reason: 'already_sent' };
    }

    var existingQueue = await admin
        .from('failed_payment_recovery_queue')
        .select('id, status')
        .eq('payment_intent_id', paymentIntent.id)
        .maybeSingle();

    if (existingQueue.data) {
        return { skipped: true, reason: 'already_queued', queue_id: existingQueue.data.id };
    }

    var insertResult = await admin
        .from('failed_payment_recovery_queue')
        .insert({
            payment_intent_id: paymentIntent.id,
            email: normalizedEmail || null,
            phone: phoneDigits,
            phone_country: metadata.phone_country || metadata.country || 'PT',
            full_name: metadata.full_name || null,
            send_after: options.sendAfter,
            status: 'pending',
        })
        .select('id, send_after')
        .single();

    if (insertResult.error) {
        throw insertResult.error;
    }

    return {
        ok: true,
        queued: true,
        queue_id: insertResult.data.id,
        payment_intent_id: paymentIntent.id,
        send_after: insertResult.data.send_after,
    };
}

async function enqueueBackfillSinceJuly15() {
    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new Error('STRIPE_SECRET_KEY em falta.');
    }

    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var stripe = new Stripe(secretKey);
    var bounds = stripeSales.resolveDateBounds({ from: BACKFILL_FROM, to: '' });
    var paymentIntents = await stripeSales.fetchPaymentIntents(stripe, bounds);
    var failed = paymentIntents.filter(stripeFailedPayments.isFailedCheckoutPayment);
    var latestByContact = {};

    failed.forEach(function (paymentIntent) {
        var summary = stripeFailedPayments.summarizeFailedPayment(paymentIntent);
        var phoneDigits = phoneUtils.normalizePhoneForWhatsApp(summary.phone, summary.phone_country);

        if (!phoneDigits) {
            return;
        }

        var key = contactKey(summary.email, phoneDigits);

        if (!key) {
            return;
        }

        if (!latestByContact[key] || summary.created > latestByContact[key].created) {
            latestByContact[key] = {
                paymentIntent: paymentIntent,
                created: summary.created,
            };
        }
    });

    var queued = [];
    var skipped = [];
    var contacts = Object.keys(latestByContact);
    var staggerIndex = 0;

    for (var i = 0; i < contacts.length; i += 1) {
        var contact = contacts[i];
        var entry = latestByContact[contact];

        try {
            var sendAfterOverride = new Date(Date.now() + (staggerIndex * BACKFILL_SPACING_MS)).toISOString();
            var result = await enqueueBackfillItem({
                admin: admin,
                paymentIntent: entry.paymentIntent,
                sendAfter: sendAfterOverride,
            });

            if (result.ok && result.queued) {
                staggerIndex += 1;
                queued.push({
                    payment_intent_id: result.payment_intent_id,
                    send_after: result.send_after,
                });
            } else {
                skipped.push({
                    payment_intent_id: entry.paymentIntent.id,
                    reason: result.reason || 'skipped',
                });
            }
        } catch (error) {
            skipped.push({
                payment_intent_id: entry.paymentIntent.id,
                reason: error.message || 'error',
            });
        }
    }

    return {
        ok: true,
        from: BACKFILL_FROM,
        scanned_failed: failed.length,
        unique_contacts: Object.keys(latestByContact).length,
        queued_count: queued.length,
        skipped_count: skipped.length,
        queued: queued,
        skipped: skipped,
    };
}

module.exports = {
    enqueueFailedPaymentRecovery: enqueueFailedPaymentRecovery,
    processNextFailedPaymentRecovery: processNextFailedPaymentRecovery,
    enqueueBackfillSinceJuly15: enqueueBackfillSinceJuly15,
    delayMs: delayMs,
};
