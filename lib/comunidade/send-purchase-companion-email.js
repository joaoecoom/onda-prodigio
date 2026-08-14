var welcomeMessage = require('../whatsapp/welcome-message');
var lifecycleEmail = require('../email/lifecycle-email');
var emailLog = require('../email/transactional-email-log');
var sendPurchaseEmail = require('./send-purchase-email');
var nextProductOffer = require('./next-product-offer');

function getReferenceId(referenceId) {
    return 'companion-email-' + referenceId;
}

async function maybeSendAfterGrant(options) {
    var admin = options.admin;
    var referenceId = getReferenceId(options.referenceId);

    if (!admin || !options.email || !options.referenceId) {
        return { skipped: true, reason: 'missing_data' };
    }

    if (await emailLog.wasEmailAlreadySent(admin, referenceId)) {
        return { skipped: true, reason: 'already_sent' };
    }

    var productNames = await sendPurchaseEmail.resolveProductNames(admin, options.productIds || []);
    var text;
    var emailType;

    if (options.provisionalPassword) {
        emailType = 'welcome_companion';
        text = welcomeMessage.buildWelcomeMessage({
            fullName: options.fullName || options.member.full_name || '',
            email: options.email,
            productNames: productNames,
            phoneDigits: options.email,
        });
    } else {
        emailType = 'confirmation_companion';
        var nextOffer = options.nextProductOffer;

        if (!nextOffer) {
            nextOffer = await nextProductOffer.resolveNextProductOffer(
                admin,
                options.member.id,
                options.productIds || []
            );
        }

        text = welcomeMessage.buildConfirmationMessage({
            fullName: options.fullName || options.member.full_name || '',
            email: options.email,
            productNames: productNames,
            nextProductOffer: nextOffer,
        });
    }

    var sendResult = await lifecycleEmail.sendLifecycleEmail({
        email: options.email,
        subject: options.provisionalPassword
            ? '[Onda Prodígio] Bem-vinda/o — dados de acesso'
            : '[Onda Prodígio] Novos conteúdos desbloqueados',
        text: text,
    });

    if (!sendResult.ok) {
        console.error('Falha ao enviar email companion de compra:', options.email, sendResult.reason || 'send_failed');
        return sendResult;
    }

    await emailLog.logSentEmail(admin, referenceId, options.member.id, emailType);

    return {
        ok: true,
        email_type: emailType,
        message_id: sendResult.messageId || '',
    };
}

module.exports = {
    maybeSendAfterGrant: maybeSendAfterGrant,
};
