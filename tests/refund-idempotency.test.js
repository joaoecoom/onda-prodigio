'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var stripeEvents = require('../lib/hub/stripe-events');

test('claimStripeEvent skips without database', async function () {
    var result = await stripeEvents.claimStripeEvent({
        id: 'evt_test_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test', metadata: { offer_id: 'offer-a' } } },
    });

    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'no_database');
});

test('claimStripeEvent requires event id', async function () {
    var result = await stripeEvents.claimStripeEvent(null);
    assert.equal(result.skipped, true);
});
