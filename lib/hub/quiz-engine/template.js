'use strict';

var constants = require('./constants');

function basicQuizTemplate() {
    return {
        headline: 'Descobre o teu plano ideal',
        intro: 'Responde a 5 perguntas rápidas para receberes uma recomendação personalizada.',
        lead_capture: {
            enabled: false,
            ask_name: true,
            ask_email: true,
            ask_phone: false,
        },
        questions: [
            {
                question: 'Qual é o teu principal objetivo?',
                question_type: 'single',
                required: true,
                answers: [
                    { label: 'Perder peso', value: 'lose_weight', score: 1 },
                    { label: 'Ganhar massa', value: 'gain_mass', score: 2 },
                    { label: 'Ter mais energia', value: 'energy', score: 3 },
                    { label: 'Melhorar alimentação', value: 'nutrition', score: 4 },
                ],
            },
            {
                question: 'Quantas refeições fazes por dia?',
                question_type: 'single',
                required: true,
                answers: [
                    { label: '1-2', value: '1-2', score: 1 },
                    { label: '3', value: '3', score: 2 },
                    { label: '4+', value: '4+', score: 3 },
                ],
            },
            {
                question: 'Preferes fruta fresca ou pronta a consumir?',
                question_type: 'single',
                required: true,
                answers: [
                    { label: 'Fresca', value: 'fresh', score: 1 },
                    { label: 'Pronta a consumir', value: 'ready', score: 2 },
                    { label: 'Ambas', value: 'both', score: 3 },
                ],
            },
            {
                question: 'Qual é o teu email?',
                question_type: 'email',
                required: false,
                answers: [],
            },
            {
                question: 'O que mais valorizas num plano?',
                question_type: 'multiple',
                required: true,
                answers: [
                    { label: 'Preço', value: 'price', score: 1 },
                    { label: 'Variedade', value: 'variety', score: 2 },
                    { label: 'Conveniência', value: 'convenience', score: 3 },
                    { label: 'Qualidade', value: 'quality', score: 4 },
                ],
            },
        ],
        results: [
            Object.assign({}, constants.DEFAULT_RESULT, {
                title: 'Plano ideal encontrado',
                description: 'Com base nas tuas respostas, este é o plano recomendado para ti.',
                min_score: 0,
                max_score: 9999,
                cta_label: 'Quero o meu plano',
            }),
        ],
    };
}

module.exports = {
    basicQuizTemplate: basicQuizTemplate,
};
