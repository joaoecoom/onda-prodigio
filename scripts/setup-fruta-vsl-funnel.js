#!/usr/bin/env node
'use strict';

/**
 * Bloco H4 — Fruta da Época VSL/Sales funnel (vsl-fruta)
 * Coexists with quiz-fruta on the same offer/checkout/product.
 */

var fs = require('fs');
var path = require('path');

var SLUG = 'fruta-da-epoca';
var FUNNEL_SLUG = 'vsl-fruta';
var PAGE_SLUG = 'sales';

function pat() {
    var mcp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.cursor', 'mcp.json'), 'utf8'));
    return mcp.mcpServers['supabase-onda-prodigio'].headers.Authorization.replace(/^Bearer\s+/i, '').trim();
}

async function loadSupabaseEnv() {
    var r = await fetch('https://api.supabase.com/v1/projects/vmyezkbkthguojmxhacw/api-keys', {
        headers: { Authorization: 'Bearer ' + pat() },
    });
    var keys = await r.json();
    var svc = (Array.isArray(keys) ? keys : keys.data || []).find(function (k) { return k.name === 'service_role'; });
    process.env.SUPABASE_URL = 'https://vmyezkbkthguojmxhacw.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = svc.api_key;
}

function checkoutButton(label, sortOrder) {
    return {
        type: 'button',
        sort_order: sortOrder,
        content: { label: label },
        settings: { action: 'checkout', variant: 'primary', alignment: 'center' },
    };
}

function heading(text, level, sortOrder) {
    return {
        type: 'heading',
        sort_order: sortOrder,
        content: { text: text },
        settings: { level: level || 2, alignment: 'center' },
    };
}

function textBlock(text, sortOrder) {
    return {
        type: 'text',
        sort_order: sortOrder,
        content: { text: text },
        settings: { alignment: 'left' },
    };
}

async function addSection(engine, offerId, pageId, sectionDef) {
    var section = await engine.createSection(offerId, pageId, {
        type: sectionDef.type,
        sort_order: sectionDef.sort_order,
        settings: { label: sectionDef.label },
    });

    for (var i = 0; i < sectionDef.blocks.length; i += 1) {
        await engine.createBlock(offerId, section.id, sectionDef.blocks[i]);
    }

    return section;
}

