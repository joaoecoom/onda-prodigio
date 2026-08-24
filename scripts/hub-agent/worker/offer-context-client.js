'use strict';

var path = require('path');

var DEFAULT_WORKSPACES_ROOT = '/opt/hub-agent/workspaces';
var LEGACY_WORKSPACE_ROOT = '/opt/hub-agent/workspace';
var DEFAULT_BRANCH = 'agent-proof-of-concept';

function getWorkspacesRoot() {
    var root = String(process.env.HUB_AGENT_WORKSPACES_ROOT || DEFAULT_WORKSPACES_ROOT).trim();
    return (root || DEFAULT_WORKSPACES_ROOT).replace(/\/$/, '');
}

function normalizeWorkspaceKey(value) {
    var key = String(value || '').trim().toLowerCase();
    if (!key || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(key)) {
        return '';
    }
    return key;
}

function resolveWorkspaceKeyFromOffer(offer) {
    if (!offer) {
        return '';
    }
    return normalizeWorkspaceKey(offer.agent_workspace_key || offer.slug || offer.id);
}

function resolveWorkspacePathForOffer(offer) {
    var key = resolveWorkspaceKeyFromOffer(offer);
    if (!key) {
        return '';
    }
    return path.resolve(getWorkspacesRoot(), key);
}

function resolveLegacyWorkspacePathForOffer(offer) {
    var key = resolveWorkspaceKeyFromOffer(offer);
    if (!key) {
        return '';
    }
    return path.resolve(LEGACY_WORKSPACE_ROOT, key);
}

function resolveBranchForOffer(offer) {
    var branch = String((offer && offer.agent_branch) || '').trim();
    if (!branch || branch.indexOf('..') !== -1 || branch.startsWith('/') || branch.startsWith('-')) {
        return DEFAULT_BRANCH;
    }
    if (!/^[a-zA-Z0-9._\/-]+$/.test(branch)) {
        return DEFAULT_BRANCH;
    }
    return branch;
}

function isPathUnderRoot(candidatePath, rootPath) {
    var candidate = path.resolve(candidatePath);
    var root = path.resolve(rootPath);
    return candidate === root || candidate.startsWith(root + path.sep);
}

function isAuthorizedWorkspacePath(workspacePath, offer) {
    var candidate = path.resolve(String(workspacePath || ''));
    if (!candidate || candidate === '/') {
        return false;
    }

    var expected = resolveWorkspacePathForOffer(offer);
    var legacy = resolveLegacyWorkspacePathForOffer(offer);

    if (expected && candidate === expected) {
        return true;
    }

    if (legacy && candidate === legacy) {
        return true;
    }

    return false;
}

function buildAgentContextSummary(offer, workspacePath, branch, primaryProduct) {
    var lines = [
        'You are operating inside HUB DR Ecoom.',
        '',
        'Offer:',
        '- ID: ' + offer.id,
        '- Name: ' + offer.name,
        '- Slug: ' + offer.slug,
        '- Status: ' + offer.status,
        '- Mode: ' + offer.mode,
    ];

    if (offer.funnel_domain) {
        lines.push('- Funnel domain: ' + offer.funnel_domain);
    }

    if (offer.primary_product_id) {
        lines.push('- Primary product ID: ' + offer.primary_product_id);
    }

    if (primaryProduct && primaryProduct.name) {
        lines.push('- Primary product name: ' + primaryProduct.name);
    }

    if (offer.branding && offer.branding.from_name) {
        lines.push('- Branding from_name: ' + offer.branding.from_name);
    }

    lines.push('');
    lines.push('Page Engine hierarchy:');
    lines.push('Offer → Funnel → Page → Section → Block');
    lines.push('');
    lines.push('HUB tools (MCP hub-page-tools):');
    lines.push('- Use ONLY the provided HUB tools for funnel/page/section/block operations.');
    lines.push('- Do NOT manipulate the database directly.');
    lines.push('- Do NOT run SQL against Supabase.');
    lines.push('- Do NOT use raw HTML blocks unless explicitly required.');
    lines.push('- Prefer structured blocks: heading, text, image, video, button, spacer.');
    lines.push('- All operations must stay inside offer_id: ' + offer.id);
    lines.push('- Use get_page_tree to inspect page structure before/after changes.');
    lines.push('');
    lines.push('Workspace:');
    lines.push('- Path: ' + workspacePath);
    lines.push('- Branch: ' + branch);
    lines.push('');
    lines.push('Rules:');
    lines.push('- Do not expose or request secrets.');
    lines.push('- Do not deploy, migrate, or force-push unless explicitly asked in the task.');
    lines.push('- Stay within the authorized workspace for this offer.');
    lines.push('- Do not modify other offers (e.g. Onda Prodígio) unless explicitly assigned.');

    return lines.join('\n');
}

function buildAgentPrompt(offer, workspacePath, branch, primaryProduct, userPrompt) {
    return buildAgentContextSummary(offer, workspacePath, branch, primaryProduct) +
        '\n\nTask:\n' + String(userPrompt || '').trim();
}

module.exports = {
    getWorkspacesRoot: getWorkspacesRoot,
    resolveWorkspacePathForOffer: resolveWorkspacePathForOffer,
    resolveLegacyWorkspacePathForOffer: resolveLegacyWorkspacePathForOffer,
    resolveBranchForOffer: resolveBranchForOffer,
    isAuthorizedWorkspacePath: isAuthorizedWorkspacePath,
    buildAgentPrompt: buildAgentPrompt,
};
