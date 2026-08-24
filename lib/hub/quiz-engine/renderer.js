'use strict';

var escapeHtml = require('../page-renderer/escape').escapeHtml;

function buildCheckoutUrl(offerSlug, funnelSlug) {
    return '/checkout/?offer=' + encodeURIComponent(offerSlug) +
        '&product_id=' + encodeURIComponent(offerSlug) +
        (funnelSlug ? '&funnel=' + encodeURIComponent(funnelSlug) : '');
}

function renderQuizDocument(input, options) {
    var offer = input.offer || {};
    var funnel = input.funnel || {};
    var page = input.page || {};
    var quiz = input.quiz || { questions: [], results: [] };
    var opts = options || {};
    var settings = funnel.settings || {};
    var headline = String(settings.headline || page.name || funnel.name || 'Quiz');
    var intro = String(settings.intro || 'Responde às perguntas para descobrir o teu resultado.');
    var mode = opts.mode || 'production';
    var showBanner = Boolean(opts.showPreviewBanner);

    var payload = {
        offer_id: offer.id || offer.slug,
        offer_slug: offer.slug,
        funnel_id: funnel.id,
        funnel_slug: funnel.slug,
        page_slug: page.slug,
        headline: headline,
        intro: intro,
        questions: (quiz.questions || []).map(function (question) {
            return {
                id: question.id,
                question: question.question,
                question_type: question.question_type,
                required: question.required,
                answers: (question.answers || []).map(function (answer) {
                    return {
                        id: answer.id,
                        label: answer.label,
                        value: answer.value,
                        score: answer.score,
                    };
                }),
            };
        }),
        results: (quiz.results || []).map(function (result) {
            return {
                id: result.id,
                title: result.title,
                description: result.description,
                min_score: result.min_score,
                max_score: result.max_score,
                cta_label: result.cta_label,
                cta_action: result.cta_action,
                image_url: result.image_url,
                checkout_url: buildCheckoutUrl(offer.slug, funnel.slug),
            };
        }),
        lead_capture: settings.lead_capture || {},
        submit_url: '/api/sales-attribution?action=hub_quiz_submit',
    };

    var banner = showBanner
        ? '<div class="quiz-preview-banner">Preview — quiz não publicado</div>'
        : '';

    return '<!DOCTYPE html><html lang="pt-PT"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + escapeHtml(headline) + '</title>' +
        '<meta name="robots" content="' + (mode === 'production' ? 'index,follow' : 'noindex,nofollow') + '">' +
        '<link rel="stylesheet" href="/assets/quiz-player.css?v=1">' +
        '</head><body class="quiz-page" data-quiz-mode="' + escapeHtml(mode) + '">' +
        banner +
        '<main class="quiz-shell" id="quiz-root"></main>' +
        '<script>window.__QUIZ__=' + JSON.stringify(payload).replace(/</g, '\\u003c') + ';</script>' +
        '<script src="/assets/tracking.js?v=1"></script>' +
        '<script src="/assets/quiz-player.js?v=1"></script>' +
        '</body></html>';
}

module.exports = {
    renderQuizDocument: renderQuizDocument,
    buildCheckoutUrl: buildCheckoutUrl,
};
