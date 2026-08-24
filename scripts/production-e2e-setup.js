#!/usr/bin/env node
'use strict';

/**
 * Full production commercial E2E — setup, payment, DB validation, refund.
 * Requires: .e2e-hub-token.local OR E2E_HUB_TOKEN (matches Vercel E2E_HUB_TOKEN)
 * Never prints secrets.
 */

var fs = require('fs');
var path = require('path');

var SITE = (process.env.E2E_SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
var HUB = (process.env.E2E_BASE_URL || 'https://hub-dr-ecoom.vercel.app').replace(/\/$/, '');
var SLUG_A = 'production-e2e-test';
var SLUG_B = 'production-e2e-test-b';
var TOKEN_FILE = path.join(__dirname, '..', '.e2e-hub-token.local');

var report = { steps: [], errors: [] };

function step(name, ok, detail) {
    report.steps.push({ name: name, ok: ok, detail: detail || '' });
    console.log((ok ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : ''));
    if (!ok) {
        report.errors.push(name + ': ' + detail);
    }
}

function pat() {
    var mcp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.cursor/mcp.json'), 'utf8'));
    return mcp.mcpServers['supabase-onda-prodigio'].headers.Authorization.replace(/^Bearer\s+/i, '').trim();
}

async function sql(query) {
    var r = await fetch('https://api.supabase.com/v1/projects/vmyezkbkthguojmxhacw/database/query', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + pat(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query }),
    });
    if (!r.ok) throw new Error('SQL ' + r.status);
    return r.json();
}

async function loadEnv() {
    var r = await fetch('https://api.supabase.com/v1/projects/vmyezkbkthguojmxhacw/api-keys', {
        headers: { Authorization: 'Bearer ' + pat() },
    });
    var keys = await r.json();
    var list = Array.isArray(keys) ? keys : keys.data || [];
    var svc = list.find(function (k) { return k.name === 'service_role'; });
    process.env.SUPABASE_URL = 'https://vmyezkbkthguojmxhacw.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = svc.api_key;
}

function hubToken() {
    return (process.env.E2E_HUB_TOKEN || fs.readFileSync(TOKEN_FILE, 'utf8')).trim();
}

async function hub(pathSuffix, opts) {
    var r = await fetch(HUB + pathSuffix, Object.assign({
        headers: { Authorization: 'Bearer ' + hubToken(), 'Content-Type': 'application/json' },
    }, opts || {}));
    var d = await r.json().catch(function () { return {}; });
    return { ok: r.ok, status: r.status, data: d };
}

async function ensureOffer(slug, name) {
    var offers = require('../lib/hub/offers');
    var safeName = String(name || '').replace(/'/g, "''");
    var rows = await sql("SELECT slug, status FROM hub_offers WHERE slug='" + slug + "' LIMIT 1;");

    if (rows[0]) {
        if (rows[0].status !== 'archived') {
            try {
                await offers.archiveOffer(slug);
            } catch (e) {
                await sql("UPDATE hub_offers SET status='archived' WHERE slug='" + slug + "';");
            }
        }

        await sql(
            "UPDATE hub_offers SET status='draft', mode='test', name='" + safeName + "' WHERE slug='" + slug + "';"
        );
        offers.clearOffersCache();
        return offers.getOfferBySlug(slug, { forceRefresh: true });
    }

    return offers.createOffer({ name: name, slug: slug, status: 'draft', mode: 'test' });
}

async function setupPage(offerId) {
    var fe = require('../lib/hub/funnel-engine');
    var publish = require('../lib/hub/page-builder/publish');
    var funnels = await fe.listFunnels(offerId);
    var funnel = funnels.find(function (row) {
        return row.slug === 'e2e';
    });

    if (!funnel) {
        funnel = await fe.createFunnel(offerId, { name: 'E2E', slug: 'e2e', funnel_type: 'sales' });
    }

    var pages = await fe.listPages(offerId, funnel.id);
    var page = pages.find(function (row) {
        return row.slug === 'sales';
    });

    if (!page) {
        page = await fe.createPage(offerId, funnel.id, { name: 'Sales', slug: 'sales', status: 'draft', page_type: 'sales' });
        var section = await fe.createSection(offerId, page.id, { name: 'Main', slug: 'main', sort_order: 1 });
        await fe.createBlock(offerId, section.id, {
            type: 'button',
            sort_order: 1,
            content: { label: 'Comprar' },
            settings: { action: 'checkout' },
        });
    }

    await publish.publishPage({ offer_id: offerId, page_id: page.id, status: 'published' });
    return { funnel: funnel, page: page };
}

async function createPI(slug, email) {
    var r = await fetch(SITE + '/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'test', checkout_id: 'main', offer_slug: slug, product_id: slug,
            full_name: 'E2E', email: email, phone: '+351910000000',
            tracking: { utm_source: 'e2e', utm_medium: 'cpc', utm_campaign: 'production-smoke', fbclid: 'e2e-fb', offer_id: slug },
        }),
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'PI failed');
    return d.clientSecret.split('_secret_')[0];
}

