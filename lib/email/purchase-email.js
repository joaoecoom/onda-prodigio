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

function renderProductList(productNames) {
    if (!productNames.length) {
        return '<p>Nenhum produto listado.</p>';
    }

    return (
        '<ul style="margin:0.75rem 0 0;padding-left:1.25rem;line-height:1.6;">' +
        productNames.map(function (name) {
            return '<li>' + escapeHtml(name) + '</li>';
        }).join('') +
        '</ul>'
    );
}

function buildWelcomeEmail(options) {
    var loginUrl = getSiteUrl() + '/comunidade/login';
    var productList = renderProductList(options.productNames || []);
    var greeting = options.fullName ? ('Olá ' + escapeHtml(options.fullName) + ',') : 'Olá,';

    var html = (
        '<div style="font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;">' +
            '<p>' + greeting + '</p>' +
            '<p>Obrigada pela tua compra. A tua área de membros já está pronta.</p>' +
            '<p style="font-size:0.95em;color:#4b5563;">Se não vires este email na caixa de entrada, verifica também <strong>Spam</strong> ou <strong>Promoções</strong>.</p>' +
            '<p><strong>Conteúdos desbloqueados:</strong></p>' +
            productList +
            '<p style="margin-top:1.25rem;"><strong>Como entrar:</strong></p>' +
            '<ol style="padding-left:1.25rem;margin:0.5rem 0 0;">' +
                '<li>Vai a <a href="' + loginUrl + '">' + loginUrl + '</a></li>' +
                '<li>Email: <strong>' + escapeHtml(options.email) + '</strong></li>' +
                '<li>Password provisória: <strong>' + escapeHtml(options.password) + '</strong></li>' +
            '</ol>' +
            '<p style="margin-top:1rem;">Guarda estes dados. Se tiveres dificuldades, responde a este email.</p>' +
            '<p>Com carinho,<br>Angela Campos</p>' +
        '</div>'
    );

    var text = [
        greeting.replace(/<[^>]+>/g, ''),
        '',
        'Obrigada pela tua compra. A tua área de membros já está pronta.',
        '',
        'Conteúdos desbloqueados:',
    ].concat(options.productNames || []).concat([
        '',
        'Como entrar:',
        '1. ' + loginUrl,
        '2. Email: ' + options.email,
        '3. Password provisória: ' + options.password,
        '',
        'Angela Campos',
    ]).join('\n');

    return {
        subject: '[Onda Prodígio] Os teus dados de acesso',
        html: html,
        text: text,
    };
}

function buildRetroactiveWelcomeEmail(options) {
    var loginUrl = getSiteUrl() + '/comunidade/login';
    var profileUrl = getSiteUrl() + '/comunidade/perfil';
    var productList = renderProductList(options.productNames || []);
    var greeting = options.fullName ? ('Olá ' + escapeHtml(options.fullName) + ',') : 'Olá,';

    var html = (
        '<div style="font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;">' +
            '<p>' + greeting + '</p>' +
            '<p>Obrigada pela tua compra e pela tua paciência.</p>' +
            '<p>Por medidas de segurança, o envio automático dos dados de acesso ficou temporariamente bloqueado no nosso servidor. Já está resolvido — e aqui estão os teus dados para entrares na área de membros.</p>' +
            '<p style="font-size:0.95em;color:#4b5563;">Se não vires este email na caixa de entrada, verifica também <strong>Spam</strong> ou <strong>Promoções</strong>.</p>' +
            '<p><strong>Conteúdos desbloqueados:</strong></p>' +
            productList +
            '<p style="margin-top:1.25rem;"><strong>Como entrar:</strong></p>' +
            '<ol style="padding-left:1.25rem;margin:0.5rem 0 0;">' +
                '<li>Vai a <a href="' + loginUrl + '">' + loginUrl + '</a></li>' +
                '<li>Email: <strong>' + escapeHtml(options.email) + '</strong></li>' +
                '<li>Password provisória: <strong>' + escapeHtml(options.password) + '</strong></li>' +
            '</ol>' +
            '<p style="margin-top:1rem;">Depois do primeiro acesso, podes alterar a password em <a href="' + profileUrl + '">Perfil</a>.</p>' +
            '<p>Se tiveres dificuldades, responde a este email.</p>' +
            '<p>Com carinho,<br>Angela Campos</p>' +
        '</div>'
    );

    var text = [
        greeting.replace(/<[^>]+>/g, ''),
        '',
        'Obrigada pela tua compra e pela tua paciência.',
        '',
        'Por medidas de segurança, o envio automático dos dados de acesso ficou temporariamente bloqueado no nosso servidor. Já está resolvido — e aqui estão os teus dados para entrares na área de membros.',
        '',
        'Conteúdos desbloqueados:',
    ].concat(options.productNames || []).concat([
        '',
        'Como entrar:',
        '1. ' + loginUrl,
        '2. Email: ' + options.email,
        '3. Password provisória: ' + options.password,
        '',
        'Depois do primeiro acesso, altera a password em: ' + profileUrl,
        '',
        'Angela Campos',
    ]).join('\n');

    return {
        subject: '[Onda Prodígio] Os teus dados de acesso',
        html: html,
        text: text,
    };
}

function buildConfirmationEmail(options) {
    var loginUrl = getSiteUrl() + '/comunidade/login';
    var productList = renderProductList(options.productNames || []);
    var greeting = options.fullName ? ('Olá ' + escapeHtml(options.fullName) + ',') : 'Olá,';

    var html = (
        '<div style="font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;">' +
            '<p>' + greeting + '</p>' +
            '<p>Confirmámos a tua compra e já desbloqueámos novos conteúdos na tua conta.</p>' +
            '<p><strong>Conteúdos desta compra:</strong></p>' +
            productList +
            '<p style="margin-top:1.25rem;">Entra com o teu email e a password que já usas:</p>' +
            '<p><a href="' + loginUrl + '">' + loginUrl + '</a></p>' +
            '<p>Com carinho,<br>Angela Campos</p>' +
        '</div>'
    );

    var text = [
        greeting.replace(/<[^>]+>/g, ''),
        '',
        'Confirmámos a tua compra e já desbloqueámos novos conteúdos na tua conta.',
        '',
        'Conteúdos desta compra:',
    ].concat(options.productNames || []).concat([
        '',
        'Entra em: ' + loginUrl,
        '',
        'Angela Campos',
    ]).join('\n');

    return {
        subject: '[Onda Prodígio] Novos conteúdos desbloqueados',
        html: html,
        text: text,
    };
}

async function sendWelcomeEmail(options) {
    var content = buildWelcomeEmail(options);

    return gmail.sendMail({
        to: options.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
    });
}

async function sendRetroactiveWelcomeEmail(options) {
    var content = buildRetroactiveWelcomeEmail(options);

    return gmail.sendMail({
        to: options.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
    });
}

async function sendConfirmationEmail(options) {
    var content = buildConfirmationEmail(options);

    return gmail.sendMail({
        to: options.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
    });
}

module.exports = {
    getSiteUrl: getSiteUrl,
    buildWelcomeEmail: buildWelcomeEmail,
    buildRetroactiveWelcomeEmail: buildRetroactiveWelcomeEmail,
    buildConfirmationEmail: buildConfirmationEmail,
    sendWelcomeEmail: sendWelcomeEmail,
    sendRetroactiveWelcomeEmail: sendRetroactiveWelcomeEmail,
    sendConfirmationEmail: sendConfirmationEmail,
};
