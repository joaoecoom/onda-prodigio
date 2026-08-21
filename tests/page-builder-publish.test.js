'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pageUrls = require('../lib/hub/page-builder/urls');
var pagePublish = require('../lib/hub/page-builder/publish');
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

    return { store: store, service: service };
}

async function seedPage(service) {
    var funnel = await service.createFunnel(OFFER_A, {
        name: 'Sales Funnel',
        slug: 'sales-funnel',
        status: 'draft',
    });
    var page = await service.createPage(OFFER_A, funnel.id, {
        name: 'Sales Page',
        slug: 'sales-page',
        status: 'draft',
        type: 'sales',
    });
    var section = await service.createSection(OFFER_A, page.id, {
        type: 'hero',
        sort_order: 100,
        settings: { label: 'Hero' },
    });
    await service.createBlock(OFFER_A, section.id, {
        type: 'heading',
        sort_order: 100,
        content: { text: 'Hello' },
        settings: { level: 1, alignment: 'center' },
    });

    return { funnel: funnel, page: page };
}

test('buildPageUrls returns preview, hub path, and domain URLs', function () {
    var urls = pageUrls.buildPageUrls({
        offer: 'ai-test-offer',
        funnel: 'ai-test-sales-funnel',
        page: 'ai-test-sales-page',
    }, {
        funnel_domain: 'ai-test.example.com',
    });

    assert.match(urls.preview_url, /\/preview\//);
    assert.match(urls.preview_url, /preview=1/);
    assert.match(urls.public_url, /^\/p\//);
    assert.equal(urls.public_absolute_url, 'https://ai-test.example.com/p/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page');
    assert.equal(urls.domain_public_url, 'https://ai-test.example.com/ai-test-sales-funnel/ai-test-sales-page');
    assert.equal(pageUrls.pickLiveUrl(urls), urls.domain_public_url);
});

test('buildPageUrls falls back to relative path without funnel domain', function () {
    var urls = pageUrls.buildPageUrls({
        offer: 'ai-test-offer',
        funnel: 'sales-funnel',
        page: 'sales-page',
    }, {});

    assert.equal(urls.public_absolute_url, urls.public_url);
    assert.equal(urls.domain_public_url, null);
    assert.equal(pageUrls.pickLiveUrl(urls), urls.public_url);
});

test('publishPage saves pending edits and publishes page', async function () {
    var fixture = createFixture();
    var seeded = await seedPage(fixture.service);
    var tree = await fixture.service.getPageTree(OFFER_A, seeded.page.id);
    var working = JSON.parse(JSON.stringify(tree));
    working.sections[0].blocks[0].content.text = 'Published headline';

    var publishedTree = await pagePublish.publishPage({
        offer_id: OFFER_A,
        page_id: seeded.page.id,
        status: 'published',
        baseline: tree,
        working: working,
        service: fixture.service,
    });

    assert.equal(publishedTree.page.status, 'published');
    assert.ok(publishedTree.page.published_at);
    assert.equal(publishedTree.sections[0].blocks[0].content.text, 'Published headline');
});

test('publishPage can revert page to draft', async function () {
    var fixture = createFixture();
    var seeded = await seedPage(fixture.service);
    await fixture.service.updatePage(OFFER_A, seeded.page.id, { status: 'published' });

    var draftTree = await pagePublish.publishPage({
        offer_id: OFFER_A,
        page_id: seeded.page.id,
        status: 'draft',
        service: fixture.service,
    });

    assert.equal(draftTree.page.status, 'draft');
    assert.equal(draftTree.page.published_at, null);
});
