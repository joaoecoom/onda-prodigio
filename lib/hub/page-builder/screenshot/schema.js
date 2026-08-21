'use strict';

var constants = require('../../funnel-engine/constants');
var defaults = require('../defaults');

var MAX_TEXT_LENGTH = 8000;
var MAX_SECTIONS = 12;
var MAX_BLOCKS_PER_SECTION = 20;
var ALLOWED_BLOCK_TYPES = constants.BLOCK_TYPES.filter(function (type) {
    return type !== 'html';
});

function trimText(value, max) {
    return String(value || '').trim().slice(0, max || MAX_TEXT_LENGTH);
}

function sanitizeHref(value) {
    var href = trimText(value, 2048);

    if (!href || href === '#') {
        return '#';
    }

    if (/^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('#')) {
        return href;
    }

    return '#';
}

function normalizeAlignment(value, fallback) {
    var alignment = String(value || fallback || 'left').toLowerCase();

    if (alignment === 'center' || alignment === 'right' || alignment === 'left') {
        return alignment;
    }

    return fallback || 'left';
}

function normalizeBlock(block) {
    var source = block && typeof block === 'object' ? block : {};

    if (source.type === 'html') {
        return null;
    }

    var type = ALLOWED_BLOCK_TYPES.indexOf(source.type) >= 0 ? source.type : 'text';
    var template = defaults.defaultBlock(type);
    var content = Object.assign({}, template.content || {}, source.content || {});
    var settings = Object.assign({}, template.settings || {}, source.settings || {});

    if (type === 'heading') {
        content.text = trimText(content.text, 500) || template.content.text;
        settings.level = Math.min(Math.max(parseInt(settings.level, 10) || 1, 1), 6);
        settings.alignment = normalizeAlignment(settings.alignment, 'center');
    } else if (type === 'text') {
        content.text = trimText(content.text) || template.content.text;
        settings.alignment = normalizeAlignment(settings.alignment, 'left');
    } else if (type === 'button') {
        content.label = trimText(content.label, 120) || template.content.label;
        content.href = sanitizeHref(content.href);
        settings.variant = trimText(settings.variant, 40) || 'primary';
        settings.alignment = normalizeAlignment(settings.alignment, 'center');
        settings.target = settings.target === '_blank' ? '_blank' : '_self';
    } else if (type === 'image') {
        content.src = trimText(content.src, 2048);
        content.alt = trimText(content.alt, 240);
        settings.alignment = normalizeAlignment(settings.alignment, 'center');
        settings.width = trimText(settings.width, 40) || '100%';
    } else if (type === 'video') {
        content.url = trimText(content.url, 2048);
        settings.controls = settings.controls !== false;
        settings.autoplay = Boolean(settings.autoplay);
        settings.muted = Boolean(settings.muted);
        settings.aspectRatio = trimText(settings.aspectRatio, 20) || '16 / 9';
    } else if (type === 'spacer') {
        settings.height = trimText(settings.height, 20) || '48px';
    }

    return {
        type: type,
        content: content,
        settings: settings,
        styles: {},
    };
}

function normalizeSection(section) {
    var source = section && typeof section === 'object' ? section : {};
    var blocks = Array.isArray(source.blocks) ? source.blocks.slice(0, MAX_BLOCKS_PER_SECTION) : [];
    var type = trimText(source.type, 40) || 'custom';

    return {
        type: type,
        settings: Object.assign({ label: trimText(source.settings && source.settings.label, 80) || type }, source.settings || {}),
        styles: source.styles && typeof source.styles === 'object' ? source.styles : {},
        blocks: blocks.map(normalizeBlock).filter(Boolean).filter(function (block) {
            return block.type !== 'spacer' || blocks.length > 1;
        }),
    };
}

function normalizeBlueprint(input) {
    var payload = input && typeof input === 'object' ? input : {};
    var sections = Array.isArray(payload.sections) ? payload.sections.slice(0, MAX_SECTIONS) : [];

    return {
        sections: sections.map(normalizeSection).filter(function (section) {
            return section.blocks.length > 0;
        }),
        confidence: trimText(payload.confidence, 20) || 'unknown',
        notes: trimText(payload.notes, 1000),
        page_type: trimText(payload.page_type, 40) || 'sales',
    };
}

function parseVisionPayload(rawText) {
    var text = String(rawText || '').trim();

    if (!text) {
        throw Object.assign(new Error('Resposta vazia do modelo.'), { code: 'INVALID_VISION_RESPONSE' });
    }

    var jsonText = text;

    if (text.indexOf('{') >= 0) {
        jsonText = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    }

    var parsed;

    try {
        parsed = JSON.parse(jsonText);
    } catch (error) {
        throw Object.assign(new Error('Resposta JSON inválida do modelo.'), { code: 'INVALID_VISION_RESPONSE' });
    }

    return normalizeBlueprint(parsed);
}

module.exports = {
    ALLOWED_BLOCK_TYPES: ALLOWED_BLOCK_TYPES,
    MAX_SECTIONS: MAX_SECTIONS,
    normalizeBlueprint: normalizeBlueprint,
    normalizeSection: normalizeSection,
    normalizeBlock: normalizeBlock,
    parseVisionPayload: parseVisionPayload,
};
