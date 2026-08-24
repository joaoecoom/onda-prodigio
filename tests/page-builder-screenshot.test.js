'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var schema = require('../lib/hub/page-builder/screenshot/schema');
var analyze = require('../lib/hub/page-builder/screenshot/analyze');

test('parseVisionPayload normalizes sections and blocks', function () {
    var payload = schema.parseVisionPayload(JSON.stringify({
        page_type: 'sales',
        confidence: 'high',
        notes: 'Hero + CTA',
        sections: [{
            type: 'hero',
            settings: { label: 'Hero' },
            blocks: [
                { type: 'heading', content: { text: '  Oferta Especial  ' }, settings: { level: 1, alignment: 'center' } },
                { type: 'html', content: { text: 'ignored' }, settings: {} },
                { type: 'button', content: { label: 'Comprar', href: 'javascript:alert(1)' }, settings: {} },
            ],
        }],
    }));

    assert.equal(payload.sections.length, 1);
    assert.equal(payload.sections[0].blocks.length, 2);
    assert.equal(payload.sections[0].blocks[0].content.text, 'Oferta Especial');
    assert.equal(payload.sections[0].blocks[1].type, 'button');
    assert.equal(payload.sections[0].blocks[1].content.href, '#');
});

test('validateImageInput rejects empty and unsupported mime', function () {
    assert.throws(function () {
        analyze.validateImageInput('', 'image/png');
    }, function (error) {
        return error.code === 'INVALID_IMAGE';
    });

    assert.throws(function () {
        analyze.validateImageInput('abc', 'image/gif');
    }, function (error) {
        return error.code === 'INVALID_IMAGE';
    });
});

test('buildFallbackBlueprint materializes sales-basic structure', function () {
    var blueprint = analyze.buildFallbackBlueprint();
    var sections = analyze.materializeBlueprint(blueprint);

    assert.ok(blueprint.sections.length >= 1);
    assert.ok(sections.length >= 1);
    assert.match(sections[0].id, /^tmp-/);
});

test('analyzeScreenshot uses fallback when vision unavailable', async function () {
    var previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
        var result = await analyze.analyzeScreenshot({
            image_base64: Buffer.from('fake-image').toString('base64'),
            mime_type: 'image/png',
        });

        assert.equal(result.source, 'fallback');
        assert.ok(result.sections.length >= 1);
    } finally {
        if (previous) {
            process.env.OPENAI_API_KEY = previous;
        }
    }
});
