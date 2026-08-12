var gmail = require('./gmail');

function getSiteUrl() {
    return String(process.env.SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildCommentReplyEmail(options) {
    var productUrl = getSiteUrl() + '/comunidade/produto?id=' + encodeURIComponent(options.productId || 'onda-prodigio');
    var greeting = options.fullName ? ('Olá ' + escapeHtml(options.fullName) + ',') : 'Olá,';
    var preview = escapeHtml(String(options.replyPreview || '').slice(0, 220));

    var html = (
        '<div style="font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;">' +
            '<p>' + greeting + '</p>' +
            '<p>Recebeste uma resposta à tua dúvida na área de membros do <strong>Onda Prodígio</strong>.</p>' +
            '<blockquote style="margin:1rem 0;padding:0.75rem 1rem;border-left:3px solid #0077c8;background:#f8fafc;color:#334155;">' +
                preview + (String(options.replyPreview || '').length > 220 ? '…' : '') +
            '</blockquote>' +
            '<p style="margin-top:1rem;">' +
                '<a href="' + productUrl + '" style="display:inline-block;background:#0077c8;color:#fff;text-decoration:none;padding:0.65rem 1rem;border-radius:6px;font-weight:600;">Ver resposta na plataforma</a>' +
            '</p>' +
            '<p style="font-size:0.92em;color:#64748b;margin-top:1rem;">Se tiveres mais dúvidas, podes responder no mesmo tópico de comentários.</p>' +
            '<p>Com carinho,<br>Angela Campos</p>' +
        '</div>'
    );

    var text = [
        greeting.replace(/<[^>]+>/g, ''),
        '',
        'Recebeste uma resposta à tua dúvida na área de membros do Onda Prodígio.',
        '',
        String(options.replyPreview || '').slice(0, 400),
        '',
        'Ver resposta: ' + productUrl,
        '',
        'Com carinho,',
        'Angela Campos',
    ].join('\n');

    return {
        subject: '[Onda Prodígio] Tens uma nova resposta na comunidade',
        html: html,
        text: text,
    };
}

async function sendCommentReplyEmail(options) {
    if (!options || !options.email) {
        return { ok: false, skipped: true, reason: 'missing_email' };
    }

    var payload = buildCommentReplyEmail(options);

    return gmail.sendMail({
        to: options.email,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
    });
}

module.exports = {
    buildCommentReplyEmail: buildCommentReplyEmail,
    sendCommentReplyEmail: sendCommentReplyEmail,
};
