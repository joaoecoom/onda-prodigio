'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var savedBlocks = require('../lib/hub/saved-blocks/service');

test('stripPagePayload keeps sections and page meta', function () {
    var payload = savedBlocks.stripPagePayload({
        page: {
            type: 'vsl',
            settings: { maxWidth: '960px' },
            seo: { title: 'VSL' },
        },
        sections: [{
            type: 'custom',
            sort_order: 100,
            settings: { label: 'Hero' },
            styles: { backgroundColor: '#000' },
            visibility: { desktop: true, tablet: true, mobile: true },
            blocks: [{
                type: 'html',
                sort_order: 100,
                content: { html: '<h1>Olá</h1>' },
                settings: {},
                styles: {},
                visibility: { desktop: true, tablet: true, mobile: true },
            }],
        }],
    });

    assert.equal(payload.page_type, 'vsl');
    assert.equal(payload.settings.maxWidth, '960px');
    assert.equal(payload.sections.length, 1);
    assert.equal(payload.sections[0].blocks[0].content.html, '<h1>Olá</h1>');
});

test('stripCheckoutPayload keeps layout bumps and price', function () {
    var payload = savedBlocks.stripCheckoutPayload({
        template: {
            html_top: '<div>top</div>',
            html_bottom: '',
            custom_css: '.x{}',
            settings: { theme: 'dark' },
        },
        checkout: {
            amount_cents: 1000,
            currency: 'eur',
            label: 'Main',
        },
        order_bumps: [{
            bump_id: 'bump-1',
            product_id: 'prod-1',
            label: 'Bump',
            amount_cents: 200,
            sort_order: 1,
            is_active: true,
        }],
    });

    assert.equal(payload.html_top, '<div>top</div>');
    assert.equal(payload.amount_cents, 1000);
    assert.equal(payload.order_bumps.length, 1);
    assert.equal(payload.order_bumps[0].bump_id, 'bump-1');
});

test('ALLOWED_KINDS includes page and checkout', function () {
    assert.ok(savedBlocks.ALLOWED_KINDS.indexOf('page') !== -1);
    assert.ok(savedBlocks.ALLOWED_KINDS.indexOf('checkout') !== -1);
});
