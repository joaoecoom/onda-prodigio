'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var hubAdminAccess = require('../lib/comunidade/hub-admin-access');

test('resolveCommunityUrl uses offer funnel domain', function () {
    var offer = {
        slug: 'onda-prodigio',
        funnel_url: 'https://onda-prodigio.vercel.app',
        funnel_domain: 'onda-prodigio.vercel.app',
    };

    assert.equal(
        hubAdminAccess.resolveCommunityUrl(offer),
        'https://onda-prodigio.vercel.app/comunidade/'
    );
});

test('resolveCommunityUrl falls back to relative path without offer domain', function () {
    assert.equal(hubAdminAccess.resolveCommunityUrl(null), '/comunidade/');
    assert.equal(hubAdminAccess.resolveCommunityUrl({ slug: 'teste' }), '/comunidade/');
});

test('resolveCommunityEnterBaseUrl prefers offer domain over hub', function () {
    var offer = {
        funnel_domain: 'minha-oferta.pt',
    };

    assert.equal(
        hubAdminAccess.resolveCommunityEnterBaseUrl(offer),
        'https://minha-oferta.pt'
    );
});

test('signed handoff token validates and rejects tampering', function () {
    var token = hubAdminAccess.createHandoffToken({
        access_token: 'a',
        refresh_token: 'b',
        community_url: 'https://onda-prodigio.vercel.app/comunidade/',
        offer_slug: 'onda-prodigio',
    });

    var payload = hubAdminAccess.consumeHandoffToken(token);

    assert.equal(payload.community_url, 'https://onda-prodigio.vercel.app/comunidade/');
    assert.equal(payload.offer_slug, 'onda-prodigio');

    var tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    assert.equal(hubAdminAccess.consumeHandoffToken(tampered), null);
});
