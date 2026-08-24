'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var validation = require('../lib/hub/funnel-engine/validation');
var seedTemplate = require('../lib/hub/page-builder/seed-template');
var { createService, createMemoryStore } = require('../lib/hub/funnel-engine/service');

var OFFER_A = 'ai-test-offer';

function mockOffer(id) {
    return { id: id, slug: id, name: id, status: 'draft', mode: 'test' };
}

function createFixture() {
    var store = createMemoryStore();
    var service = createService({
        repository: store,
        resolveOffer: function (input) {
            var id = typeof input === 'string' ? input : (input.offer_id || input.slug);
            return Promise.resolve(mockOffer(id));
        },
    });

    return { store: store, service: service, offerA: OFFER_A };
}

test('validateBlockPayload sanitizes undefined text values', function () {
    var payload = validation.validateBlockPayload({
        type: 'heading',
        content: { text: 'undefined' },
        settings: { level: 1 },
    }, false);

    assert.equal(payload.content.text, '');
});

test('seedPageFromTemplate creates sections and blocks on empty page', async function () {
    var fx = createFixture();
    var funnel = await fx.service.createFunnel(fx.offerA, { name: 'Seed Funnel', slug: 'seed-funnel' });
    var page = await fx.service.createPage(fx.offerA, funnel.id, {
        name: 'Seed Page',
        slug: 'seed-page',
    });

    var count = await seedTemplate.seedPageFromTemplate(fx.offerA, page.id, 'sales-minimal', fx.service);
    assert.ok(count >= 1);

    var tree = await fx.service.getPageTree(fx.offerA, page.id);
    assert.ok(tree.sections.length >= 1);
    assert.ok(tree.sections[0].blocks.length >= 1);
    assert.equal(typeof tree.sections[0].blocks[0].content.text, 'string');
});
