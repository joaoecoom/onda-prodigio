'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pageRevisions = require('../lib/hub/page-builder/revisions');
var { createService, createMemoryStore } = require('../lib/hub/funnel-engine/service');

var OFFER_A = 'ai-test-offer';

function mockOffer(id) {
    return { id: id, slug: id, name: id, status: 'draft', mode: 'test' };
}

function createFixture() {
    var funnelStore = createMemoryStore();
    var revisionStore = pageRevisions.createMemoryStore();
    var service = createService({
        repository: funnelStore,
        resolveOffer: function (input) {
            var id = typeof input === 'string' ? input : (input.offer_id || input.slug);
            return Promise.resolve(mockOffer(id));
        },
    });

    return { funnelStore: funnelStore, revisionStore: revisionStore, service: service };
}

async function seedPage(service, options) {
    var opts = options || {};
    var funnelSlug = opts.funnelSlug || 'sales-funnel';
    var pageSlug = opts.pageSlug || 'sales-page';

    var funnel = await service.createFunnel(OFFER_A, {
        name: 'Sales Funnel',
        slug: funnelSlug,
        status: 'draft',
    });
    var page = await service.createPage(OFFER_A, funnel.id, {
        name: 'Sales Page',
        slug: pageSlug,
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

test('createRevision stores snapshot and lists newest first', async function () {
    var fixture = createFixture();
    var seeded = await seedPage(fixture.service);
    var tree = await fixture.service.getPageTree(OFFER_A, seeded.page.id);

    await pageRevisions.createRevision({
        store: fixture.revisionStore,
        offer_id: OFFER_A,
        page_id: seeded.page.id,
        tree: tree,
        source: 'manual',
    });

    var updated = JSON.parse(JSON.stringify(tree));
    updated.sections[0].blocks[0].content.text = 'Updated';

    await pageRevisions.createRevision({
        store: fixture.revisionStore,
        offer_id: OFFER_A,
        page_id: seeded.page.id,
        tree: updated,
        source: 'publish',
    });

    var rows = await pageRevisions.listRevisions({
        store: fixture.revisionStore,
        offer_id: OFFER_A,
        page_id: seeded.page.id,
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0].revision_number, 2);
    assert.equal(rows[0].source, 'publish');
    assert.equal(rows[1].revision_number, 1);
});

test('restoreRevision applies older tree and keeps backup snapshot', async function () {
    var fixture = createFixture();
    var seeded = await seedPage(fixture.service);
    var baseline = await fixture.service.getPageTree(OFFER_A, seeded.page.id);
    var older = JSON.parse(JSON.stringify(baseline));
    older.sections[0].blocks[0].content.text = 'Old headline';

    var olderRevision = await pageRevisions.createRevision({
        store: fixture.revisionStore,
        offer_id: OFFER_A,
        page_id: seeded.page.id,
        tree: older,
        source: 'manual',
    });

    var current = JSON.parse(JSON.stringify(baseline));
    current.sections[0].blocks[0].content.text = 'Current headline';
    await fixture.service.updateBlock(
        OFFER_A,
        current.sections[0].blocks[0].id,
        { content: { text: 'Current headline' } }
    );

    var restored = await pageRevisions.restoreRevision({
        store: fixture.revisionStore,
        service: fixture.service,
        offer_id: OFFER_A,
        page_id: seeded.page.id,
        revision_id: olderRevision.id,
        current_tree: await fixture.service.getPageTree(OFFER_A, seeded.page.id),
    });

    assert.equal(restored.tree.sections[0].blocks[0].content.text, 'Old headline');

    var rows = await pageRevisions.listRevisions({
        store: fixture.revisionStore,
        offer_id: OFFER_A,
        page_id: seeded.page.id,
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0].source, 'restore');
    assert.match(rows[0].label, /Before restore/);
});

test('restoreRevision rejects revision from another page', async function () {
    var fixture = createFixture();
    var seededA = await seedPage(fixture.service);
    var seededB = await seedPage(fixture.service, {
        funnelSlug: 'sales-funnel-b',
        pageSlug: 'sales-page-b',
    });
    var treeA = await fixture.service.getPageTree(OFFER_A, seededA.page.id);

    var revision = await pageRevisions.createRevision({
        store: fixture.revisionStore,
        offer_id: OFFER_A,
        page_id: seededA.page.id,
        tree: treeA,
        source: 'manual',
    });

    await assert.rejects(function () {
        return pageRevisions.restoreRevision({
            store: fixture.revisionStore,
            service: fixture.service,
            offer_id: OFFER_A,
            page_id: seededB.page.id,
            revision_id: revision.id,
            current_tree: treeA,
        });
    }, function (error) {
        return error.code === 'FORBIDDEN';
    });
});
