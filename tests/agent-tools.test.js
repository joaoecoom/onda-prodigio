'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var agentTools = require('../lib/hub/agent-tools');
var registry = require('../lib/hub/agent-tools/registry');
var { createService, createMemoryStore } = require('../lib/hub/funnel-engine/service');
var { ERROR_CODES } = require('../lib/hub/agent-tools/errors');

var OFFER_A = 'offer-a';
var OFFER_B = 'offer-b';

function mockOffer(id) {
    return { id: id, slug: id, name: id, status: 'draft', mode: 'test' };
}

function createFixture() {
    var store = createMemoryStore();
    var service = createService({
        repository: store,
        resolveOffer: function (input) {
            if (typeof input === 'string') {
                return Promise.resolve(mockOffer(input));
            }

            if (input && input.slug) {
                return Promise.resolve(mockOffer(input.slug));
            }

            if (input && input.offer_id) {
                return Promise.resolve(mockOffer(input.offer_id));
            }

            return Promise.reject(Object.assign(new Error('Oferta não encontrada.'), { code: 'OFFER_NOT_FOUND' }));
        },
    });

    return {
        store: store,
        service: service,
        execute: function (toolName, input) {
            return agentTools.executeTool(toolName, input, {
                boundOfferId: OFFER_A,
                service: service,
            });
        },
    };
}

test('tool registry is allowlisted and complete', function () {
    assert.ok(registry.isAllowedTool('create_page'));
    assert.ok(registry.isAllowedTool('get_page_tree'));
    assert.equal(registry.isAllowedTool('execute_sql'), false);
    assert.equal(registry.isAllowedTool('run_shell'), false);
    assert.equal(registry.ALLOWED_TOOL_NAMES.length, 41);
});

test('create funnel tool', async function () {
    var fx = createFixture();
    var result = await fx.execute('create_funnel', {
        offer_id: OFFER_A,
        name: 'AI Generated Funnel',
        slug: 'ai-generated-funnel',
        type: 'custom',
        status: 'draft',
    });

    assert.equal(result.success, true);
    assert.equal(result.slug, 'ai-generated-funnel');
});

test('create page tool', async function () {
    var fx = createFixture();
    var funnel = await fx.execute('create_funnel', {
        offer_id: OFFER_A,
        name: 'Funnel',
        slug: 'funnel',
    });

    var page = await fx.execute('create_page', {
        offer_id: OFFER_A,
        funnel_id: funnel.funnel_id,
        name: 'AI Generated Sales Page',
        slug: 'ai-generated-sales-page',
        type: 'sales',
        status: 'draft',
    });

    assert.equal(page.success, true);
    assert.equal(page.status, 'draft');
});

test('create section and block tools', async function () {
    var fx = createFixture();
    var funnel = await fx.service.createFunnel(OFFER_A, { name: 'F', slug: 'f' });
    var page = await fx.service.createPage(OFFER_A, funnel.id, { name: 'P', slug: 'p' });

    var section = await fx.execute('create_section', {
        offer_id: OFFER_A,
        page_id: page.id,
        type: 'hero',
        sort_order: 100,
    });

    var block = await fx.execute('create_block', {
        offer_id: OFFER_A,
        section_id: section.section_id,
        type: 'heading',
        sort_order: 100,
        content: { text: 'Hello' },
        settings: { level: 1 },
    });

    assert.equal(section.success, true);
    assert.equal(block.success, true);
    assert.equal(block.type, 'heading');
});

test('update page and block tools', async function () {
    var fx = createFixture();
    var funnel = await fx.service.createFunnel(OFFER_A, { name: 'F', slug: 'f2' });
    var page = await fx.service.createPage(OFFER_A, funnel.id, { name: 'P', slug: 'p2' });
    var section = await fx.service.createSection(OFFER_A, page.id, { type: 'hero' });
    var block = await fx.service.createBlock(OFFER_A, section.id, {
        type: 'heading',
        content: { text: 'Old' },
    });

    await fx.execute('update_page', {
        offer_id: OFFER_A,
        page_id: page.id,
        name: 'Updated Page',
    });

    var updated = await fx.execute('update_block', {
        offer_id: OFFER_A,
        block_id: block.id,
        content: { text: 'Transforma a tua rotina com um novo método.' },
    });

    assert.equal(updated.success, true);

    var tree = await fx.execute('get_page_tree', {
        offer_id: OFFER_A,
        page_id: page.id,
    });

    assert.equal(tree.sections[0].blocks[0].content.text, 'Transforma a tua rotina com um novo método.');
});

