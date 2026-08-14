var shared = require('../messaging/shared');
var funnelCheckoutConfig = require('../funnel-checkout-config');

function buildFailedPaymentRecoveryEmail(options) {
    var checkoutUrl = shared.getSiteUrl() + funnelCheckoutConfig.getRecoveryCheckoutPath(options.checkoutId);
    var greeting = shared.angelaGreeting(options.fullName, true);

    var html = shared.wrapAngelaEmail(
        '<p>' + greeting + '</p>' +
        '<p>Reparámos que o teu pagamento não foi concluído — por vezes acontece por limite do cartão, dados incorrectos ou confirmação do banco.</p>' +
        '<p style="margin-top:1rem;">Podes voltar a tentar aqui:</p>' +
        '<p><a href="' + shared.escapeHtml(checkoutUrl) + '">' + shared.escapeHtml(checkoutUrl) + '</a></p>' +
        '<p style="margin-top:1rem;">Se precisares de ajuda ou quiseres concluir a compra de outra forma, responde a este email.</p>'
    );

    var text = [
        shared.angelaGreeting(options.fullName, false),
        '',
        'Reparámos que o teu pagamento não foi concluído — por vezes acontece por limite do cartão, dados incorrectos ou confirmação do banco.',
        '',
        'Podes voltar a tentar aqui:',
        checkoutUrl,
        '',
        'Se precisares de ajuda ou quiseres concluir a compra de outra forma, responde a este email.',
        '',
        'Angela Campos',
    ].join('\n');

    return {
        subject: '[Onda Prodígio] Concluir a tua compra',
        html: html,
        text: text,
    };
}

function buildNeverLoggedInFollowUpEmail(options) {
    var loginUrl = shared.getSiteUrl() + '/comunidade/login';
    var greeting = shared.angelaGreeting(options.fullName, true);
    var products = shared.formatProductList(options.productNames || []);
    var productsHtml = products
        ? ('<p>Os teus cursos já estão desbloqueados: <strong>' + shared.escapeHtml(products) + '</strong>.</p>')
        : '<p>Os teus cursos já estão desbloqueados na área de membros.</p>';
    var productsText = products
        ? ('Os teus cursos já estão desbloqueados: ' + products + '.')
        : 'Os teus cursos já estão desbloqueados na área de membros.';

    var html = shared.wrapAngelaEmail(
        '<p>' + greeting + '</p>' +
        '<p>Reparámos que ainda não entraste na área de membros — por isso podes estar com alguma dificuldade de acesso.</p>' +
        productsHtml +
        '<p style="font-size:0.95em;color:#4b5563;margin-top:1rem;">Se não vires emails anteriores na caixa de entrada, verifica também <strong>Spam</strong> ou <strong>Promoções</strong>.</p>' +
        '<p style="margin-top:1rem;"><strong>Como entrar:</strong></p>' +
        '<ol style="padding-left:1.25rem;margin:0.5rem 0 0;">' +
            '<li>Vai a <a href="' + loginUrl + '">' + loginUrl + '</a></li>' +
            '<li>Email: <strong>' + shared.escapeHtml(options.email || '') + '</strong></li>' +
            '<li>Se não te lembrares da password, clica em <strong>Esqueci a password</strong></li>' +
        '</ol>' +
        '<p style="margin-top:1rem;">Qualquer dúvida, responde a este email.</p>'
    );

    var text = [
        shared.angelaGreeting(options.fullName, false),
        '',
        'Reparámos que ainda não entraste na área de membros — por isso podes estar com alguma dificuldade de acesso.',
        '',
        productsText,
        '',
        'Como entrar:',
        '1. ' + loginUrl,
        '2. Email: ' + (options.email || ''),
        '3. Se não te lembrares da password, clica em "Esqueci a password"',
        '',
        'Angela Campos',
    ].join('\n');

    return {
        subject: '[Onda Prodígio] Acesso à área de membros',
        html: html,
        text: text,
    };
}

module.exports = {
    buildFailedPaymentRecoveryEmail: buildFailedPaymentRecoveryEmail,
    buildNeverLoggedInFollowUpEmail: buildNeverLoggedInFollowUpEmail,
};
