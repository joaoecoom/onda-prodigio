'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var offerTracking = require('../lib/tracking/offer-tracking');

test('buildServerTrackingConfig prefers integrations over env when provided', function () {
    var originalPixel = process.env.META_PIXEL_ID;
    process.env.META_PIXEL_ID = 'env-pixel';

    var config = offerTracking.buildServerTrackingConfig({
        meta_pixel_id: 'db-pixel',
        meta_access_token: 'db-token',
        ga4_measurement_id: 'G-DB123',
        ga4_api_secret: 'db-secret',
    }, {
        id: 'ai-test-offer',
        slug: 'ai-test-offer',
        name: 'AI Test Offer',
        funnel_url: 'https://example.com/funnel',
    });

    assert.equal(config.meta_pixel_id, 'db-pixel');
    assert.equal(config.meta_access_token, 'db-token');
    assert.equal(config.ga4_measurement_id, 'G-DB123');
    assert.equal(config.ga4_api_secret, 'db-secret');
    assert.equal(config.offer_slug, 'ai-test-offer');
    assert.equal(config.site_url, 'https://example.com/funnel');

    process.env.META_PIXEL_ID = originalPixel;
});

test('buildClientTrackingPayload exposes offer metadata without secrets', function () {
    var payload = offerTracking.buildClientTrackingPayload({
        id: 'onda-prodigio',
        slug: 'onda-prodigio',
        name: 'Onda Prodígio',
        tracking: {
            meta_pixel_id: '123456789',
            ga4_measurement_id: 'G-ABC123',
            gtm_container_id: 'GTM-TEST',
            server_container_url: 'https://stape.example.com',
            meta_reporting_currency: 'EUR',
        },
    });

    assert.equal(payload.offer_id, 'onda-prodigio');
    assert.equal(payload.offer_slug, 'onda-prodigio');
    assert.equal(payload.metaPixelId, '123456789');
    assert.equal(payload.ga4MeasurementId, 'G-ABC123');
    assert.equal(payload.metaReportingCurrency, 'EUR');
    assert.equal(payload.ga4ApiSecret, undefined);
});

test('resolveServerTrackingFromMetadata uses offer_slug from payment metadata', async function () {
    var config = await offerTracking.resolveServerTrackingFromMetadata({
        offer_slug: 'onda-prodigio',
    });

    assert.equal(config.offer_slug, 'onda-prodigio');
    assert.equal(config.offer_id, 'onda-prodigio');
});
