'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var llm = require('../lib/llm');

test('llm index re-exporta extractParts', function () {
    assert.equal(typeof llm.extractParts, 'function');

    var parts = llm.extractParts({
        content: { parts: [{ text: 'ok' }] },
    });

    assert.equal(parts.length, 1);
    assert.equal(parts[0].text, 'ok');
});
