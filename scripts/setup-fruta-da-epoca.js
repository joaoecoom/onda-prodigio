#!/usr/bin/env node
'use strict';

/**
 * Setup Fruta da Época offer — Bloco H2
 * Creates offer, products, order bumps, funnel, published sales page.
 */

var fs = require('fs');
var path = require('path');

var SLUG = 'fruta-da-epoca';
var NAME = 'Fruta da Época';
var MAIN_CENTS = 1000;
var BUMP_CENTS = 200;

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

async function applyMigration() {
    var sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '074_hub_offer_order_bumps.sql'), 'utf8');
    var r = await fetch('https://api.supabase.com/v1/projects/vmyezkbkthguojmxhacw/database/query', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + pat(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
    });

    if (!r.ok) {
        throw new Error('Migration 074 failed: ' + r.status);
    }
}

async function run() {
    console.log('[fruta-da-epoca] Applying migration 074…');
    await applyMigration();
    await loadSupabaseEnv();

    var offers = require('../lib/hub/offers');
    var provisioning = require('../lib/hub/offer-provisioning');
    var orderBumps = require('../lib/hub/order-bumps');
    var funnelEngine = require('../lib/hub/funnel-engine');
    var publish = require('../lib/hub/page-builder/publish');
    var { getSupabaseAdmin } = require('../lib/supabase-admin');

    var existing = await offers.getOfferBySlug(SLUG, { forceRefresh: true });

    if (!existing) {
        console.log('[fruta-da-epoca] Creating offer…');
        await offers.createOffer({
            name: NAME,
            slug: SLUG,
            status: 'draft',
            mode: 'test',
        });
    }

    await provisioning.provisionOffer(SLUG);
    await provisioning.updateMainCheckout(SLUG, { amount_cents: MAIN_CENTS, label: 'Fruta da Época' });

    var supabase = getSupabaseAdmin();

    for (var i = 1; i <= 3; i += 1) {
        var bumpProductId = SLUG + '-bump-' + i;
        var bumpId = 'bump-' + i;

        await supabase.from('products').upsert({
            id: bumpProductId,
            name: 'Bump ' + i,
            description: 'Order bump ' + i + ' — Fruta da Época',
            offer_id: SLUG,
            sort_order: i + 1,
        });

        await orderBumps.upsertOrderBump(SLUG, {
            bump_id: bumpId,
            product_id: bumpProductId,
            label: 'Bump ' + i,
            amount_cents: BUMP_CENTS,
            sort_order: i,
        });

        console.log('[fruta-da-epoca] Bump', bumpId, bumpProductId, '€2');
    }

    var funnels = await funnelEngine.listFunnels(SLUG);
    var funnel = funnels.find(function (row) { return row.slug === 'vendas'; });

    if (!funnel) {
        funnel = await funnelEngine.createFunnel(SLUG, {
            name: 'Vendas',
            slug: 'vendas',
            funnel_type: 'sales',
        });
    }

    var pages = await funnelEngine.listPages(SLUG, funnel.id);
    var page = pages.find(function (row) { return row.slug === 'sales'; });

    if (!page) {
        page = await funnelEngine.createPage(SLUG, funnel.id, {
            name: 'Sales Page',
            slug: 'sales',
            status: 'draft',
            page_type: 'sales',
        });
    }

    var sections = await funnelEngine.listSections(SLUG, page.id);
    var section = sections[0];

    if (!section) {
        section = await funnelEngine.createSection(SLUG, page.id, {
            name: 'Hero',
            slug: 'hero',
            sort_order: 1,
        });
    }

    var blocks = await funnelEngine.listBlocks(SLUG, section.id);
    var hasButton = blocks.some(function (row) { return row.type === 'button'; });

    if (!hasButton) {
        if (!blocks.some(function (row) { return row.type === 'heading'; })) {
            await funnelEngine.createBlock(SLUG, section.id, {
                type: 'heading',
                sort_order: 1,
                content: { text: 'Fruta da Época' },
                settings: { level: 1 },
            });
        }

        if (!blocks.some(function (row) { return row.type === 'text'; })) {
            await funnelEngine.createBlock(SLUG, section.id, {
                type: 'text',
                sort_order: 2,
                content: { text: 'Oferta de teste — produto principal €10 + 3 bumps de €2.' },
                settings: {},
            });
        }

        await funnelEngine.createBlock(SLUG, section.id, {
            type: 'button',
            sort_order: 3,
            content: { label: 'Comprar agora' },
            settings: { action: 'checkout', variant: 'primary' },
        });
    }

    var published = await publish.publishPage({
        offer_id: SLUG,
        page_id: page.id,
        status: 'published',
    });

    offers.clearOffersCache();

    var pageUrl = 'https://onda-prodigio.vercel.app/p/' + SLUG + '/vendas/sales';
    var checkoutUrl = 'https://onda-prodigio.vercel.app/checkout/?offer=' + SLUG + '&mode=test';

    console.log('\n[fruta-da-epoca] Setup complete');
    console.log('Sales page:', pageUrl);
    console.log('Checkout:', checkoutUrl);
    console.log('Main product:', SLUG, '€10');
    console.log('Bumps: bump-1, bump-2, bump-3 @ €2 each');
}

run().catch(function (error) {
    console.error('[fruta-da-epoca] FAIL:', error.message || error);
    process.exit(1);
});
