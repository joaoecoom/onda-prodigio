'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var launchReadiness = require('../lib/hub/launch-readiness');
var vercelDomains = require('../lib/hub/vercel-domains');

var OFFER_A = {
    id: 'offer-a',
    slug: 'oferta-a',
    name: 'Oferta A',
    status: 'active',
    mode: 'test',
    primary_product_id: 'oferta-a',
    checkouts: [{
        checkout_id: 'main',
        product_id: 'oferta-a',
        amount_cents: 100,
        path: '/checkout/?offer=oferta-a',
    }],
    funnel_domain: 'oferta-a.com',
};

var OFFER_B = {
    id: 'offer-b',
    slug: 'oferta-b',
    name: 'Oferta B',
    status: 'draft',
    primary_product_id: 'oferta-b',
    checkouts: [],
};

var PRODUCT_A = {
    id: 'oferta-a',
    name: 'Produto A',
    offer_id: 'offer-a',
};

test('checkOffer passes for valid active offer', function () {
    var check = launchReadiness.checkOffer(OFFER_A);
    assert.equal(check.status, 'pass');
});

test('checkProduct rejects cross-offer product', function () {
    var check = launchReadiness.checkProduct(OFFER_A, {
        id: 'oferta-b',
        offer_id: 'offer-b',
        name: 'Produto B',
    });
    assert.equal(check.status, 'fail');
});

test('checkSalesPage fails when only draft pages exist', function () {
    var check = launchReadiness.checkSalesPage(
        [{ id: 'p1', funnel_id: 'f1', status: 'draft', slug: 'sales' }],
        [{ id: 'f1', offer_id: 'offer-a', slug: 'main' }],
        OFFER_A
    );
    assert.equal(check.status, 'fail');
    assert.match(check.message, /não publicada/i);
});

test('checkCtaCheckout detects checkout action blocks', function () {
    var check = launchReadiness.checkCtaCheckout([
        {
            type: 'button',
            settings: { action: 'checkout', product_id: 'oferta-a' },
            content: { label: 'Comprar' },
        },
    ], OFFER_A);
    assert.equal(check.status, 'pass');
});

test('checkStripe fails without keys', function () {
    var check = launchReadiness.checkStripe(OFFER_A, {});
    assert.equal(check.status, 'fail');
    assert.equal(check.severity, 'critical');
});

test('checkStripe passes with test keys', function () {
    var check = launchReadiness.checkStripe(OFFER_A, {
        stripe_test_secret_key: 'sk_test_x',
        stripe_test_publishable_key: 'pk_test_x',
    });
    assert.equal(check.status, 'pass');
});

test('computeReadiness returns not_ready on critical failure', function () {
    var summary = launchReadiness.computeReadiness([
        launchReadiness.checkOffer(OFFER_A),
        launchReadiness.checkStripe(OFFER_B, {}),
    ]);
    assert.equal(summary.readiness, launchReadiness.READINESS.NOT_READY);
    assert.equal(summary.ready, false);
});

test('computeReadiness returns ready when only optional warnings', function () {
    var summary = launchReadiness.computeReadiness([
        launchReadiness.checkOffer(OFFER_A),
        launchReadiness.checkTestOrder(0),
    ]);
    assert.equal(summary.readiness, launchReadiness.READINESS.READY);
});

test('checkDomainRouting isolates domains per offer', function () {
    var checkA = launchReadiness.checkDomainRouting(OFFER_A, [
        { domain: 'oferta-a.com', domain_type: 'funnel', is_primary: true },
    ]);
    var checkB = launchReadiness.checkDomainRouting(OFFER_B, [
        { domain: 'oferta-b.com', domain_type: 'funnel', is_primary: true },
    ]);

    assert.equal(checkA.details.domains[0], 'oferta-a.com');
    assert.equal(checkB.details.domains[0], 'oferta-b.com');
});

test('mapVercelDomainStatus maps active domain', function () {
    var mapped = vercelDomains.mapVercelDomainStatus({
        verified: true,
        configured: true,
    });
    assert.equal(mapped.status, vercelDomains.DOMAIN_STATES.ACTIVE);
});

test('mapVercelDomainStatus maps DNS required', function () {
    var mapped = vercelDomains.mapVercelDomainStatus({
        verified: false,
        configured: false,
        verification: [{ type: 'TXT', domain: '_vercel', value: 'abc' }],
    });
    assert.equal(mapped.status, vercelDomains.DOMAIN_STATES.DNS_REQUIRED);
});
