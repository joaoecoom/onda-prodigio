'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var hubMetrics = require('../lib/hub/hub-metrics');
var salesReport = require('../lib/metrics/sales-report');

var offerList = [
    {
        id: 'offer-a',
        slug: 'onda-prodigio',
        status: 'active',
        checkouts: [{ checkout_id: 'checkout9' }, { checkout_id: 'checkout19' }],
    },
    {
        id: 'offer-b',
        slug: 'nova-oferta',
        status: 'draft',
        checkouts: [{ checkout_id: 'checkout-custom' }],
    },
];

function contextForOffers(list) {
    return {
        knownSlugs: { 'onda-prodigio': true, 'nova-oferta': true },
        idToSlug: { 'offer-a': 'onda-prodigio', 'offer-b': 'nova-oferta' },
        checkoutToSlug: {
            checkout9: 'onda-prodigio',
            checkout19: 'onda-prodigio',
            'checkout-custom': 'nova-oferta',
        },
        defaultSlug: 'onda-prodigio',
    };
}

test('resolvePaymentOfferSlug uses metadata offer_slug', function () {
    var context = contextForOffers(offerList);
    var slug = hubMetrics.resolvePaymentOfferSlug({
        metadata: { offer_slug: 'nova-oferta', checkout: 'checkout9' },
    }, context);

    assert.equal(slug, 'nova-oferta');
});

test('resolvePaymentOfferSlug falls back to offer_id', function () {
    var context = contextForOffers(offerList);
    var slug = hubMetrics.resolvePaymentOfferSlug({
        metadata: { offer_id: 'offer-b', checkout: 'checkout9' },
    }, context);

    assert.equal(slug, 'nova-oferta');
});

test('resolvePaymentOfferSlug maps checkout to offer', function () {
    var context = contextForOffers(offerList);
    var slug = hubMetrics.resolvePaymentOfferSlug({
        metadata: { checkout: 'checkout19' },
        status: 'succeeded',
    }, context);

    assert.equal(slug, 'onda-prodigio');
});

test('summarizeSalesMetrics aggregates revenue and traffic', function () {
    var summary = hubMetrics.summarizeSalesMetrics([
        { amount_eur: 9, is_traffic: true },
        { amount_eur: 19, is_traffic: false },
    ]);

    assert.equal(summary.sales, 2);
    assert.equal(summary.revenue_eur, 28);
    assert.equal(summary.traffic_sales, 1);
    assert.equal(summary.traffic_revenue_eur, 9);
});

test('buildCheckoutToOfferMap maps checkout ids to slugs', function () {
    var map = hubMetrics.buildCheckoutToOfferMap(offerList);
    assert.equal(map.checkout9, 'onda-prodigio');
    assert.equal(map['checkout-custom'], 'nova-oferta');
});

test('isDashboardSale accepts funnel and supplementary sales', function () {
    assert.equal(salesReport.isDashboardSale({
        status: 'succeeded',
        amount: 900,
        metadata: { checkout: 'checkout9' },
    }), true);

    assert.equal(salesReport.isDashboardSale({
        status: 'succeeded',
        amount: 900,
        metadata: { checkout: 'checkout9', stripe_mode: 'test' },
    }), false);
});
