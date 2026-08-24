'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var funnelSteps = require('../lib/hub/funnel-steps');
var geminiToolBridge = require('../lib/hub/gemini-tool-bridge');
var geminiAssistant = require('../lib/hub/gemini-assistant');
var registry = require('../lib/hub/agent-tools/registry');

test('buildDefaultSteps includes sales upsell thank_you', function () {
    var steps = funnelSteps.buildDefaultSteps();
    var types = steps.map(function (row) { return row.type; });

    assert.ok(types.indexOf('sales') !== -1);
    assert.ok(types.indexOf('upsell') !== -1);
    assert.ok(types.indexOf('thank_you') !== -1);
    assert.ok(types.indexOf('checkout') === -1);
});

test('groupPagesIntoSteps links pages by type', function () {
    var grouped = funnelSteps.groupPagesIntoSteps([
        { type: 'sales', slug: 'sales', sort_order: 100 },
        { type: 'upsell', slug: 'upsell-1', sort_order: 300 },
    ]);

    var sales = grouped.find(function (row) { return row.type === 'sales'; });
    var checkout = grouped.find(function (row) { return row.type === 'checkout'; });

    assert.equal(sales.linked, true);
    assert.equal(sales.pages.length, 1);
    assert.equal(checkout.system, true);
});

test('gemini tool bridge exposes funnel tracking and checkout modes', function () {
    assert.ok(geminiToolBridge.getToolsForMode('funnel').length >= 5);
    assert.ok(geminiToolBridge.getToolsForMode('tracking').length >= 2);
    assert.ok(geminiToolBridge.getToolsForMode('checkout').length >= 5);
    assert.ok(registry.isAllowedTool('setup_funnel_flow'));
    assert.ok(registry.isAllowedTool('register_funnel_domain'));
    assert.ok(registry.isAllowedTool('save_checkout_template'));
});

test('gemini assistant status reports configuration', function () {
    var status = geminiAssistant.getStatus();
    assert.equal(typeof status.configured, 'boolean');
    assert.ok(Array.isArray(status.modes));
});

test('gemini chat validates input', async function () {
    var original = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';

    await assert.rejects(function () {
        return geminiAssistant.chat({ message: 'test message here' });
    }, /Oferta em falta/);

    process.env.GEMINI_API_KEY = original;
});
