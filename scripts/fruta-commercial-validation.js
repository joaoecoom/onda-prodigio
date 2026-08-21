#!/usr/bin/env node
'use strict';

/**
 * Bloco H5 — Fruta da Época commercial validation (Stripe TEST)
 * €10 (quiz-fruta) + €16 (vsl-fruta + 3 bumps) + refund €16
 */

var fs = require('fs');
var path = require('path');
var execSync = require('child_process').execSync;

var SITE = (process.env.E2E_SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
var HUB = (process.env.E2E_BASE_URL || 'https://hub-dr-ecoom.vercel.app').replace(/\/$/, '');
var OFFER = 'fruta-da-epoca';
var PRODUCT = 'fruta-da-epoca';
var TOKEN_FILE = path.join(__dirname, '..', '.e2e-hub-token.local');

var report = { checks: [], payments: {} };

function check(name, ok, detail) {
    report.checks.push({ name: name, ok: ok, detail: detail || '' });
    console.log((ok ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : ''));
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

    if (!r.ok) {
        throw new Error('SQL failed: ' + r.status);
    }

    return r.json();
}

function hubToken() {
    return (process.env.E2E_HUB_TOKEN || fs.readFileSync(TOKEN_FILE, 'utf8')).trim();
}

async function hubApi(pathSuffix) {
    var r = await fetch(HUB + pathSuffix, {
        headers: { Authorization: 'Bearer ' + hubToken() },
    });
    return { ok: r.ok, data: await r.json() };
}

async function createPI(options) {
    var body = {
        mode: 'test',
        checkout_id: 'main',
        offer_slug: OFFER,
        product_id: PRODUCT,
        full_name: options.fullName || 'H5 Validation',
        email: options.email,
        phone: '+351910000001',
        selected_bump_ids: options.bumps || [],
        tracking: Object.assign({
            offer_slug: OFFER,
            offer_id: OFFER,
            utm_source: 'h5-validation',
            utm_medium: 'test',
            utm_campaign: 'fruta-h5',
        }, options.tracking || {}),
    };

    var r = await fetch(SITE + '/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    var data = await r.json();

    if (!r.ok) {
        throw new Error(data.error || 'create-payment-intent failed');
    }

    return data.clientSecret.split('_secret_')[0];
}

function confirmPI(piId) {
    var out = execSync(
        'stripe payment_intents confirm ' + piId +
        ' --payment-method pm_card_visa' +
        ' --return-url "' + SITE + '/comunidade/?welcome=1"',
        { encoding: 'utf8' }
    );
    var result = JSON.parse(out);

    if (result.status !== 'succeeded') {
        throw new Error('Payment not succeeded: ' + result.status);
    }

    return result;
}

function refundPI(piId) {
    var out = execSync('stripe refunds create --payment-intent ' + piId, { encoding: 'utf8' });
    return JSON.parse(out);
}

async function waitOrder(piId, ms) {
    var end = Date.now() + (ms || 120000);

    while (Date.now() < end) {
        var rows = await sql(
            "SELECT * FROM hub_orders WHERE stripe_payment_intent_id='" + piId.replace(/'/g, "''") + "' LIMIT 1;"
        );

        if (rows[0]) {
            return rows[0];
        }

        await new Promise(function (resolve) { setTimeout(resolve, 3000); });
    }

    return null;
}

async function waitAccess(email, ms) {
    var end = Date.now() + (ms || 120000);
    var safeEmail = email.replace(/'/g, "''");

    while (Date.now() < end) {
        var rows = await sql(
            "SELECT mp.id FROM member_products mp JOIN members m ON m.id=mp.member_id " +
            "WHERE lower(m.email)=lower('" + safeEmail + "') AND mp.product_id='" + PRODUCT + "' LIMIT 1;"
        );

        if (rows[0]) {
            return rows[0];
        }

        await new Promise(function (resolve) { setTimeout(resolve, 3000); });
    }

    return null;
}

async function waitRefunded(piId, ms) {
    var end = Date.now() + (ms || 120000);

    while (Date.now() < end) {
        var rows = await sql(
            "SELECT status FROM hub_orders WHERE stripe_payment_intent_id='" + piId.replace(/'/g, "''") + "' LIMIT 1;"
        );

        if (rows[0] && rows[0].status === 'refunded') {
            return rows[0];
        }

        await new Promise(function (resolve) { setTimeout(resolve, 3000); });
    }

    return null;
}

async function run() {
    var ts = Date.now();
    var email10 = 'fruta-h5-10-' + ts + '@test.local';
    var email16 = 'fruta-h5-16-' + ts + '@test.local';

    console.log('\n=== CASE A: €10 quiz-fruta ===\n');
    var pi10 = await createPI({
        email: email10,
        bumps: [],
        tracking: { funnel_slug: 'quiz-fruta', page_slug: 'quiz' },
    });
    report.payments.pi10 = pi10;
    check('pi10_created', !!pi10, pi10);

    var stripe10 = confirmPI(pi10);
    check('pi10_amount', stripe10.amount === 1000, String(stripe10.amount));

    var order10 = await waitOrder(pi10);
    check('pi10_webhook_order', !!order10, order10 ? order10.status : 'timeout');
    check('pi10_order_amount', order10 && Number(order10.amount_cents) === 1000, order10 && order10.amount_cents);
    check('pi10_order_count', order10 && order10.offer_id === OFFER, order10 && order10.offer_id);

    var meta10 = order10 && order10.metadata ? order10.metadata : {};
    check('pi10_funnel', meta10.funnel_slug === 'quiz-fruta', meta10.funnel_slug);
    check('pi10_page', meta10.page_slug === 'quiz', meta10.page_slug);

    var dup10 = await sql("SELECT COUNT(*)::int AS n FROM hub_orders WHERE stripe_payment_intent_id='" + pi10 + "';");
    check('pi10_single_order', dup10[0] && dup10[0].n === 1, 'count=' + (dup10[0] && dup10[0].n));

    var access10 = await waitAccess(email10);
    check('pi10_member_access', !!access10, email10);

    console.log('\n=== CASE B: €16 vsl-fruta + 3 bumps ===\n');
    var pi16 = await createPI({
        email: email16,
        bumps: ['bump-1', 'bump-2', 'bump-3'],
        tracking: { funnel_slug: 'vsl-fruta', page_slug: 'sales' },
    });
    report.payments.pi16 = pi16;
    check('pi16_created', !!pi16, pi16);

    var stripe16 = confirmPI(pi16);
    check('pi16_amount', stripe16.amount === 1600, String(stripe16.amount));

    var order16 = await waitOrder(pi16);
    check('pi16_webhook_order', !!order16, order16 ? order16.status : 'timeout');
    check('pi16_order_amount', order16 && Number(order16.amount_cents) === 1600, order16 && order16.amount_cents);

    var meta16 = order16 && order16.metadata ? order16.metadata : {};
    check('pi16_funnel', meta16.funnel_slug === 'vsl-fruta', meta16.funnel_slug);
    check('pi16_bumps', String(meta16.order_bumps || '').indexOf('bump-1') !== -1, meta16.order_bumps);

    var dup16 = await sql("SELECT COUNT(*)::int AS n FROM hub_orders WHERE stripe_payment_intent_id='" + pi16 + "';");
    check('pi16_single_order', dup16[0] && dup16[0].n === 1, 'count=' + (dup16[0] && dup16[0].n));

    var access16 = await waitAccess(email16);
    check('pi16_member_access', !!access16, email16);

    console.log('\n=== REFUND €16 ===\n');
    var refund = refundPI(pi16);
    check('refund_created', !!refund.id, refund.id);

    var refunded = await waitRefunded(pi16);
    check('refund_status', !!refunded, refunded ? refunded.status : 'timeout');

    var metrics = await hubApi('/api/sales-attribution?action=hub_metrics&slug=' + OFFER + '&days=30&refresh=1');
    check('dashboard_metrics', metrics.ok && metrics.data.metrics, metrics.ok ? 'ok' : 'fail');

    if (metrics.data && metrics.data.metrics) {
        var m = metrics.data.metrics;
        check('dashboard_gross', Number(m.gross_revenue_eur || m.revenue_eur) >= 10, String(m.gross_revenue_eur || m.revenue_eur));
        check('dashboard_refunds', Number(m.refunds_eur) >= 16, String(m.refunds_eur));
    }

    if (metrics.data && metrics.data.funnel_breakdown) {
        var quizRow = metrics.data.funnel_breakdown.find(function (row) {
            return row.funnel_slug === 'quiz-fruta';
        });
        var vslRow = metrics.data.funnel_breakdown.find(function (row) {
            return row.funnel_slug === 'vsl-fruta';
        });
        check('funnel_quiz_attribution', !!quizRow && quizRow.orders >= 1, quizRow && String(quizRow.orders));
        check('funnel_vsl_attribution', !!vslRow, vslRow ? String(vslRow.orders) : 'missing');
    } else {
        check('funnel_breakdown', false, 'missing from API');
    }

    fs.writeFileSync(path.join(__dirname, '..', '.h5-validation-report.json'), JSON.stringify(report, null, 2));
    var failed = report.checks.filter(function (c) { return !c.ok; });
    process.exit(failed.length ? 1 : 0);
}

run().catch(function (error) {
    console.error('FATAL:', error.message || error);
    process.exit(1);
});
