'use strict';

var assert = require('assert');
var integrationResolver = require('../lib/hub/integration-resolver');
var offerFlows = require('../lib/hub/offer-flows');
var stripeCatalog = require('../lib/hub/stripe-catalog');
var runtime = require('../lib/hub/offer-runtime-config');

function testResolveNoEnvLeakForNewOffers() {
    var value = integrationResolver.resolveIntegrationValue(
        'nova-oferta-teste',
        'gmail_user',
        '',
        { includeSecrets: true }
    );
    assert.strictEqual(value, '', 'nova oferta não herda env Gmail');
}

function testFlowNormalization() {
    var def = offerFlows.normalizeDefinition({
        nodes: [
            { type: 'wait', minutes: '15', label: 'Wait' },
            { type: 'email', subject: 'Hi', body: 'Body' },
        ],
    });
    assert.strictEqual(def.nodes.length, 2);
    assert.strictEqual(def.nodes[0].minutes, 15);
    assert.strictEqual(def.nodes[1].type, 'email');
}

function testLookupKey() {
    var key = stripeCatalog.buildLookupKey('fruta-da-epoca', 'bump', 'ebook');
    assert.strictEqual(key, 'hub-fruta-da-epoca-bump-ebook');
}

function testGmailConfigFromIntegrations() {
    var config = runtime.gmailConfigFromIntegrations({
        gmail_user: 'vendas@empresa.com',
        gmail_app_password: 'abcd efgh',
        gmail_from_name: 'Vendas',
    });
    assert.strictEqual(config.user, 'vendas@empresa.com');
    assert.strictEqual(config.appPassword, 'abcdefgh');
    assert.strictEqual(config.fromName, 'Vendas');
}

function testWhatsAppConfigReady() {
    var ready = runtime.whatsappConfigFromIntegrations({
        whatsapp_enabled: 'true',
        evolution_api_url: 'https://evo.example.com',
        evolution_api_key: 'secret',
        evolution_instance_name: 'main',
    });
    assert.strictEqual(ready.ready, true);

    var notReady = runtime.whatsappConfigFromIntegrations({
        whatsapp_enabled: 'false',
        evolution_api_url: 'https://evo.example.com',
        evolution_api_key: 'secret',
        evolution_instance_name: 'main',
    });
    assert.strictEqual(notReady.ready, false);
}

testResolveNoEnvLeakForNewOffers();
testFlowNormalization();
testLookupKey();
testGmailConfigFromIntegrations();
testWhatsAppConfigReady();

console.log('hub-multi-offer-foundation.test.js OK');
