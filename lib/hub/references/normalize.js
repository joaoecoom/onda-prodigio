'use strict';

var visualGuide = require('../page-builder/visual-replication-guide');

var IMAGE_MIMES = {
    'image/png': true,
    'image/jpeg': true,
    'image/jpg': true,
    'image/webp': true,
    'image/gif': true,
};

var VIDEO_MIMES = {
    'video/mp4': true,
    'video/webm': true,
    'video/quicktime': true,
};

var MAX_ATTACHMENTS = 8;
var MAX_IMAGE_BYTES = 4 * 1024 * 1024;
var MAX_VIDEO_BYTES = 12 * 1024 * 1024;

function normalizeMime(value) {
    var mime = String(value || '').trim().toLowerCase();

    if (mime === 'image/jpg') {
        return 'image/jpeg';
    }

    return mime;
}

function estimateBase64Bytes(base64) {
    var raw = String(base64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    return Math.floor((raw.length * 3) / 4);
}

function normalizeLink(ref) {
    var url = String(ref.url || ref.href || '').trim();

    if (!/^https?:\/\//i.test(url)) {
        return null;
    }

    return {
        type: 'link',
        url: url,
        name: String(ref.name || ref.label || '').trim().slice(0, 120),
    };
}

function normalizeMedia(ref, type) {
    var mime = normalizeMime(ref.mime_type || ref.mimeType);
    var allowed = type === 'video' ? VIDEO_MIMES : IMAGE_MIMES;

    if (!allowed[mime]) {
        return null;
    }

    var base64 = String(ref.data_base64 || ref.dataBase64 || '').trim();

    if (!base64) {
        return null;
    }

    var bytes = estimateBase64Bytes(base64);
    var maxBytes = type === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (bytes > maxBytes) {
        throw Object.assign(new Error(
            (type === 'video' ? 'Vídeo' : 'Imagem') + ' demasiado grande (máx. ' +
            Math.round(maxBytes / (1024 * 1024)) + 'MB).'
        ), { code: 'REFERENCE_TOO_LARGE' });
    }

    return {
        type: type,
        mime_type: mime,
        data_base64: base64.replace(/^data:[^;]+;base64,/, ''),
        name: String(ref.name || '').trim().slice(0, 120),
    };
}

function normalizeReferences(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }

    var out = [];

    raw.forEach(function (ref) {
        if (!ref || out.length >= MAX_ATTACHMENTS) {
            return;
        }

        var type = String(ref.type || '').trim().toLowerCase();
        var normalized = null;

        if (type === 'link') {
            normalized = normalizeLink(ref);
        } else if (type === 'video') {
            normalized = normalizeMedia(ref, 'video');
        } else if (type === 'image') {
            normalized = normalizeMedia(ref, 'image');
        }

        if (normalized) {
            out.push(normalized);
        }
    });

    return out;
}

function buildReferencePrompt(references, message) {
    var refs = references || [];
    var lines = [];
    var links = refs.filter(function (row) { return row.type === 'link'; });
    var images = refs.filter(function (row) { return row.type === 'image'; });
    var videos = refs.filter(function (row) { return row.type === 'video'; });

    if (!links.length && !images.length && !videos.length) {
        return '';
    }

    lines.push('REFERÊNCIAS DO UTILIZADOR — fidelidade visual obrigatória:');

    links.forEach(function (link, index) {
        lines.push('- Link ' + (index + 1) + ': ' + link.url +
            (link.name ? ' — ' + link.name : ''));
    });

    if (images.length) {
        lines.push('- ' + images.length + ' imagem(ns): analisa e REPLICA FIEL (layout, cores, tipografia, ícones).');
        lines.push(visualGuide.buildReferenceReplicationPrompt(refs, message));
    }

    if (videos.length) {
        lines.push('- ' + videos.length + ' vídeo(s): usa ritmo e fluxo como inspiração.');
    }

    return lines.join('\n');
}

function buildUserParts(message, references) {
    var refs = references || [];
    var parts = [];
    var text = String(message || '').trim();
    var refPrompt = buildReferencePrompt(refs, text);

    if (refPrompt) {
        text = text ? (text + '\n\n' + refPrompt) : refPrompt;
    }

    if (text) {
        parts.push({ text: text });
    }

    refs.forEach(function (ref) {
        if ((ref.type === 'image' || ref.type === 'video') && ref.data_base64 && ref.mime_type) {
            parts.push({
                inlineData: {
                    mimeType: ref.mime_type,
                    data: ref.data_base64,
                },
            });
        }
    });

    if (!parts.length) {
        parts.push({ text: 'Modela com base nas referências anexadas.' });
    }

    return parts;
}

module.exports = {
    MAX_ATTACHMENTS: MAX_ATTACHMENTS,
    normalizeReferences: normalizeReferences,
    buildReferencePrompt: buildReferencePrompt,
    buildUserParts: buildUserParts,
};
