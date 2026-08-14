var welcomeMessage = require('../whatsapp/welcome-message');
var lifecycleEmail = require('../email/lifecycle-email');
var emailLog = require('../email/transactional-email-log');
var sendPurchaseEmail = require('./send-purchase-email');
var sendNeverLoggedInWhatsApp = require('./send-never-logged-in-whatsapp');

function getReferenceId(memberId) {
    return 'followup-never-login-email-' + memberId;
}

async function wasFollowUpEmailAlreadySent(admin, memberId) {
    return emailLog.wasEmailAlreadySent(admin, getReferenceId(memberId));
}

async function sendNeverLoggedInFollowUpEmail(options) {
    var admin = options.admin;
    var member = options.member;

    if (!admin || !member || !member.id || !member.email) {
        return { skipped: true, reason: 'missing_data' };
    }

    if (sendNeverLoggedInWhatsApp.hasLoggedIn(member)) {
        return { skipped: true, reason: 'logged_in' };
    }

    if (await wasFollowUpEmailAlreadySent(admin, member.id)) {
        return { skipped: true, reason: 'already_sent' };
    }

    var productNames = await sendPurchaseEmail.resolveProductNames(admin, options.productIds || []);
    var text = welcomeMessage.buildNeverLoggedInFollowUpMessage({
        fullName: member.full_name || '',
        email: member.email,
        productNames: productNames,
    });

    var sendResult = await lifecycleEmail.sendLifecycleEmail({
        email: member.email,
        subject: '[Onda Prodígio] Acesso à área de membros',
        text: text,
    });

    if (!sendResult.ok) {
        return sendResult;
    }

    await emailLog.logSentEmail(admin, getReferenceId(member.id), member.id, 'never_logged_in_followup');

    return {
        ok: true,
        email: member.email,
        message_id: sendResult.messageId || '',
    };
}

module.exports = {
    getReferenceId: getReferenceId,
    wasFollowUpEmailAlreadySent: wasFollowUpEmailAlreadySent,
    sendNeverLoggedInFollowUpEmail: sendNeverLoggedInFollowUpEmail,
};
