'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var offerSetupWizard = require('../lib/hub/offer-setup-wizard');
var offerProvisioning = require('../lib/hub/offer-provisioning');
var registry = require('../lib/hub/agent-tools/registry');

test('provisionOffer export survives offers circular require', function () {
    assert.equal(typeof offerProvisioning.provisionOffer, 'function');
    assert.equal(typeof offerProvisioning.updateMainCheckout, 'function');
});

test('resolveStripeConnectionStatus returns not_configured without keys', function () {
    var status = offerSetupWizard.resolveStripeConnectionStatus({ mode: 'test' }, {});
    assert.equal(status.status, 'not_configured');
    assert.equal(status.label, 'NOT CONFIGURED');
});

test('resolveStripeConnectionStatus returns TEST MODE when keys configured', function () {
    var status = offerSetupWizard.resolveStripeConnectionStatus({ mode: 'test' }, {
        stripe_test_secret_key: true,
        stripe_test_publishable_key: true,
    });
    assert.equal(status.status, 'connected');
    assert.equal(status.label, 'TEST MODE');
});

test('resolveStripeConnectionStatus returns LIVE MODE', function () {
    var status = offerSetupWizard.resolveStripeConnectionStatus({ mode: 'live' }, {
        stripe_secret_key: true,
        stripe_publishable_key: true,
    });
    assert.equal(status.status, 'connected');
    assert.equal(status.label, 'LIVE MODE');
});

test('resolveStripeConnectionStatus returns ERROR for partial keys', function () {
    var status = offerSetupWizard.resolveStripeConnectionStatus({ mode: 'test' }, {
        stripe_test_secret_key: true,
    });
    assert.equal(status.status, 'error');
    assert.equal(status.label, 'ERROR');
});

test('wizard exposes nine orchestration steps', function () {
    assert.equal(offerSetupWizard.WIZARD_STEPS.length, 9);
    assert.equal(offerSetupWizard.WIZARD_STEPS[0].id, 'offer');
    assert.equal(offerSetupWizard.WIZARD_STEPS[8].id, 'ready');
});

test('agent registry includes phase F operational tools', function () {
    assert.ok(registry.isAllowedTool('provision_offer'));
    assert.ok(registry.isAllowedTool('validate_offer'));
    assert.ok(registry.isAllowedTool('launch_offer'));
});