async function run() {
    await loadSupabaseEnv();

    var offers = require('../lib/hub/offers');
    var funnelEngine = require('../lib/hub/funnel-engine');
    var publish = require('../lib/hub/page-builder/publish');

    var offer = await offers.getOfferBySlug(SLUG, { forceRefresh: true });

    if (!offer) {
        throw new Error('Offer not found: ' + SLUG);
    }

    var funnels = await funnelEngine.listFunnels(SLUG);
    var funnel = funnels.find(function (row) { return row.slug === FUNNEL_SLUG; });

    if (!funnel) {
        funnel = await funnelEngine.createFunnel(SLUG, {
            name: 'VSL Fruta',
            slug: FUNNEL_SLUG,
            type: 'vsl',
            status: 'active',
            description: '[PLACEHOLDER] Funil VSL — Fruta da Época',
        });
        console.log('[vsl-fruta] Created funnel', funnel.id);
    } else if (funnel.type !== 'vsl') {
        funnel = await funnelEngine.updateFunnel(SLUG, funnel.id, { type: 'vsl', status: 'active' });
    }

    var pages = await funnelEngine.listPages(SLUG, funnel.id);
    var page = pages.find(function (row) { return row.slug === PAGE_SLUG; });

    if (!page) {
        page = await funnelEngine.createPage(SLUG, funnel.id, {
            name: 'Sales Page VSL',
            slug: PAGE_SLUG,
            type: 'vsl',
            status: 'draft',
        });
        console.log('[vsl-fruta] Created page', page.id);
    }

    var sections = await funnelEngine.listSections(SLUG, page.id);

    if (!sections.length) {
        var sectionDefs = [
            {
                type: 'hero',
                label: 'Hero',
                sort_order: 100,
                blocks: [
                    heading('[PLACEHOLDER] Fruta da Época — Hero', 1, 100),
                    textBlock('[PLACEHOLDER] Descobre como receber fruta fresca em casa, sem complicações.', 200),
                    checkoutButton('Quero começar — €10', 300),
                ],
            },
            {
                type: 'vsl',
                label: 'VSL',
                sort_order: 200,
                blocks: [
                    heading('[PLACEHOLDER] Vídeo de apresentação', 2, 100),
                    {
                        type: 'html',
                        sort_order: 200,
                        content: {
                            html: '<div style="aspect-ratio:16/9;background:#111;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif">[PLACEHOLDER VSL — substituir por vídeo real]</div>',
                        },
                        settings: {},
                    },
                ],
            },
            {
                type: 'custom',
                label: 'Problem',
                sort_order: 300,
                blocks: [
                    heading('[PLACEHOLDER] O problema', 2, 100),
                    textBlock('[PLACEHOLDER] Comprar fruta fresca todos os dias é difícil, caro e inconsistente.', 200),
                ],
            },
            {
                type: 'custom',
                label: 'Mechanism',
                sort_order: 400,
                blocks: [
                    heading('[PLACEHOLDER] O mecanismo', 2, 100),
                    textBlock('[PLACEHOLDER] Selecionamos a fruta da época e entregamos num plano simples e acessível.', 200),
                ],
            },
            {
                type: 'benefits',
                label: 'Benefits',
                sort_order: 500,
                blocks: [
                    heading('[PLACEHOLDER] Benefícios', 2, 100),
                    textBlock('• [PLACEHOLDER] Fruta fresca\n• [PLACEHOLDER] Preço acessível\n• [PLACEHOLDER] Entrega conveniente', 200),
                ],
            },
            {
                type: 'custom',
                label: 'Social Proof',
                sort_order: 600,
                blocks: [
                    heading('[PLACEHOLDER] Prova social', 2, 100),
                    textBlock('[PLACEHOLDER] "Finalmente como fruta todos os dias." — Cliente teste', 200),
                ],
            },
            {
                type: 'custom',
                label: 'Offer',
                sort_order: 700,
                blocks: [
                    heading('[PLACEHOLDER] Oferta — Fruta da Época', 2, 100),
                    textBlock('[PLACEHOLDER] Produto principal €10 + order bumps opcionais de €2 cada.', 200),
                ],
            },
            {
                type: 'cta',
                label: 'CTA',
                sort_order: 800,
                blocks: [
                    heading('[PLACEHOLDER] Pronto para experimentar?', 2, 100),
                    checkoutButton('Comprar agora — €10', 200),
                ],
            },
            {
                type: 'custom',
                label: 'FAQ',
                sort_order: 900,
                blocks: [
                    heading('[PLACEHOLDER] FAQ', 2, 100),
                    textBlock('[PLACEHOLDER] P: Como funciona?\nR: Resposta placeholder.\n\nP: Posso cancelar?\nR: Resposta placeholder.', 200),
                ],
            },
            {
                type: 'cta',
                label: 'Final CTA',
                sort_order: 1000,
                blocks: [
                    heading('[PLACEHOLDER] Última chamada', 2, 100),
                    checkoutButton('Quero a minha fruta — €10', 200),
                ],
            },
        ];

        for (var s = 0; s < sectionDefs.length; s += 1) {
            await addSection(funnelEngine, SLUG, page.id, sectionDefs[s]);
        }

        console.log('[vsl-fruta] Seeded', sectionDefs.length, 'sections');
    } else {
        console.log('[vsl-fruta] Page already has sections — skipping seed');
    }

    var published = await publish.publishPage({
        offer_id: SLUG,
        page_id: page.id,
        status: 'published',
    });

    console.log('\n[vsl-fruta] Setup complete');
    console.log('Preview:', 'https://onda-prodigio.vercel.app/preview/' + SLUG + '/' + FUNNEL_SLUG + '/' + PAGE_SLUG + '?preview=1');
    console.log('Live:', 'https://onda-prodigio.vercel.app/p/' + SLUG + '/' + FUNNEL_SLUG + '/' + PAGE_SLUG);
    console.log('Editor:', 'https://hub-dr-ecoom.vercel.app/editor/' + SLUG + '/' + FUNNEL_SLUG + '/' + PAGE_SLUG);
    console.log('Checkout:', 'https://onda-prodigio.vercel.app/checkout/?offer=' + SLUG + '&funnel=' + FUNNEL_SLUG + '&page=' + PAGE_SLUG + '&mode=test');
    console.log('Published status:', published.status || 'published');
}

run().catch(function (error) {
    console.error('[vsl-fruta] FAIL:', error.message || error);
    process.exit(1);
});
