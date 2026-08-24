'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var stripeCatalog = require('../lib/hub/stripe-catalog');
var starter = require('../lib/hub/checkout-starter-template');

test('buildLookupKey is stable and namespaced', function () {
    assert.equal(
        stripeCatalog.buildLookupKey('Offer-1', 'main', 'main'),
        'hub-offer-1-main-main'
    );
    assert.equal(
        stripeCatalog.buildLookupKey('fruta', 'bump', 'bump-1'),
        'hub-fruta-bump-bump-1'
    );
});

test('starter template is vertical dark chrome without replacing core form', function () {
    var tpl = starter.buildStarterTemplate({ offerName: 'Fruta da Época' });

    assert.equal(tpl.settings.theme, 'dark');
    assert.match(tpl.html_top, /scarcity-bar/);
    assert.match(tpl.html_bottom, /checkout-testimonials/);
    assert.doesNotMatch(tpl.html_top, /id="checkout-form"/);
    assert.doesNotMatch(tpl.html_top, /payment-element/);
    assert.match(tpl.custom_css, /max-width:640px/);
});
