'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var offers = require('../lib/hub/offers');

test('isOfferDeletionAllowed blocks primary offer', function () {
    assert.equal(offers.isOfferDeletionAllowed('onda-prodigio'), false);
    assert.equal(offers.isOfferDeletionAllowed('teste'), true);
    assert.equal(offers.isOfferDeletionAllowed(''), false);
});
