'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var quizEngine = require('../lib/hub/quiz-engine');
var template = require('../lib/hub/quiz-engine/template');

function setupQuizOffer() {
    var store = quizEngine.createMemoryStore();
    var offerId = 'offer-fruta';
    var funnelId = 'funnel-quiz-1';

    store.setFunnels([{
        id: funnelId,
        offer_id: offerId,
        slug: 'quiz-fruta',
        name: 'Quiz Fruta',
        type: 'quiz',
        status: 'draft',
        settings: {},
    }]);

    var service = quizEngine.createService(store);

    return { store: store, service: service, offerId: offerId, funnelId: funnelId };
}

test('quiz template has five conceptual steps', function () {
    var tpl = template.basicQuizTemplate();
    assert.equal(tpl.questions.length, 5);
    assert.ok(tpl.results.length >= 1);
});

test('save and load quiz definition with offer isolation', async function () {
    var ctx = setupQuizOffer();
    var tpl = template.basicQuizTemplate();

    await ctx.service.saveQuizDefinition(ctx.offerId, ctx.funnelId, {
        questions: tpl.questions,
        results: tpl.results,
    });

    var loaded = await ctx.service.loadQuizBundle(ctx.funnelId, ctx.offerId);
    assert.equal(loaded.questions.length, 5);
    assert.equal(loaded.questions[0].answers.length, 4);
});

test('cross-offer quiz access is rejected', async function () {
    var ctx = setupQuizOffer();
    var tpl = template.basicQuizTemplate();

    await ctx.service.saveQuizDefinition(ctx.offerId, ctx.funnelId, {
        questions: tpl.questions,
        results: tpl.results,
    });

    await assert.rejects(function () {
        return ctx.service.loadQuizBundle(ctx.funnelId, 'other-offer');
    }, function (error) {
        return error.code === 'CROSS_OFFER_ACCESS';
    });
});

test('quiz submission computes score and resolves result', async function () {
    var ctx = setupQuizOffer();
    var tpl = template.basicQuizTemplate();

    var saved = await ctx.service.saveQuizDefinition(ctx.offerId, ctx.funnelId, {
        questions: tpl.questions,
        results: [{
            title: 'Low',
            description: 'Low result',
            min_score: 0,
            max_score: 3,
            cta_label: 'Go',
            cta_action: 'checkout',
        }, {
            title: 'High',
            description: 'High result',
            min_score: 4,
            max_score: 99,
            cta_label: 'Go',
            cta_action: 'checkout',
        }],
    });

    var question = saved.questions[0];
    var answerId = question.answers[2].id;
    var answers = {};
    answers[question.id] = answerId;

    var scored = await ctx.service.submitQuiz(ctx.offerId, ctx.funnelId, { answers: answers });

    assert.equal(scored.total_score, 3);
    assert.equal(scored.result.title, 'Low');
});

test('quiz renderer outputs player shell', function () {
    var tpl = template.basicQuizTemplate();
    var html = quizEngine.renderQuizDocument({
        offer: { id: 'offer-fruta', slug: 'fruta-da-epoca' },
        funnel: { id: 'f1', slug: 'quiz', name: 'Quiz', settings: { headline: 'Test' } },
        page: { slug: 'quiz' },
        quiz: { questions: tpl.questions, results: tpl.results },
    }, { mode: 'preview', showPreviewBanner: true });

    assert.match(html, /quiz-player\.js/);
    assert.match(html, /__QUIZ__/);
});
