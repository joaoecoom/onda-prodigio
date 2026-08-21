#!/usr/bin/env node
'use strict';

/**
 * Bloco H — audit launch readiness + commercial state for one offer slug.
 * Usage: node scripts/bloco-h-audit.js <slug>
 * Auth: .e2e-hub-token.local OR E2E_HUB_TOKEN (never printed)
 */

var fs = require('fs');
var path = require('path');

var HUB = (process.env.E2E_BASE_URL || 'https://hub-dr-ecoom.vercel.app').replace(/\/$/, '');
var SITE = (process.env.E2E_SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
var TOKEN_FILE = path.join(__dirname, '..', '.e2e-hub-token.local');

function hubToken() {
    return (process.env.E2E_HUB_TOKEN || (fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8') : '')).trim();
}

function pat() {
    var mcp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.cursor', 'mcp.json'), 'utf8'));
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

async function hub(pathSuffix, opts) {
    var r = await fetch(HUB + pathSuffix, Object.assign({
        headers: { Authorization: 'Bearer ' + hubToken(), 'Content-Type': 'application/json' },
    }, opts || {}));
    var d = await r.json().catch(function () { return {}; });
    return { ok: r.ok, status: r.status, data: d };
}

async function run() {
    var slug = process.argv[2];

    if (!slug) {
        console.error('Usage: node scripts/bloco-h-audit.js <offer-slug>');
        process.exit(1);
    }

    if (!hubToken()) {
        console.error('Missing E2E_HUB_TOKEN or .e2e-hub-token.local');
        process.exit(1);
    }

    var report = { slug: slug, at: new Date().toISOString(), sections: {} };

    var health = await hub('/api/sales-attribution?action=hub_launch_health&slug=' + encodeURIComponent(slug) + '&refresh=1');
    report.sections.launch_health = health.ok ? {
        readiness: health.data.readiness,
        label: health.data.label,
        checks: (health.data.checks || []).map(function (c) {
            return { id: c.id, group: c.group, status: c.status, message: c.message };
        }),
    } : { error: health.data.error || health.status };

    var wizard = await hub('/api/sales-attribution?action=hub_offer_wizard&slug=' + encodeURIComponent(slug) + '&refresh=1');
    report.sections.wizard = wizard.ok ? {
        steps: (wizard.data.wizard && wizard.data.wizard.steps) || [],
        launch: wizard.data.wizard && wizard.data.wizard.launch,
    } : { error: wizard.data.error || wizard.status };

    var metrics = await hub('/api/sales-attribution?action=hub_metrics_overview&slug=' + encodeURIComponent(slug));
    report.sections.metrics = metrics.ok ? metrics.data : { error: metrics.data.error || metrics.status };

    var safeSlug = slug.replace(/'/g, "''");
    var orders = await sql(
        "SELECT status, COUNT(*)::int AS n, SUM(amount_cents)::int AS cents " +
        "FROM hub_orders WHERE offer_id = '" + safeSlug + "' GROUP BY status ORDER BY status;"
    );
    report.sections.orders = orders;

    var pages = await sql(
        "SELECT f.slug AS funnel_slug, p.slug AS page_slug, p.status " +
        "FROM funnels f JOIN pages p ON p.funnel_id = f.id " +
        "JOIN hub_offers o ON o.id = f.offer_id WHERE o.slug = '" + safeSlug + "';"
    );
    report.sections.funnels = pages;

    if (pages[0]) {
        var pageUrl = SITE + '/p/' + slug + '/' + pages[0].funnel_slug + '/' + pages[0].page_slug;
        var pageResp = await fetch(pageUrl);
        report.sections.public_page = { url: pageUrl, http: pageResp.status };
    }

    console.log(JSON.stringify(report, null, 2));
}

run().catch(function (error) {
    console.error(error.message || error);
    process.exit(1);
});
