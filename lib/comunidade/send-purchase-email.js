var purchaseEmail = require('../email/purchase-email');

async function resolveProductNames(admin, productIds) {
    if (!productIds.length) {
        return [];
    }

    var result = await admin
        .from('products')
        .select('id, name')
        .in('id', productIds);

    if (result.error) {
        throw result.error;
    }

    var nameById = {};

    (result.data || []).forEach(function (row) {
        nameById[row.id] = row.name;
    });

    return productIds.map(function (productId) {
        return nameById[productId] || productId;
    });
}

async function wasEmailAlreadySent(admin, referenceId) {
    if (!referenceId) {
        return false;
    }

    try {
        var existing = await admin
            .from('purchase_email_log')
            .select('id')
            .eq('reference_id', referenceId)
            .maybeSingle();

        if (existing.error) {
            if (String(existing.error.message || '').toLowerCase().indexOf('purchase_email_log') !== -1) {
                return false;
            }

            throw existing.error;
        }

        return Boolean(existing.data);
    } catch (error) {
        console.warn('purchase_email_log indisponível:', error.message);
        return false;
    }
}

async function logSentEmail(admin, referenceId, memberId, emailType) {
    if (!referenceId) {
        return;
    }

    try {
        await admin.from('purchase_email_log').insert({
            reference_id: referenceId,
            member_id: memberId,
            email_type: emailType,
        });
    } catch (error) {
        console.warn('Não foi possível registar purchase_email_log:', error.message);
    }
}

/**
 * @param {{
 *   admin: object,
 *   member: object,
 *   email: string,
 *   fullName?: string,
 *   productIds: string[],
 *   referenceId: string,
 *   provisionalPassword?: string|null,
 *   hadPasswordSet: boolean
 * }} options
 */
async function maybeSendAfterGrant(options) {
    var admin = options.admin;
    var referenceId = options.referenceId;

    if (!admin || !options.email || !options.productIds || !options.productIds.length) {
        return { skipped: true, reason: 'missing_data' };
    }

    if (await wasEmailAlreadySent(admin, referenceId)) {
        return { skipped: true, reason: 'already_sent' };
    }

    var productNames = await resolveProductNames(admin, options.productIds);
    var emailType = options.provisionalPassword ? 'welcome' : 'confirmation';
    var sendResult;

    if (options.provisionalPassword) {
        sendResult = await purchaseEmail.sendWelcomeEmail({
            email: options.email,
            fullName: options.fullName || options.member.full_name || '',
            productNames: productNames,
            password: options.provisionalPassword,
        });
    } else {
        sendResult = await purchaseEmail.sendConfirmationEmail({
            email: options.email,
            fullName: options.fullName || options.member.full_name || '',
            productNames: productNames,
        });
    }

    if (!sendResult.ok) {
        console.error('Falha ao enviar email de compra:', options.email, sendResult.reason || 'send_failed');
        return {
            skipped: Boolean(sendResult.skipped),
            ok: false,
            reason: sendResult.reason || 'send_failed',
        };
    }

    await logSentEmail(admin, referenceId, options.member.id, emailType);

    return {
        ok: true,
        email_type: emailType,
        message_id: sendResult.messageId || '',
    };
}

/**
 * Reenvio manual a partir do /adm — gera nova password provisória.
 */
async function sendManualWelcomeEmail(options) {
    var admin = options.admin;
    var productIds = options.productIds || [];
    var productNames = await resolveProductNames(admin, productIds);
    var sendFn = options.retroactive ? purchaseEmail.sendRetroactiveWelcomeEmail : purchaseEmail.sendWelcomeEmail;

    var sendResult = await sendFn({
        email: options.email,
        fullName: options.fullName || '',
        productNames: productNames,
        password: options.password,
    });

    if (!sendResult.ok) {
        return sendResult;
    }

    await logSentEmail(
        admin,
        'manual-' + options.memberId + '-' + Date.now(),
        options.memberId,
        options.retroactive ? 'manual_retroactive' : 'manual_welcome'
    );

    return {
        ok: true,
        message_id: sendResult.messageId || '',
    };
}

module.exports = {
    resolveProductNames: resolveProductNames,
    maybeSendAfterGrant: maybeSendAfterGrant,
    sendManualWelcomeEmail: sendManualWelcomeEmail,
};
