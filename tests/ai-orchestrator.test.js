'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var aiOrchestrator = require('../lib/hub/ai-orchestrator');
var contextEngine = require('../lib/hub/ai-context-engine');
var geminiToolBridge = require('../lib/hub/gemini-tool-bridge');
var aiProvider = require('../lib/llm');

test('AI provider abstraction exposes gemini', function () {
    assert.equal(typeof aiProvider.isConfigured, 'function');
    assert.equal(typeof aiProvider.generateContent, 'function');
});

test('page_builder mode exposes slim fast page tools', function () {
    var tools = geminiToolBridge.getToolsForMode('page_builder');
    var names = tools.map(function (row) { return row.name; });

    assert.ok(names.indexOf('create_section') !== -1);
    assert.ok(names.indexOf('update_block') !== -1);
    assert.ok(names.indexOf('delete_section') !== -1);
    assert.equal(names.indexOf('get_page_tree'), -1);
    assert.equal(names.indexOf('apply_template'), -1);
    assert.ok(geminiToolBridge.listModes().indexOf('page_builder') !== -1);
});

test('orchestrator builds steps from tool log', function () {
    var steps = aiOrchestrator.buildSteps([
        { name: 'create_page', ok: true },
        { name: 'apply_template', ok: false, error: 'slug exists' },
    ]);

    assert.equal(steps.length, 2);
    assert.equal(steps[0].ok, true);
    assert.equal(steps[1].ok, false);
});

test('orchestrator extracts page id from tool results', function () {
    var refs = aiOrchestrator.extractPageIdFromToolLog([
        {
            name: 'create_page',
            ok: true,
            result: { success: true, page_id: 'abc-123', slug: 'sales-page' },
        },
    ]);

    assert.equal(refs.page_id, 'abc-123');
    assert.equal(refs.page_slug, 'sales-page');
});

test('context engine routes page_builder to page context builder', async function () {
    assert.equal(typeof contextEngine.buildPageContext, 'function');
    assert.equal(typeof contextEngine.build, 'function');
});

test('orchestrator status includes provider metadata', function () {
    var status = aiOrchestrator.getStatus();

    assert.equal(status.provider, 'gemini');
    assert.ok(Array.isArray(status.modes));
    assert.ok(status.tool_count >= 49);
});
