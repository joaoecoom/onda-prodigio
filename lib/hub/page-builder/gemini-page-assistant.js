'use strict';

var aiOrchestrator = require('../ai-orchestrator');
var scope = require('./scope');
var pageUrls = require('./urls');
var funnelEngine = require('../funnel-engine');
var offers = require('../offers');
var save = require('./save');
var patchEngine = require('./patch-engine');
var builderContext = require('./builder-context');
var timing = require('./timing');

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
}

async function resolveScope(input, offerSlug, funnelSlug, pageSlug) {
    var clientTree = input.tree;

    if (clientTree && clientTree.sections && input.page_id) {
        var offer = await offers.getOfferBySlug(offerSlug);

        if (!offer) {
            throw new Error('Oferta não encontrada.');
        }

        var page = clientTree.page || {
            id: input.page_id,
            slug: pageSlug,
            name: pageSlug,
        };
        var funnel = clientTree.funnel || {
            slug: funnelSlug,
            name: funnelSlug,
        };

        return {
            offer: offer,
            tree: clientTree,
            page: page,
            funnel: funnel,
        };
    }

    if (!funnelSlug || !pageSlug) {
        return null;
    }

    return scope.resolveEditorScope(offerSlug, funnelSlug, pageSlug);
}

async function loadTreeAfterRun(offerSlug, refs, input, scoped) {
    var funnelSlug = String(input.funnel_slug || input.funnel || '').trim();
    var pageSlug = String(input.page_slug || input.page || '').trim() || refs.page_slug;
    var pageId = refs.page_id || input.page_id;

    if (pageId) {
        var offer = await offers.getOfferBySlug(offerSlug);

        if (!offer) {
            return null;
        }

        var page = await funnelEngine.getPage(offer.id, pageId);
        var funnel = await funnelEngine.getFunnel(offer.id, page.funnel_id);
        var tree = await funnelEngine.getPageTree(offer.id, page.id);
        return packLoaded(offerSlug, funnel, page, tree, funnelSlug);
    }

    if (scoped && scoped.tree && !(refs && refs.page_id)) {
        return packLoaded(
            offerSlug,
            scoped.funnel || scoped.tree.funnel,
            scoped.page || scoped.tree.page,
            scoped.tree,
            funnelSlug || (scoped.funnel && scoped.funnel.slug) || scoped.tree.funnel.slug
        );
    }

    if (funnelSlug && pageSlug) {
        var resolved = await scope.resolveEditorScope(offerSlug, funnelSlug, pageSlug);
        return packLoaded(offerSlug, resolved.funnel, resolved.page, resolved.tree, funnelSlug);
    }

    return null;
}

function packLoaded(offerSlug, funnel, page, tree, funnelSlug) {
    var resolvedFunnelSlug = funnel.slug || funnelSlug;
    var urls = pageUrls.buildPageUrls({
        offer: offerSlug,
        funnel: resolvedFunnelSlug,
        page: page.slug,
    }, { slug: offerSlug });

    return {
        page: page,
        funnel: funnel,
        tree: tree,
        preview_url: urls.preview_url,
        editor_url: '/studio/' + encodeURIComponent(offerSlug) + '/' +
            encodeURIComponent(resolvedFunnelSlug) + '/' + encodeURIComponent(page.slug),
        studio_url: '/studio/' + encodeURIComponent(offerSlug) + '/' +
            encodeURIComponent(resolvedFunnelSlug) + '/' + encodeURIComponent(page.slug),
    };
}

async function tryFastPathPersist(input, scoped, timer) {
    if (patchEngine.isComplexRequest(input.message, input.references)) {
        return null;
    }

    var baseline = input.baseline || input.tree || scoped.tree;
    var workingTree = input.tree || scoped.tree;
    var fast = patchEngine.tryFastPath(
        input.message,
        workingTree,
        input.selection,
        input.selected_section
    );

    timer.mark('fast_path_ms');

    if (!fast.applied) {
        if (fast.reason === 'invalid_video_url') {
            return {
                ok: true,
                mode: 'fast',
                reply: fast.message,
                applied: false,
                error: fast.message,
            };
        }

        return null;
    }

    var offerRecord = scoped.offer;
    var pageRecord = scoped.page || (scoped.tree && scoped.tree.page);
    var funnelRecord = scoped.funnel || (scoped.tree && scoped.tree.funnel);

    if (!pageRecord || !pageRecord.id) {
        throw new Error('Page não encontrada no scope.');
    }

    var savedTree = await save.saveTree(
        offerRecord.id,
        pageRecord.id,
        baseline,
        fast.tree
    );
    timer.mark('db_write_ms');

    var urls = pageUrls.buildPageUrls({
        offer: offerRecord.slug,
        funnel: funnelRecord.slug,
        page: pageRecord.slug,
    }, offerRecord);

    return {
        ok: true,
        mode: 'fast',
        applied: true,
        reply: fast.summary,
        changes_summary: patchEngine.summarizePatches(fast.patches) || fast.summary,
        patches: fast.patches,
        tree: savedTree,
        page: pageRecord,
        funnel: funnelRecord,
        preview_url: urls.preview_url,
        editor_url: '/studio/' + encodeURIComponent(offerRecord.slug) + '/' +
            encodeURIComponent(funnelRecord.slug) + '/' + encodeURIComponent(pageRecord.slug),
        selected: fast.selected,
        steps: [{ tool: 'fast_path', label: fast.summary, ok: true }],
        tool_calls: [],
    };
}

