'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var stripeClient = require('../lib/hub/stripe-client');
var offers = require('../lib/hub/offers');

var MOCK_OFFER = {
    id: 'test-offer',
    slug: 'test-offer',
    name: 'Test Offer',
    checkouts: [
        {
            checkout_id: 'checkout9',
            label: '€12',
            path: '/checkout9/',
            test_path: '/checkout9-test/',
            amount_cents: 1200,
            stripe_price_id: 'price_live_test',
            stripe_test_price_id: 'price_test_test',
            sort_order: 1,
        },
        {
            checkout_id: 'checkout19',
            label: '€29',
            path: '/checkout19/',
            test_path: null,
            amount_cents: 2900,
            stripe_price_id: 'price_live_19',
            stripe_test_price_id: 'price_test_19',
            sort_order: 2,
        },
    ],
};

test('pickOfferCheckout matches checkout rows by checkout_id', function () {
    var checkout = stripeClient.pickOfferCheckout(MOCK_OFFER, 'checkout19', 'live');

    assert.equal(checkout.checkout_id, 'checkout19');
    assert.equal(checkout.amount_cents, 2900);
});

test('buildCheckoutSettings prefers offer checkout amount and price', function () {
    var checkout = stripeClient.buildCheckoutSettings('checkout9', 'live', MOCK_OFFER.checkouts[0]);

    assert.equal(checkout.amountCents, 1200);
    assert.equal(checkout.priceId, 'price_live_test');
    assert.equal(checkout.checkoutPath, '/checkout9/');
});

test('buildStripeSettings maps integration keys and offer metadata', function () {
    var settings = stripeClient.buildStripeSettings(
        'live',
        'checkout9',
        {
            stripe_secret_key: 'sk_live_offer',
            stripe_publishable_key: 'pk_live_offer',
            stripe_webhook_secret: 'whsec_offer',
        },
        MOCK_OFFER,
        MOCK_OFFER.checkouts[0]
    );

    assert.equal(settings.secretKey, 'sk_live_offer');
    assert.equal(settings.publishableKey, 'pk_live_offer');
    assert.equal(settings.webhookSecret, 'whsec_offer');
    assert.equal(settings.amountCents, 1200);
    assert.equal(settings.priceId, 'price_live_test');
    assert.equal(settings.offerId, 'test-offer');
    assert.equal(settings.offerSlug, 'test-offer');
    assert.equal(settings.offerName, 'Test Offer');
});

test('buildOfferMetadata exposes offer identifiers for Stripe metadata', function () {
    var metadata = stripeClient.buildOfferMetadata({
        offerId: 'test-offer',
        offerSlug: 'test-offer',
    });

    assert.deepEqual(metadata, {
        offer_id: 'test-offer',
        offer_slug: 'test-offer',
    });
});

test('resolveOfferHint reads offer slug from body, query and tracking', function () {
    var fromBody = stripeClient.resolveOfferHint(
        { query: {}, headers: { host: 'example.com' } },
        { offer_slug: 'from-body', tracking: { offer_id: 'ignored-when-slug' } }
    );

    assert.equal(fromBody.slug, 'from-body');
    assert.equal(fromBody.domain, 'example.com');

    var fromQuery = stripeClient.resolveOfferHint(
        { query: { offer: 'from-query' }, headers: {} },
        {}
    );

    assert.equal(fromQuery.slug, 'from-query');
});

test('resolveStripeContext falls back to env stripe client when offer not found', async function () {
    var originalKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_fallback';

    var context = await stripeClient.resolveStripeContext(
        { query: {}, headers: {} },
        { offer_slug: 'definitely-missing-offer-slug-xyz', checkout_id: 'checkout9' },
        { allowDefault: false }
    );

    assert.equal(context.offer, null);
    assert.equal(context.error, null);
    assert.ok(context.stripe);
    assert.equal(context.settings.amountCents, 900);

    process.env.STRIPE_SECRET_KEY = originalKey;
});

test('getEnvFallbackOffer includes checkout amounts for legacy fallback', function () {
    var fallback = offers.getEnvFallbackOffer();

    assert.equal(fallback.id, 'onda-prodigio');
    assert.ok(Array.isArray(fallback.checkouts));
    assert.equal(fallback.checkouts[0].checkout_id, 'checkout9');
    assert.ok(fallback.checkouts[0].amount_cents >= 50);
});
