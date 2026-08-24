'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var normalize = require('../lib/hub/page-builder/block-input-normalize');

test('normalizeNestedBlock lifts html to content.html', function () {
    var block = normalize.normalizeNestedBlock({
        type: 'html',
        html: '<div>Headline</div>',
    });

    assert.equal(block.content.html, '<div>Headline</div>');
    assert.equal(block.html, undefined);
});

test('assertBlockHasContent rejects empty html block', function () {
    assert.throws(function () {
        normalize.assertBlockHasContent({ type: 'html', content: {} });
    }, /content\.html/);
});

test('assertBlockHasContent accepts heading text', function () {
    normalize.assertBlockHasContent({
        type: 'heading',
        content: { text: 'Olá' },
    });
});
