var evolutionApi = require('../whatsapp/evolution-api');
var welcomeMessage = require('../whatsapp/welcome-message');
var phoneUtils = require('../whatsapp/phone');
var sendPurchaseEmail = require('./send-purchase-email');
var nextProductOffer = require('./next-product-offer');

async function wasWhatsAppAlreadySent(admin, referenceId) {
    if (!referenceId) {
        return false;
    }

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

async function logSentWhatsApp(admin, referenceId, memberId, phoneDigits, messageType) {
    if (!referenceId) {
        return;
    }

    try {
        await admin.from('whatsapp_message_log').insert({
            reference_id: referenceId,
            member_id: memberId,
            phone: phoneDigits,
            message_type: messageType,
        });
    } catch (error) {
        console.warn('Não foi possível registar whatsapp_message_log:', error.message);
    }
}

/**
 * @param {{
 *   admin: object,
 *   member: object,
 *   email: string,
 *   fullName?: string,
 *   phone?: string,
 *   phoneCountry?: string,
 *   productIds: string[],
 *   referenceId: string,
 *   provisionalPassword?: string|null,
 * }} options
 */
async function maybeSendAfterGrant(options) {
    if (!evolutionApi.isEnabled()) {
        return { skipped: true, reason: 'disabled' };
    }

    var admin = options.admin;
    var referenceId = 'wa-' + options.referenceId;

    if (!admin || !options.referenceId) {
        return { skipped: true, reason: 'missing_data' };
    }

    if (await wasWhatsAppAlreadySent(admin, referenceId)) {
        return { skipped: true, reason: 'already_sent' };
    }

    var phoneDigits = phoneUtils.normalizePhoneForWhatsApp(
        options.phone || options.member.phone || '',
        options.phoneCountry || options.member.phone_country || 'PT'
    );

    if (!phoneDigits) {
        return { skipped: true, reason: 'missing_phone' };
    }

    var productNames = await sendPurchaseEmail.resolveProductNames(admin, options.productIds || []);
    var messageType = options.provisionalPassword ? 'welcome' : 'confirmation';
    var text;
    var nextOffer = null;

    if (options.provisionalPassword) {
        text = welcomeMessage.buildWelcomeMessage({
            fullName: options.fullName || options.member.full_name || '',
            email: options.email,
            password: options.provisionalPassword,
            productNames: productNames,
            phoneDigits: phoneDigits,
        });
    } else {
        nextOffer = await nextProductOffer.resolveNextProductOffer(
            admin,
            options.member.id,
            options.productIds || []
        );

        text = welcomeMessage.buildConfirmationMessage({
            fullName: options.fullName || options.member.full_name || '',
            email: options.email,
            productNames: productNames,
            nextProductOffer: nextOffer,
        });
    }

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

        console.error('Falha ao enviar WhatsApp de compra:', options.email, sendResult.reason || 'send_failed');
        return {
            skipped: Boolean(sendResult.skipped),
            ok: false,
            reason: sendResult.reason || 'send_failed',
        };
    }

    await logSentWhatsApp(admin, referenceId, options.member.id, phoneDigits, messageType);

    return {
        ok: true,
        message_type: messageType,
        message_id: sendResult.message_id || '',
        phone: phoneDigits,
        next_product_offer: nextOffer,
    };
}

module.exports = {
    maybeSendAfterGrant: maybeSendAfterGrant,
};
