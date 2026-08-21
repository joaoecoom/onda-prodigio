#!/usr/bin/env node
'use strict';

/**
 * Production E2E orchestrator — uses Supabase Management API for credentials.
 * Never logs secret values.
 */

var fs = require('fs');
var path = require('path');

var SITE_URL = (process.env.E2E_SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
var HUB_URL = (process.env.E2E_BASE_URL || 'https://hub-dr-ecoom.vercel.app').replace(/\/$/, '');
var SLUG_A = process.env.E2E_OFFER_SLUG_A || 'production-e2e-test';
var SLUG_B = process.env.E2E_OFFER_SLUG_B || 'production-e2e-test-b';
var TOKEN_FILE = path.join(__dirname, '..', '.e2e-hub-token.local');

var results = {
    offerA: null,
    offerB: null,
    funnel: null,
    page: null,
    paymentIntentId: null,
    paymentStatus: null,
    order: null,
    member: null,
    memberAccess: null,
    refund: null,
    launchA: null,
    metricsA: null,
    errors: [],
};

function log(msg) {
    console.log('[production-e2e] ' + msg);
}

function fail(step, error) {
    var message = error && error.message ? error.message : String(error);
    results.errors.push({ step: step, message: message });
    log('FAIL ' + step + ': ' + message);
}

function pass(step, detail) {
    log('PASS ' + step + (detail ? ': ' + detail : ''));
}

function loadMcpPat() {
    var mcpPath = path.join(__dirname, '..', '.cursor', 'mcp.json');
    var raw = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    var auth = raw.mcpServers['supabase-onda-prodigio'].headers.Authorization;
    return auth.replace(/^Bearer\s+/i, '').trim();
}

async function mgQuery(sql) {
    var pat = loadMcpPat();
    var response = await fetch('https://api.supabase.com/v1/projects/vmyezkbkthguojmxhacw/database/query', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + pat,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
        throw new Error('Supabase query failed: ' + response.status);
    }

    return response.json();
}

async function loadSupabaseEnv() {
    var pat = loadMcpPat();
    var response = await fetch('https://api.supabase.com/v1/projects/vmyezkbkthguojmxhacw/api-keys', {
        headers: { Authorization: 'Bearer ' + pat },
    });

    if (!response.ok) {
        throw new Error('Could not load Supabase API keys');
    }

    var keys = await response.json();
    var list = Array.isArray(keys) ? keys : keys.data || [];
    var service = list.find(function (k) { return k.name === 'service_role'; });
    process.env.SUPABASE_URL = 'https://vmyezkbkthguojmxhacw.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = service.api_key;
}

function readHubToken() {
    if (process.env.E2E_HUB_TOKEN) {
        return process.env.E2E_HUB_TOKEN.trim();
    }

    if (fs.existsSync(TOKEN_FILE)) {
        return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    }

    return '';
}

async function hubApi(pathSuffix, options) {
    var token = readHubToken();

    if (!token) {
        throw new Error('HUB token unavailable');
    }

    var response = await fetch(HUB_URL + pathSuffix, Object.assign({
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
        },
    }, options || {}));

    var data = await response.json().catch(function () { return {}; });
    return { ok: response.ok, status: response.status, data: data };
}

async function archiveIfExists(slug) {
    var rows = await mgQuery(
        "SELECT slug, status FROM hub_offers WHERE slug = '" + slug.replace(/'/g, "''") + "' LIMIT 1;"
    );

    if (!rows[0]) {
        return;
    }

    if (rows[0].status === 'archived') {
        return;
    }

    var offers = require('../lib/hub/offers');

    try {
        await offers.archiveOffer(slug);
        pass('cleanup', slug);
    } catch (error) {
        if (error.message.indexOf('não pode ser apagada') !== -1) {
            return;
        }

        await mgQuery(
            "UPDATE hub_offers SET status = 'archived', updated_at = now() WHERE slug = '" +
            slug.replace(/'/g, "''") + "';"
        );
    }
}

async function createTestOffer(slug, name) {
    var offers = require('../lib/hub/offers');
    return offers.createOffer({
        name: name,
        slug: slug,
        status: 'draft',
        mode: 'test',
    });
}

async function setupFunnelAndPage(offerId) {
    var funnelEngine = require('../lib/hub/funnel-engine');
    var funnel = await funnelEngine.createFunnel(offerId, {
        name: 'E2E Funnel',
        slug: 'e2e-funnel',
        funnel_type: 'sales',
    });

    var page = await funnelEngine.createPage(offerId, funnel.id, {
        name: 'Sales Page',
        slug: 'sales',
        status: 'draft',
        page_type: 'sales',
    });

    var section = await funnelEngine.createSection(offerId, page.id, {
        name: 'Hero',
        slug: 'hero',
        sort_order: 1,
    });

    await funnelEngine.createBlock(offerId, section.id, {
        type: 'heading',
        sort_order: 1,
        content: { text: 'Production E2E Test' },
        settings: { level: 1 },
    });

    await funnelEngine.createBlock(offerId, section.id, {
        type: 'button',
        sort_order: 2,
        content: { label: 'Comprar agora' },
        settings: { action: 'checkout', variant: 'primary' },
    });

    var publish = require('../lib/hub/page-builder/publish');
    var tree = await publish.publishPage({
        offer_id: offerId,
        page_id: page.id,
        status: 'published',
    });

    return { funnel: funnel, page: tree.page || page };
}

async function createProductionPayment(slug, email) {
    var response = await fetch(SITE_URL + '/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'test',
            checkout_id: 'main',
            offer_slug: slug,
            product_id: slug,
            full_name: 'Production E2E',
            email: email,
            phone: '+351910000001',
            tracking: {
                utm_source: 'e2e',
                utm_medium: 'cpc',
                utm_campaign: 'production-smoke',
                utm_content: 'creative-01',
                fbclid: 'e2e-fbclid',
                offer_id: slug,
            },
        }),
    });

    var data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'create-payment-intent failed');
    }

    var piId = String(data.clientSecret || '').split('_secret_')[0];

    if (!piId.startsWith('pi_')) {
        throw new Error('Invalid PaymentIntent id');
    }

    return { paymentIntentId: piId, clientSecret: data.clientSecret };
}

