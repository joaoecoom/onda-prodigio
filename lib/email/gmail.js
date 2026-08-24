var nodemailer = require('nodemailer');

function getEnvGmailConfig() {
    return {
        user: String(process.env.GMAIL_USER || '').trim(),
        appPassword: String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''),
        fromName: String(process.env.GMAIL_FROM_NAME || '').trim(),
    };
}

function getGmailConfig(override) {
    if (override && override.user && override.appPassword) {
        return {
            user: String(override.user || '').trim(),
            appPassword: String(override.appPassword || '').replace(/\s/g, ''),
            fromName: String(override.fromName || '').trim() || 'HUB DR',
        };
    }

    var env = getEnvGmailConfig();

    return {
        user: env.user || 'suporte.angelacampos@gmail.com',
        appPassword: env.appPassword,
        fromName: env.fromName || 'Angela Campos — Onda Prodígio',
    };
}

function isConfigured(override) {
    var config = getGmailConfig(override);
    return Boolean(config.user && config.appPassword);
}

function createTransport(override) {
    var config = getGmailConfig(override);

    if (!config.user || !config.appPassword) {
        throw new Error('GMAIL_USER ou GMAIL_APP_PASSWORD em falta.');
    }

    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: config.user,
            pass: config.appPassword,
        },
    });
}

/**
 * @param {{ to: string, subject: string, text?: string, html?: string, replyTo?: string, offerId?: string, config?: object }} options
 */
async function sendMail(options) {
    var override = options.config || null;

    if (!override && options.offerId) {
        try {
            var runtime = require('../hub/offer-runtime-config');
            override = await runtime.resolveGmailConfig(options.offerId);
        } catch (error) {
            override = null;
        }
    }

    if (!isConfigured(override)) {
        return {
            ok: false,
            skipped: true,
            reason: 'Gmail SMTP não configurado (conta da oferta ou GMAIL_APP_PASSWORD em falta).',
        };
    }

    var config = getGmailConfig(override);
    var transport = createTransport(override);

    var message = {
        from: '"' + config.fromName + '" <' + config.user + '>',
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: options.html || undefined,
        replyTo: options.replyTo || config.user,
    };

    var result = await transport.sendMail(message);

    return {
        ok: true,
        messageId: result.messageId || '',
        offer_id: options.offerId || null,
    };
}

module.exports = {
    getGmailConfig: getGmailConfig,
    isConfigured: isConfigured,
    sendMail: sendMail,
};
