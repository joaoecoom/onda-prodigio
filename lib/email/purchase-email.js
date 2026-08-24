var gmail = require('./gmail');
var shared = require('../messaging/shared');

function getSiteUrl() {
    return shared.getSiteUrl();
}

function escapeHtml(value) {
    return shared.escapeHtml(value);
}

function renderProductList(productNames) {
    return shared.renderProductListHtml(productNames || []);
}

function buildWelcomeEmail(options) {
    var loginUrl = getSiteUrl() + '/comunidade/login';
    var productList = renderProductList(options.productNames || []);
    var greeting = shared.angelaGreeting(options.fullName, true);
    var productsLine = (options.productNames || []).length
        ? shared.formatProductList(options.productNames)
        : '';

    var html = shared.wrapAngelaEmail(
        '<p>' + greeting + '</p>' +
        '<p>A tua compra está confirmada. A tua área de membros já está pronta.</p>' +
        (productsLine
            ? ('<p><strong>Conteúdos desbloqueados:</strong></p>' + renderProductList(options.productNames))
            : '<p>Os teus cursos já estão desbloqueados na área de membros.</p>') +
        '<p style="font-size:0.95em;color:#4b5563;margin-top:1rem;">Se não vires este email na caixa de entrada, verifica também <strong>Spam</strong> ou <strong>Promoções</strong>.</p>' +
        '<p style="margin-top:1.25rem;"><strong>Como entrar:</strong></p>' +
        '<ol style="padding-left:1.25rem;margin:0.5rem 0 0;">' +
            '<li>Vai a <a href="' + loginUrl + '">' + loginUrl + '</a></li>' +
            '<li>Email: <strong>' + escapeHtml(options.email) + '</strong></li>' +
            '<li>Password provisória: <strong>' + escapeHtml(options.password) + '</strong></li>' +
        '</ol>' +
        '<p style="margin-top:1rem;">Guarda estes dados. Se tiveres dificuldades, responde a este email.</p>'
    );

    var text = [
        shared.angelaGreeting(options.fullName, false),
        '',
        'A tua compra está confirmada. A tua área de membros já está pronta.',
        '',
        productsLine ? ('Conteúdos desbloqueados: ' + productsLine) : 'Os teus cursos já estão desbloqueados na área de membros.',
        '',
        'Como entrar:',
        '1. ' + loginUrl,
        '2. Email: ' + options.email,
        '3. Password provisória: ' + options.password,
        '',
        'Angela Campos',
    ].join('\n');

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

function renderNextProductOfferHtml(nextProductOffer) {
    if (!nextProductOffer || !nextProductOffer.name) {
        return '';
    }

    var description = nextProductOffer.description
        ? ('<p style="margin:0.35rem 0 0;color:#4b5563;">' + escapeHtml(nextProductOffer.description) + '</p>')
        : '';

    return (
        '<div style="margin-top:1.5rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa;">' +
            '<p style="margin:0 0 0.35rem;"><strong>Próximo passo (opcional)</strong></p>' +
            '<p style="margin:0;">Se quiseres dar o próximo passo, ainda podes desbloquear <strong>' + escapeHtml(nextProductOffer.name) + '</strong>.</p>' +
            description +
            '<p style="margin:0.85rem 0 0;"><a href="' + escapeHtml(nextProductOffer.checkout_url) + '">Ver oferta</a></p>' +
        '</div>'
    );
}

function renderNextProductOfferText(nextProductOffer) {
    if (!nextProductOffer || !nextProductOffer.name) {
        return [];
    }

    return [
        '',
        'Próximo passo (opcional):',
        'Se quiseres dar o próximo passo, ainda podes desbloquear ' + nextProductOffer.name + '.',
        nextProductOffer.description || '',
        'Ver oferta: ' + nextProductOffer.checkout_url,
    ].filter(Boolean);
}

function buildConfirmationEmail(options) {
    var communityUrl = getSiteUrl() + '/comunidade';
    var greeting = shared.angelaGreeting(options.fullName, true);
    var productsLine = shared.formatProductList(options.productNames || []);
    var purchasedLine = productsLine
        ? ('Parabéns — acabaste de desbloquear <strong>' + shared.escapeHtml(productsLine) + '</strong>.')
        : 'Parabéns — acabaste de desbloquear novos conteúdos na tua conta.';
    var offerHtml = renderNextProductOfferHtml(options.nextProductOffer);

    var html = shared.wrapAngelaEmail(
        '<p>' + greeting + '</p>' +
        '<p>' + purchasedLine + ' Já está tudo disponível na tua área de membros.</p>' +
        '<p><strong>Conteúdos desta compra:</strong></p>' +
        renderProductList(options.productNames || []) +
        '<p style="margin-top:1.25rem;">Entra com o teu email habitual (' + shared.escapeHtml(options.email || '') + ') e a password que já usas:</p>' +
        '<p><a href="' + communityUrl + '">' + communityUrl + '</a></p>' +
        offerHtml
    );

    var text = [
        shared.angelaGreeting(options.fullName, false),
        '',
        (productsLine
            ? ('Parabéns — acabaste de desbloquear ' + productsLine + '.')
            : 'Parabéns — acabaste de desbloquear novos conteúdos na tua conta.') + ' Já está tudo disponível na tua área de membros.',
        '',
        'Conteúdos desta compra:',
    ].concat(options.productNames || []).concat([
        '',
        'Entra em: ' + communityUrl,
        'Email: ' + (options.email || ''),
    ]).concat(renderNextProductOfferText(options.nextProductOffer)).concat([
        '',
        'Angela Campos',
    ]).join('\n');

    return {
        subject: '[Onda Prodígio] Parabéns — novos conteúdos desbloqueados',
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
        offerId: options.offerId || options.offer_id || null,
    });
}

async function sendRetroactiveWelcomeEmail(options) {
    var content = buildRetroactiveWelcomeEmail(options);

    return gmail.sendMail({
        to: options.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
        offerId: options.offerId || options.offer_id || null,
    });
}

async function sendConfirmationEmail(options) {
    var content = buildConfirmationEmail(options);

    return gmail.sendMail({
        to: options.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
        offerId: options.offerId || options.offer_id || null,
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
