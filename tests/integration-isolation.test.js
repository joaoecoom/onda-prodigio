'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var integrationResolver = require('../lib/hub/integration-resolver');
var offerTracking = require('../lib/tracking/offer-tracking');

test('usesEnvIntegrationFallback only allows onda-prodigio legacy offer', function () {
    assert.equal(integrationResolver.usesEnvIntegrationFallback('onda-prodigio'), true);
    assert.equal(integrationResolver.usesEnvIntegrationFallback('fruta-da-epoca'), false);
    assert.equal(integrationResolver.usesEnvIntegrationFallback('ai-test-offer'), false);
});

test('resolveIntegrationValue ignores env for isolated offers', function () {
    var originalPixel = process.env.META_PIXEL_ID;
    process.env.META_PIXEL_ID = 'env-pixel-global';

    assert.equal(
        integrationResolver.resolveIntegrationValue('fruta-da-epoca', 'meta_pixel_id', ''),
        ''
    );

    assert.equal(
        integrationResolver.resolveIntegrationValue('onda-prodigio', 'meta_pixel_id', 'db-pixel'),
        'db-pixel'
    );

    assert.equal(
        integrationResolver.resolveIntegrationValue('onda-prodigio', 'meta_pixel_id', ''),
        'env-pixel-global'
    );

    process.env.META_PIXEL_ID = originalPixel;
});

test('normalizeCurrency falls back to eur for unknown codes', function () {
    assert.equal(integrationResolver.normalizeCurrency('USD'), 'usd');
    assert.equal(integrationResolver.normalizeCurrency('xyz'), 'eur');
});

test('buildServerTrackingConfig does not use env pixel for isolated offers', function () {
    var originalPixel = process.env.META_PIXEL_ID;
    process.env.META_PIXEL_ID = 'env-pixel';

    var config = offerTracking.buildServerTrackingConfig({}, {
        id: 'fruta-da-epoca',
        slug: 'fruta-da-epoca',
        name: 'Fruta',
        settings: { commercial_currency: 'eur' },
    });

    assert.equal(config.meta_pixel_id, '');
    assert.equal(config.meta_reporting_currency, 'EUR');

    process.env.META_PIXEL_ID = originalPixel;
});

test('buildClientTrackingPayload does not expose env pixel for isolated offers', function () {
    var originalPixel = process.env.META_PIXEL_ID;
    process.env.META_PIXEL_ID = 'env-pixel';

    var payload = offerTracking.buildClientTrackingPayload({
        id: 'fruta-da-epoca',
        slug: 'fruta-da-epoca',
        name: 'Fruta',
        settings: { commercial_currency: 'eur' },
        tracking: {},
    });

    assert.equal(payload.metaPixelId, '');

    process.env.META_PIXEL_ID = originalPixel;
});