test('delete block tool', async function () {
    var fx = createFixture();
    var funnel = await fx.service.createFunnel(OFFER_A, { name: 'F', slug: 'f3' });
    var page = await fx.service.createPage(OFFER_A, funnel.id, { name: 'P', slug: 'p3' });
    var section = await fx.service.createSection(OFFER_A, page.id, { type: 'hero' });
    var block = await fx.service.createBlock(OFFER_A, section.id, { type: 'text', content: { text: 'x' } });

    var result = await fx.execute('delete_block', {
        offer_id: OFFER_A,
        block_id: block.id,
    });

    assert.equal(result.success, true);
    assert.equal(result.deleted, true);
});

test('reorder sections and blocks', async function () {
    var fx = createFixture();
    var funnel = await fx.service.createFunnel(OFFER_A, { name: 'F', slug: 'f4' });
    var page = await fx.service.createPage(OFFER_A, funnel.id, { name: 'P', slug: 'p4' });
    var s1 = await fx.service.createSection(OFFER_A, page.id, { type: 'hero', sort_order: 100 });
    var s2 = await fx.service.createSection(OFFER_A, page.id, { type: 'benefits', sort_order: 200 });

    var sections = await fx.execute('reorder_sections', {
        offer_id: OFFER_A,
        page_id: page.id,
        items: [
            { id: s2.id, sort_order: 100 },
            { id: s1.id, sort_order: 200 },
        ],
    });

    assert.equal(sections.sections[0].id, s2.id);
});

test('get page tree tool', async function () {
    var fx = createFixture();
    var funnel = await fx.service.createFunnel(OFFER_A, { name: 'F', slug: 'f5' });
    var page = await fx.service.createPage(OFFER_A, funnel.id, { name: 'P', slug: 'p5' });
    var section = await fx.service.createSection(OFFER_A, page.id, { type: 'hero' });
    await fx.service.createBlock(OFFER_A, section.id, { type: 'heading', content: { text: 'H' } });

    var tree = await fx.execute('get_page_tree', {
        offer_id: OFFER_A,
        page_id: page.id,
    });

    assert.equal(tree.success, true);
    assert.equal(tree.sections.length, 1);
    assert.equal(tree.sections[0].blocks.length, 1);
});

test('cross-offer rejection', async function () {
    var fx = createFixture();
    var funnel = await fx.service.createFunnel(OFFER_B, { name: 'Other', slug: 'other' });

    await assert.rejects(function () {
        return fx.execute('get_funnel', {
            offer_id: OFFER_B,
            funnel_id: funnel.id,
        });
    }, function (error) {
        return error.code === ERROR_CODES.CROSS_OFFER_ACCESS;
    });
});

test('invalid block type rejected', async function () {
    var fx = createFixture();
    var funnel = await fx.service.createFunnel(OFFER_A, { name: 'F', slug: 'f6' });
    var page = await fx.service.createPage(OFFER_A, funnel.id, { name: 'P', slug: 'p6' });
    var section = await fx.service.createSection(OFFER_A, page.id, { type: 'hero' });

    await assert.rejects(function () {
        return fx.execute('create_block', {
            offer_id: OFFER_A,
            section_id: section.id,
            type: 'unknown_test_block',
            content: {},
        });
    }, function (error) {
        return error.code === ERROR_CODES.INVALID_BLOCK_TYPE;
    });
});

test('duplicate slug surfaces DUPLICATE_SLUG', async function () {
    var fx = createFixture();
    await fx.execute('create_funnel', {
        offer_id: OFFER_A,
        name: 'One',
        slug: 'dup-funnel',
    });

    await assert.rejects(function () {
        return fx.execute('create_funnel', {
            offer_id: OFFER_A,
            name: 'Two',
            slug: 'dup-funnel',
        });
    }, function (error) {
        return error.code === ERROR_CODES.DUPLICATE_SLUG;
    });
});

