'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var blockRegistry = require('../lib/hub/page-renderer/block-registry');
var sectionRenderer = require('../lib/hub/page-renderer/section-renderer');
var pageRenderer = require('../lib/hub/page-renderer/page-renderer');
var escapeUtil = require('../lib/hub/page-renderer/escape');
var visibilityUtil = require('../lib/hub/page-renderer/visibility');
var loadPageModule = require('../lib/hub/page-renderer/load-page');
var { createService, createMemoryStore } = require('../lib/hub/funnel-engine/service');

var OFFER_A = 'offer-a';
var OFFER_B = 'offer-b';

function mockOffer(id) {
    return { id: id, slug: id, name: id, status: 'draft', mode: 'test' };
}

function createFixtureService() {
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

            return Promise.reject(new Error('Oferta não encontrada.'));
        },
    });

    return { store: store, service: service };
}

async function buildAiTestTree(service) {
    var funnel = await service.createFunnel(OFFER_A, {
        name: 'AI Test Sales Funnel',
        slug: 'ai-test-sales-funnel',
    });

    var page = await service.createPage(OFFER_A, funnel.id, {
        name: 'AI Test Sales Page',
        slug: 'ai-test-sales-page',
        type: 'sales',
        status: 'draft',
        settings: { maxWidth: '960px', background: '#ffffff' },
        seo: { title: 'AI Test Sales Page', description: 'Fixture page' },
    });

    var hero = await service.createSection(OFFER_A, page.id, { type: 'hero', sort_order: 100 });
    await service.createBlock(OFFER_A, hero.id, {
        type: 'heading',
        sort_order: 100,
        content: { text: 'Hero Heading' },
        settings: { level: 1, alignment: 'center' },
    });
    await service.createBlock(OFFER_A, hero.id, {
        type: 'text',
        sort_order: 200,
        content: { text: 'Hero body copy.' },
    });
    await service.createBlock(OFFER_A, hero.id, {
        type: 'button',
        sort_order: 300,
        content: { label: 'Buy Now' },
        settings: { href: '/checkout9', variant: 'primary' },
    });

    var benefits = await service.createSection(OFFER_A, page.id, { type: 'benefits', sort_order: 200 });
    await service.createBlock(OFFER_A, benefits.id, {
        type: 'heading',
        sort_order: 100,
        content: { text: 'Benefits' },
    });
    await service.createBlock(OFFER_A, benefits.id, {
        type: 'text',
        sort_order: 200,
        content: { text: 'Benefit details here.' },
    });

    return service.getPageTree(OFFER_A, page.id);
}

test('render heading strips script tags from rich text', function () {
    var html = blockRegistry.renderBlock({
        id: 'b1',
        type: 'heading',
        content: { text: '<script>alert(1)</script>' },
        settings: { level: 2 },
        styles: {},
        visibility: { desktop: true, tablet: true, mobile: true },
    });

    assert.doesNotMatch(html, /<script>/);
    assert.doesNotMatch(html, /alert\(1\)/);
});

test('render text with alignment', function () {
    var html = blockRegistry.renderBlock({
        id: 'b2',
        type: 'text',
        content: { text: 'Line one\nLine two' },
        settings: { alignment: 'center' },
        styles: {},
        visibility: {},
    });

    assert.match(html, /Line one<br>Line two/);
    assert.match(html, /text-align:center/);
});

test('render image validates url', function () {
    var bad = blockRegistry.renderBlock({
        id: 'b3',
        type: 'image',
        content: { src: 'javascript:alert(1)' },
        settings: {},
        styles: {},
        visibility: {},
    });

    assert.match(bad, /inválida/);

    var good = blockRegistry.renderBlock({
        id: 'b4',
        type: 'image',
        content: { src: 'https://example.com/a.jpg', alt: 'A' },
        settings: {},
        styles: {},
        visibility: {},
    });

    assert.match(good, /src="https:\/\/example.com\/a.jpg"/);
});

