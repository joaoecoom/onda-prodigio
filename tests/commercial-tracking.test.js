'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var orderMetrics = require('../lib/hub/order-metrics');
var commerceEvents = require('../lib/tracking/commerce-events');
var constants = require('../lib/tracking/constants');
var metaMetrics = require('../lib/hub/meta-metrics');

test('orderRowToSale preserves UTM attribution from order metadata', function () {
    var sale = orderMetrics.orderRowToSale({
        id: 'order-1',
        offer_id: 'offer-a',
        product_id: 'offer-a',
        stripe_payment_intent_id: 'pi_test',
        customer_email: 'buyer@example.com',
        amount_cents: 100,
        currency: 'eur',
        status: 'paid',
        created_at: '2026-08-21T12:00:00.000Z',
        metadata: {
            utm_source: 'facebook',
            utm_medium: 'paid',
            utm_campaign: 'camp-1',
            fbclid: 'fb.1.test',
        },
    }, 'offer-a');

    assert.equal(sale.amount_eur, 1);
    assert.equal(sale.utm_source, 'facebook');
    assert.equal(sale.is_traffic, true);
    assert.equal(sale.is_hub_order, true);
});

test('summarizeOrderMetrics calculates revenue, orders and AOV', function () {
    var summary = orderMetrics.summarizeOrderMetrics([
        { status: 'paid', amount_eur: 9, is_traffic: true },
        { status: 'paid', amount_eur: 19, is_traffic: false },
        { status: 'refunded', amount_eur: 5, is_traffic: false },
    ]);

    assert.equal(summary.orders, 2);
    assert.equal(summary.revenue_eur, 28);
    assert.equal(summary.refunds_eur, 5);
    assert.equal(summary.net_revenue_eur, 23);
    assert.equal(summary.aov_eur, 14);
});

test('mergeSalesLists deduplicates by payment_intent id', function () {
    var merged = orderMetrics.mergeSalesLists(
        [{ payment_intent: 'pi_1', created: '2026-08-21T12:00:00.000Z', amount_eur: 1 }],
        [{ payment_intent: 'pi_1', created: '2026-08-21T12:00:00.000Z', amount_eur: 9 }]
    );

    assert.equal(merged.length, 1);
    assert.equal(merged[0].amount_eur, 1);
});

test('groupOrdersByOfferSlug isolates offers', function () {
    var buckets = orderMetrics.groupOrdersByOfferSlug([
        {
            offer_id: 'offer-a',
            product_id: 'offer-a',
            stripe_payment_intent_id: 'pi_a',
            customer_email: 'a@test.com',
            amount_cents: 100,
            currency: 'eur',
            status: 'paid',
            created_at: '2026-08-21T12:00:00.000Z',
            metadata: {},
        },
        {
            offer_id: 'offer-b',
            product_id: 'offer-b',
            stripe_payment_intent_id: 'pi_b',
            customer_email: 'b@test.com',
            amount_cents: 200,
            currency: 'eur',
            status: 'paid',
            created_at: '2026-08-21T12:00:00.000Z',
            metadata: {},
        },
    ], [
        { id: 'offer-a', slug: 'oferta-a' },
        { id: 'offer-b', slug: 'oferta-b' },
    ]);

    assert.equal(buckets['oferta-a'].length, 1);
    assert.equal(buckets['oferta-b'].length, 1);
    assert.equal(buckets['oferta-a'][0].amount_eur, 1);
});

test('shouldSendPurchaseTracking enables universal checkout in test mode', function () {
    assert.equal(commerceEvents.shouldSendPurchaseTracking({
        checkout_type: 'offer',
        checkout: 'main',
        stripe_mode: 'test',
    }), true);

    assert.equal(commerceEvents.shouldSendPurchaseTracking({
        checkout: 'checkout9-test',
        stripe_mode: 'test',
    }), false);
});

test('buildTrackingItemsFromPayment uses offer product metadata', function () {
    var items = constants.buildTrackingItemsFromPayment({
        checkout_type: 'offer',
        product_id: 'oferta-c',
        product: 'Oferta C',
    }, 100);

    assert.equal(items.length, 1);
    assert.equal(items[0].item_id, 'oferta-c');
    assert.equal(items[0].price, 1);
});

test('computeCpa returns null without spend or orders', function () {
    assert.equal(metaMetrics.computeCpa(0, 5), null);
    assert.equal(metaMetrics.computeCpa(100, 0), null);
    assert.equal(metaMetrics.computeCpa(100, 4), 25);
});
