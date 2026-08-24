'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var offerProvisioning = require('../lib/hub/offer-provisioning');

test('normalizeCheckoutId sanitizes ids', function () {
    assert.equal(offerProvisioning.normalizeCheckoutId('Main Checkout'), 'main-checkout');
    assert.equal(offerProvisioning.normalizeCheckoutId('UPSELL_A!!'), 'upsell_a');
    assert.equal(offerProvisioning.normalizeCheckoutId(''), 'main');
    assert.equal(offerProvisioning.normalizeCheckoutId('  a--b  '), 'a-b');
});

test('list/upsert/deactivate checkout helpers are exported', function () {
    assert.equal(typeof offerProvisioning.listOfferCheckouts, 'function');
    assert.equal(typeof offerProvisioning.upsertOfferCheckout, 'function');
    assert.equal(typeof offerProvisioning.deactivateOfferCheckout, 'function');
    assert.equal(typeof offerProvisioning.updateMainCheckout, 'function');
});

test('deactivateOfferCheckout rejects main', async function () {
    await assert.rejects(
        function () {
            return offerProvisioning.deactivateOfferCheckout('offer-x', 'main');
        },
        /checkout principal/i
    );
});
