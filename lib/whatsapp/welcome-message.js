function getSiteUrl() {
    return String(process.env.SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
}

function firstName(fullName) {
    var parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    return parts[0] || '';
}

function formatProductList(productNames) {
    var names = (productNames || []).filter(Boolean);

    if (!names.length) {
        return '';
    }

    if (names.length === 1) {
        return names[0];
    }

    return names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
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

function buildWelcomeMessage(options) {
    var loginUrl = getSiteUrl() + '/comunidade/login';
    var name = firstName(options.fullName);
    var greeting = name ? ('Olá ' + name + '!') : 'Olá!';
    var products = formatProductList(options.productNames);
    var productsLine = products
        ? ('Cursos desbloqueados: ' + products + '.')
        : 'Os teus cursos já estão desbloqueados na área de membros.';
    var idx = pickTemplateIndex(options.email || options.phoneDigits || '');

    var core = [
        greeting + ' Aqui é o João, eu faço parte da equipa da Professora Angela Campos da Onda Prodígio 🌊',
        '',
        'A tua compra está confirmada.',
        productsLine,
        '',
        'Enviei os dados de acesso para o teu email (' + options.email + ').',
        'Se não encontrares na caixa de entrada, procura também em Spam, Promoções ou Lixo.',
        '',
        'Quando tiveres o email, entra em: ' + loginUrl,
        '',
        'Qualquer dúvida, ou dificuldade de acesso responde aqui.',
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
            'Enviei os dados de acesso para o teu email (' + options.email + ').',
            'Enviei os dados de acesso (email + password provisória) para ' + options.email + '.'
        ),
    ];

    return variants[idx] || core;
}

function buildConfirmationMessage(options) {
    var communityUrl = getSiteUrl() + '/comunidade';
    var name = firstName(options.fullName);
    var greeting = name ? ('Olá ' + name + '!') : 'Olá!';
    var products = formatProductList(options.productNames);
    var productsLine = products
        ? ('Parabéns — acabaste de desbloquear ' + products + '.')
        : 'Parabéns — acabaste de desbloquear novos conteúdos na tua área de membros.';
    var lines = [
        greeting + ' Aqui é o João, eu faço parte da equipa da Professora Angela Campos da Onda Prodígio 🌊',
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
    var name = firstName(options.fullName);
    var greeting = name ? ('Olá ' + name + '!') : 'Olá!';
    var products = formatProductList(options.productNames);
    var productsLine = products
        ? ('Os teus cursos já estão desbloqueados: ' + products + '.')
        : 'Os teus cursos já estão desbloqueados na área de membros.';

    return [
        greeting + ' Aqui é o João, eu faço parte da equipa da Professora Angela Campos da Onda Prodígio 🌊',
        '',
        'Reparámos que ainda não entraste na área de membros — por isso podes estar com alguma dificuldade de acesso.',
        '',
        productsLine,
        '',
        'Enviamos os dados de acesso para o teu email (' + options.email + ').',
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
    var checkoutUrl = getSiteUrl() + '/checkout9/';
    var name = firstName(options.fullName);
    var greeting = name ? ('Olá ' + name + '!') : 'Olá!';

    return [
        greeting + ' Aqui é o João, eu faço parte da equipa da Professora Angela Campos da Onda Prodígio 🌊',
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
