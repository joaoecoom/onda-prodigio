#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');

var state = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.e2e-run-state.json'), 'utf8'));
var SLUG_A = state.slugA;
var SLUG_B = state.slugB;
var piId = state.piId;
var email = state.email;

function pat() {
    var mcp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.cursor/mcp.json'), 'utf8'));
    return mcp.mcpServers['supabase-onda-prodigio'].headers.Authorization.replace(/^Bearer\s+/i, '').trim();
}

async function sql(q) {
    var r = await fetch('https://api.supabase.com/v1/projects/vmyezkbkthguojmxhacw/database/query', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + pat(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
    });
    return r.json();
}

function hubToken() {
    return fs.readFileSync(path.join(__dirname, '..', '.e2e-hub-token.local'), 'utf8').trim();
}

async function hub(pathSuffix) {
    var r = await fetch('https://hub-dr-ecoom.vercel.app' + pathSuffix, {
        headers: { Authorization: 'Bearer ' + hubToken() },
    });
    return { ok: r.ok, data: await r.json() };
}

async function run() {
    var report = { checks: [] };
    function check(name, ok, detail) {
        report.checks.push({ name: name, ok: ok, detail: detail || '' });
        console.log((ok ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : ''));
    }

    var orders = await sql("SELECT * FROM hub_orders WHERE stripe_payment_intent_id='" + piId + "';");
    var order = orders[0];
    check('hub_order', !!order, order ? order.status : 'missing');
    check('order_offer', order && order.offer_id === SLUG_A, order && order.offer_id);
    check('order_product', order && order.product_id === SLUG_A, order && order.product_id);
    check('order_amount', order && Number(order.amount_cents) === 100, order && order.amount_cents);

    var dup = await sql("SELECT COUNT(*)::int AS n FROM hub_orders WHERE stripe_payment_intent_id='" + piId + "';");
    check('order_idempotency', dup[0] && dup[0].n === 1, 'count=' + (dup[0] && dup[0].n));

    var events = await sql("SELECT COUNT(*)::int AS n FROM hub_stripe_events WHERE payment_intent_id='" + piId + "';");
    check('stripe_event_logged', events[0] && events[0].n >= 1, 'events=' + (events[0] && events[0].n));

    var access = await sql(
        "SELECT mp.id FROM member_products mp JOIN members m ON m.id=mp.member_id " +
        "WHERE lower(m.email)=lower('" + email.replace(/'/g, "''") + "') AND mp.product_id='" + SLUG_A + "' LIMIT 1;"
    );
    check('member_access', !!access[0], email);

    var meta = order && order.metadata ? order.metadata : {};
    check('attribution_utm', meta.utm_source === 'e2e' || (typeof meta === 'object' && JSON.stringify(meta).indexOf('e2e') > -1), 'utm');

    var metrics = await hub('/api/sales-attribution?action=hub_metrics&slug=' + SLUG_A + '&days=30');
    check('dashboard_metrics', metrics.ok && metrics.data.metrics, metrics.ok ? 'ok' : 'fail');

    if (metrics.data && metrics.data.metrics) {
        check('dashboard_orders', Number(metrics.data.metrics.orders) >= 1, String(metrics.data.metrics.orders));
    }

    var launch = await hub('/api/sales-attribution?action=hub_launch_health&slug=' + SLUG_A);
    check('launch_status', launch.ok && launch.data.readiness, launch.data && launch.data.readiness);

    var countB = await sql("SELECT COUNT(*)::int AS n FROM hub_orders WHERE offer_id='" + SLUG_B + "';");
    var countA = await sql("SELECT COUNT(*)::int AS n FROM hub_orders WHERE offer_id='" + SLUG_A + "' AND status='paid';");
    check('isolation', countB[0].n === 0 && countA[0].n >= 1, 'A=' + countA[0].n + ' B=' + countB[0].n);

    fs.writeFileSync(path.join(__dirname, '..', '.e2e-verify-report.json'), JSON.stringify(report, null, 2));
    var failed = report.checks.filter(function (c) { return !c.ok; });
    process.exit(failed.length ? 1 : 0);
}

run();