async function chat(input) {
    var timer = timing.createTimer();
    var offerSlug = String(input.slug || input.offer || '').trim();
    var funnelSlug = String(input.funnel_slug || input.funnel || '').trim();
    var pageSlug = String(input.page_slug || input.page || '').trim();
    var message = String(input.message || '').trim();
    var createPage = input.create_page || null;
    var references = input.references || [];

    if (!offerSlug) {
        throw new Error('Oferta em falta.');
    }

    if (!message && (!references || !references.length)) {
        throw new Error('Mensagem em falta.');
    }

    if (!funnelSlug && createPage && createPage.funnel_slug) {
        funnelSlug = String(createPage.funnel_slug).trim();
    }

    var scoped = null;

    if (funnelSlug && pageSlug) {
        scoped = await resolveScope(input, offerSlug, funnelSlug, pageSlug);
        timer.mark('scope_ms');
    }

    if (scoped && !patchEngine.isComplexRequest(message, references)) {
        var fastResult = await tryFastPathPersist(input, scoped, timer);

        if (fastResult) {
            timer.mark('total_ms');
            fastResult.metrics = timer.toJSON();
            fastResult.offer = {
                id: scoped.offer.id,
                slug: scoped.offer.slug,
                name: scoped.offer.name,
            };
            return fastResult;
        }
    }

    var enrichedMessage = message || 'Modela com base nas referências anexadas.';

    if (createPage && createPage.name) {
        enrichedMessage += '\n\n[CRIAR PÁGINA] name="' + createPage.name + '"';
        enrichedMessage += ' slug="' + (createPage.slug || slugify(createPage.name)) + '"';
        enrichedMessage += ' type="' + (createPage.type || 'sales') + '"';
        if (funnelSlug) {
            enrichedMessage += ' funnel_slug="' + funnelSlug + '"';
        }
        enrichedMessage += '. Depois constrói secções/blocks no Page Engine (não HTML solto).';
    }

    var pageRecord = scoped && (scoped.page || (scoped.tree && scoped.tree.page));
    var funnelRecord = scoped && (scoped.funnel || (scoped.tree && scoped.tree.funnel));

    var extraContext = builderContext.buildMinimalGeminiContext({
        offer_id: scoped && scoped.offer.id,
        page_id: (pageRecord && pageRecord.id) || input.page_id,
        message: enrichedMessage,
        selection: input.selection,
        selected_section: input.selected_section,
        client_tree: input.tree || (scoped && scoped.tree),
        client_page_summary: input.page_summary || input.client_page_summary,
        references: references,
    });

    var result = await aiOrchestrator.run({
        slug: offerSlug,
        mode: 'page_builder',
        message: enrichedMessage,
        messages: input.messages || [],
        references: references,
        funnel_slug: funnelSlug,
        page_slug: pageSlug,
        page_id: (pageRecord && pageRecord.id) || input.page_id,
        funnel_id: (funnelRecord && funnelRecord.id) || input.funnel_id,
        offer_id: scoped && scoped.offer.id,
        offer_name: scoped && scoped.offer.name,
        selection: input.selection,
        selected_section: input.selected_section,
        extraContext: extraContext,
        skipPageTreeLoad: Boolean(input.tree || input.page_summary),
        client_tree: input.tree,
        client_page_summary: input.page_summary,
    });

    timer.mark('gemini_total_ms');

    var knownPageId = (pageRecord && pageRecord.id) || input.page_id;
    var loaded = null;

    if (result.tool_calls && result.tool_calls.length && knownPageId) {
        loaded = await loadTreeAfterRun(offerSlug, Object.assign({ page_id: knownPageId }, result.page_refs || {}), {
            funnel_slug: funnelSlug,
            page_slug: pageSlug,
            page_id: knownPageId,
        }, scoped);
        timer.mark('db_read_ms');
    } else if (scoped) {
        loaded = packLoaded(
            offerSlug,
            scoped.funnel || scoped.tree.funnel,
            scoped.page || scoped.tree.page,
            scoped.tree,
            funnelSlug
        );
    }

    var changesSummary = buildChangesSummary(result.tool_calls);

    timer.mark('total_ms');

    return {
        ok: true,
        mode: 'gemini',
        reply: result.reply,
        changes_summary: changesSummary,
        steps: result.steps,
        tool_calls: result.tool_calls,
        context: result.context,
        metrics: Object.assign({}, result.metrics || {}, timer.toJSON()),
        page: loaded && loaded.page,
        funnel: loaded && loaded.funnel,
        tree: loaded && loaded.tree,
        preview_url: loaded && loaded.preview_url,
        editor_url: loaded && loaded.editor_url,
        offer: result.offer,
    };
}

function buildChangesSummary(toolCalls) {
    if (!toolCalls || !toolCalls.length) {
        return '';
    }

    var okCount = toolCalls.filter(function (row) { return row.ok; }).length;

    if (okCount === 1) {
        var row = toolCalls.find(function (r) { return r.ok; });
        var labels = {
            create_section: 'Bloco criado',
            update_section: 'Bloco actualizado',
            update_block: 'Conteúdo actualizado',
            delete_section: 'Bloco removido',
            reorder_sections: 'Ordem actualizada',
            apply_page_patches: 'Alterações aplicadas',
        };
        return labels[row.name] || 'Alteração aplicada';
    }

    return okCount + ' alterações aplicadas';
}

module.exports = {
    chat: chat,
};
