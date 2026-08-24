'use strict';

var funnelEngine = require('../funnel-engine');
var checkoutDefaultPage = require('./checkout-default-page');

async function writeSections(offerId, pageId, sections, service) {
    var engine = service || funnelEngine;
    var created = 0;

    for (var i = 0; i < sections.length; i += 1) {
        var section = sections[i];
        var createdSection = await engine.createSection(offerId, pageId, {
            type: section.type,
            sort_order: (i + 1) * 100,
            settings: section.settings || {},
            styles: section.styles || {},
            visibility: section.visibility || { desktop: true, tablet: true, mobile: true },
        });

        var blocks = section.blocks || [];

        for (var j = 0; j < blocks.length; j += 1) {
            var block = blocks[j];
            await engine.createBlock(offerId, createdSection.id, {
                type: block.type,
                sort_order: (j + 1) * 100,
                content: block.content || {},
                settings: block.settings || {},
                styles: block.styles || {},
                visibility: block.visibility || { desktop: true, tablet: true, mobile: true },
            });
        }

        created += 1;
    }

    return created;
}

async function seedCheckoutDefaultPage(offerId, pageId, options, service) {
    var sections = checkoutDefaultPage.buildCheckoutDefaultSections(options || {});
    return writeSections(offerId, pageId, sections, service);
}

async function ensureCheckoutDefaultSeeded(offerId, page, options, service) {
    var engine = service || funnelEngine;

    if (!page || page.type !== 'checkout') {
        return { seeded: false, reason: 'not_checkout' };
    }

    var tree = await engine.getPageTree(offerId, page.id);
    var existing = (tree && tree.sections) || [];

    if (existing.length > 0) {
        return { seeded: false, reason: 'already_has_sections', sections: existing.length };
    }

    var count = await seedCheckoutDefaultPage(offerId, page.id, Object.assign({
        offerName: options && options.offerName,
        priceLabel: options && options.priceLabel,
    }, options || {}), engine);

    return { seeded: true, sections: count };
}

module.exports = {
    seedCheckoutDefaultPage: seedCheckoutDefaultPage,
    ensureCheckoutDefaultSeeded: ensureCheckoutDefaultSeeded,
    writeSections: writeSections,
};