async function waitForOrder(paymentIntentId, maxMs) {
    var deadline = Date.now() + (maxMs || 90000);

    while (Date.now() < deadline) {
        var rows = await mgQuery(
            "SELECT id, offer_id, product_id, stripe_payment_intent_id, status, amount_cents, currency, metadata " +
            "FROM hub_orders WHERE stripe_payment_intent_id = '" + paymentIntentId.replace(/'/g, "''") + "' LIMIT 1;"
        );

        if (rows[0]) {
            return rows[0];
        }

        await new Promise(function (r) { setTimeout(r, 3000); });
    }

    return null;
}

async function waitForMemberAccess(email, productId, maxMs) {
    var deadline = Date.now() + (maxMs || 90000);
    var safeEmail = email.replace(/'/g, "''");

    while (Date.now() < deadline) {
        var rows = await mgQuery(
            "SELECT ma.id, ma.product_id, m.email FROM member_access ma " +
            "JOIN members m ON m.id = ma.member_id " +
            "WHERE lower(m.email) = lower('" + safeEmail + "') " +
            "AND ma.product_id = '" + productId.replace(/'/g, "''") + "' LIMIT 1;"
        );

        if (rows[0]) {
            return rows[0];
        }

        await new Promise(function (r) { setTimeout(r, 3000); });
    }

    return null;
}

async function countOrdersForOffer(offerId) {
    var rows = await mgQuery(
        "SELECT COUNT(*)::int AS n FROM hub_orders WHERE offer_id = '" + offerId.replace(/'/g, "''") + "';"
    );
    return rows[0] ? rows[0].n : 0;
}

async function run() {
    log('Starting production E2E orchestrator');

    await loadSupabaseEnv();
    pass('supabase_env', 'loaded');

    var token = readHubToken();

    if (!token) {
        fail('hub_token', new Error('Set E2E_HUB_TOKEN or .e2e-hub-token.local'));
    }

    try {
        var healthProbe = await hubApi('/api/sales-attribution?action=hub_launch_health&slug=onda-prodigio');

        if (!healthProbe.ok) {
            fail('hub_auth', new Error('HUB API unauthorized — configure E2E_HUB_TOKEN'));
        } else {
            pass('hub_auth');
        }
    } catch (error) {
        fail('hub_auth', error);
    }

    if (results.errors.some(function (e) { return e.step === 'hub_auth' || e.step === 'hub_token'; })) {
        printSummary();
        process.exit(1);
    }

    try {
        await archiveIfExists(SLUG_A);
        await archiveIfExists(SLUG_B);

        results.offerA = await createTestOffer(SLUG_A, 'Production E2E Test Offer');
        pass('create_offer_a', SLUG_A);

        results.offerB = await createTestOffer(SLUG_B, 'Production E2E Test Offer B');
        pass('create_offer_b', SLUG_B);

        var setup = await setupFunnelAndPage(SLUG_A);
        results.funnel = setup.funnel;
        results.page = setup.page;
        pass('funnel_page', setup.page.slug);

        var previewUrl = SITE_URL + '/p/' + SLUG_A + '/' + setup.funnel.slug + '/' + setup.page.slug;
        var previewResp = await fetch(previewUrl);

        if (!previewResp.ok) {
            throw new Error('Published page HTTP ' + previewResp.status);
        }

        var html = await previewResp.text();

        if (html.indexOf('Comprar agora') === -1 || html.indexOf('/checkout/?') === -1) {
            throw new Error('Published page missing checkout CTA');
        }

        pass('published_page', previewUrl);
    } catch (error) {
        fail('setup', error);
        printSummary();
        process.exit(1);
    }

    var testEmail = 'production-e2e-' + Date.now() + '@test.ondaprodigio.local';

    try {
        var payment = await createProductionPayment(SLUG_A, testEmail);
        results.paymentIntentId = payment.paymentIntentId;
        pass('payment_intent_created', payment.paymentIntentId);

        log('Stripe confirm must run via MCP/browser — waiting for external confirm');
        log('Run: STRIPE_CONFIRM_PI=' + payment.paymentIntentId);

        printSummary();
        process.exit(0);
    } catch (error) {
        fail('payment', error);
        printSummary();
        process.exit(1);
    }
}

function printSummary() {
    console.log('\n=== PRODUCTION E2E SUMMARY ===');
    console.log(JSON.stringify({
        slugA: SLUG_A,
        slugB: SLUG_B,
        paymentIntentId: results.paymentIntentId,
        publishedPage: results.page && results.page.slug,
        errors: results.errors,
    }, null, 2));
}

run().catch(function (error) {
    fail('fatal', error);
    printSummary();
    process.exit(1);
});
