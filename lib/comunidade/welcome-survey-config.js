var SURVEY_ID = 'onda-prodigio-welcome';

var REQUIRED_FIELDS = [
    'child_age',
    'main_challenge',
    'daily_situation',
    'biggest_fear',
    'tried_alternatives',
    'purchase_reason',
    'priority_result',
    'relationship',
];

var OTHER_FIELDS = {
    child_age: 'child_age_other',
    main_challenge: 'main_challenge_other',
    daily_situation: 'daily_situation_other',
    priority_result: 'priority_result_other',
    relationship: 'relationship_other',
};

function normalizeValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function validateAnswers(answers) {
    var index;

    for (index = 0; index < REQUIRED_FIELDS.length; index += 1) {
        var field = REQUIRED_FIELDS[index];
        var value = normalizeValue(answers[field]);

        if (!value) {
            return 'Responde a todas as perguntas obrigatórias.';
        }

        if (value === '__other__') {
            var otherField = OTHER_FIELDS[field];
            var otherValue = otherField ? normalizeValue(answers[otherField]) : '';

            if (!otherValue) {
                return 'Preenche o campo «Outro» quando seleccionares essa opção.';
            }
        }
    }

    if (normalizeValue(answers.biggest_fear).length < 5) {
        return 'Descreve melhor o teu maior medo ou frustração.';
    }

    if (normalizeValue(answers.purchase_reason).length < 5) {
        return 'Descreve melhor o que te convenceu a adquirir o Onda Prodígio.';
    }

    return '';
}

function sanitizeAnswers(answers) {
    var sanitized = {};
    var keys = Object.keys(answers || {});

    keys.forEach(function (key) {
        sanitized[key] = normalizeValue(answers[key]);
    });

    return sanitized;
}

module.exports = {
    SURVEY_ID: SURVEY_ID,
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    OTHER_FIELDS: OTHER_FIELDS,
    LESSON_TITLE_MATCH: 'Questionário Inicial',
    validateAnswers: validateAnswers,
    sanitizeAnswers: sanitizeAnswers,
};
