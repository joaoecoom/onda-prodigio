var shared = require('../messaging/shared');
var funnelCheckoutConfig = require('../funnel-checkout-config');

function getSiteUrl() {
    return shared.getSiteUrl();
}

function pickTemplateIndex(seed) {
    var text = String(seed || Date.now());
    var hash = 0;

    for (var i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash) % 3;
}

function joaoIntro(fullName) {
    var name = shared.firstName(fullName);
    var greeting = name ? ('Olá ' + name + '!') : 'Olá!';
    return greeting + ' Aqui é o João, do suporte da Professora Angela Campos — Onda Prodígio 🌊';
}

function buildWelcomeMessage(options) {
    var loginUrl = getSiteUrl() + '/comunidade/login';
    var products = shared.formatProductList(options.productNames);
    var productsLine = products
        ? ('Cursos desbloqueados: ' + products + '.')
        : 'Os teus cursos já estão desbloqueados na área de membros.';
    var idx = pickTemplateIndex(options.email || options.phoneDigits || '');

    var core = [
        joaoIntro(options.fullName),
        '',
        'A tua compra está confirmada.',
        productsLine,
        '',
        'A Professora Angela enviou os dados de acesso para o teu email (' + options.email + ').',
        'Se não encontrares na caixa de entrada, procura também em Spam, Promoções ou Lixo.',
        '',
        'Quando tiveres o email, entra em: ' + loginUrl,
        '',
        'Qualquer dúvida ou dificuldade de acesso, responde aqui.',
        '',
        'Obrigado!',
    ].join('\n');

    var variants = [
        core,
        core.replace(
            'Quando tiveres o email, entra em:',
            'No email tens o teu email de login e a password provisória.\n\nDepois entra em:'
        ),
        core.replace(
            'A Professora Angela enviou os dados de acesso para o teu email (' + options.email + ').',
            'A Professora Angela enviou os dados de acesso (email + password provisória) para ' + options.email + '.'
        ),
    ];

    return variants[idx] || core;
}

function buildConfirmationMessage(options) {
    var communityUrl = getSiteUrl() + '/comunidade';
    var products = shared.formatProductList(options.productNames);
    var productsLine = products
        ? ('Parabéns — acabaste de desbloquear ' + products + '.')
        : 'Parabéns — acabaste de desbloquear novos conteúdos na tua área de membros.';
    var lines = [
        joaoIntro(options.fullName),
        '',
        productsLine,
        '',
        'Já está tudo disponível na tua conta. Entra em:',
        communityUrl,
        '',
        'Usa o teu email habitual (' + (options.email || '') + ') e a password que já tinhas.',
    ];

    if (options.nextProductOffer && options.nextProductOffer.name) {
        lines.push('');
        lines.push('Se quiseres dar o próximo passo, ainda tens disponível o ' + options.nextProductOffer.name + ':');
        lines.push(options.nextProductOffer.checkout_url);
    }

    lines.push('');
    lines.push('Qualquer dúvida, responde aqui.');
    lines.push('');
    lines.push('Obrigado!');

    return lines.join('\n');
}

function buildNeverLoggedInFollowUpMessage(options) {
    var loginUrl = getSiteUrl() + '/comunidade/login';
    var products = shared.formatProductList(options.productNames);
    var productsLine = products
        ? ('Os teus cursos já estão desbloqueados: ' + products + '.')
        : 'Os teus cursos já estão desbloqueados na área de membros.';

    return [
        joaoIntro(options.fullName),
        '',
        'Reparámos que ainda não entraste na área de membros — por isso podes estar com alguma dificuldade de acesso.',
        '',
        productsLine,
        '',
        'A Professora Angela enviou os dados de acesso para o teu email (' + options.email + ').',
        'Se não encontrares na caixa de entrada, procura também em Spam, Promoções ou Lixo.',
        '',
        'Se tiveres dificuldades, entra aqui:',
        loginUrl,
        '',
        'Coloca o email da compra, clica em "Esqueci a password" e vais receber um novo email com as instruções para mudares a tua password.',
        '',
        'Qualquer dúvida, responde aqui que eu ajudo.',
        '',
        'Obrigado!',
    ].join('\n');
}

function buildFailedPaymentRecoveryMessage(options) {
    var checkoutUrl = getSiteUrl() + funnelCheckoutConfig.getRecoveryCheckoutPath(options.checkoutId);

    return [
        joaoIntro(options.fullName),
        '',
        'Reparámos que o teu pagamento não foi concluído — por vezes acontece por limite do cartão, dados incorrectos ou confirmação do banco.',
        '',
        'Podes voltar a tentar aqui:',
        checkoutUrl,
        '',
        'Se precisares de ajuda ou quiseres concluir a compra de outra forma, responde a esta mensagem.',
        '',
        'Obrigado!',
    ].join('\n');
}

module.exports = {
    buildWelcomeMessage: buildWelcomeMessage,
    buildConfirmationMessage: buildConfirmationMessage,
    buildNeverLoggedInFollowUpMessage: buildNeverLoggedInFollowUpMessage,
    buildFailedPaymentRecoveryMessage: buildFailedPaymentRecoveryMessage,
};
