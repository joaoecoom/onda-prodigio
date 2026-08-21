'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var contentUpload = require('../lib/comunidade/content-upload');

test('sanitizeFilename keeps safe characters only', function () {
    assert.equal(contentUpload.sanitizeFilename('Meu PDF (final).pdf'), 'Meu-PDF-final-.pdf');
});

test('normalizeUploadField accepts media fields', function () {
    assert.equal(contentUpload.normalizeUploadField('pdf_path'), 'pdf_path');
    assert.throws(function () {
        contentUpload.normalizeUploadField('evil');
    }, /inválido/);
});

test('buildObjectPath scopes uploads by product and item', function () {
    var path = contentUpload.buildObjectPath('minha-oferta', 'abc-123', 'pdf_path', 'guia.pdf');

    assert.match(path, /^minha-oferta\/abc-123\/pdf-/);
    assert.match(path, /guia\.pdf$/);
});
