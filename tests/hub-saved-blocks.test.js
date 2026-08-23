'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var savedBlocks = require('../lib/hub/saved-blocks/service');

test('stripSectionPayload remove ids e mantém blocks', function () {
    var stripped = savedBlocks.stripSectionPayload({
        id: 'sec-1',
        type: 'hero',
        sort_order: 100,
        settings: { label: 'Hero' },
        blocks: [{
            id: 'blk-1',
            type: 'heading',
            sort_order: 10,
            content: { text: 'Olá' },
        }],
    });

    assert.equal(stripped.type, 'hero');
    assert.equal(stripped.settings.label, 'Hero');
    assert.equal(stripped.blocks.length, 1);
    assert.equal(stripped.blocks[0].type, 'heading');
    assert.equal(stripped.blocks[0].content.text, 'Olá');
    assert.equal(stripped.blocks[0].id, undefined);
});

test('stripBlockPayload preserva html de script', function () {
    var stripped = savedBlocks.stripBlockPayload({
        id: 'x',
        type: 'html',
        content: { html: '<script>alert(1)</script>' },
    });

    assert.equal(stripped.type, 'html');
    assert.equal(stripped.content.html, '<script>alert(1)</script>');
});

test('stripBlockPayload remove id de botão', function () {
    var payload = savedBlocks.stripBlockPayload({
        id: 'x',
        type: 'button',
        content: { label: 'CTA' },
    });

    assert.equal(payload.type, 'button');
    assert.equal(payload.content.label, 'CTA');
    assert.equal(payload.id, undefined);
});
