var offerContext = require('../offer-context');
var funnelEngine = require('../funnel-engine');
var pageRenderer = require('./page-renderer');

function createRenderError(message, code, status) {
    var error = new Error(message);
    error.code = code || 'RENDER_ERROR';
    error.status = status || 400;
    return error;
}

function validateRenderableTree(tree) {
    if (!tree || !tree.page || !tree.funnel) {
        throw createRenderError('Árvore de página inválida.', 'INVALID_TREE', 500);
    }

    if (tree.page.funnel_id !== tree.funnel.id) {
        throw createRenderError('Page não pertence ao funnel.', 'OFFER_MISMATCH', 403);
    }

    if (tree.page.offer_id !== tree.funnel.offer_id) {
        throw createRenderError('Inconsistência offer/funnel/page.', 'OFFER_MISMATCH', 403);
    }

    if (!Array.isArray(tree.sections)) {
        throw createRenderError('Sections em falta.', 'INVALID_TREE', 500);
    }

    return tree;
}

function assertPageVisibility(page, options) {
    var opts = options || {};
    var status = page.status || 'draft';

    if (status === 'published') {
        return;
    }

    if (opts.allowDraft) {
        return;
    }

    if (status === 'archived') {
        throw createRenderError('Página arquivada.', 'PAGE_ARCHIVED', 404);
    }

    throw createRenderError('Página não publicada.', 'PAGE_DRAFT', 403);
}

async function getRenderablePageById(offerId, pageId, options) {
    var context = await offerContext.resolveOfferContext({ offer_id: offerId });
    var tree = validateRenderableTree(await funnelEngine.getPageTree(context.id, pageId));

    if (tree.page.offer_id !== context.id) {
        throw createRenderError('Page não pertence à oferta.', 'OFFER_MISMATCH', 403);
    }

    assertPageVisibility(tree.page, options);

    return {
        offer: context,
        tree: tree,
    };
}

async function getRenderablePageBySlugs(offerSlug, funnelSlug, pageSlug, options) {
    var context = await offerContext.resolveOfferContext({ slug: offerSlug });
    var tree = validateRenderableTree(
        await funnelEngine.getPageTreeBySlugs(context.slug, funnelSlug, pageSlug)
    );

    if (tree.page.offer_id !== context.id) {
        throw createRenderError('Page não pertence à oferta.', 'OFFER_MISMATCH', 403);
    }

    assertPageVisibility(tree.page, options);

    return {
        offer: context,
        tree: tree,
    };
}

async function renderPageHtml(input, options) {
    var payload;
    var opts = options || {};

    if (input.pageId && input.offerId) {
        payload = await getRenderablePageById(input.offerId, input.pageId, opts);
    } else if (input.offerSlug && input.funnelSlug && input.pageSlug) {
        payload = await getRenderablePageBySlugs(
            input.offerSlug,
            input.funnelSlug,
            input.pageSlug,
            opts
        );
    } else {
        throw createRenderError('Identificadores de página em falta.', 'BAD_REQUEST', 400);
    }

    var html = pageRenderer.renderPageDocument(payload.tree, {
        mode: opts.mode || (payload.tree.page.status === 'published' ? 'production' : 'preview'),
        showPreviewBanner: Boolean(opts.showPreviewBanner || payload.tree.page.status !== 'published'),
        offerContext: payload.offer,
    });

    return {
        html: html,
        offer: payload.offer,
        tree: payload.tree,
    };
}

module.exports = {
    getRenderablePageById: getRenderablePageById,
    getRenderablePageBySlugs: getRenderablePageBySlugs,
    renderPageHtml: renderPageHtml,
    validateRenderableTree: validateRenderableTree,
    assertPageVisibility: assertPageVisibility,
};
