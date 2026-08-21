'use strict';

var path = require('path');

var { getSupabaseAdmin } = require('../supabase-admin');

var BUCKET = 'comunidade-uploads';

var FIELD_TO_PREFIX = {
    pdf_path: 'pdf',
    video_path: 'video',
    audio_path: 'audio',
    image_url: 'image',
};

function sanitizeFilename(filename) {
    var base = path.basename(String(filename || 'file').trim()) || 'file';

    return base
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 120);
}

function normalizeUploadField(field) {
    var normalized = String(field || '').trim();

    if (!FIELD_TO_PREFIX[normalized]) {
        throw new Error('Campo de upload inválido.');
    }

    return normalized;
}

function buildObjectPath(productId, itemId, field, filename) {
    var prefix = FIELD_TO_PREFIX[field];
    var safeProduct = String(productId || 'product').replace(/[^a-zA-Z0-9_-]+/g, '-');
    var safeItem = String(itemId || 'item').replace(/[^a-zA-Z0-9-]+/g, '-');
    var safeName = sanitizeFilename(filename);

    return safeProduct + '/' + safeItem + '/' + prefix + '-' + Date.now() + '-' + safeName;
}

function getPublicUrl(objectPath) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var result = admin.storage.from(BUCKET).getPublicUrl(objectPath);

    return (result.data && result.data.publicUrl) || '';
}

async function prepareContentUpload(options) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var productId = String(options.productId || '').trim();
    var itemId = String(options.itemId || '').trim();
    var field = normalizeUploadField(options.field);
    var filename = String(options.filename || 'file').trim();

    if (!productId || !itemId) {
        throw new Error('Produto ou item em falta.');
    }

    var objectPath = buildObjectPath(productId, itemId, field, filename);
    var signed = await admin.storage.from(BUCKET).createSignedUploadUrl(objectPath);

    if (signed.error || !signed.data) {
        throw new Error(
            (signed.error && signed.error.message) ||
            'Não foi possível preparar o upload.'
        );
    }

    return {
        bucket: BUCKET,
        object_path: objectPath,
        signed_url: signed.data.signedUrl,
        token: signed.data.token,
        public_url: getPublicUrl(objectPath),
        field: field,
    };
}

async function uploadContentFileBase64(options) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var productId = String(options.productId || '').trim();
    var itemId = String(options.itemId || '').trim();
    var field = normalizeUploadField(options.field);
    var filename = String(options.filename || 'file').trim();
    var contentType = String(options.contentType || 'application/octet-stream').trim();
    var base64 = String(options.contentBase64 || '').trim();

    if (!base64) {
        throw new Error('Ficheiro em falta.');
    }

    var buffer = Buffer.from(base64, 'base64');

    if (!buffer.length) {
        throw new Error('Ficheiro vazio.');
    }

    if (buffer.length > 3 * 1024 * 1024) {
        throw new Error('Ficheiro demasiado grande para upload directo (máx. 3 MB). Usa ficheiro menor ou URL externa.');
    }

    var objectPath = buildObjectPath(productId, itemId, field, filename);
    var uploadResult = await admin.storage.from(BUCKET).upload(objectPath, buffer, {
        contentType: contentType,
        upsert: true,
    });

    if (uploadResult.error) {
        throw new Error(uploadResult.error.message || 'Não foi possível enviar o ficheiro.');
    }

    return {
        bucket: BUCKET,
        object_path: objectPath,
        public_url: getPublicUrl(objectPath),
        field: field,
    };
}

module.exports = {
    BUCKET: BUCKET,
    sanitizeFilename: sanitizeFilename,
    normalizeUploadField: normalizeUploadField,
    buildObjectPath: buildObjectPath,
    getPublicUrl: getPublicUrl,
    prepareContentUpload: prepareContentUpload,
    uploadContentFileBase64: uploadContentFileBase64,
};
