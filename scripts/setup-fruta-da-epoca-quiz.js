#!/usr/bin/env node
'use strict';

/**
 * Idempotent setup: Fruta da Época quiz funnel (5 questions → result → checkout)
 */

var fs = require('fs');
var path = require('path');

function pat() {
    var mcp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.cursor', 'mcp.json'), 'utf8'));
    return mcp.mcpServers['supabase-onda-prodigio'].headers.Authorization.replace(/^Bearer\s+/i, '').trim();
}

async function loadSupabaseEnv() {
    var r = await fetch('https://api.supabase.com/v1/projects/vmyezkbkthguojmxhacw/api-keys', {
        headers: { Authorization: 'Bearer ' + pat() },
    });
    var keys = await r.json();
    var list = Array.isArray(keys) ? keys : keys.data || [];
    var svc = list.find(function (k) { return k.name === 'service_role'; });
    process.env.SUPABASE_URL = 'https://vmyezkbkthguojmxhacw.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = svc.api_key;
}

var quizEngine = require('../lib/hub/quiz-engine');
var funnelEngine = require('../lib/hub/funnel-engine');
var offerContext = require('../lib/hub/offer-context');
var template = require('../lib/hub/quiz-engine/template');

async function main() {
    await loadSupabaseEnv();
    var offer = await offerContext.resolveOfferContext({ slug: 'fruta-da-epoca' });
    var funnels = await funnelEngine.listFunnels(offer.id);
    var funnel = funnels.find(function (row) { return row.slug === 'quiz-fruta'; });

    if (!funnel) {
        funnel = await funnelEngine.createFunnel(offer.id, {
            name: 'Quiz Fruta',
            slug: 'quiz-fruta',
            type: 'quiz',
            status: 'active',
            settings: {
                headline: 'Descobre qual é o melhor plano de fruta para ti',
                intro: 'Responde a 5 perguntas rápidas para receberes a tua recomendação personalizada.',
            },
        });
        console.log('Created funnel quiz-fruta:', funnel.id);
    } else if (funnel.type !== 'quiz') {
        funnel = await funnelEngine.updateFunnel(offer.id, funnel.id, { type: 'quiz' });
    }

    var tpl = template.basicQuizTemplate();
    tpl.questions[0].question = 'Qual é o teu principal objetivo com fruta?';
    tpl.results = [{
        title: 'Plano ideal encontrado',
        description: 'Com base nas tuas respostas, este é o plano de fruta recomendado para ti.',
        min_score: 0,
        max_score: 9999,
        cta_label: 'Quero o meu plano',
        cta_action: 'checkout',
    }];

    await quizEngine.saveQuizDefinition(offer.id, funnel.id, {
        questions: tpl.questions,
        results: tpl.results,
    });

    var pages = await funnelEngine.listPages(offer.id, funnel.id);
    var page = pages.find(function (row) { return row.slug === 'quiz'; });

    if (!page) {
        page = await funnelEngine.createPage(offer.id, funnel.id, {
            name: 'Quiz Principal',
            slug: 'quiz',
            type: 'custom',
            status: 'published',
        });
    } else if (page.status !== 'published') {
        page = await funnelEngine.updatePage(offer.id, page.id, { status: 'published' });
    }

    console.log('Quiz ready:');
    console.log('  Preview:', 'https://onda-prodigio.vercel.app/preview/fruta-da-epoca/quiz-fruta/quiz?preview=1');
    console.log('  Live:', 'https://onda-prodigio.vercel.app/p/fruta-da-epoca/quiz-fruta/quiz');
}

main().catch(function (error) {
    console.error(error);
    process.exit(1);
});
