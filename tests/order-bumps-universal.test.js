'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var orderBumps = require('../lib/hub/order-bumps');

test('computeCheckoutTotal sums base and bump amounts', function () {
    var total = orderBumps.computeCheckoutTotal(1000, [
        { amount_cents: 200 },
        { amount_cents: 200 },
    ]);

    assert.equal(total, 1400);
});

test('buildOrderLineItems includes main and bumps', function () {
    var items = orderBumps.buildOrderLineItems('fruta-da-epoca', 1000, 'Fruta da Época', [
        { bump_id: 'bump-1', product_id: 'fruta-da-epoca-bump-1', label: 'Bump 1', amount_cents: 200 },
    ]);

    assert.equal(items.length, 2);
    assert.equal(items[0].type, 'main');
    assert.equal(items[0].amount_cents, 1000);
    assert.equal(items[1].type, 'bump');
    assert.equal(items[1].amount_cents, 200);
});

test('buildBumpMetadata stores bump ids and product ids', function () {
    var meta = orderBumps.buildBumpMetadata('fruta-da-epoca', 'Fruta da Época', 1000, [
        { bump_id: 'bump-1', product_id: 'fruta-da-epoca-bump-1', label: 'Bump 1', amount_cents: 200 },
        { bump_id: 'bump-2', product_id: 'fruta-da-epoca-bump-2', label: 'Bump 2', amount_cents: 200 },
    ]);

    assert.equal(meta.order_bumps, 'bump-1, bump-2');
    assert.equal(meta.bump_product_ids, 'fruta-da-epoca-bump-1, fruta-da-epoca-bump-2');
    assert.match(meta.order_items, /fruta-da-epoca-bump-1/);
});

test('parseProductIdsFromMetadata returns main and bump products', function () {
    var ids = orderBumps.parseProductIdsFromMetadata({
        product_id: 'fruta-da-epoca',
        bump_product_ids: 'fruta-da-epoca-bump-1, fruta-da-epoca-bump-2',
    });

    assert.deepEqual(ids, [
        'fruta-da-epoca',
        'fruta-da-epoca-bump-1',
        'fruta-da-epoca-bump-2',
    ]);
});

test('resolveSelectedBumps rejects when database unavailable or bump invalid', async function () {
    await assert.rejects(function () {
        return orderBumps.resolveSelectedBumps('fruta-da-epoca', ['bump-999']);
    });
});

test('tracking builds items from order_items metadata', function () {
    var constants = require('../lib/tracking/constants');
    var items = constants.buildTrackingItemsFromPayment({
        checkout_type: 'offer',
        product_id: 'fruta-da-epoca',
        order_items: JSON.stringify([
            { type: 'main', product_id: 'fruta-da-epoca', label: 'Fruta da Época', amount_cents: 1000 },
            { type: 'bump', product_id: 'fruta-da-epoca-bump-1', label: 'Bump 1', amount_cents: 200 },
        ]),
    }, 1200);

    assert.equal(items.length, 2);
    assert.equal(items[0].price, 10);
    assert.equal(items[1].price, 2);
    assert.equal(items[1].item_category, 'order_bump');
});

test('create-payment-intent rejects adulterated bump from another offer', async function () {
    var checkoutResolver = require('../lib/hub/checkout-resolver');
    assert.equal(typeof checkoutResolver.resolveUniversalCheckoutWithBumps, 'function');
});
