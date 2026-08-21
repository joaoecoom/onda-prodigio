'use strict';

var catalog = require('../templates/catalog');
var templateApply = require('../templates/apply');
var schema = require('./schema');
var vision = require('./vision');

var ALLOWED_MIME_TYPES = {
    'image/png': true,
    'image/jpeg': true,
    'image/jpg': true,
    'image/webp': true,
};

var MAX_BASE64_LENGTH = 6 * 1024 * 1024;

function normalizeMimeType(value) {
    var mime = String(value || 'image/png').trim().toLowerCase();
    return mime === 'image/jpg' ? 'image/jpeg' : mime;
}

function validateImageInput(imageBase64, mimeType) {
    var base64 = String(imageBase64 || '').trim();

    if (!base64) {
        throw Object.assign(new Error('Imagem em falta.'), { code: 'INVALID_IMAGE' });
    }

    if (base64.length > MAX_BASE64_LENGTH) {
        throw Object.assign(new Error('Imagem demasiado grande (máx. ~4MB).'), { code: 'IMAGE_TOO_LARGE' });
    }

    var normalizedMime = normalizeMimeType(mimeType);

    if (!ALLOWED_MIME_TYPES[normalizedMime]) {
        throw Object.assign(new Error('Formato de imagem não suportado.'), { code: 'INVALID_IMAGE' });
    }

    return {
        imageBase64: base64,
        mimeType: normalizedMime,
    };
}

function buildFallbackBlueprint() {
    var template = catalog.resolveTemplate('sales-basic');

    if (!template) {
        return schema.normalizeBlueprint({
            sections: [{
                type: 'hero',
                settings: { label: 'Hero' },
                blocks: [
                    { type: 'heading', content: { text: 'Headline detectada no screenshot' }, settings: { level: 1, alignment: 'center' } },
                    { type: 'text', content: { text: 'Adiciona OPENAI_API_KEY para análise visual completa do screenshot.' }, settings: { alignment: 'center' } },
                    { type: 'button', content: { label: 'Call to action', href: '#' }, settings: { variant: 'primary', alignment: 'center', target: '_self' } },
                ],
            }],
            confidence: 'low',
            notes: 'Fallback estrutural — vision API indisponível.',
            page_type: 'sales',
        });
    }

    return schema.normalizeBlueprint({
        sections: template.sections,
        confidence: 'low',
        notes: 'Fallback: template sales-basic aplicado porque a vision API não está configurada.',
        page_type: 'sales',
    });
}

function materializeBlueprint(blueprint) {
    var scratch = { sections: [] };
    templateApply.appendSectionsToTree(scratch, blueprint.sections || []);
    return scratch.sections;
}

async function analyzeScreenshot(input) {
    var validated = validateImageInput(input && input.image_base64, input && input.mime_type);
    var blueprint = null;
    var source = 'fallback';

    try {
        blueprint = await vision.analyzeScreenshotVision(validated.imageBase64, validated.mimeType);

        if (blueprint && blueprint.sections.length) {
            source = 'vision';
        }
    } catch (error) {
        if (error.code === 'VISION_API_ERROR' || error.code === 'INVALID_VISION_RESPONSE') {
            throw error;
        }
    }

    if (!blueprint || !blueprint.sections.length) {
        blueprint = buildFallbackBlueprint();
        source = 'fallback';
    }

    var sections = materializeBlueprint(blueprint);

    if (!sections.length) {
        throw Object.assign(new Error('Não foi possível gerar sections a partir do screenshot.'), { code: 'EMPTY_RESULT' });
    }

    return {
        source: source,
        model: source === 'vision' ? vision.getVisionModel() : null,
        summary: source === 'vision'
            ? 'Screenshot analisado — ' + sections.length + ' section(s) gerada(s).'
            : 'Vision indisponível — aplicado fallback estrutural (' + sections.length + ' section(s)).',
        blueprint: blueprint,
        sections: sections,
    };
}

module.exports = {
    ALLOWED_MIME_TYPES: ALLOWED_MIME_TYPES,
    validateImageInput: validateImageInput,
    parseVisionPayload: schema.parseVisionPayload,
    buildFallbackBlueprint: buildFallbackBlueprint,
    materializeBlueprint: materializeBlueprint,
    analyzeScreenshot: analyzeScreenshot,
};