test('unknown tool rejected', async function () {
    var fx = createFixture();

    await assert.rejects(function () {
        return fx.execute('execute_sql', { offer_id: OFFER_A, query: 'select 1' });
    }, function (error) {
        return error.code === ERROR_CODES.UNKNOWN_TOOL;
    });
});

test('duplicate page copies sections and blocks', async function () {
    var fx = createFixture();
    var funnel = await fx.service.createFunnel(OFFER_A, { name: 'F', slug: 'f7' });
    var page = await fx.service.createPage(OFFER_A, funnel.id, { name: 'Source', slug: 'source' });
    var section = await fx.service.createSection(OFFER_A, page.id, { type: 'hero' });
    await fx.service.createBlock(OFFER_A, section.id, { type: 'text', content: { text: 'copy me' } });

    var dup = await fx.execute('duplicate_page', {
        offer_id: OFFER_A,
        page_id: page.id,
        name: 'Copy',
        slug: 'copy',
    });

    var tree = await fx.execute('get_page_tree', {
        offer_id: OFFER_A,
        page_id: dup.page_id,
    });

    assert.equal(tree.sections.length, 1);
    assert.equal(tree.sections[0].blocks[0].content.text, 'copy me');
});

test('full ai generated page structure via tools', async function () {
    var fx = createFixture();

    var funnel = await fx.execute('create_funnel', {
        offer_id: OFFER_A,
        name: 'AI Generated Funnel',
        slug: 'ai-generated-funnel',
        type: 'custom',
        status: 'draft',
    });

    var page = await fx.execute('create_page', {
        offer_id: OFFER_A,
        funnel_id: funnel.funnel_id,
        name: 'AI Generated Sales Page',
        slug: 'ai-generated-sales-page',
        type: 'sales',
        status: 'draft',
    });

    var hero = await fx.execute('create_section', {
        offer_id: OFFER_A,
        page_id: page.page_id,
        type: 'hero',
        sort_order: 100,
    });

    await fx.execute('create_block', {
        offer_id: OFFER_A,
        section_id: hero.section_id,
        type: 'heading',
        sort_order: 100,
        content: { text: 'Hero Title' },
    });
    await fx.execute('create_block', {
        offer_id: OFFER_A,
        section_id: hero.section_id,
        type: 'text',
        sort_order: 200,
        content: { text: 'Hero copy' },
    });
    await fx.execute('create_block', {
        offer_id: OFFER_A,
        section_id: hero.section_id,
        type: 'button',
        sort_order: 300,
        content: { label: 'Buy' },
        settings: { href: '#' },
    });

    var benefits = await fx.execute('create_section', {
        offer_id: OFFER_A,
        page_id: page.page_id,
        type: 'benefits',
        sort_order: 200,
    });

    await fx.execute('create_block', {
        offer_id: OFFER_A,
        section_id: benefits.section_id,
        type: 'heading',
        sort_order: 100,
        content: { text: 'Benefits' },
    });
    await fx.execute('create_block', {
        offer_id: OFFER_A,
        section_id: benefits.section_id,
        type: 'text',
        sort_order: 200,
        content: { text: 'Benefit copy' },
    });

    var cta = await fx.execute('create_section', {
        offer_id: OFFER_A,
        page_id: page.page_id,
        type: 'cta',
        sort_order: 300,
    });

    await fx.execute('create_block', {
        offer_id: OFFER_A,
        section_id: cta.section_id,
        type: 'heading',
        sort_order: 100,
        content: { text: 'Ready?' },
    });
    await fx.execute('create_block', {
        offer_id: OFFER_A,
        section_id: cta.section_id,
        type: 'button',
        sort_order: 200,
        content: { label: 'Start' },
        settings: { href: '#' },
    });

    var tree = await fx.execute('get_page_tree', {
        offer_id: OFFER_A,
        page_id: page.page_id,
    });

    assert.equal(tree.sections.length, 3);
    assert.equal(tree.sections[0].type, 'hero');
    assert.equal(tree.sections[0].blocks.length, 3);
});
