'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var contentAdmin = require('../lib/comunidade/content-admin');

test('buildModuleTree groups lessons under modules and sorts by sort_order', function () {
    var rows = [
        { id: 'm2', product_id: 'onda-prodigio', parent_id: null, title: 'M2', sort_order: 20 },
        { id: 'a2', product_id: 'onda-prodigio', parent_id: 'm1', title: 'A2', sort_order: 20 },
        { id: 'm1', product_id: 'onda-prodigio', parent_id: null, title: 'M1', sort_order: 10 },
        { id: 'a1', product_id: 'onda-prodigio', parent_id: 'm1', title: 'A1', sort_order: 10 },
    ];

    var tree = contentAdmin.buildModuleTree(rows);

    assert.equal(tree.length, 2);
    assert.equal(tree[0].id, 'm1');
    assert.equal(tree[1].id, 'm2');
    assert.equal(tree[0].aulas.length, 2);
    assert.equal(tree[0].aulas[0].id, 'a1');
    assert.equal(tree[0].aulas[1].id, 'a2');
});

test('buildModuleTree returns empty list for no rows', function () {
    assert.deepEqual(contentAdmin.buildModuleTree([]), []);
});
