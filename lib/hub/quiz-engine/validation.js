'use strict';

var constants = require('./constants');

function normalizeEnum(value, allowed, fallback) {
    var raw = String(value || '').trim().toLowerCase();

    if (allowed.indexOf(raw) !== -1) {
        return raw;
    }

    return fallback;
}

function normalizeQuestion(input) {
    var payload = input || {};

    return {
        question: String(payload.question || '').trim(),
        question_type: normalizeEnum(payload.question_type, constants.QUESTION_TYPES, 'single'),
        required: payload.required !== false,
        position: Number.isFinite(Number(payload.position)) ? Number(payload.position) : 100,
        settings: payload.settings && typeof payload.settings === 'object' ? payload.settings : {},
    };
}

function normalizeAnswer(input) {
    var payload = input || {};

    return {
        label: String(payload.label || '').trim(),
        value: String(payload.value || payload.label || '').trim(),
        score: Number.isFinite(Number(payload.score)) ? Number(payload.score) : 0,
        position: Number.isFinite(Number(payload.position)) ? Number(payload.position) : 100,
    };
}

function normalizeResult(input) {
    var payload = input || {};

    return {
        title: String(payload.title || '').trim(),
        description: String(payload.description || '').trim(),
        min_score: Number.isFinite(Number(payload.min_score)) ? Number(payload.min_score) : 0,
        max_score: Number.isFinite(Number(payload.max_score)) ? Number(payload.max_score) : 9999,
        cta_label: String(payload.cta_label || 'Continuar').trim(),
        cta_action: String(payload.cta_action || 'checkout').trim(),
        image_url: String(payload.image_url || '').trim(),
        sort_order: Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 100,
        settings: payload.settings && typeof payload.settings === 'object' ? payload.settings : {},
    };
}

module.exports = {
    normalizeQuestion: normalizeQuestion,
    normalizeAnswer: normalizeAnswer,
    normalizeResult: normalizeResult,
};
