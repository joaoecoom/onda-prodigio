'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var editorState = require('../lib/hub/page-builder/editor-state');
var treeDiff = require('../lib/hub/page-builder/tree-diff');
var save = require('../lib/hub/page-builder/save');
var defaults = require('../lib/hub/page-builder/defaults');
var pageRenderer = require('../lib/hub/page-renderer/page-renderer');
var { createService, createMemoryStore } = require('../lib/hub/funnel-engine/service');

var OFFER_A = 'ai-test-offer';
var OFFER_B = 'onda-prodigio';

function mockOffer(id) {
    return { id: id, slug: id, name: id, status: 'draft', mode: 'test' };
}

function sampleTree() {
    return {
        funnel: { id: 'f1', offer_id: OFFER_A, slug: 'test-funnel', name: 'Test Funnel' },
        page: { id: 'p1', funnel_id: 'f1', offer_id: OFFER_A, slug: 'test-page', name: 'Test Page', status: 'draft', settings: {} },
        sections: [{
            id: 's1',
            page_id: 'p1',
            offer_id: OFFER_A,
            type: 'hero',
            sort_order: 100,
            settings: { label: 'Hero' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
            blocks: [{
                id: 'b1',
                section_id: 's1',
                page_id: 'p1',
                offer_id: OFFER_A,
                type: 'heading',
                sort_order: 100,
                content: { text: 'Hello' },
                settings: { level: 1, alignment: 'center' },
                styles: {},
                visibility: { desktop: true, tablet: true, mobile: true },
            }],
        }],
    };
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

async function seedTree(service) {
    var funnel = await service.createFunnel(OFFER_A, {
        name: 'Test Funnel',
        slug: 'test-funnel',
        status: 'draft',
    });
    var page = await service.createPage(OFFER_A, funnel.id, {
        name: 'Test Page',
        slug: 'test-page',
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

    return service.getPageTree(OFFER_A, page.id);
}

test('editor route slugs resolve tree via service', async function () {
    var fx = createFixture();
    var tree = await seedTree(fx.service);
    var bySlugs = await fx.service.getPageTreeBySlugs(OFFER_A, 'test-funnel', 'test-page');

    assert.equal(bySlugs.page.slug, tree.page.slug);
    assert.equal(bySlugs.sections.length, 1);
});

test('load page tree structure', async function () {
    var fx = createFixture();
    var tree = await seedTree(fx.service);

    assert.equal(tree.page.name, 'Test Page');
    assert.equal(tree.sections[0].blocks[0].type, 'heading');
});

test('offer isolation rejects cross-offer funnel access', async function () {
    var fx = createFixture();
    await seedTree(fx.service);

    await assert.rejects(function () {
        return fx.service.getFunnel(OFFER_B, 'missing');
    }, function (error) {
        return error.code === 'NOT_FOUND' || /não encontrad/i.test(error.message);
    });
});

test('select block and section in editor state', function () {
    var state = editorState.createEditorState(sampleTree());
    editorState.select(state, 'block', 'b1');
    assert.equal(state.selected.type, 'block');
    editorState.select(state, 'section', 's1');
    assert.equal(state.selected.id, 's1');
});

test('add block creates temp id', function () {
    var state = editorState.createEditorState(sampleTree());
    var block = editorState.addBlock(state, 's1', 'text');
    assert.match(block.id, /^tmp-/);
    assert.equal(block.type, 'text');
});

test('add section creates empty section', function () {
    var state = editorState.createEditorState(sampleTree());
    var section = editorState.addSection(state, 'benefits');
    assert.match(section.id, /^tmp-/);
    assert.equal(section.blocks.length, 0);
});

test('update heading content', function () {
    var state = editorState.createEditorState(sampleTree());
    editorState.updateBlock(state, 'b1', { content: { text: 'Updated headline' } });
    var found = editorState.findBlock(state, 'b1');
    assert.equal(found.block.content.text, 'Updated headline');
});

test('update text block', function () {
    var state = editorState.createEditorState(sampleTree());
    editorState.addBlock(state, 's1', 'text');
    var block = state.tree.sections[0].blocks.find(function (row) { return row.type === 'text'; });
    editorState.updateBlock(state, block.id, { content: { text: 'Paragraph' } });
    assert.equal(editorState.findBlock(state, block.id).block.content.text, 'Paragraph');
});

test('update button block', function () {
    var state = editorState.createEditorState(sampleTree());
    var block = editorState.addBlock(state, 's1', 'button');
    editorState.updateBlock(state, block.id, {
        content: { label: 'CTA', href: 'https://example.com' },
        settings: { variant: 'primary' },
    });
    var updated = editorState.findBlock(state, block.id).block;
    assert.equal(updated.content.label, 'CTA');
    assert.equal(updated.content.href, 'https://example.com');
});

test('update image block', function () {
    var state = editorState.createEditorState(sampleTree());
    var block = editorState.addBlock(state, 's1', 'image');
    editorState.updateBlock(state, block.id, {
        content: { src: 'https://example.com/a.jpg', alt: 'Hero' },
        settings: { width: '80%' },
    });
    var updated = editorState.findBlock(state, block.id).block;
    assert.equal(updated.content.src, 'https://example.com/a.jpg');
});

test('update video block', function () {
    var state = editorState.createEditorState(sampleTree());
    var block = editorState.addBlock(state, 's1', 'video');
    editorState.updateBlock(state, block.id, {
        content: { url: 'https://example.com/video.mp4' },
        settings: { aspectRatio: '16 / 9' },
    });
    assert.equal(editorState.findBlock(state, block.id).block.content.url, 'https://example.com/video.mp4');
});

test('update section settings', function () {
    var state = editorState.createEditorState(sampleTree());
    editorState.updateSection(state, 's1', {
        settings: { label: 'Hero updated' },
        styles: { background: '#fff' },
    });
    var section = editorState.findSection(state, 's1');
    assert.equal(section.settings.label, 'Hero updated');
    assert.equal(section.styles.background, '#fff');
});

test('duplicate block', function () {
    var state = editorState.createEditorState(sampleTree());
    var copy = editorState.duplicateBlock(state, 'b1');
    assert.notEqual(copy.id, 'b1');
    assert.equal(state.tree.sections[0].blocks.length, 2);
});

test('duplicate section', function () {
    var state = editorState.createEditorState(sampleTree());
    var copy = editorState.duplicateSection(state, 's1');
    assert.notEqual(copy.id, 's1');
    assert.equal(copy.blocks.length, 1);
    assert.equal(state.tree.sections.length, 2);
});

test('delete block', function () {
    var state = editorState.createEditorState(sampleTree());
    editorState.deleteBlock(state, 'b1');
    assert.equal(state.tree.sections[0].blocks.length, 0);
});

test('delete empty section', function () {
    var state = editorState.createEditorState(sampleTree());
    editorState.deleteBlock(state, 'b1');
    editorState.deleteSection(state, 's1', { force: true });
    assert.equal(state.tree.sections.length, 0);
});

test('reorder block', function () {
    var state = editorState.createEditorState(sampleTree());
    var textBlock = editorState.addBlock(state, 's1', 'text');
    var heading = editorState.findBlock(state, 'b1').block;
    var text = editorState.findBlock(state, textBlock.id).block;
    var headingOrder = heading.sort_order;
    var textOrder = text.sort_order;
    editorState.moveBlock(state, textBlock.id, 'up');
    assert.equal(editorState.findBlock(state, 'b1').block.sort_order, textOrder);
    assert.equal(editorState.findBlock(state, textBlock.id).block.sort_order, headingOrder);
});

test('reorder section', function () {
    var state = editorState.createEditorState(sampleTree());
    var second = editorState.addSection(state, 'cta');
    var firstOrder = editorState.findSection(state, 's1').sort_order;
    var secondOrder = editorState.findSection(state, second.id).sort_order;
    editorState.moveSection(state, second.id, 'up');
    assert.equal(editorState.findSection(state, 's1').sort_order, secondOrder);
    assert.equal(editorState.findSection(state, second.id).sort_order, firstOrder);
});

test('save persists new block via domain layer', async function () {
    var fx = createFixture();
    var baseline = await seedTree(fx.service);
    var working = editorState.cloneTree(baseline);
    var sectionId = working.sections[0].id;
    working.sections[0].blocks.push(Object.assign(defaults.defaultBlock('text'), {
        id: editorState.tempId(),
        sort_order: 200,
        content: { text: 'Saved paragraph' },
    }));

    var saved = await save.saveTree(OFFER_A, baseline.page.id, baseline, working, fx.service);
    assert.equal(saved.sections[0].blocks.length, 2);
    assert.equal(saved.sections[0].blocks[1].content.text, 'Saved paragraph');
});

test('save failure keeps local tree intact', async function () {
    var fx = createFixture();
    var baseline = await seedTree(fx.service);
    var working = editorState.cloneTree(baseline);
    working.sections[0].blocks[0].content.text = 'Local only';

    await assert.rejects(function () {
        return save.saveTree(OFFER_B, baseline.page.id, baseline, working, fx.service);
    });

    assert.equal(working.sections[0].blocks[0].content.text, 'Local only');
});

test('undo restores previous tree', function () {
    var state = editorState.createEditorState(sampleTree());
    editorState.updateBlock(state, 'b1', { content: { text: 'Changed' } });
    editorState.undo(state);
    assert.equal(editorState.findBlock(state, 'b1').block.content.text, 'Hello');
});

test('redo reapplies change', function () {
    var state = editorState.createEditorState(sampleTree());
    editorState.updateBlock(state, 'b1', { content: { text: 'Changed' } });
    editorState.undo(state);
    editorState.redo(state);
    assert.equal(editorState.findBlock(state, 'b1').block.content.text, 'Changed');
});

test('draft preview render uses PageRenderer', function () {
    var tree = sampleTree();
    var html = pageRenderer.renderPageBody(tree, { mode: 'preview' });
    assert.match(html, /Hello/);
    assert.match(html, /data-block-id="b1"/);
});

test('cross-offer save mutation rejected by service', async function () {
    var fx = createFixture();
    var tree = await seedTree(fx.service);

    await assert.rejects(function () {
        return fx.service.updateBlock(OFFER_B, tree.sections[0].blocks[0].id, {
            content: { text: 'Hack' },
        });
    });
});

test('tree diff detects create and update mutations', function () {
    var baseline = sampleTree();
    var working = editorState.cloneTree(baseline);
    working.sections[0].blocks[0].content.text = 'Updated';
    var block = defaults.defaultBlock('button');
    block.id = editorState.tempId();
    working.sections[0].blocks.push(block);

    var mutations = treeDiff.buildMutations(baseline, working);
    assert.ok(mutations.some(function (row) { return row.op === 'update_block'; }));
    assert.ok(mutations.some(function (row) { return row.op === 'create_block'; }));
});

test('component library includes html for rich layouts', function () {
    var types = defaults.COMPONENT_LIBRARY.map(function (row) { return row.type; });
    assert.ok(types.includes('heading'));
    assert.ok(types.includes('html'));
});

test('reorder utility buildOrder inserts before target', function () {
    var reorder = require('../lib/hub/page-builder/reorder');
    var order = reorder.buildOrder(['a', 'b', 'c'], 'c', 'a', 'before');
    assert.deepEqual(order, ['c', 'a', 'b']);
});

test('reorderSectionsByIds updates sort order', function () {
    var state = editorState.createEditorState({
        page: { id: 'p1' },
        sections: [
            { id: 's1', sort_order: 100, blocks: [] },
            { id: 's2', sort_order: 200, blocks: [] },
            { id: 's3', sort_order: 300, blocks: [] },
        ],
    });
    editorState.reorderSectionsByIds(state, ['s3', 's1', 's2']);
    assert.equal(state.tree.sections[0].id, 's3');
    assert.equal(state.tree.sections[0].sort_order, 100);
    assert.equal(state.tree.sections[2].id, 's2');
});

test('moveBlockToSection moves block across sections', function () {
    var state = editorState.createEditorState({
        page: { id: 'p1' },
        sections: [
            { id: 's1', sort_order: 100, blocks: [{ id: 'b1', type: 'heading', sort_order: 100 }] },
            { id: 's2', sort_order: 200, blocks: [] },
        ],
    });
    editorState.moveBlockToSection(state, 'b1', 's2', null);
    assert.equal(state.tree.sections[0].blocks.length, 0);
    assert.equal(state.tree.sections[1].blocks.length, 1);
    assert.equal(state.tree.sections[1].blocks[0].id, 'b1');
});

test('drag reorder persists sort_order change on save', async function () {
    var fx = createFixture();
    var baseline = await seedTree(fx.service);
    var section2 = await fx.service.createSection(OFFER_A, baseline.page.id, {
        type: 'benefits',
        sort_order: 200,
        settings: { label: 'Benefits' },
    });
    baseline = await fx.service.getPageTree(OFFER_A, baseline.page.id);

    var state = editorState.createEditorState(baseline);
    var ids = baseline.sections.slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    }).map(function (s) { return s.id; }).reverse();

    editorState.reorderSectionsByIds(state, ids);

    var saved = await save.saveTree(OFFER_A, baseline.page.id, baseline, state.tree, fx.service);
    var first = saved.sections.slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    })[0];

    assert.equal(first.id, section2.id);
});
