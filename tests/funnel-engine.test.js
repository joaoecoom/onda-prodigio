'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var validation = require('../lib/hub/funnel-engine/validation');
var constants = require('../lib/hub/funnel-engine/constants');
var { createService, createMemoryStore } = require('../lib/hub/funnel-engine/service');

var OFFER_A = 'offer-a';
var OFFER_B = 'offer-b';

function mockResolveOffer(offerId) {
    if (offerId !== OFFER_A && offerId !== OFFER_B) {
        var error = new Error('Oferta não encontrada.');
        error.code = 'OFFER_NOT_FOUND';
        throw error;
    }

    return Promise.resolve({ id: offerId, slug: offerId, name: offerId });
}

function createTestService() {
    return createService({
        repository: createMemoryStore(),
        resolveOffer: mockResolveOffer,
    });
}

test('validateBlockPayload accepts structured content/settings/styles', function () {
    var payload = validation.validateBlockPayload({
        type: 'text',
        content: { text: 'Hello' },
        settings: { alignment: 'center' },
        styles: { fontSize: '18px' },
        visibility: { desktop: true, tablet: false, mobile: true },
    });

    assert.equal(payload.type, 'text');
    assert.equal(payload.content.text, 'Hello');
    assert.equal(payload.settings.alignment, 'center');
    assert.equal(payload.visibility.tablet, false);
});

test('validateBlockPayload rejects invalid block type', function () {
    assert.throws(function () {
        validation.validateBlockPayload({ type: 'hero' });
    }, /Tipo de block inválido/);
});

test('validatePagePayload rejects non-object settings', function () {
    assert.throws(function () {
        validation.validatePagePayload({ name: 'Page', settings: 'bad' }, false);
    }, /settings deve ser um objecto JSON/);
});

test('create funnel for Offer A and Offer B with same slug scope', async function () {
    var service = createTestService();

    var funnelA = await service.createFunnel(OFFER_A, {
        name: 'Sales Funnel',
        slug: 'sales',
    });

    var funnelB = await service.createFunnel(OFFER_B, {
        name: 'Sales Funnel',
        slug: 'sales',
    });

    assert.equal(funnelA.slug, 'sales');
    assert.equal(funnelB.slug, 'sales');
    assert.notEqual(funnelA.id, funnelB.id);
});

test('reject funnel without valid offer', async function () {
    var service = createTestService();

    await assert.rejects(function () {
        return service.createFunnel('missing-offer', { name: 'X' });
    }, /Oferta não encontrada/);
});

test('prevent page linked to funnel from another offer', async function () {
    var service = createTestService();
    var funnelB = await service.createFunnel(OFFER_B, { name: 'B Funnel', slug: 'b-funnel' });

    await assert.rejects(function () {
        return service.createPage(OFFER_A, funnelB.id, { name: 'Cross Page' });
    }, /não pertence à oferta/);
});

test('create page, section and blocks under correct offer', async function () {
    var service = createTestService();
    var funnel = await service.createFunnel(OFFER_A, { name: 'Main', slug: 'main' });
    var page = await service.createPage(OFFER_A, funnel.id, {
        name: 'Landing',
        slug: 'landing',
        type: 'landing',
        status: 'draft',
    });

    var hero = await service.createSection(OFFER_A, page.id, { type: 'hero', sort_order: 100 });
    var heading = await service.createBlock(OFFER_A, hero.id, {
        type: 'heading',
        sort_order: 100,
        content: { text: 'Title' },
    });
    var text = await service.createBlock(OFFER_A, hero.id, {
        type: 'text',
        sort_order: 200,
        content: { text: 'Body' },
    });
    var button = await service.createBlock(OFFER_A, hero.id, {
        type: 'button',
        sort_order: 300,
        content: { label: 'Go' },
    });

    assert.equal(page.offer_id, OFFER_A);
    assert.equal(hero.offer_id, OFFER_A);
    assert.equal(heading.type, 'heading');
    assert.equal(text.sort_order, 200);
    assert.equal(button.type, 'button');
});

test('reorder sections deterministically', async function () {
    var service = createTestService();
    var funnel = await service.createFunnel(OFFER_A, { name: 'F', slug: 'f' });
    var page = await service.createPage(OFFER_A, funnel.id, { name: 'P', slug: 'p' });
    var s1 = await service.createSection(OFFER_A, page.id, { type: 'hero', sort_order: 100 });
    var s2 = await service.createSection(OFFER_A, page.id, { type: 'benefits', sort_order: 200 });

    var reordered = await service.reorderSections(OFFER_A, page.id, [
        { id: s2.id, sort_order: 100 },
        { id: s1.id, sort_order: 200 },
    ]);

    assert.equal(reordered[0].id, s2.id);
    assert.equal(reordered[0].sort_order, 100);
});

