/**
 * Respostas automáticas da comunidade — motor offline (sem custos de API).
 * Detecta o tema da pergunta e compõe resposta variada com factos do método.
 */
var METHOD_KNOWLEDGE = [
    'Áudio principal: mínimo 7 minutos por dia; versão completa de 11 minutos acelera resultados.',
    'Momento ideal: à noite, ao adormecer — o cérebro fica mais receptivo. Também pode ouvir durante o dia, em actividades tranquilas.',
    'Modo: altifalante ou auriculares. Pode ouvir acordado (actividades calmas) ou enquanto dorme — o áudio continua a trabalhar.',
    'Frequência: uma sessão diária consistente é o essencial; não é necessário repetir várias vezes no mesmo dia, excepto se quiseres usar os 11 minutos em vez dos 7.',
    'Resultados: cada criança é diferente. Muitas famílias começam a notar mais calma e foco nas primeiras 2–3 semanas; alterações mais visíveis na leitura e concentração costumam consolidar-se com 4–6 semanas de rotina regular.',
    'Tom: reforçar paciência, consistência e observação do filho — nunca prometer resultados milagrosos.',
].join('\n');

var GENERIC_PHRASE_MARKERS = [
    'muitas famílias passam exactamente pelo mesmo',
    'recebi a tua mensagem e quero que saibas que faz todo o sentido',
    'continua a aplicar o método com calma, em pequenos passos',
];

var OPENINGS = [
    'Olá{nome}!',
    'Que boa pergunta{nome} — obrigada por a partilhares connosco 🌊',
    'Agradeço a tua mensagem{nome}.',
    'Fico contente por teres deixado esta dúvida aqui{nome}.',
    'Obrigada por escreveres{nome} — vamos por partes.',
    'Boa dúvida{nome}!',
];

var CLOSINGS = [
    'Com carinho,\nAngela Campos',
    'Um abraço,\nAngela Campos',
    'Conta connosco se precisares de mais alguma coisa.\n\nCom carinho,\nAngela Campos',
    'Estamos aqui para te apoiar.\n\nCom carinho,\nAngela Campos',
];

var TOPICS = [
    {
        id: 'audio',
        score: function (text) {
            var score = 0;
            if (/ouvir|audio|dormir|acordad|vezes|minutos|altifalante|auricular|noite/.test(text)) score += 3;
            if (/quantas vezes|ao dia|antes de dormir/.test(text)) score += 2;
            return score;
        },
        body: buildAudioFrequencyReply,
    },
    {
        id: 'reading',
        score: function (text) {
            var score = 0;
            if (/sess|leitura|foco|comportamento|alterac|mudanc|concentr|ler|caderno|escola|estudo|resist|particip|escrev|dificuldade/.test(text)) score += 3;
            if (/notar|resultado|quando|prazo|semana/.test(text)) score += 1;
            return score;
        },
        body: buildReadingFocusReply,
    },
    {
        id: 'sleep',
        score: function (text) {
            var score = 0;
            if (/sono|dormir|noite|conto|acordar|rotina nocturna|deitar/.test(text)) score += 3;
            return score;
        },
        body: buildSleepReply,
    },
    {
        id: 'age',
        score: function (text) {
            var score = 0;
            if (/idade|anos|bebe|bebe|crianca|filho|filha|adaptar/.test(text)) score += 2;
            if (/pode usar|serve para|funciona para/.test(text)) score += 2;
            return score;
        },
        body: buildAgeReply,
    },
    {
        id: 'start',
        score: function (text) {
            var score = 0;
            if (/comecar|como aplicar|primeiro passo|por onde|instruc|modulo/.test(text)) score += 3;
            if (/rotina|consist|todos os dias|nao tenho tempo/.test(text)) score += 2;
            return score;
        },
        body: buildStartReply,
    },
    {
        id: 'access',
        score: function (text) {
            var score = 0;
            if (/acesso|login|entrar|password|palavra.passe|email|link|nao consigo|video|carrega/.test(text)) score += 3;
            return score;
        },
        body: buildAccessReply,
    },
    {
        id: 'thanks',
        score: function (text) {
            var score = 0;
            if (/obrigad|agrade|adorei|gostei|maravilh|excelente|resultado positivo/.test(text)) score += 3;
            if (text.length < 80) score += 1;
            return score;
        },
        body: buildThanksReply,
    },
];

