var welcomeMessage = require('../whatsapp/welcome-message');
var lifecycleEmail = require('../email/lifecycle-email');
var emailLog = require('../email/transactional-email-log');
var supabaseAdmin = require('../supabase-admin');
var sendFailedPaymentWhatsApp = require('./send-failed-payment-whatsapp');

function getReferenceId(paymentIntentId) {
    return 'failed-payment-email-' + paymentIntentId;
}

async function wasRecoveryEmailAlreadySent(admin, paymentIntentId) {
    return emailLog.wasEmailAlreadySent(admin, getReferenceId(paymentIntentId));
}

async function sendFailedPaymentRecoveryEmail(options) {
    var paymentIntent = options.paymentIntent;

    if (!paymentIntent || !paymentIntent.id) {
        return { skipped: true, reason: 'missing_data' };
    }

    var metadata = paymentIntent.metadata || {};
    var email = supabaseAdmin.normalizeEmail(
        metadata.email || metadata.customer_email || paymentIntent.receipt_email || ''
    );

    if (!email) {
        return { skipped: true, reason: 'missing_email' };
    }

    if (metadata.stripe_mode === 'test' || metadata.checkout === 'checkout9-test') {
        return { skipped: true, reason: 'test_mode' };
    }

    var admin = options.admin || supabaseAdmin.getSupabaseAdmin();

    if (await wasRecoveryEmailAlreadySent(admin, paymentIntent.id)) {
        return { skipped: true, reason: 'already_sent' };
    }

    if (await sendFailedPaymentWhatsApp.memberAlreadyPurchased(admin, email)) {
        return { skipped: true, reason: 'already_purchased' };
    }

    var text = welcomeMessage.buildFailedPaymentRecoveryMessage({
        fullName: metadata.full_name || '',
        email: email,
    });

    var sendResult = await lifecycleEmail.sendLifecycleEmail({
        email: email,
        subject: '[Onda Prodígio] Concluir a tua compra',
        text: text,
    });

    if (!sendResult.ok) {
        return sendResult;
    }

    await emailLog.logSentEmail(admin, getReferenceId(paymentIntent.id), null, 'payment_failed_recovery');

    return {
        ok: true,
        email: email,
        payment_intent_id: paymentIntent.id,
        message_id: sendResult.messageId || '',
    };
}

module.exports = {
    getReferenceId: getReferenceId,
    wasRecoveryEmailAlreadySent: wasRecoveryEmailAlreadySent,
    sendFailedPaymentRecoveryEmail: sendFailedPaymentRecoveryEmail,
};
