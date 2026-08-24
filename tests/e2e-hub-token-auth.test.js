'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var auth = require('../lib/metrics/auth');

test('isAuthorized accepts E2E_HUB_TOKEN when configured', function () {
    var previous = process.env.E2E_HUB_TOKEN;
    process.env.E2E_HUB_TOKEN = 'e2e-test-token-only';

    try {
        assert.equal(auth.isAuthorized({
            headers: { authorization: 'Bearer e2e-test-token-only' },
        }), true);
        assert.equal(auth.isAuthorized({
            headers: { authorization: 'Bearer wrong' },
        }), false);
    } finally {
        if (previous == null) {
            delete process.env.E2E_HUB_TOKEN;
        } else {
            process.env.E2E_HUB_TOKEN = previous;
        }
    }
});
