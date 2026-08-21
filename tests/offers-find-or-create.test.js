'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var offers = require('../lib/hub/offers');

test('findOrCreateOffer is exported', function () {
    assert.equal(typeof offers.findOrCreateOffer, 'function');
});

test('findOrCreateOffer rejects invalid slug input', async function () {
    await assert.rejects(function () {
        return offers.findOrCreateOffer({ name: '!!!' });
    }, /Slug inválido/);
});
