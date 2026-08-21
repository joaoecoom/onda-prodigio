#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');

var SLUG = 'fruta-da-epoca';

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

var CASES = [
    { label: '€10', bumps: [], total: 1000 },
    { label: '€12', bumps: ['bump-1'], total: 1200 },
    { label: '€14', bumps: ['bump-1', 'bump-2'], total: 1400 },
    { label: '€16', bumps: ['bump-1', 'bump-2', 'bump-3'], total: 1600 },
];

async function run() {
    await loadSupabaseEnv();

    var offers = require('../lib/hub/offers');
    var checkoutResolver = require('../lib/hub/checkout-resolver');

    var offer = await offers.getOfferBySlug(SLUG, { forceRefresh: true });

    if (!offer) {
        throw new Error('Offer not found: ' + SLUG);
    }

    var failed = 0;

    for (var i = 0; i < CASES.length; i += 1) {
        var testCase = CASES[i];

        try {
            var resolved = await checkoutResolver.resolveUniversalCheckoutWithBumps(offer, {
                checkoutId: 'main',
                mode: 'test',
                productId: offer.primary_product_id,
                selectedBumpIds: testCase.bumps,
            });

            if (resolved.totalCents !== testCase.total) {
                console.log('FAIL', testCase.label, 'expected', testCase.total, 'got', resolved.totalCents);
                failed += 1;
            } else {
                console.log('PASS', testCase.label, resolved.totalCents);
            }
        } catch (error) {
            console.log('FAIL', testCase.label, error.message);
            failed += 1;
        }
    }

    try {
        await checkoutResolver.resolveUniversalCheckoutWithBumps(offer, {
            checkoutId: 'main',
            mode: 'test',
            productId: offer.primary_product_id,
            selectedBumpIds: ['bump-from-other-offer'],
        });
        console.log('FAIL cross-offer bump should reject');
        failed += 1;
    } catch (error) {
        console.log('PASS cross-offer bump rejected');
    }

    try {
        await checkoutResolver.resolveUniversalCheckoutWithBumps(offer, {
            checkoutId: 'main',
            mode: 'test',
            productId: 'onda-prodigio',
            selectedBumpIds: [],
        });
        console.log('FAIL wrong product should reject');
        failed += 1;
    } catch (error) {
        console.log('PASS wrong product rejected');
    }

    process.exit(failed ? 1 : 0);
}

run().catch(function (error) {
    console.error(error.message || error);
    process.exit(1);
});
