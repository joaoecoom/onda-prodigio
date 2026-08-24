'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var guide = require('../lib/hub/page-builder/visual-replication-guide');

test('looksLikeFacebookComments detects replica + image intent', function () {
    var refs = [{ type: 'image' }];
    assert.equal(guide.looksLikeFacebookComments('faz exactamente igual à referência', refs), true);
    assert.equal(guide.looksLikeFacebookComments('comentários facebook', []), true);
});

test('buildReferenceReplicationPrompt includes bubble and name color', function () {
    var prompt = guide.buildReferenceReplicationPrompt(
        [{ type: 'image' }],
        'cria exactamente como na imagem'
    );
    assert.match(prompt, /#F0F2F5/);
    assert.match(prompt, /#385898/);
    assert.match(prompt, /#0866FF/);
    assert.match(prompt, /border-left/);
});
