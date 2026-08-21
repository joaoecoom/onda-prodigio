'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var orders = require('../lib/hub/orders');
var orderMetrics = require('../lib/hub/order-metrics');
var launchReadiness = require('../lib/hub/launch-readiness');
var agentRegistry = require('../lib/hub/agent-tools/registry');

test('markOrderRefundedFromCharge skips without payment_intent', async function () {
    var result = await orders.markOrderRefundedFromCharge({ id: 'ch_test' });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'missing_payment_intent');
});

test('order metrics net revenue subtracts refunds', function () {
    var summary = orderMetrics.summarizeOrderMetrics([
        { status: 'paid', amount_eur: 10, is_traffic: false },
        { status: 'refunded', amount_eur: 3, is_traffic: false },
    ]);

    assert.equal(summary.gross_revenue_eur, 10);
    assert.equal(summary.refunds_eur, 3);
    assert.equal(summary.net_revenue_eur, 7);
    assert.equal(summary.orders, 1);
});

test('launch readiness and agent tool share same offer check export', function () {
    assert.equal(typeof launchReadiness.evaluateLaunchReadiness, 'function');
    assert.ok(agentRegistry.isAllowedTool('get_offer_launch_status'));
});

test('domain routing rejects hub host', async function () {
    var domainRouting = require('../lib/hub/page-builder/domain-routing');
    var hubConfig = require('../lib/hub/config');
    var hubHost = await domainRouting.resolveFunnelOfferFromHost(hubConfig.getHubHost());
    assert.equal(hubHost, null);
});

test('productsService rejects cross-offer checkout product', async function () {
    var productsService = require('../lib/comunidade/products-service');

    await assert.rejects(function () {
        return productsService.assertProductBelongsToOffer('onda-prodigio', 'fake-offer-b');
    });
});

test('payment intent metadata preserves attribution fields', function () {
    var metadata = {
        offer_id: 'e2e-offer',
        product_id: 'e2e-offer',
        checkout_type: 'offer',
        utm_source: 'test',
        utm_campaign: 'e2e-test',
        fbclid: 'fb.test',
    };

    var fields = orderMetrics.extractAttributionFields(metadata);
    assert.equal(fields.utm_source, 'test');
    assert.equal(fields.utm_campaign, 'e2e-test');
    assert.equal(fields.fbclid, 'fb.test');
});
