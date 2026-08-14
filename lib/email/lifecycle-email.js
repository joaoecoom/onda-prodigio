var gmail = require('./gmail');

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function textToHtml(text) {
    return String(text || '')
        .split('\n')
        .map(function (line) {
            var trimmed = line.trim();

            if (!trimmed) {
                return '<p style="margin:0.65rem 0 0;">&nbsp;</p>';
            }

            if (/^https?:\/\//.test(trimmed)) {
                return '<p style="margin:0.35rem 0 0;"><a href="' + escapeHtml(trimmed) + '">' + escapeHtml(trimmed) + '</a></p>';
            }

            return '<p style="margin:0.35rem 0 0;">' + escapeHtml(trimmed) + '</p>';
        })
        .join('');
}

function wrapEmailHtml(bodyHtml) {
    return (
        '<div style="font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;">' +
        bodyHtml +
        '<p style="margin-top:1.25rem;color:#6b7280;font-size:0.9em;">Equipa Onda Prodígio · Angela Campos</p>' +
        '</div>'
    );
}

function buildFromPlainText(options) {
    var text = String(options.text || '').trim();
    var subject = options.subject || '[Onda Prodígio]';

    return {
        subject: subject,
        text: text,
        html: wrapEmailHtml(textToHtml(text)),
    };
}

async function sendLifecycleEmail(options) {
    if (!options.email) {
        return { skipped: true, reason: 'missing_email' };
    }

    var content = buildFromPlainText({
        subject: options.subject,
        text: options.text,
    });

    return gmail.sendMail({
        to: options.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
    });
}

module.exports = {
    buildFromPlainText: buildFromPlainText,
    sendLifecycleEmail: sendLifecycleEmail,
};
