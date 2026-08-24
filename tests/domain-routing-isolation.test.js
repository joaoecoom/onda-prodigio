'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var domainRouting = require('../lib/hub/page-builder/domain-routing');
var offerContext = require('../lib/hub/offer-context');
var hubConfig = require('../lib/hub/config');

var originalResolve = offerContext.resolveOfferByDomain;

test.after(function () {
    offerContext.resolveOfferByDomain = originalResolve;
});

function stubDomainResolver(map) {
    offerContext.resolveOfferByDomain = async function (domain) {
        return map[hubConfig.normalizeHost(domain)] || null;
    };
}

test('domain A resolves to offer A', async function () {
    stubDomainResolver({
        'offer-a.com': { id: 'offer-a', slug: 'offer-a', hub_domain: 'hub.example.com' },
        'offer-b.com': { id: 'offer-b', slug: 'offer-b', hub_domain: 'hub.example.com' },
    });

    var offerA = await domainRouting.resolveFunnelOfferFromHost('Offer-A.COM');
    assert.equal(offerA.slug, 'offer-a');
});

test('domain B resolves to offer B', async function () {
    stubDomainResolver({
        'offer-a.com': { id: 'offer-a', slug: 'offer-a', hub_domain: 'hub.example.com' },
        'offer-b.com': { id: 'offer-b', slug: 'offer-b', hub_domain: 'hub.example.com' },
    });

    var offerB = await domainRouting.resolveFunnelOfferFromHost('offer-b.com');
    assert.equal(offerB.slug, 'offer-b');
});

test('domain A does not resolve to offer B', async function () {
    stubDomainResolver({
        'offer-a.com': { id: 'offer-a', slug: 'offer-a', hub_domain: 'hub.example.com' },
        'offer-b.com': { id: 'offer-b', slug: 'offer-b', hub_domain: 'hub.example.com' },
    });

    var offer = await domainRouting.resolveFunnelOfferFromHost('offer-a.com');
    assert.notEqual(offer.slug, 'offer-b');
});

test('unknown domain does not resolve to any offer', async function () {
    stubDomainResolver({
        'offer-a.com': { id: 'offer-a', slug: 'offer-a', hub_domain: 'hub.example.com' },
    });

    var offer = await domainRouting.resolveFunnelOfferFromHost('unknown-domain.example');
    assert.equal(offer, null);
});

test('hub host never resolves funnel offer', async function () {
    stubDomainResolver({
        'offer-a.com': { id: 'offer-a', slug: 'offer-a', hub_domain: hubConfig.getHubHost() },
    });

    var offer = await domainRouting.resolveFunnelOfferFromHost(hubConfig.getHubHost());
    assert.equal(offer, null);
});

test('funnel host matching hub_domain on offer is rejected', async function () {
    var hubHost = hubConfig.getHubHost();
    stubDomainResolver({
        [hubHost]: { id: 'offer-a', slug: 'offer-a', hub_domain: hubHost },
    });

    var offer = await domainRouting.resolveFunnelOfferFromHost(hubHost);
    assert.equal(offer, null);
});
