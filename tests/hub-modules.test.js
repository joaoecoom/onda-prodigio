'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var modules = require('../lib/hub/modules');

var ONDA_OFFER = {
    id: 'onda-prodigio',
    slug: 'onda-prodigio',
    name: 'Onda Prodígio',
    status: 'active',
    funnel_domain: 'onda-prodigio.vercel.app',
    funnel_url: 'https://onda-prodigio.vercel.app',
};

test('comunidade module embed href stays on hub origin for iframe', function () {
    var list = modules.getModulesForOffer(ONDA_OFFER);
    var community = list.find(function (entry) {
        return entry.id === 'comunidade';
    });

    assert.ok(community);
    assert.match(community.href, /^\/adm\//);
    assert.match(community.href, /offer=onda-prodigio/);
    assert.match(community.href, /tab=content/);
    assert.doesNotMatch(community.href, /^https:\/\//);
});

test('comunidade module falls back to relative adm when offer has no domain', function () {
    var list = modules.getModulesForOffer({
        id: 'draft-offer',
        slug: 'draft-offer',
        status: 'active',
    });
    var community = list.find(function (entry) {
        return entry.id === 'comunidade';
    });

    assert.ok(community);
    assert.match(community.href, /^\/adm\//);
});
