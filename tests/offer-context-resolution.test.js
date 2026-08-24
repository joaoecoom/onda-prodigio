'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var offers = require('../lib/hub/offers');
var offerContext = require('../lib/hub/offer-context');

test('resolveOfferContext by slug uses env fallback offer', async function () {
    var context = await offerContext.resolveOfferContext({ slug: 'onda-prodigio' });
    assert.equal(context.slug, 'onda-prodigio');
    assert.equal(context.workspace.key, 'onda-prodigio');
});

test('resolveOfferContext by id uses env fallback offer', async function () {
    var context = await offerContext.resolveOfferContext({ offer_id: 'onda-prodigio' });
    assert.equal(context.id, 'onda-prodigio');
});

test('resolveOfferContext by domain resolves Onda funnel host', async function () {
    var context = await offerContext.resolveOfferContext({ domain: 'onda-prodigio.vercel.app' });
    assert.equal(context.id, 'onda-prodigio');
});

test('resolveOfferContext unknown slug throws OFFER_NOT_FOUND', async function () {
    await assert.rejects(function () {
        return offerContext.resolveOfferContext({ slug: 'does-not-exist-xyz' });
    }, function (error) {
        return error && error.code === 'OFFER_NOT_FOUND';
    });
});

test('resolveOfferContext default offer when allowed', async function () {
    var context = await offerContext.resolveOfferContext({}, { allowDefault: true });
    var fallback = offers.getEnvFallbackOffer();
    assert.equal(context.id, fallback.id);
});

test('getDefaultOffer returns active offer first', async function () {
    var offer = await offerContext.getDefaultOffer();
    assert.ok(offer.id);
    assert.ok(offer.slug);
});

test('offer without domain still resolves by slug', async function () {
    var context = await offerContext.resolveOfferContext({ slug: 'onda-prodigio' });
    assert.ok(context.name);
    assert.ok(context.workspace.path);
});
