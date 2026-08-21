'use strict';

var funnelEngine = require('../funnel-engine');
var templateApply = require('./templates/apply');

async function seedPageFromTemplate(offerId, pageId, templateId, service) {
    var engine = service || funnelEngine;
    var materialized = templateApply.materializeTemplateSections(templateId);
    var sections = materialized.sections || [];

    for (var i = 0; i < sections.length; i += 1) {
        var section = sections[i];
        var createdSection = await engine.createSection(offerId, pageId, {
            type: section.type,
            sort_order: section.sort_order,
            settings: section.settings,
            styles: section.styles,
            visibility: section.visibility,
        });

        var blocks = section.blocks || [];

        for (var j = 0; j < blocks.length; j += 1) {
            var block = blocks[j];
            await engine.createBlock(offerId, createdSection.id, {
                type: block.type,
                sort_order: block.sort_order,
                content: block.content,
                settings: block.settings,
                styles: block.styles,
                visibility: block.visibility,
            });
        }
    }

    return sections.length;
}

module.exports = {
    seedPageFromTemplate: seedPageFromTemplate,
};