async function waitOrder(pi, ms) {
    var end = Date.now() + (ms || 120000);
    while (Date.now() < end) {
        var rows = await sql("SELECT * FROM hub_orders WHERE stripe_payment_intent_id='" + pi + "' LIMIT 1;");
        if (rows[0]) return rows[0];
        await new Promise(function (r) { setTimeout(r, 2500); });
    }
    return null;
}

async function waitAccess(email, productId, ms) {
    var end = Date.now() + (ms || 120000);
    while (Date.now() < end) {
        var rows = await sql(
            "SELECT mp.* FROM member_products mp JOIN members m ON m.id=mp.member_id " +
            "WHERE lower(m.email)=lower('" + email.replace(/'/g, "''") + "') AND mp.product_id='" + productId + "' LIMIT 1;"
        );
        if (rows[0]) return rows[0];
        await new Promise(function (r) { setTimeout(r, 2500); });
    }
    return null;
}

async function confirmPIViaGrant(piId) {
    var Stripe = require('stripe');
    var key = process.env.STRIPE_TEST_SECRET_KEY;
    if (!key) {
        throw new Error('STRIPE_TEST_SECRET_KEY not available locally — use Playwright payment step');
    }
    var stripe = new Stripe(key);
    var pi = await stripe.paymentIntents.retrieve(piId);
    if (pi.status === 'succeeded') return pi;
    return stripe.paymentIntents.confirm(piId, { payment_method: 'pm_card_visa' });
}

async function run() {
    await loadEnv();

    var auth = await hub('/api/sales-attribution?action=hub_launch_health&slug=onda-prodigio');
    step('hub_auth', auth.ok, auth.ok ? 'ok' : String(auth.status));

    if (!auth.ok) {
        console.log('\nDeploy required for E2E_HUB_TOKEN auth patch.');
        process.exit(1);
    }

    var offerA = await ensureOffer(SLUG_A, 'Production E2E Test Offer');
    step('create_offer_a', !!offerA.id, SLUG_A);

    var offerB = await ensureOffer(SLUG_B, 'Production E2E Test Offer B');
    step('create_offer_b', !!offerB.id, SLUG_B);

    var pageSetup = await setupPage(SLUG_A);
    var pubUrl = SITE + '/p/' + SLUG_A + '/' + pageSetup.funnel.slug + '/' + pageSetup.page.slug;
    var pub = await fetch(pubUrl);
    var pubHtml = await pub.text();
    step('publish_page', pub.ok && pubHtml.indexOf('/checkout/?') > -1, pubUrl);

    var email = 'e2e-' + Date.now() + '@prod-test.local';
    var piId;

    try {
        piId = await createPI(SLUG_A, email);
        step('create_pi', !!piId, piId);
    } catch (e) {
        step('create_pi', false, e.message);
        finish(1);
        return;
    }

    process.env.E2E_PAYMENT_INTENT_ID = piId;
    process.env.E2E_TEST_EMAIL = email;
    process.env.E2E_OFFER_SLUG = SLUG_A;
    fs.writeFileSync(path.join(__dirname, '..', '.e2e-run-state.json'), JSON.stringify({
        piId: piId, email: email, slugA: SLUG_A, slugB: SLUG_B,
    }));

    console.log('\n→ Run Playwright production payment: npm run test:e2e:payment');
    console.log('→ Then: node scripts/production-e2e-verify.js');
    finish(0);
}

function finish(code) {
    fs.writeFileSync(path.join(__dirname, '..', '.e2e-report.json'), JSON.stringify(report, null, 2));
    process.exit(code);
}

run().catch(function (e) {
    step('fatal', false, e.message);
    finish(1);
});
