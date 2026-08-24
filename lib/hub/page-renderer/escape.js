function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function stripScriptTags(html) {
    return String(html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

var UNSAFE_URL_PATTERN = /^(javascript:|data:text\/html|vbscript:)/i;

function isSafeUrl(url) {
    var value = String(url || '').trim();

    if (!value) {
        return false;
    }

    if (UNSAFE_URL_PATTERN.test(value)) {
        return false;
    }

    if (value.charAt(0) === '#') {
        return true;
    }

    if (value.charAt(0) === '/') {
        return value.charAt(1) !== '/';
    }

    if (/^https?:\/\//i.test(value)) {
        return true;
    }

    if (/^mailto:/i.test(value)) {
        return true;
    }

    return false;
}

function normalizeHref(url) {
    var value = String(url || '').trim();

    if (!isSafeUrl(value)) {
        return '#';
    }

    return value;
}

function normalizeTarget(target) {
    var value = String(target || '').trim().toLowerCase();

    if (value === '_blank') {
        return '_blank';
    }

    return '_self';
}

module.exports = {
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
    stripScriptTags: stripScriptTags,
    isSafeUrl: isSafeUrl,
    normalizeHref: normalizeHref,
    normalizeTarget: normalizeTarget,
};
