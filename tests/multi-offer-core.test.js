'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var legacyProducts = require('../lib/comunidade/legacy-products');

test('legacy products include Onda Prodígio and Clube', function () {
    assert.equal(legacyProducts.isLegacyProduct('onda-prodigio'), true);
    assert.equal(legacyProducts.isLegacyProduct('clube-super-cerebros'), true);
});

test('new offer products use generic renderer', function () {
    assert.equal(legacyProducts.usesGenericRenderer('oferta-teste'), true);
    assert.equal(legacyProducts.usesGenericRenderer('onda-prodigio'), false);
});

test('legacy list is explicit and stable', function () {
    assert.ok(legacyProducts.LEGACY_PRODUCT_IDS.length >= 2);
    assert.equal(legacyProducts.isLegacyProduct(''), false);
});
