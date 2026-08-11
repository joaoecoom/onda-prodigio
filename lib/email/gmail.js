var nodemailer = require('nodemailer');

function getGmailConfig() {
    return {
        user: String(process.env.GMAIL_USER || 'suporte.angelacampos@gmail.com').trim(),
        appPassword: String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''),
        fromName: String(process.env.GMAIL_FROM_NAME || 'Angela Campos — Onda Prodígio').trim(),
    };
}

function isConfigured() {
    var config = getGmailConfig();
    return Boolean(config.user && config.appPassword);
}

function createTransport() {
    var config = getGmailConfig();

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
 * @param {{ to: string, subject: string, text?: string, html?: string, replyTo?: string }} options
 */
async function sendMail(options) {
    if (!isConfigured()) {
        return {
            ok: false,
            skipped: true,
            reason: 'Gmail SMTP não configurado (GMAIL_APP_PASSWORD em falta).',
        };
    }

    var config = getGmailConfig();
    var transport = createTransport();

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
    };
}

module.exports = {
    getGmailConfig: getGmailConfig,
    isConfigured: isConfigured,
    sendMail: sendMail,
};
