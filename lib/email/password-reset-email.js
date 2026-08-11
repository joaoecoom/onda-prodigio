var gmail = require('./gmail');
var purchaseEmail = require('./purchase-email');

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildResetUrl(token) {
    return purchaseEmail.getSiteUrl() + '/comunidade/redefinir-password?token=' + encodeURIComponent(token);
}

async function sendPasswordResetEmail(options) {
    var resetUrl = buildResetUrl(options.token);
    var greeting = options.fullName ? ('Olá ' + escapeHtml(options.fullName) + ',') : 'Olá,';

    var html = (
        '<div style="font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;">' +
            '<p>' + greeting + '</p>' +
            '<p>Recebemos um pedido para redefinir a password da tua conta na Comunidade Onda Prodígio.</p>' +
            '<p><a href="' + resetUrl + '" style="display:inline-block;padding:0.75rem 1rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Redefinir password</a></p>' +
            '<p>Ou copia este link para o browser:<br><a href="' + resetUrl + '">' + resetUrl + '</a></p>' +
            '<p>Este link expira em 1 hora. Se não pediste isto, ignora este email.</p>' +
            '<p>Com carinho,<br>Angela Campos</p>' +
        '</div>'
    );

    var text = [
        greeting.replace(/<[^>]+>/g, ''),
        '',
        'Recebemos um pedido para redefinir a password da tua conta na Comunidade Onda Prodígio.',
        '',
        'Redefinir password:',
        resetUrl,
        '',
        'Este link expira em 1 hora.',
        '',
        'Angela Campos',
    ].join('\n');

    return gmail.sendMail({
        to: options.email,
        subject: 'Redefinir password — Comunidade Onda Prodígio',
        html: html,
        text: text,
    });
}

module.exports = {
    sendPasswordResetEmail: sendPasswordResetEmail,
};
