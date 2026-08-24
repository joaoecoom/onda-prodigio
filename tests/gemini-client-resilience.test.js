'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var geminiClient = require('../lib/llm/gemini-client');

test('isRetryableError detects high demand message', function () {
    assert.equal(
        geminiClient.isRetryableError(503, 'This model is currently experiencing high demand.'),
        true
    );
});

test('isRetryableError detects rate limits', function () {
    assert.equal(geminiClient.isRetryableError(429, 'Rate limit exceeded'), true);
});

test('isRetryableError rejects auth errors', function () {
    assert.equal(geminiClient.isRetryableError(401, 'API key invalid'), false);
});

test('getModelChain deduplicates primary and fallbacks', function () {
    var chain = geminiClient.getModelChain('gemini-2.5-flash');
    assert.equal(chain[0], 'gemini-2.5-flash');
    assert.equal(chain.filter(function (m) { return m === 'gemini-2.5-flash'; }).length, 1);
    assert.ok(chain.length >= 2);
});

test('isModelUnavailableError detects deprecated model message', function () {
    assert.equal(
        geminiClient.isModelUnavailableError(400, 'models/gemini-2.5-pro is no longer available to new users'),
        true
    );
});

test('getModelChain excludes deprecated models and models/ prefix', function () {
    var chain = geminiClient.getModelChain('models/gemini-2.5-pro');
    assert.equal(chain.indexOf('gemini-2.5-pro'), -1);
    assert.ok(chain.indexOf('gemini-3.6-flash') !== -1 || chain.indexOf('gemini-2.5-flash') !== -1);
});

test('isRetryableError ignores deprecated model message', function () {
    assert.equal(
        geminiClient.isRetryableError(400, 'models/gemini-2.5-pro is no longer available to new users'),
        false
    );
});
