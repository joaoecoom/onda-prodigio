var metricsAuth = require('../../metrics/auth');
var pageRenderer = require('../page-renderer');

function sendHtml(res, html, status) {
    res.statusCode = status || 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(html);
}

function errorPage(message, status) {
    return '<!DOCTYPE html><html lang="pt-PT"><head><meta charset="UTF-8"><title>Preview</title></head><body style="font-family:Inter,sans-serif;padding:2rem"><h1>Preview indisponível</h1><p>' +
        String(message || 'Erro').replace(/</g, '&lt;') +
        '</p></body></html>';
}

module.exports = async function handler(req, res) {
    var query = req.query || {};
    var offer = String(query.offer || query.offer_slug || '').trim();
    var funnel = String(query.funnel || query.funnel_slug || '').trim();
    var page = String(query.page || query.page_slug || '').trim();
    var pageId = String(query.page_id || query.id || '').trim();
    var offerId = String(query.offer_id || '').trim();
    var previewFlag = String(query.preview || query.draft || '').trim() === '1';
    var authenticated = metricsAuth.isAuthorized(req);
    var allowDraft = previewFlag || authenticated;

    try {
        var result;

        if (pageId && offerId) {
            result = await pageRenderer.renderPageHtml({
                offerId: offerId,
                pageId: pageId,
            }, {
                allowDraft: allowDraft,
                authenticatedPreview: authenticated,
                showPreviewBanner: allowDraft,
                mode: allowDraft ? 'preview' : 'production',
            });
        } else if (offer && funnel && page) {
            result = await pageRenderer.renderPageHtml({
                offerSlug: offer,
                funnelSlug: funnel,
                pageSlug: page,
            }, {
                allowDraft: allowDraft,
                authenticatedPreview: authenticated,
                showPreviewBanner: allowDraft,
                mode: allowDraft ? 'preview' : 'production',
            });
        } else {
            return sendHtml(res, errorPage('Parâmetros em falta: offer, funnel, page.', 400), 400);
        }

        return sendHtml(res, result.html, 200);
    } catch (error) {
        var status = error.status || 400;

        if (error.code === 'PAGE_DRAFT' && !allowDraft) {
            status = 403;
        }

        if (error.code === 'NOT_FOUND' || error.code === 'PAGE_ARCHIVED') {
            status = 404;
        }

        if (error.code === 'OFFER_MISMATCH') {
            status = 403;
        }

        return sendHtml(res, errorPage(error.message || 'Erro ao renderizar página.', status), status);
    }
};
