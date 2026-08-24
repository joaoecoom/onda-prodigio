'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var aiAssistant = require('../lib/hub/page-builder/ai-assistant');
var aiContext = require('../lib/hub/page-builder/ai-context');
var editorState = require('../lib/hub/page-builder/editor-state');

function sampleTree(headline) {
    return {
        page: { id: 'p1', slug: 'test-page', name: 'Test Page' },
        funnel: { id: 'f1', slug: 'test-funnel' },
        sections: [{
            id: 's1',
            type: 'hero',
            sort_order: 100,
            settings: { label: 'Hero' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
            blocks: [{
                id: 'b1',
                type: 'heading',
                sort_order: 100,
                content: { text: headline || 'Hello' },
                settings: { level: 1, alignment: 'center' },
                styles: {},
                visibility: { desktop: true, tablet: true, mobile: true },
            }],
        }],
    };
}

test('local assistant updates heading text', function () {
    var tree = sampleTree('Old headline');
    var result = aiAssistant.applyLocalAssistant('Muda a headline para Nova oferta', tree, {
        type: 'block',
        id: 'b1',
    });

    assert.equal(result.applied, true);
    assert.equal(result.tree.sections[0].blocks[0].content.text, 'Nova oferta');
});

test('local assistant adds CTA section template', function () {
    var tree = sampleTree();
    var result = aiAssistant.applyLocalAssistant('Adiciona secção CTA', tree, { type: null, id: null });

    assert.equal(result.applied, true);
    assert.equal(result.tree.sections.length, 2);
    assert.equal(result.tree.sections[1].type, 'cta');
});

test('local assistant returns suggestions when prompt is unknown', function () {
    var tree = sampleTree();
    var result = aiAssistant.applyLocalAssistant('Faz algo completamente abstracto e impossível', tree, {
        type: null,
        id: null,
    });

    assert.equal(result.applied, false);
    assert.ok(Array.isArray(result.suggestions));
});

test('buildPageBuilderAgentPrompt includes page scope', function () {
    var prompt = aiContext.buildPageBuilderAgentPrompt({
        offer_id: 'o1',
        offer_slug: 'ai-test-offer',
        funnel_id: 'f1',
        funnel_slug: 'ai-test-sales-funnel',
        page_id: 'p1',
        page_slug: 'ai-test-sales-page',
    }, 'Melhora a copy da hero');

    assert.match(prompt, /ai-test-offer/);
    assert.match(prompt, /ai-test-sales-page/);
    assert.match(prompt, /Melhora a copy da hero/);
});

test('buildPageSummary summarizes sections and blocks', function () {
    var summary = aiContext.buildPageSummary(sampleTree('Headline test'));

    assert.equal(summary.length, 1);
    assert.equal(summary[0].blocks[0].preview, 'Headline test');
});
