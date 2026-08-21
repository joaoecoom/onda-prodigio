'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var offerSettings = require('../lib/hub/offer-settings');

test('normalizeDomain strips protocol and trailing slash', function () {
    assert.equal(offerSettings.normalizeDomain('https://Onda-Prodigio.vercel.app/'), 'onda-prodigio.vercel.app');
    assert.equal(offerSettings.normalizeDomain(''), '');
});
