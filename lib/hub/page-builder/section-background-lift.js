'use strict';

/**
 * Lift background colors from HTML wrappers onto section.styles so the
 * renderer can paint full-bleed section backgrounds (edge to edge).
 * AI often puts background+max-width on an inner div — that makes colors
 * "stop in the middle".
 */

var BG_COLOR_RE = /background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)/i;
var MAX_WIDTH_RE = /max-width\s*:/i;
var FB_MARKERS_RE = /#F0F2F5|#385898|Gosto|Responder|border-radius:\s*18px/i;

function extractFirstBackground(html) {
    var match = String(html || '').match(BG_COLOR_RE);
    if (!match) {
        return null;
    }
    var color = String(match[1] || '').trim().toLowerCase();
    if (!color || color === 'transparent' || color === 'inherit' || color === 'initial') {
        return null;
    }
    return match[1].trim();
}

function looksLikeConstrainedBand(html) {
    var text = String(html || '');
    return MAX_WIDTH_RE.test(text) && BG_COLOR_RE.test(text);
}

function looksLikeFacebookComments(html) {
    return FB_MARKERS_RE.test(String(html || ''));
}

function liftSectionBackgroundFromHtml(html, styles) {
    var next = Object.assign({}, styles || {});
    var payload = String(html || '');

    if (next.backgroundColor) {
        if (!next.padding && looksLikeFacebookComments(payload)) {
            next.padding = '24px 16px';
        }
        return next;
    }

    if (looksLikeFacebookComments(payload)) {
        next.backgroundColor = '#F0F2F5';
        if (!next.padding) {
            next.padding = '24px 16px';
        }
        return next;
    }

    if (looksLikeConstrainedBand(payload)) {
        var color = extractFirstBackground(payload);
        if (color) {
            next.backgroundColor = color;
            if (!next.padding) {
                next.padding = '40px 16px';
            }
        }
    }

    return next;
}

module.exports = {
    extractFirstBackground: extractFirstBackground,
    looksLikeConstrainedBand: looksLikeConstrainedBand,
    looksLikeFacebookComments: looksLikeFacebookComments,
    liftSectionBackgroundFromHtml: liftSectionBackgroundFromHtml,
};
