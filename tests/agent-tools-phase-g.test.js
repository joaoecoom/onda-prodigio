'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var registry = require('../lib/hub/agent-tools/registry');
var integrationsStore = require('../lib/hub/integrations-store');
var agentTools = require('../lib/hub/agent-tools');
var { createService, createMemoryStore } = require('../lib/hub/funnel-engine/service');
var logger = require('../lib/hub/agent-tools/logger');

var OFFER_A = 'offer-a';

function mockOffer(id) {
    return { id: id, slug: id, name: id, status: 'draft', mode: 'test', primary_product_id: id };
}

function createFixture() {
    var store = createMemoryStore();
    var service = createService({
        repository: store,
        resolveOffer: function (input) {
            if (typeof input === 'string') {
                return Promise.resolve(mockOffer(input));
            }

            return Promise.resolve(mockOffer(input.offer_id || input.slug || OFFER_A));
        },
    });

    return {
        service: service,
        execute: function (toolName, input) {
            return agentTools.executeTool(toolName, input, {
                boundOfferId: input && input.offer_id ? input.offer_id : OFFER_A,
                service: service,
            });
        },
    };
}

test('phase G tools are registered', function () {
    [
        'create_offer',
        'save_offer_integrations',
        'get_offer_integrations_status',
        'apply_template',
        'publish_page',
        'get_content_tree',
        'create_content_module',
        'create_content_lesson',
        'update_content_module',
        'update_content_lesson',
    ].forEach(function (name) {
        assert.ok(registry.isAllowedTool(name), 'missing tool: ' + name);
    });

    assert.equal(registry.ALLOWED_TOOL_NAMES.length, 55);
});

test('integration status summary never exposes secret values', function () {
    var summary = integrationsStore.buildIntegrationStatusSummary('offer-a', [
        { key: 'stripe_test_secret_key', configured: true },
        { key: 'stripe_test_publishable_key', configured: true },
        { key: 'meta_pixel_id', configured: true },
        { key: 'meta_access_token', configured: false },
        { key: 'ga4_measurement_id', configured: false },
        { key: 'ga4_api_secret', configured: false },
    ]);

    assert.equal(summary.stripe.configured, true);
    assert.equal(summary.meta.configured, false);
    assert.equal(summary.ga4.configured, false);
    assert.equal(JSON.stringify(summary).indexOf('sk_'), -1);
});

test('logger redacts integration patches', function () {
    var sanitized = logger.sanitizeInput({
        offer_id: 'offer-a',
        integrations: { stripe_test_secret_key: 'sk_test_123' },
    });

    assert.equal(sanitized.integrations, '[redacted-integration-patches]');
});

test('publish_page sets published status', async function () {
    var fx = createFixture();
    var funnel = await fx.execute('create_funnel', {
        offer_id: OFFER_A,
        name: 'Sales',
        slug: 'sales',
        type: 'custom',
    });
    var page = await fx.execute('create_page', {
        offer_id: OFFER_A,
        funnel_id: funnel.funnel_id,
        name: 'Landing',
        slug: 'landing',
        type: 'sales',
    });

    assert.equal(page.status, 'draft');

    var published = await fx.execute('publish_page', {
        offer_id: OFFER_A,
        page_id: page.page_id,
    });

    assert.equal(published.page.status, 'published');
});

test('apply_template seeds page sections', async function () {
    var fx = createFixture();
    var funnel = await fx.execute('create_funnel', {
        offer_id: OFFER_A,
        name: 'Sales',
        slug: 'sales-template',
        type: 'custom',
    });
    var page = await fx.execute('create_page', {
        offer_id: OFFER_A,
        funnel_id: funnel.funnel_id,
        name: 'Landing',
        slug: 'landing-template',
        type: 'sales',
    });

    var applied = await fx.execute('apply_template', {
        offer_id: OFFER_A,
        page_id: page.page_id,
        template_id: 'sales-minimal',
    });

    assert.ok(applied.sections_created >= 1);

    var tree = await fx.execute('get_page_tree', {
        offer_id: OFFER_A,
        page_id: page.page_id,
    });

    assert.ok((tree.sections || []).length >= 1);
});
