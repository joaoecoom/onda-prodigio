'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var serverEvents = require('../lib/tracking/server-events');

test('buildStripeTrackingMetadata preserves funnel and page slugs', function () {
    var metadata = serverEvents.buildStripeTrackingMetadata({
        offer_slug: 'fruta-da-epoca',
        funnel_slug: 'vsl-fruta',
        page_slug: 'sales',
        utm_source: 'facebook',
        utm_campaign: 'fruta-test',
    }, 'Mozilla/5.0');

    assert.equal(metadata.offer_slug, 'fruta-da-epoca');
    assert.equal(metadata.funnel_slug, 'vsl-fruta');
    assert.equal(metadata.page_slug, 'sales');
    assert.equal(metadata.utm_source, 'facebook');
    assert.equal(metadata.utm_campaign, 'fruta-test');
});
