'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var geminiToolBridge = require('../lib/hub/gemini-tool-bridge');
var registry = require('../lib/hub/agent-tools/registry');
var checkoutBuilder = require('../lib/hub/checkout-builder');

test('gemini checkout mode exposes builder tools', function () {
    var tools = geminiToolBridge.getToolsForMode('checkout');
    var names = tools.map(function (row) { return row.name; });

    assert.ok(names.indexOf('save_checkout_template') !== -1);
    assert.ok(names.indexOf('update_checkout_pricing') !== -1);
    assert.ok(names.indexOf('upsert_order_bump') !== -1);
    assert.ok(geminiToolBridge.listModes().indexOf('checkout') !== -1);
});

test('checkout template helpers normalize settings', function () {
    var empty = checkoutBuilder.getTemplate('missing-offer-without-db');

    assert.ok(empty instanceof Promise);

    return empty.then(function (template) {
        assert.equal(template.html_top, '');
        assert.equal(template.settings.theme, 'dark');
        assert.equal(template.has_custom, false);
    });
});

test('registry includes checkout coding tools', function () {
    assert.ok(registry.isAllowedTool('get_checkout_context'));
    assert.ok(registry.isAllowedTool('save_checkout_template'));
    assert.ok(registry.isAllowedTool('list_order_bumps'));
});
