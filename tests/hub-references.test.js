'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var referenceNormalize = require('../lib/hub/references/normalize');

test('buildUserParts adds inline image data and link context', function () {
    var parts = referenceNormalize.buildUserParts('Cria hero igual', [
        { type: 'link', url: 'https://example.com/landing' },
        {
            type: 'image',
            mime_type: 'image/png',
            data_base64: 'abc123',
            name: 'ref.png',
        },
    ]);

    assert.equal(parts.length, 2);
    assert.match(parts[0].text, /Cria hero igual/);
    assert.match(parts[0].text, /example.com/);
    assert.equal(parts[1].inlineData.mimeType, 'image/png');
    assert.equal(parts[1].inlineData.data, 'abc123');
});

test('normalizeReferences rejects oversized images', function () {
    var huge = 'A'.repeat(6 * 1024 * 1024);
    assert.throws(function () {
        referenceNormalize.normalizeReferences([
            { type: 'image', mime_type: 'image/png', data_base64: huge },
        ]);
    }, /demasiado grande/i);
});
