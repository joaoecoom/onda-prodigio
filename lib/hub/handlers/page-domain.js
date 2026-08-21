'use strict';

var domainRouting = require('../page-builder/domain-routing');
var pageRenderer = require('../page-renderer');

function sendHtml(res, html, status) {
    res.statusCode = status || 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    return res.end(html);
}

function errorPage(message, status) {
    return '<!DOCTYPE html><html lang="pt-PT"><head><meta charset="UTF-8"><title>Página</title></head><body style="font-family:Inter,sans-serif;padding:2rem"><h1>Página indisponível</h1><p>' +
        String(message || 'Erro').replace(/</g, '&lt;') +
        '</p></body></html>';
}

module.exports = async function handler(req, res) {
    var query = req.query || {};
    var funnel = String(query.funnel || query.funnel_slug || '').trim();
    var page = String(query.page || query.page_slug || '').trim();
    var host = domainRouting.readHost(req);

    if (!funnel || !page) {
        return sendHtml(res, errorPage('Parâmetros em falta: funnel, page.', 400), 400);
    }

    if (domainRouting.isReservedDomainPath('/' + funnel + '/' + page)) {
        return sendHtml(res, errorPage('Rota reservada.', 404), 404);
    }

    try {
        var offer = await domainRouting.resolveFunnelOfferFromHost(host);

        if (!offer) {
            return sendHtml(res, errorPage('Domínio não reconhecido para funil.', 404), 404);
        }

        var result = await pageRenderer.renderPageHtml({
            offerSlug: offer.slug,
            funnelSlug: funnel,
            pageSlug: page,
        }, {
            allowDraft: false,
            authenticatedPreview: false,
            showPreviewBanner: false,
            mode: 'production',
        });

        return sendHtml(res, result.html, 200);
    } catch (error) {
        var status = error.status || 400;

        if (error.code === 'PAGE_DRAFT') {
            status = 403;
        }

        if (error.code === 'NOT_FOUND' || error.code === 'PAGE_ARCHIVED' || error.code === 'OFFER_NOT_FOUND') {
            status = 404;
        }

        if (error.code === 'OFFER_MISMATCH') {
            status = 403;
        }

        return sendHtml(res, errorPage(error.message || 'Erro ao renderizar página.', status), status);
    }
};