function pickVariant(seed, list) {
    var index = 0;

    if (seed) {
        for (var i = 0; i < seed.length; i++) {
            index += seed.charCodeAt(i);
        }
    }

    return list[index % list.length];
}

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function firstName(fullName) {
    var name = String(fullName || '').trim().split(/\s+/)[0];

    if (!name || name.length < 2) {
        return '';
    }

    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatOpening(template, memberName) {
    var nome = firstName(memberName);

    return template.replace('{nome}', nome ? ', ' + nome : '');
}

function detectTopic(content) {
    var text = normalizeText(content);
    var best = null;
    var bestScore = 0;

    for (var i = 0; i < TOPICS.length; i++) {
        var topic = TOPICS[i];
        var score = topic.score(text);

        if (score > bestScore) {
            bestScore = score;
            best = topic;
        }
    }

    return bestScore >= 2 ? best : null;
}

function moduleHint(moduleContext) {
    var ctx = String(moduleContext || '').trim();

    if (!ctx) {
        return '';
    }

    var titleLine = ctx.split('\n')[0].replace(/^Módulo: /, '').replace(/^Secção: /, '');

    if (!titleLine) {
        return '';
    }

    return 'Vi que comentaste no módulo «' + titleLine + '». ';
}

function buildAudioFrequencyReply() {
    return (
        'Sobre o áudio do método: o essencial é uma sessão por dia — os 7 minutos diários já estimulam o cérebro. ' +
        'Se quiseres potenciar, podes usar a versão completa de 11 minutos.\n\n' +
        'Quanto a dormir ou acordado: funciona nos dois casos. Muitas mães deixam tocar à noite, enquanto adormece, ' +
        'porque é quando o cérebro está mais receptivo. Mas também podes pôr durante o dia, com actividades tranquilas — ' +
        'não precisa de estar concentrado a ouvir; o importante é a exposição regular.\n\n' +
        'Altifalante ou auriculares, como for mais prático em casa. O que conta é a consistência, não repetir várias vezes no mesmo dia.'
    );
}

function buildReadingFocusReply() {
    return (
        'Sobre quando notar mudanças no foco e na leitura: cada criança tem o seu ritmo, por isso não há um número exacto de sessões igual para todos.\n\n' +
        'Na prática, muitas famílias referem mais calma e atenção já nas primeiras 2–3 semanas de rotina diária. ' +
        'Alterações mais evidentes na leitura e na concentração costumam consolidar-se entre a 4.ª e a 6.ª semana, ' +
        'desde que mantenhas os 7 minutos (ou 11 minutos) todos os dias.\n\n' +
        'Observa o teu filho com carinho — pequenos sinais (menos resistência, mais curiosidade, menos dispersão) ' +
        'são muitas vezes os primeiros. Se quiseres, conta-nos a idade dele e há quanto tempo aplicam o método para te orientar melhor.'
    );
}

function buildSleepReply() {
    return (
        'Para o sono, o método tem duas ferramentas: o áudio principal (idealmente à noite, enquanto adormece) ' +
        'e o bónus Protocolo do Sono Profundo, com contos para acalmar antes de deitar.\n\n' +
        'Não precisas de forçar — podes começar só com o áudio de 7 minutos na rotina nocturna. ' +
        'Mantém horários regulares e um ambiente calmo. Muitas famílias notam noites mais tranquilas nas primeiras semanas de consistência.'
    );
}

function buildAgeReply() {
    return (
        'O método foi pensado para crianças em idade escolar, mas cada caso é único. ' +
        'O importante é adaptar com calma: o áudio diário funciona quer esteja acordada em actividade tranquila quer a adormecer.\n\n' +
        'Se me disseres a idade exacta do teu filho, consigo orientar-te melhor sobre expectativas e como encaixar na rotina de vocês.'
    );
}

function buildStartReply() {
    return (
        'Para começares: assiste primeiro ao módulo «Começa aqui», depois passa ao áudio diário do Método Onda Prodígio (7 minutos por dia). ' +
        'Escolhe um horário fixo — muitas famílias preferem antes de dormir.\n\n' +
        'Não precisas de fazer tudo de uma vez. O essencial é a repetição diária, mesmo que alguns dias seja só o mínimo. ' +
        'A paciência e a observação do teu filho valem mais do que a perfeição.'
    );
}

function buildAccessReply() {
    return (
        'Se estás com dificuldades de acesso ou a ver o conteúdo, envia-nos por aqui o e-mail com que compraste e descreve o que aparece no ecrã ' +
        '(mensagem de erro, página em branco, vídeo que não carrega). Assim conseguimos ajudar-te mais depressa.\n\n' +
        'Entretanto, experimenta actualizar a página ou abrir noutro browser — por vezes é só cache do telemóvel.'
    );
}

function buildThanksReply() {
    return (
        'Fico mesmo feliz por ler isto — obrigada por partilhares 🌊\n\n' +
        'Continua com a rotina diária e observa pequenos progressos ao longo das semanas. ' +
        'Cada família tem o seu ritmo, e o teu empenho faz toda a diferença para o teu filho.'
    );
}

function buildGenericContextualReply(questionSnippet) {
    var snippet = String(questionSnippet || '').trim();

    if (snippet.length > 120) {
        snippet = snippet.slice(0, 117) + '…';
    }

    return (
        'Li a tua mensagem sobre «' + snippet + '».\n\n' +
        'Para te responder com precisão, ajuda saber a idade do teu filho, há quanto tempo usam o método e o que já notaste. ' +
        'Em linhas gerais: mantém a rotina diária do áudio (7 ou 11 minutos), observa pequenas mudanças ao longo das semanas ' +
        'e adapta com calma — não há pressa.\n\n' +
        'Deixa mais um detalhe aqui na comunidade e aprofundamos a resposta.'
    );
}

function buildReply(comment, options) {
    options = options || {};
    var content = comment && comment.content;
    var seed = (comment && comment.id) || normalizeText(content);
    var memberName = options.memberName || (comment && comment.member_name) || '';
    var moduleContext = options.moduleContext || '';
    var opening = formatOpening(pickVariant(seed, OPENINGS), memberName);
    var closing = pickVariant(seed + 'close', CLOSINGS);
    var topic = detectTopic(content);
    var hint = moduleHint(moduleContext);
    var body;

    if (topic) {
        body = topic.body();
    } else {
        body = buildGenericContextualReply(content);
    }

    if (hint && topic && topic.id !== 'access' && topic.id !== 'thanks') {
        body = hint + body;
    }

    return opening + '\n\n' + body + '\n\n' + closing;
}

function isGenericLegacyReply(text) {
    var normalized = String(text || '').toLowerCase();
    var hits = 0;

    for (var i = 0; i < GENERIC_PHRASE_MARKERS.length; i++) {
        if (normalized.indexOf(GENERIC_PHRASE_MARKERS[i]) !== -1) {
            hits += 1;
        }
    }

    return hits >= 2;
}

module.exports = {
    METHOD_KNOWLEDGE: METHOD_KNOWLEDGE,
    GENERIC_PHRASE_MARKERS: GENERIC_PHRASE_MARKERS,
    buildReply: buildReply,
    buildFallbackReply: buildReply,
    isGenericLegacyReply: isGenericLegacyReply,
};
