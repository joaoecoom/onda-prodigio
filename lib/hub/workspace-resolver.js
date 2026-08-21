var path = require('path');

var DEFAULT_WORKSPACES_ROOT = '/opt/hub-agent/workspaces';
var LEGACY_WORKSPACE_ROOT = '/opt/hub-agent/workspace';
var DEFAULT_BRANCH = 'agent-proof-of-concept';

function getWorkspacesRoot() {
    var root = String(process.env.HUB_AGENT_WORKSPACES_ROOT || DEFAULT_WORKSPACES_ROOT).trim();

    if (!root) {
        return DEFAULT_WORKSPACES_ROOT;
    }

    return root.replace(/\/$/, '');
}

function normalizeWorkspaceKey(value) {
    var key = String(value || '').trim().toLowerCase();

    if (!key) {
        return '';
    }

    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(key)) {
        return '';
    }

    return key;
}

function resolveWorkspaceKeyFromOffer(offer) {
    if (!offer) {
        return '';
    }

    var fromColumn = normalizeWorkspaceKey(offer.agent_workspace_key);

    if (fromColumn) {
        return fromColumn;
    }

    return normalizeWorkspaceKey(offer.slug || offer.id);
}

function resolveWorkspacePathForOffer(offer) {
    var key = resolveWorkspaceKeyFromOffer(offer);

    if (!key) {
        return '';
    }

    var root = getWorkspacesRoot();
    var resolved = path.resolve(root, key);

    if (!resolved.startsWith(path.resolve(root) + path.sep) && resolved !== path.resolve(root)) {
        return '';
    }

    return resolved;
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
    var workspacesRoot = getWorkspacesRoot();
    var legacyRoot = LEGACY_WORKSPACE_ROOT;

    if (expected && candidate === expected) {
        return true;
    }

    if (legacy && candidate === legacy) {
        return true;
    }

    if (expected && isPathUnderRoot(candidate, workspacesRoot)) {
        return candidate === expected;
    }

    if (legacy && isPathUnderRoot(candidate, legacyRoot)) {
        return candidate === legacy;
    }

    return false;
}

function listAllowedWorkspaceRoots() {
    return [getWorkspacesRoot(), LEGACY_WORKSPACE_ROOT];
}

module.exports = {
    DEFAULT_WORKSPACES_ROOT: DEFAULT_WORKSPACES_ROOT,
    LEGACY_WORKSPACE_ROOT: LEGACY_WORKSPACE_ROOT,
    DEFAULT_BRANCH: DEFAULT_BRANCH,
    getWorkspacesRoot: getWorkspacesRoot,
    normalizeWorkspaceKey: normalizeWorkspaceKey,
    resolveWorkspaceKeyFromOffer: resolveWorkspaceKeyFromOffer,
    resolveWorkspacePathForOffer: resolveWorkspacePathForOffer,
    resolveLegacyWorkspacePathForOffer: resolveLegacyWorkspacePathForOffer,
    resolveBranchForOffer: resolveBranchForOffer,
    isAuthorizedWorkspacePath: isAuthorizedWorkspacePath,
    isPathUnderRoot: isPathUnderRoot,
    listAllowedWorkspaceRoots: listAllowedWorkspaceRoots,
};
