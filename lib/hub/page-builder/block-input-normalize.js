'use strict';

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseMaybeJson(value) {
    if (typeof value !== 'string') {
        return value;
    }

    var trimmed = value.trim();

    if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
        return value;
    }

    try {
        return JSON.parse(trimmed);
    } catch (error) {
        return value;
    }
}

function normalizeContent(type, rawContent, block) {
    var content = parseMaybeJson(rawContent);

    if (typeof content === 'string') {
        content = type === 'html'
            ? { html: content }
            : { text: content };
    }

    if (!isPlainObject(content)) {
        content = {};
    }

    if (block.html != null && !content.html) {
        content.html = String(block.html);
    }

    if (block.text != null && !content.text) {
        content.text = String(block.text);
    }

    if (block.label != null && !content.label) {
        content.label = String(block.label);
    }

    if (block.src != null && !content.src) {
        content.src = String(block.src);
    }

    if (block.url != null && !content.url) {
        content.url = String(block.url);
    }

    return content;
}

function normalizeNestedBlock(nested) {
    var block = Object.assign({}, nested || {});
    var type = String(block.type || 'html').trim().toLowerCase();

    block.type = type;
    block.content = normalizeContent(type, block.content, block);

    delete block.html;
    delete block.text;
    delete block.label;
    delete block.src;
    delete block.url;

    return block;
}

function hasRenderableContent(block) {
    var type = String(block.type || '').trim();
    var content = block.content || {};

    if (type === 'html') {
        return Boolean(String(content.html || '').trim());
    }

    if (type === 'heading' || type === 'text') {
        return Boolean(String(content.text || content.html || '').trim());
    }

    if (type === 'image') {
        return Boolean(String(content.src || content.url || '').trim());
    }

    if (type === 'video') {
        return Boolean(String(content.url || content.src || '').trim());
    }

    if (type === 'button') {
        return Boolean(String(content.label || (block.settings && block.settings.label) || '').trim());
    }

    if (type === 'spacer') {
        return true;
    }

    return Object.keys(content).length > 0;
}

function assertBlockHasContent(block) {
    if (hasRenderableContent(block)) {
        return;
    }

    var type = String(block.type || 'block');
    var message = 'Block ' + type + ' criado sem conteúdo. ';

    if (type === 'html') {
        message += 'Obrigatório: content.html com HTML completo (headlines multi-cor, spans, estilos).';
    } else if (type === 'heading' || type === 'text') {
        message += 'Obrigatório: content.text ou content.html.';
    } else {
        message += 'Inclui content preenchido.';
    }

    var error = new Error(message);
    error.code = 'BLOCK_CONTENT_EMPTY';
    throw error;
}

module.exports = {
    normalizeNestedBlock: normalizeNestedBlock,
    normalizeContent: normalizeContent,
    hasRenderableContent: hasRenderableContent,
    assertBlockHasContent: assertBlockHasContent,
};