test('reorder blocks deterministically', async function () {
    var service = createTestService();
    var funnel = await service.createFunnel(OFFER_A, { name: 'F2', slug: 'f2' });
    var page = await service.createPage(OFFER_A, funnel.id, { name: 'P2', slug: 'p2' });
    var section = await service.createSection(OFFER_A, page.id, { type: 'hero' });
    var b1 = await service.createBlock(OFFER_A, section.id, { type: 'text', sort_order: 100, content: { text: '1' } });
    var b2 = await service.createBlock(OFFER_A, section.id, { type: 'text', sort_order: 200, content: { text: '2' } });

    var blocks = await service.reorderBlocks(OFFER_A, section.id, [
        { id: b2.id, sort_order: 100 },
        { id: b1.id, sort_order: 200 },
    ]);

    assert.equal(blocks[0].id, b2.id);
});

test('update page and publish status sets published_at', async function () {
    var service = createTestService();
    var funnel = await service.createFunnel(OFFER_A, { name: 'Pub', slug: 'pub' });
    var page = await service.createPage(OFFER_A, funnel.id, {
        name: 'Draft Page',
        slug: 'draft-page',
        status: 'draft',
    });

    assert.equal(page.status, 'draft');
    assert.equal(page.published_at, null);

    var published = await service.updatePage(OFFER_A, page.id, { status: 'published' });
    assert.equal(published.status, 'published');
    assert.ok(published.published_at);
});

test('draft page remains draft until published', async function () {
    var service = createTestService();
    var funnel = await service.createFunnel(OFFER_A, { name: 'D', slug: 'd' });
    var page = await service.createPage(OFFER_A, funnel.id, { name: 'Only Draft', slug: 'only-draft' });
    assert.equal(page.status, 'draft');
});

test('slug uniqueness is scoped per funnel for pages', async function () {
    var service = createTestService();
    var funnel = await service.createFunnel(OFFER_A, { name: 'S', slug: 's' });
    await service.createPage(OFFER_A, funnel.id, { name: 'One', slug: 'same-slug' });

    var funnelB = await service.createFunnel(OFFER_B, { name: 'SB', slug: 'sb' });
    var pageB = await service.createPage(OFFER_B, funnelB.id, { name: 'Two', slug: 'same-slug' });
    assert.equal(pageB.slug, 'same-slug');
});

test('offer isolation prevents cross-offer reads', async function () {
    var service = createTestService();
    var funnelA = await service.createFunnel(OFFER_A, { name: 'A', slug: 'a' });
    var pageA = await service.createPage(OFFER_A, funnelA.id, { name: 'PA', slug: 'pa' });

    await assert.rejects(function () {
        return service.getPage(OFFER_B, pageA.id);
    }, /não pertence à oferta/);
});

test('delete funnel removes owned pages (memory cascade)', async function () {
    var service = createTestService();
    var funnel = await service.createFunnel(OFFER_A, { name: 'Del', slug: 'del' });
    var page = await service.createPage(OFFER_A, funnel.id, { name: 'To Delete', slug: 'to-delete' });
    var section = await service.createSection(OFFER_A, page.id, { type: 'hero' });
    await service.createBlock(OFFER_A, section.id, { type: 'text', content: { text: 'x' } });

    await service.deleteFunnel(OFFER_A, funnel.id);

    await assert.rejects(function () {
        return service.getPage(OFFER_A, page.id);
    }, /não encontrad/);
});

test('getPageTree returns nested structure', async function () {
    var service = createTestService();
    var funnel = await service.createFunnel(OFFER_A, {
        name: 'AI Test Sales Funnel',
        slug: 'ai-test-sales-funnel',
    });
    var page = await service.createPage(OFFER_A, funnel.id, {
        name: 'AI Test Sales Page',
        slug: 'ai-test-sales-page',
        type: 'sales',
    });
    var hero = await service.createSection(OFFER_A, page.id, { type: 'hero', sort_order: 100 });
    await service.createBlock(OFFER_A, hero.id, { type: 'heading', content: { text: 'H' } });
    await service.createBlock(OFFER_A, hero.id, { type: 'text', content: { text: 'T' } });
    await service.createBlock(OFFER_A, hero.id, { type: 'button', content: { label: 'B' } });
    var benefits = await service.createSection(OFFER_A, page.id, { type: 'benefits', sort_order: 200 });

    var tree = await service.getPageTree(OFFER_A, page.id);
    assert.equal(tree.funnel.slug, 'ai-test-sales-funnel');
    assert.equal(tree.page.slug, 'ai-test-sales-page');
    assert.equal(tree.sections.length, 2);
    assert.equal(tree.sections[0].blocks.length, 3);
    assert.equal(tree.sections[1].type, 'benefits');
});

test('all block types are accepted by validation', function () {
    constants.BLOCK_TYPES.forEach(function (type) {
        var payload = validation.validateBlockPayload({ type: type, content: {} });
        assert.equal(payload.type, type);
    });
});
