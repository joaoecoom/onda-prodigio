'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var patchEngine = require('../lib/hub/page-builder/patch-engine');

function sampleTree(headline) {
    return {
        page: { id: 'p1', slug: 'test-page' },
        sections: [{
            id: 's1',
            type: 'custom',
            sort_order: 100,
            settings: { label: 'Hero' },
            styles: {},
            blocks: [{
                id: 'b1',
                type: 'heading',
                sort_order: 100,
                content: { text: headline || 'Hello' },
                settings: {},
                styles: {},
            }],
        }],
    };
}

test('buildBlockIndex includes internal block ids', function () {
    var index = patchEngine.buildBlockIndex(sampleTree());
    assert.equal(index.length, 1);
    assert.equal(index[0].alias, 'block_01');
    assert.equal(index[0].section_id, 's1');
    assert.equal(index[0].primary_block_id, 'b1');
    assert.equal(index[0].blocks[0].block_id, 'b1');
    assert.equal(index[0].blocks[0].type, 'heading');
});

test('fast path updates headline on selected block', function () {
    var tree = sampleTree('Old');
    var result = patchEngine.tryFastPath(
        'Muda a headline para Nova oferta',
        tree,
        { type: 'section', id: 's1' },
        null
    );

    assert.equal(result.applied, true);
    assert.equal(result.mode, 'fast');
    assert.equal(result.tree.sections[0].blocks[0].content.text, 'Nova oferta');
    assert.match(result.summary, /Headline/i);
});

test('fast path skips complex page build requests', function () {
    var intent = patchEngine.classifyIntent('Cria uma sales page completa para X', null, []);
    assert.equal(intent.tier, 'gemini');
});

test('fast path duplicates selected block', function () {
    var tree = sampleTree();
    var result = patchEngine.tryFastPath(
        'Duplica o bloco seleccionado',
        tree,
        { type: 'section', id: 's1' },
        null
    );

    assert.equal(result.applied, true);
    assert.equal(result.tree.sections.length, 2);
});

test('fast path rejects invalid video url', function () {
    var tree = sampleTree();
    var result = patchEngine.tryFastPath(
        'Coloca este vídeo no bloco https://example.com/not-a-video',
        tree,
        { type: 'section', id: 's1' },
        null
    );

    assert.equal(result.applied, false);
    assert.equal(result.reason, 'invalid_video_url');
});

test('isComplexRequest allows simple edits with image context', function () {
    var refs = [{ type: 'image', mime_type: 'image/jpeg', data_base64: 'abc' }];
    assert.equal(patchEngine.isComplexRequest('Muda a headline para Teste', refs), false);
    assert.equal(patchEngine.isComplexRequest('Constrói bloco novo com comentários Facebook', refs), true);
});

test('summarizePatches returns human label', function () {
    assert.equal(
        patchEngine.summarizePatches([{ operation: 'UPDATE_TEXT', field: 'headline' }]),
        'Headline actualizada'
    );
});
