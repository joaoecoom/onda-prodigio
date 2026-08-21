'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var domainRouting = require('../lib/hub/page-builder/domain-routing');
var hubConfig = require('../lib/hub/config');

test('isReservedDomainPath blocks known app routes', function () {
    assert.equal(domainRouting.isReservedDomainPath('/comunidade/login'), true);
    assert.equal(domainRouting.isReservedDomainPath('/checkout9/foo'), true);
    assert.equal(domainRouting.isReservedDomainPath('/preview/a/b'), true);
    assert.equal(domainRouting.isReservedDomainPath('/sales-funnel/landing-page'), false);
});

test('isReservedDomainPath requires exactly two segments', function () {
    assert.equal(domainRouting.isReservedDomainPath('/only-one'), true);
    assert.equal(domainRouting.isReservedDomainPath('/a/b/c'), true);
    assert.equal(domainRouting.isReservedDomainPath('/'), true);
});

test('readHost prefers x-forwarded-host', function () {
    var host = domainRouting.readHost({
        headers: {
            host: 'fallback.example.com',
            'x-forwarded-host': 'Primary.Example.com',
        },
        query: {},
    });

    assert.equal(host, 'primary.example.com');
});

test('resolveFunnelOfferFromHost rejects hub host', async function () {
    var offer = await domainRouting.resolveFunnelOfferFromHost(hubConfig.getHubHost());
    assert.equal(offer, null);
});
