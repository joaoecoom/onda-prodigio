'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var path = require('path');

var workspaceResolver = require('../lib/hub/workspace-resolver');
var offerContext = require('../lib/hub/offer-context');

var SAMPLE_ONDA = {
    id: 'onda-prodigio',
    slug: 'onda-prodigio',
    name: 'Onda Prodígio',
    status: 'active',
    mode: 'live',
    primary_product_id: 'onda-prodigio',
    site_url: 'https://onda-prodigio.vercel.app',
    funnel_url: 'https://onda-prodigio.vercel.app',
    funnel_domain: 'onda-prodigio.vercel.app',
    hub_domain: 'hub-dr-ecoom.vercel.app',
    agent_workspace_key: 'onda-prodigio',
    agent_branch: 'agent-proof-of-concept',
    branding: { from_name: 'Angela Campos — Onda Prodígio' },
    settings: {},
    meta_accounts: [],
    checkouts: [],
};

var SAMPLE_AI_TEST = {
    id: 'ai-test-offer',
    slug: 'ai-test-offer',
    name: 'AI Test Offer',
    status: 'draft',
    mode: 'test',
    primary_product_id: null,
    funnel_domain: '',
    hub_domain: 'hub-dr-ecoom.vercel.app',
    agent_workspace_key: 'ai-test-offer',
    agent_branch: 'agent-proof-of-concept',
    branding: { from_name: 'AI Test Offer' },
    settings: { purpose: 'phase2_isolation_test' },
    meta_accounts: [],
    checkouts: [],
};

test('resolveWorkspacePathForOffer uses workspaces root + key', function () {
    var original = process.env.HUB_AGENT_WORKSPACES_ROOT;
    process.env.HUB_AGENT_WORKSPACES_ROOT = '/opt/hub-agent/workspaces';

    var resolved = workspaceResolver.resolveWorkspacePathForOffer(SAMPLE_ONDA);
    assert.equal(resolved, path.resolve('/opt/hub-agent/workspaces/onda-prodigio'));

    process.env.HUB_AGENT_WORKSPACES_ROOT = original;
});

test('resolveWorkspacePathForOffer isolates offers', function () {
    var onda = workspaceResolver.resolveWorkspacePathForOffer(SAMPLE_ONDA);
    var ai = workspaceResolver.resolveWorkspacePathForOffer(SAMPLE_AI_TEST);
    assert.notEqual(onda, ai);
    assert.match(ai, /ai-test-offer$/);
});

test('isAuthorizedWorkspacePath accepts expected and legacy paths', function () {
    var expected = workspaceResolver.resolveWorkspacePathForOffer(SAMPLE_ONDA);
    var legacy = workspaceResolver.resolveLegacyWorkspacePathForOffer(SAMPLE_ONDA);

    assert.equal(workspaceResolver.isAuthorizedWorkspacePath(expected, SAMPLE_ONDA), true);
    assert.equal(workspaceResolver.isAuthorizedWorkspacePath(legacy, SAMPLE_ONDA), true);
    assert.equal(workspaceResolver.isAuthorizedWorkspacePath('/etc', SAMPLE_ONDA), false);
});

test('resolveBranchForOffer falls back safely', function () {
    assert.equal(workspaceResolver.resolveBranchForOffer(SAMPLE_ONDA), 'agent-proof-of-concept');
    assert.equal(workspaceResolver.resolveBranchForOffer({ agent_branch: '../evil' }), 'agent-proof-of-concept');
});

test('buildAgentContextSummary excludes secrets wording', function () {
    var context = {
        id: 'ai-test-offer',
        slug: 'ai-test-offer',
        name: 'AI Test Offer',
        status: 'draft',
        mode: 'test',
        funnel_domain: '',
        primary_product_id: null,
        products: [],
        branding: { from_name: 'AI Test Offer' },
        workspace: {
            path: '/opt/hub-agent/workspaces/ai-test-offer',
            branch: 'agent-proof-of-concept',
        },
    };

    var summary = offerContext.buildAgentContextSummary(context);
    assert.match(summary, /AI Test Offer/);
    assert.match(summary, /Do not expose or request secrets/);
    assert.doesNotMatch(summary, /service_role|sk_live|api_key/i);
});

test('buildAgentPrompt wraps user task', function () {
    var context = {
        id: 'x',
        slug: 'x',
        name: 'X',
        status: 'draft',
        mode: 'test',
        primary_product_id: null,
        products: [],
        branding: {},
        workspace: { path: '/tmp/x', branch: 'agent-proof-of-concept' },
    };

    context.agentContext = offerContext.buildAgentContextSummary(context);
    var prompt = offerContext.buildAgentPrompt(context, 'Cria ficheiro TEST.md');

    assert.match(prompt, /Task:/);
    assert.match(prompt, /Cria ficheiro TEST\.md/);
});

test('normalizeIdentifier extracts fields', function () {
    var id = offerContext.normalizeIdentifier({
        offer_id: 'abc',
        slug: 'My Offer',
        hostname: 'Example.COM',
    });

    assert.equal(id.offer_id, 'abc');
    assert.equal(id.slug, 'my offer');
    assert.equal(id.domain, 'example.com');
});

test('sanitizeIntegrationsForAgent masks secret-like keys', function () {
    var safe = offerContext.sanitizeIntegrationsForAgent({
        meta_pixel_id: '123',
        stripe_secret_key: 'sk_live_x',
        meta_access_token: 'token',
    });

    assert.equal(safe.meta_pixel_id, '123');
    assert.equal(safe.stripe_secret_key, '[configured]');
    assert.equal(safe.meta_access_token, '[configured]');
});