test('render video with controls', function () {
    var html = blockRegistry.renderBlock({
        id: 'b5',
        type: 'video',
        content: { url: 'https://example.com/video.mp4' },
        settings: { controls: true, muted: true },
        styles: {},
        visibility: {},
    });

    assert.match(html, /<video/);
    assert.match(html, /controls/);
    assert.match(html, /muted/);
});

test('render button with safe href', function () {
    var html = blockRegistry.renderBlock({
        id: 'b6',
        type: 'button',
        content: { label: 'Click' },
        settings: { href: 'javascript:evil()', variant: 'primary' },
        styles: {},
        visibility: {},
    });

    assert.match(html, /href="#"/);

    var safe = blockRegistry.renderBlock({
        id: 'b7',
        type: 'button',
        content: { label: 'Go' },
        settings: { href: 'https://example.com', target: '_blank' },
        styles: {},
        visibility: {},
    });

    assert.match(safe, /href="https:\/\/example.com"/);
    assert.match(safe, /rel="noopener noreferrer"/);
});

test('render spacer', function () {
    var html = blockRegistry.renderBlock({
        id: 'b8',
        type: 'spacer',
        content: {},
        settings: { height: '48px', mobileHeight: '24px' },
        styles: {},
        visibility: {},
    });

    assert.match(html, /height:48px/);
    assert.match(html, /data-mobile-height="24px"/);
});

test('render html strips scripts', function () {
    var html = blockRegistry.renderBlock({
        id: 'b9',
        type: 'html',
        content: { html: '<p>OK</p><script>x()</script>' },
        settings: {},
        styles: {},
        visibility: {},
    }, { mode: 'preview' });

    assert.doesNotMatch(html, /HTML block/);
    assert.doesNotMatch(html, /scripts removidos/);
    assert.match(html, /<p>OK<\/p>/);
    assert.doesNotMatch(html, /<script>/);
});

test('unknown block fallback in preview', function () {
    var html = blockRegistry.renderBlock({
        id: 'bx',
        type: 'hero-vsl',
        content: {},
        settings: {},
        styles: {},
        visibility: {},
    }, { mode: 'preview' });

    assert.match(html, /Unsupported block: hero-vsl/);
});

test('unknown block omitted in production mode', function () {
    var html = blockRegistry.renderBlock({
        id: 'bx',
        type: 'hero-vsl',
        content: {},
        settings: {},
        styles: {},
        visibility: {},
    }, { mode: 'production' });

    assert.match(html, /unsupported block: hero-vsl/);
    assert.doesNotMatch(html, /Unsupported block/);
});

test('sections and blocks preserve sort order', function () {
    var tree = {
        page: { id: 'p1', settings: {}, seo: {} },
        sections: [
            {
                id: 's2',
                type: 'benefits',
                sort_order: 200,
                settings: {},
                styles: {},
                visibility: {},
                blocks: [
                    { id: 'b2', type: 'text', sort_order: 200, content: { text: 'Second' }, settings: {}, styles: {}, visibility: {} },
                    { id: 'b1', type: 'heading', sort_order: 100, content: { text: 'First' }, settings: {}, styles: {}, visibility: {} },
                ],
            },
            {
                id: 's1',
                type: 'hero',
                sort_order: 100,
                settings: {},
                styles: {},
                visibility: {},
                blocks: [],
            },
        ],
    };

    var html = pageRenderer.renderPageDocument(tree, { mode: 'preview' });
    var heroPos = html.indexOf('pe-section--hero');
    var benefitsPos = html.indexOf('pe-section--benefits');
    var firstPos = html.indexOf('First');
    var secondPos = html.indexOf('Second');

    assert.ok(heroPos < benefitsPos);
    assert.ok(firstPos < secondPos);
});

test('visibility classes applied', function () {
    var cls = visibilityUtil.visibilityClasses({ desktop: true, tablet: false, mobile: true });
    assert.match(cls, /pe-hide-tablet/);
});

