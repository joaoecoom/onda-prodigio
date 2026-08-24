'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var catalog = require('../lib/hub/page-builder/templates/catalog');
var templateApply = require('../lib/hub/page-builder/templates/apply');
var editorState = require('../lib/hub/page-builder/editor-state');

test('listTemplates returns page and section catalogs', function () {
    var payload = catalog.listTemplates();

    assert.ok(Array.isArray(payload.page_templates));
    assert.ok(Array.isArray(payload.section_templates));
    assert.ok(payload.page_templates.length >= 3);
    assert.ok(payload.section_templates.length >= 4);
    assert.equal(payload.page_templates[0].kind, 'page');
    assert.equal(payload.section_templates[0].kind, 'section');
});

test('resolveTemplate resolves page and section templates', function () {
    var page = catalog.resolveTemplate('sales-basic');
    assert.equal(page.kind, 'page');
    assert.equal(page.sections.length, 3);

    var section = catalog.resolveTemplate('hero-standard');
    assert.equal(section.kind, 'section');
    assert.equal(section.sections.length, 1);
    assert.equal(section.sections[0].type, 'hero');
});

test('materializeTemplateSections creates temp ids and sort orders', function () {
    var payload = templateApply.materializeTemplateSections('cta-simple');

    assert.equal(payload.template.id, 'cta-simple');
    assert.equal(payload.sections.length, 1);

    var section = payload.sections[0];
    assert.match(section.id, /^tmp-/);
    assert.equal(section.sort_order, 100);
    assert.ok(section.blocks.length >= 2);
    assert.match(section.blocks[0].id, /^tmp-/);
});

test('applyTemplateToState appends sections with history', function () {
    var state = editorState.createEditorState({ sections: [] });

    templateApply.applyTemplateToState(state, 'sales-minimal');

    assert.equal(state.tree.sections.length, 1);
    assert.equal(state.undoStack.length, 1);
    assert.equal(state.selected.type, 'section');
    assert.equal(state.selected.id, state.tree.sections[0].id);
});

test('materializeTemplateSections throws for unknown template', function () {
    assert.throws(function () {
        templateApply.materializeTemplateSections('missing-template');
    }, function (error) {
        return error.code === 'NOT_FOUND';
    });
});
