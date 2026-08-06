var SURVEY_ID = 'onda-prodigio-genius-test';

var LESSON_TITLE_MATCH = 'Teste para Descobrir o Génio';

var REQUIRED_FIELDS = [
    'play_style',
    'learn_style',
    'memory_style',
    'challenge_style',
    'strength_signal',
    'focus_style',
    'motivation_style',
    'dream_activity',
];

var PROFILES = {
    creative: {
        id: 'creative',
        label: 'Génio Criativo',
        emoji: '🎨',
        summary: 'O teu filho pensa em imagens, histórias e possibilidades. Aprende melhor quando pode inventar, expressar-se e ligar o novo ao imaginário.',
        tips: 'Usa desenhos, mapas visuais, histórias e desafios abertos. Deixa espaço para criar antes de pedir respostas «certas».',
    },
    logical: {
        id: 'logical',
        label: 'Génio Lógico',
        emoji: '🔢',
        summary: 'Gosta de padrões, sequências e desafios com regras claras. Entende o mundo quando consegue organizar, comparar e resolver problemas passo a passo.',
        tips: 'Divide tarefas em etapas, usa jogos de lógica e mostra o «porquê» por trás de cada passo. Elogia o raciocínio, não só o resultado.',
    },
    linguistic: {
        id: 'linguistic',
        label: 'Génio Linguístico',
        emoji: '📖',
        summary: 'Tem facilidade com palavras, leitura, conversa e explicação. Aprende ouvindo, lendo, contando e transformando ideias em linguagem.',
        tips: 'Lê em voz alta, faz resumos verbais, usa rimas ou histórias. Pede-lhe que explique o que aprendeu com as próprias palavras.',
    },
    spatial: {
        id: 'spatial',
        label: 'Génio Espacial',
        emoji: '🧩',
        summary: 'Pensa em formas, espaços e relações visuais. Aprende melhor vendo, construindo, desenhando esquemas ou experimentando na prática.',
        tips: 'Usa materiais concretos, blocos, mapas mentais e demonstrações visuais. Deixa-o mover-se e manipular enquanto estuda.',
    },
    social: {
        id: 'social',
        label: 'Génio Social',
        emoji: '🤝',
        summary: 'Aprende com pessoas, emoções e relações. Motiva-se quando se sente compreendido, quando coopera e quando vê o impacto do que faz nos outros.',
        tips: 'Estuda em pequenos grupos, usa exemplos reais, conversa sobre sentimentos e celebra progressos em conjunto.',
    },
    naturalist: {
        id: 'naturalist',
        label: 'Génio Naturalista',
        emoji: '🌿',
        summary: 'Observa, classifica e conecta-se com a natureza, animais e detalhes do mundo real. Aprende melhor com exemplos vivos e experiências concretas.',
        tips: 'Liga os conteúdos à natureza, passeios, animais ou curiosidades do dia a dia. Valoriza a observação antes da explicação teórica.',
    },
};

function normalizeValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function computeResult(answers) {
    var scores = {
        creative: 0,
        logical: 0,
        linguistic: 0,
        spatial: 0,
        social: 0,
        naturalist: 0,
    };
    var index;

    for (index = 0; index < REQUIRED_FIELDS.length; index += 1) {
        var field = REQUIRED_FIELDS[index];
        var value = normalizeValue(answers[field]);

        if (value && Object.prototype.hasOwnProperty.call(scores, value)) {
            scores[value] += 1;
        }
    }

    var winner = 'creative';
    var winnerScore = -1;
    var keys = Object.keys(scores);

    keys.forEach(function (key) {
        if (scores[key] > winnerScore) {
            winner = key;
            winnerScore = scores[key];
        }
    });

    var profile = PROFILES[winner] || PROFILES.creative;

    return {
        profile_id: profile.id,
        profile_label: profile.label,
        profile_emoji: profile.emoji,
        profile_summary: profile.summary,
        profile_tips: profile.tips,
        scores: scores,
    };
}

function validateAnswers(answers) {
    var index;

    for (index = 0; index < REQUIRED_FIELDS.length; index += 1) {
        var field = REQUIRED_FIELDS[index];
        var value = normalizeValue(answers[field]);

        if (!value) {
            return 'Responde a todas as perguntas para descobrires o perfil de génio.';
        }

        if (!PROFILES[value]) {
            return 'Resposta inválida. Tenta submeter o teste novamente.';
        }
    }

    return '';
}

function sanitizeAnswers(answers) {
    var sanitized = {};
    var keys = Object.keys(answers || {});

    keys.forEach(function (key) {
        sanitized[key] = normalizeValue(answers[key]);
    });

    var result = computeResult(sanitized);

    sanitized._result = result;

    return sanitized;
}

module.exports = {
    SURVEY_ID: SURVEY_ID,
    LESSON_TITLE_MATCH: LESSON_TITLE_MATCH,
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    OTHER_FIELDS: {},
    PROFILES: PROFILES,
    validateAnswers: validateAnswers,
    sanitizeAnswers: sanitizeAnswers,
    computeResult: computeResult,
};