test('draft page blocked without preview flag', function () {
    assert.throws(function () {
        loadPageModule.assertPageVisibility({ status: 'draft' }, {
            allowDraft: false,
            authenticatedPreview: false,
        });
    }, /não publicada/);
});

test('published page allowed publicly', function () {
    assert.doesNotThrow(function () {
        loadPageModule.assertPageVisibility({ status: 'published' }, {
            allowDraft: false,
            authenticatedPreview: false,
        });
    });
});

test('escape util rejects unsafe urls', function () {
    assert.equal(escapeUtil.isSafeUrl('javascript:alert(1)'), false);
    assert.equal(escapeUtil.isSafeUrl('https://example.com'), true);
    assert.equal(escapeUtil.isSafeUrl('#top'), true);
});

test('full page tree renders hero and benefits', async function () {
    var fixture = createFixtureService();
    var tree = await buildAiTestTree(fixture.service);
    var html = pageRenderer.renderPageDocument(tree, {
        mode: 'preview',
        showPreviewBanner: true,
        offerContext: mockOffer(OFFER_A),
    });

    assert.match(html, /Hero Heading/);
    assert.match(html, /Hero body copy/);
    assert.match(html, /Buy Now/);
    assert.match(html, /Benefits/);
    assert.match(html, /pe-section--hero/);
    assert.match(html, /pe-section--benefits/);
    assert.match(html, /<title>AI Test Sales Page<\/title>/);
});

test('cross-offer tree validation fails', function () {
    assert.throws(function () {
        loadPageModule.validateRenderableTree({
            funnel: { id: 'f1', offer_id: OFFER_A },
            page: { id: 'p1', funnel_id: 'f2', offer_id: OFFER_A },
            sections: [],
        });
    }, /não pertence ao funnel/);
});

test('draft page allowed with preview flag', function () {
    assert.doesNotThrow(function () {
        loadPageModule.assertPageVisibility({ status: 'draft' }, {
            allowDraft: true,
            authenticatedPreview: false,
        });
    });
});

test('page settings use full-bleed layout and background', function () {
    var previewHtml = pageRenderer.renderPageDocument({
        page: {
            id: 'p1',
            name: 'Settings Test',
            settings: { maxWidth: '720px', background: '#f3f4f6' },
            seo: {},
        },
        sections: [{
            id: 's1',
            type: 'custom',
            sort_order: 100,
            styles: { backgroundColor: '#111111' },
            blocks: [],
        }],
    }, { mode: 'preview' });

    assert.match(previewHtml, /background:#f3f4f6/);
    assert.match(previewHtml, /pe-page__inner\{[^}]*max-width:none/);
    assert.match(previewHtml, /pe-section__inner\{[^}]*max-width:100%/);
    assert.match(previewHtml, /background-color:#111111/);

    var prodHtml = pageRenderer.renderPageDocument({
        page: {
            id: 'p1',
            name: 'Settings Test',
            settings: { maxWidth: '720px', background: '#f3f4f6' },
            seo: {},
        },
        sections: [],
    }, { mode: 'production' });

    assert.match(prodHtml, /pe-section__inner\{[^}]*max-width:100%/);
    assert.match(prodHtml, /background:#f3f4f6/);
});

test('getPageTreeBySlugs resolves fixture', async function () {
    var fixture = createFixtureService();
    await buildAiTestTree(fixture.service);

    var tree = await fixture.service.getPageTreeBySlugs(
        OFFER_A,
        'ai-test-sales-funnel',
        'ai-test-sales-page'
    );

    assert.equal(tree.page.slug, 'ai-test-sales-page');
    assert.equal(tree.sections.length, 2);
});

test('slug lookup rejects wrong offer funnel combo', async function () {
    var fixture = createFixtureService();
    await buildAiTestTree(fixture.service);

    await assert.rejects(function () {
        return fixture.service.getPageTreeBySlugs(
            OFFER_B,
            'ai-test-sales-funnel',
            'ai-test-sales-page'
        );
    });
});
