'use strict';

var defaults = require('../defaults');
var editorState = require('../editor-state');
var catalog = require('./catalog');
var constants = require('../../funnel-engine/constants');

var DEFAULT_VISIBILITY = { desktop: true, tablet: true, mobile: true };

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

function materializeBlock(blockTemplate, sortOrder) {
    return {
        id: editorState.tempId(),
        type: blockTemplate.type,
        sort_order: sortOrder,
        content: cloneJson(blockTemplate.content),
        settings: cloneJson(blockTemplate.settings),
        styles: cloneJson(blockTemplate.styles),
        visibility: Object.assign({}, DEFAULT_VISIBILITY, blockTemplate.visibility || {}),
    };
}

function materializeSection(sectionTemplate, sortOrder) {
    var gap = constants.DEFAULT_SORT_GAP;
    var blocks = (sectionTemplate.blocks || []).map(function (block, index) {
        return materializeBlock(block, (index + 1) * gap);
    });

    return {
        id: editorState.tempId(),
        type: sectionTemplate.type,
        sort_order: sortOrder,
        settings: cloneJson(sectionTemplate.settings),
        styles: cloneJson(sectionTemplate.styles),
        visibility: Object.assign({}, DEFAULT_VISIBILITY, sectionTemplate.visibility || {}),
        blocks: blocks,
    };
}

function appendSectionsToTree(tree, sectionTemplates) {
    tree.sections = tree.sections || [];

    sectionTemplates.forEach(function (sectionTemplate) {
        var section = materializeSection(sectionTemplate, defaults.nextSortOrder(tree.sections));
        tree.sections.push(section);
    });

    return tree;
}

function applyTemplateToState(state, templateId) {
    var template = catalog.resolveTemplate(templateId);

    if (!template) {
        throw Object.assign(new Error('Template não encontrado.'), { code: 'NOT_FOUND' });
    }

    editorState.pushHistory(state);
    appendSectionsToTree(state.tree, template.sections || []);

    if (template.sections && template.sections.length) {
        var lastSection = state.tree.sections[state.tree.sections.length - 1];
        editorState.select(state, 'section', lastSection.id);
    }

    return template;
}

function materializeTemplateSections(templateId) {
    var template = catalog.resolveTemplate(templateId);

    if (!template) {
        throw Object.assign(new Error('Template não encontrado.'), { code: 'NOT_FOUND' });
    }

    var scratch = { sections: [] };
    appendSectionsToTree(scratch, template.sections || []);

    return {
        template: {
            id: template.id,
            kind: template.kind,
            label: template.label,
            description: template.description,
        },
        sections: scratch.sections,
    };
}

module.exports = {
    materializeBlock: materializeBlock,
    materializeSection: materializeSection,
    appendSectionsToTree: appendSectionsToTree,
    applyTemplateToState: applyTemplateToState,
    materializeTemplateSections: materializeTemplateSections,
};
