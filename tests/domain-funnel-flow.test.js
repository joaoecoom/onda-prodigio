'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var domainAvailability = require('../lib/hub/domain-availability');
var funnelFlow = require('../lib/hub/funnel-flow');

test('validateDomainFormat accepts vercel hostnames', function () {
    var result = domainAvailability.validateDomainFormat('frutadaepoca.vercel.app');
    assert.equal(result.valid, true);
    assert.equal(result.domain, 'frutadaepoca.vercel.app');
});

test('validateDomainFormat rejects invalid hostnames', function () {
    var result = domainAvailability.validateDomainFormat('not a domain!');
    assert.equal(result.valid, false);
});

test('defaultSalesFlow includes checkout step', function () {
    var flow = funnelFlow.defaultSalesFlow();
    var kinds = flow.map(function (row) { return row.kind; });

    assert.ok(kinds.indexOf('checkout') !== -1);
    assert.ok(kinds.indexOf('sales') !== -1 || flow[0].page_type === 'sales');
});

test('normalizeFlow preserves step order', function () {
    var flow = funnelFlow.normalizeFlow([
        { kind: 'thank_you', sort_order: 500 },
        { kind: 'page', page_type: 'sales', sort_order: 100 },
    ]);

    assert.equal(flow[0].page_type, 'sales');
    assert.equal(flow[1].kind, 'thank_you');
});

test('flowFromLegacyPages maps checkout as system step', function () {
    var flow = funnelFlow.flowFromLegacyPages([
        { id: 'p1', type: 'sales', slug: 'sales', name: 'Sales' },
    ]);

    assert.ok(flow.some(function (step) { return step.kind === 'checkout'; }));
});
