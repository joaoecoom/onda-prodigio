'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var metaAccountsStore = require('../lib/hub/meta-accounts-store');

test('normalizeAccountsInput deduplicates and strips act_ prefix', function () {
    var result = metaAccountsStore.normalizeAccountsInput([
        { account_id: 'act_111', label: 'Principal' },
        { account_id: '111', label: 'Duplicada' },
        { account_id: '222', label: 'Secundária' },
    ]);

    assert.equal(result.length, 2);
    assert.equal(result[0].account_id, '111');
    assert.equal(result[0].label, 'Principal');
    assert.equal(result[0].is_default, true);
    assert.equal(result[1].account_id, '222');
});

test('normalizeAccountsInput returns empty array for invalid input', function () {
    assert.deepEqual(metaAccountsStore.normalizeAccountsInput(null), []);
    assert.deepEqual(metaAccountsStore.normalizeAccountsInput([{ account_id: '  ' }]), []);
});
