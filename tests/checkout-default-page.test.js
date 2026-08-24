'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var checkoutDefaultPage = require('../lib/hub/page-builder/checkout-default-page');
var catalog = require('../lib/hub/page-builder/templates/catalog');

test('checkout default page has scarcity, core and testimonials', function () {
    var sections = checkoutDefaultPage.buildCheckoutDefaultSections({
        offerName: 'Fruta da Época',
        priceLabel: '€10,00',
    });

    assert.equal(sections.length, 3);
    assert.equal(sections[0].type, 'checkout_scarcity');
    assert.equal(sections[1].type, 'checkout_core');
    assert.equal(sections[2].type, 'checkout_testimonials');

    var scarcity = sections[0].blocks[0].content.html;
    var core = sections[1].blocks[0].content.html;
    var testimonials = sections[2].blocks[0].content.html;

    assert.match(scarcity, /ck-seed-scarcity/);
    assert.match(scarcity, /Fruta da Época/);
    assert.match(core, /ck-seed-product/);
    assert.match(core, /Dados pessoais/);
    assert.match(core, /Comprar junto/);
    assert.match(core, /Pagar agora/);
    assert.match(testimonials, /ck-seed-testimonial/);
});

test('catalog resolves checkout-default template', function () {
    var template = catalog.resolveTemplate('checkout-default');
    assert.ok(template);
    assert.equal(template.id, 'checkout-default');
    assert.ok(template.sections.length >= 3);
});
