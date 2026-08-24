'use strict';

var QUESTION_TYPES = ['single', 'multiple', 'text', 'email'];

module.exports = {
    QUESTION_TYPES: QUESTION_TYPES,
    DEFAULT_RESULT: {
        title: 'Resultado',
        description: 'Obrigado por completar o quiz.',
        min_score: 0,
        max_score: 9999,
        cta_label: 'Quero continuar',
        cta_action: 'checkout',
    },
};
