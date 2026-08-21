'use strict';

var offerContext = require('../offer-context');
var funnelEngine = require('../funnel-engine');

function mapError(error) {
    var status = 400;
    var code = error.code || 'ERROR';

    if (code === 'NOT_FOUND' || code === 'PAGE_ARCHIVED') {
        status = 404;
    }

    if (code === 'OFFER_MISMATCH' || code === 'CROSS_OFFER_ACCESS') {
        status = 403;
    }

    if (code === 'PAGE_DRAFT') {
        status = 403;
    }

    if (code === 'IMAGE_TOO_LARGE') {
        status = 413;
    }

    if (code === 'VISION_API_ERROR') {
        status = 502;
    }

    return {
        status: status,
        code: code,
        message: error.message || 'Erro no page builder.',
    };
}

async function resolveOfferBySlug(offerSlug) {
    var slug = String(offerSlug || '').trim();

    if (!slug) {
        throw Object.assign(new Error('offer_slug em falta.'), { code: 'VALIDATION_ERROR' });
    }

    return offerContext.resolveOfferContext({ slug: slug });
}

async function resolveEditorScope(offerSlug, funnelSlug, pageSlug) {
    var offer = await resolveOfferBySlug(offerSlug);
    var tree = await funnelEngine.getPageTreeBySlugs(offerSlug, funnelSlug, pageSlug);

    if (tree.page.offer_id !== offer.id) {
        throw Object.assign(new Error('Page não pertence à oferta.'), { code: 'OFFER_MISMATCH' });
    }

    return {
        offer: offer,
        tree: tree,
    };
}

async function listFunnelsForOffer(offerSlug) {
    var offer = await resolveOfferBySlug(offerSlug);
    var funnels = await funnelEngine.listFunnels(offer.id);

    return {
        offer: {
            id: offer.id,
            slug: offer.slug,
            name: offer.name,
        },
        funnels: funnels,
    };
}

async function listPagesForFunnel(offerSlug, funnelSlug) {
    var offer = await resolveOfferBySlug(offerSlug);
    var funnels = await funnelEngine.listFunnels(offer.id);
    var match = funnels.find(function (row) {
        return row.slug === funnelSlug;
    });

    if (!match) {
        throw Object.assign(new Error('Funnel não encontrado.'), { code: 'NOT_FOUND' });
    }

    var pages = await funnelEngine.listPages(offer.id, match.id);

    return {
        offer: {
            id: offer.id,
            slug: offer.slug,
            name: offer.name,
            funnel_domain: offer.funnel_domain || '',
            funnel_url: offer.funnel_url || '',
            site_url: offer.site_url || '',
        },
        funnel: match,
        pages: pages,
    };
}

module.exports = {
    mapError: mapError,
    resolveOfferBySlug: resolveOfferBySlug,
    resolveEditorScope: resolveEditorScope,
    listFunnelsForOffer: listFunnelsForOffer,
    listPagesForFunnel: listPagesForFunnel,
};
