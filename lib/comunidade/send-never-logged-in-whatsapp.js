var welcomeMessage = require('../whatsapp/welcome-message');
var evolutionApi = require('../whatsapp/evolution-api');
var phoneUtils = require('../whatsapp/phone');
var sendPurchaseEmail = require('./send-purchase-email');

async function wasFollowUpAlreadySent(admin, memberId) {
    var referenceId = 'followup-never-login-' + memberId;

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

function hasLoggedIn(member) {
    if (!member) {
        return false;
    }

    if (member.last_login_at) {
        return true;
    }

    return member.login_count != null && Number(member.login_count) > 0;
}

async function logFollowUpSent(admin, memberId, phoneDigits, messageType) {
    var referenceId = 'followup-never-login-' + memberId;

    try {
        await admin.from('whatsapp_message_log').insert({
            reference_id: referenceId,
            member_id: memberId,
            phone: phoneDigits,
            message_type: messageType || 'never_logged_in_followup',
        });
    } catch (error) {
        console.warn('Não foi possível registar whatsapp follow-up:', error.message);
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

/**
 * @param {{
 *   admin: object,
 *   member: object,
 *   productIds: string[],
 *   phone?: string,
 *   phoneCountry?: string,
 * }} options
 */
async function sendNeverLoggedInFollowUp(options) {
    if (!evolutionApi.isEnabled()) {
        return { skipped: true, reason: 'disabled' };
    }

    var admin = options.admin;
    var member = options.member;

    if (!admin || !member || !member.id) {
        return { skipped: true, reason: 'missing_data' };
    }

    if (hasLoggedIn(member)) {
        return { skipped: true, reason: 'logged_in' };
    }

    if (await wasFollowUpAlreadySent(admin, member.id)) {
        return { skipped: true, reason: 'already_sent' };
    }

    var phoneDigits = phoneUtils.normalizePhoneForWhatsApp(
        options.phone || member.phone || '',
        options.phoneCountry || member.phone_country || 'PT'
    );

    if (!phoneDigits) {
        return { skipped: true, reason: 'missing_phone' };
    }

    var productNames = await sendPurchaseEmail.resolveProductNames(admin, options.productIds || []);
    var text = welcomeMessage.buildNeverLoggedInFollowUpMessage({
        fullName: member.full_name || '',
        email: member.email,
        productNames: productNames,
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
            await logFollowUpSent(admin, member.id, phoneDigits, 'never_logged_in_followup_skipped');
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

    await logFollowUpSent(admin, member.id, phoneDigits, 'never_logged_in_followup');

    if (!member.phone && options.phone) {
        await admin.from('members').update({
            phone: options.phone,
            phone_country: options.phoneCountry || member.phone_country || 'PT',
            updated_at: new Date().toISOString(),
        }).eq('id', member.id);
    }

    return {
        ok: true,
        email: member.email,
        phone: phoneDigits,
        message_id: sendResult.message_id || '',
    };
}

module.exports = {
    sendNeverLoggedInFollowUp: sendNeverLoggedInFollowUp,
    wasFollowUpAlreadySent: wasFollowUpAlreadySent,
    hasLoggedIn: hasLoggedIn,
};
