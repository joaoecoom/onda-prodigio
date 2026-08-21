'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var grantAccess = require('../lib/comunidade/grant-access');
var checkoutResolver = require('../lib/hub/checkout-resolver');

var MOCK_OFFER = {
    id: 'oferta-a',
    slug: 'oferta-a',
    name: 'Oferta A',
    primary_product_id: 'oferta-a',
    checkouts: [
        {
            checkout_id: 'main',
            product_id: 'oferta-a',
            label: '€1',
            path: '/checkout/?offer=oferta-a',
            test_path: '/checkout/?offer=oferta-a&mode=test',
            amount_cents: 100,
            currency: 'eur',
            stripe_price_id: '',
            stripe_test_price_id: '',
            is_active: true,
            sort_order: 1,
        },
    ],
};

test('parseProductIdsFromMetadata uses explicit product_id for universal checkout', function () {
    var ids = grantAccess.parseProductIdsFromMetadata({
        checkout_type: 'offer',
        checkout: 'main',
        product_id: 'oferta-b',
        offer_id: 'oferta-b',
    });

    assert.deepEqual(ids, ['oferta-b']);
});

test('shouldGrantAccessForPayment allows universal offer checkout in test mode', function () {
    var allowed = grantAccess.shouldGrantAccessForPayment(
        {
            checkout_type: 'offer',
            checkout: 'main',
            product_id: 'oferta-a',
            email: 'test@example.com',
            stripe_mode: 'test',
        },
        { status: 'succeeded' }
    );

    assert.equal(allowed, true);
});

test('shouldGrantAccessForPayment blocks legacy test checkout9-test', function () {
    var blocked = grantAccess.shouldGrantAccessForPayment(
        {
            checkout: 'checkout9-test',
            stripe_mode: 'test',
            email: 'test@example.com',
        },
        { status: 'succeeded' }
    );

    assert.equal(blocked, false);
});

test('legacy order bumps still include onda-prodigio when no product_id', function () {
    var ids = grantAccess.parseLegacyOrderBumps({ order_bumps: 'tardes-sem-brigas' });
    assert.ok(ids.indexOf('onda-prodigio') !== -1);
    assert.ok(ids.indexOf('tardes-sem-brigas') !== -1);
});

test('pickOfferCheckoutRow resolves main checkout', function () {
    var row = checkoutResolver.pickOfferCheckoutRow(MOCK_OFFER, 'main');
    assert.equal(row.checkout_id, 'main');
    assert.equal(row.amount_cents, 100);
});
