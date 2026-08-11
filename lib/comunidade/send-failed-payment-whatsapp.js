var welcomeMessage = require('../whatsapp/welcome-message');
var evolutionApi = require('../whatsapp/evolution-api');
var phoneUtils = require('../whatsapp/phone');
var supabaseAdmin = require('../supabase-admin');

async function wasRecoveryAlreadySent(admin, paymentIntentId) {
    var referenceId = 'failed-payment-' + paymentIntentId;

    try {
        var existing = await admin
            .from('whatsapp_message_log')
            .select('id')
            .eq('reference_id', referenceId)
            .maybeSingle();

        if (existing.error) {
            if (String(existing.error.message || '').toLowerCase().indexOf('whatsapp_message_log') !== -1) {
                return false;
            }

            throw existing.error;
        }

        return Boolean(existing.data);
    } catch (error) {
        console.warn('whatsapp_message_log indisponível:', error.message);
        return false;
    }
}

async function logRecoverySent(admin, paymentIntentId, phoneDigits, messageType) {
    var referenceId = 'failed-payment-' + paymentIntentId;

    try {
        await admin.from('whatsapp_message_log').insert({
            reference_id: referenceId,
            member_id: null,
            phone: phoneDigits,
            message_type: messageType || 'payment_failed_recovery',
        });
    } catch (error) {
        console.warn('Não foi possível registar whatsapp payment_failed:', error.message);
    }
}

function isInvalidWhatsAppNumber(sendResult) {
    if (!sendResult || sendResult.ok) {
        return false;
    }

    if (sendResult.reason !== 'http_400') {
        return false;
    }

    var body = sendResult.body || {};
    var message = body.response && body.response.message;

    if (Array.isArray(message)) {
        return message.some(function (item) {
            return item && item.exists === false;
        });
    }

    return false;
}

async function memberAlreadyPurchased(admin, email) {
    if (!admin || !email) {
        return false;
    }

    var normalizedEmail = supabaseAdmin.normalizeEmail(email);

    try {
        var memberResult = await admin
            .from('members')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (memberResult.error || !memberResult.data) {
            return false;
        }

        var productsResult = await admin
            .from('member_products')
            .select('id')
            .eq('member_id', memberResult.data.id)
            .limit(1);

        return Boolean(productsResult.data && productsResult.data.length);
    } catch (error) {
        console.warn('memberAlreadyPurchased ignorado:', error.message);
        return false;
    }
}

/**
 * @param {{ paymentIntent: object, admin?: object }} options
 */
async function sendFailedPaymentRecovery(options) {
    if (!evolutionApi.isEnabled()) {
        return { skipped: true, reason: 'disabled' };
    }

    var paymentIntent = options.paymentIntent;

    if (!paymentIntent || !paymentIntent.id) {
        return { skipped: true, reason: 'missing_data' };
    }

    var metadata = paymentIntent.metadata || {};
    var email = metadata.email || metadata.customer_email || paymentIntent.receipt_email || '';

    if (metadata.stripe_mode === 'test' || metadata.checkout === 'checkout9-test') {
        return { skipped: true, reason: 'test_mode' };
    }

    var admin = options.admin || supabaseAdmin.getSupabaseAdmin();

    if (await wasRecoveryAlreadySent(admin, paymentIntent.id)) {
        return { skipped: true, reason: 'already_sent' };
    }

    if (email && await memberAlreadyPurchased(admin, email)) {
        return { skipped: true, reason: 'already_purchased' };
    }

    var phoneDigits = phoneUtils.normalizePhoneForWhatsApp(
        metadata.phone || '',
        metadata.phone_country || metadata.country || 'PT'
    );

    if (!phoneDigits) {
        return { skipped: true, reason: 'missing_phone' };
    }

    var text = welcomeMessage.buildFailedPaymentRecoveryMessage({
        fullName: metadata.full_name || '',
        email: email,
    });

    var sendResult = await evolutionApi.sendTextMessage({
        phoneDigits: phoneDigits,
        text: text,
    });

    if (!sendResult.ok && !sendResult.skipped) {
        sendResult = await evolutionApi.sendTextMessage({
            phoneDigits: phoneDigits,
            text: text,
        });
    }

    if (!sendResult.ok) {
        if (sendResult.skipped) {
            return sendResult;
        }

        if (isInvalidWhatsAppNumber(sendResult)) {
            await logRecoverySent(admin, paymentIntent.id, phoneDigits, 'payment_failed_recovery_skipped');
            return {
                ok: false,
                skipped: true,
                reason: 'no_whatsapp_account',
                phone: phoneDigits,
            };
        }

        return {
            ok: false,
            reason: sendResult.reason || 'send_failed',
            body: sendResult.body || null,
        };
    }

    await logRecoverySent(admin, paymentIntent.id, phoneDigits, 'payment_failed_recovery');

    return {
        ok: true,
        email: email,
        phone: phoneDigits,
        payment_intent_id: paymentIntent.id,
        message_id: sendResult.message_id || '',
    };
}

module.exports = {
    sendFailedPaymentRecovery: sendFailedPaymentRecovery,
    wasRecoveryAlreadySent: wasRecoveryAlreadySent,
    memberAlreadyPurchased: memberAlreadyPurchased,
};
