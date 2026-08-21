'use strict';

var metricsAuth = require('../../metrics/auth');
var pageRenderer = require('../page-renderer/page-renderer');
var scope = require('../page-builder/scope');
var save = require('../page-builder/save');
var defaults = require('../page-builder/defaults');
var funnelEngine = require('../funnel-engine');
var templateCatalog = require('../page-builder/templates/catalog');
var templateApply = require('../page-builder/templates/apply');
var aiAssistant = require('../page-builder/ai-assistant');
var aiContext = require('../page-builder/ai-context');
var aiTasks = require('../ai-tasks');
var screenshotAnalyze = require('../page-builder/screenshot/analyze');
var pageUrls = require('../page-builder/urls');
var pagePublish = require('../page-builder/publish');
var pageRevisions = require('../page-builder/revisions');
var seedTemplate = require('../page-builder/seed-template');

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string' && req.body.trim()) {
        return JSON.parse(req.body);
    }

    return {};
}

function sendError(res, error) {
    var mapped = scope.mapError(error);
    return res.status(mapped.status).json({
        error: mapped.message,
        code: mapped.code,
    });
}

function readSlugs(query, body) {
    var source = body || query || {};
    return {
        offer: String(source.offer || source.offer_slug || query.offer || '').trim(),
        funnel: String(source.funnel || source.funnel_slug || query.funnel || '').trim(),
        page: String(source.page || source.page_slug || query.page || '').trim(),
    };
}

async function handleGetTree(req, res) {
    var slugs = readSlugs(req.query, null);

    if (!slugs.offer || !slugs.funnel || !slugs.page) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel, page.' });
    }

    try {
        var scoped = await scope.resolveEditorScope(slugs.offer, slugs.funnel, slugs.page);
        var urls = pageUrls.buildPageUrls(slugs, scoped.offer);

        return res.status(200).json({
            offer: {
                id: scoped.offer.id,
                slug: scoped.offer.slug,
                name: scoped.offer.name,
                funnel_domain: scoped.offer.funnel_domain || '',
            },
            tree: scoped.tree,
            components: defaults.COMPONENT_LIBRARY,
            templates: templateCatalog.listTemplates(),
            editor_url: '/editor/' + encodeURIComponent(slugs.offer) + '/' +
                encodeURIComponent(slugs.funnel) + '/' + encodeURIComponent(slugs.page),
            preview_url: urls.preview_url,
            public_url: pageUrls.pickLiveUrl(urls),
            page_urls: urls,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleListFunnels(req, res) {
    var offerSlug = String(req.query.offer || req.query.offer_slug || '').trim();

    if (!offerSlug) {
        return res.status(400).json({ error: 'offer em falta.' });
    }

    try {
        var data = await scope.listFunnelsForOffer(offerSlug);
        return res.status(200).json(data);
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleListPages(req, res) {
    var offerSlug = String(req.query.offer || req.query.offer_slug || '').trim();
    var funnelSlug = String(req.query.funnel || req.query.funnel_slug || '').trim();

    if (!offerSlug || !funnelSlug) {
        return res.status(400).json({ error: 'offer e funnel em falta.' });
    }

    try {
        var data = await scope.listPagesForFunnel(offerSlug, funnelSlug);

        data.pages = (data.pages || []).map(function (page) {
            var urls = pageUrls.buildPageUrls({
                offer: data.offer.slug,
                funnel: data.funnel.slug,
                page: page.slug,
            }, data.offer);

            return Object.assign({}, page, {
                preview_url: urls.preview_url,
                public_url: pageUrls.pickLiveUrl(urls),
                page_urls: urls,
            });
        });

        return res.status(200).json(data);
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleCreateFunnel(req, res) {
    var body = await readJsonBody(req);
    var offerSlug = String(body.offer || body.offer_slug || req.query.offer || '').trim();

    if (!offerSlug) {
        return res.status(400).json({ error: 'offer em falta.' });
    }

    try {
        var offer = await scope.resolveOfferBySlug(offerSlug);
        var funnel = await funnelEngine.createFunnel(offer.id, {
            name: body.name,
            slug: body.slug,
            type: body.type || 'custom',
            status: body.status || 'draft',
            description: body.description || '',
            is_default: Boolean(body.is_default),
        });

        return res.status(201).json({
            ok: true,
            offer: { id: offer.id, slug: offer.slug, name: offer.name },
            funnel: funnel,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleCreatePage(req, res) {
    var body = await readJsonBody(req);
    var offerSlug = String(body.offer || body.offer_slug || req.query.offer || '').trim();
    var funnelSlug = String(body.funnel || body.funnel_slug || '').trim();
    var templateId = String(body.template_id || '').trim();

    if (!offerSlug || !funnelSlug) {
        return res.status(400).json({ error: 'offer e funnel em falta.' });
    }

    try {
        var offer = await scope.resolveOfferBySlug(offerSlug);
        var funnels = await funnelEngine.listFunnels(offer.id);
        var funnel = funnels.find(function (row) {
            return row.slug === funnelSlug;
        });

        if (!funnel) {
            return res.status(404).json({ error: 'Funnel não encontrado.', code: 'NOT_FOUND' });
        }

        var page = await funnelEngine.createPage(offer.id, funnel.id, {
            name: body.name,
            slug: body.slug,
            type: body.type || 'sales',
            status: body.status || 'draft',
        });

        var seededSections = 0;

        if (templateId) {
            seededSections = await seedTemplate.seedPageFromTemplate(offer.id, page.id, templateId);
        }

        var slugs = {
            offer: offer.slug,
            funnel: funnel.slug,
            page: page.slug,
        };
        var urls = pageUrls.buildPageUrls(slugs, offer);

        return res.status(201).json({
            ok: true,
            offer: { id: offer.id, slug: offer.slug, name: offer.name },
            funnel: { id: funnel.id, slug: funnel.slug, name: funnel.name },
            page: page,
            seeded_sections: seededSections,
            editor_url: '/editor/' + encodeURIComponent(slugs.offer) + '/' +
                encodeURIComponent(slugs.funnel) + '/' + encodeURIComponent(slugs.page),
            preview_url: urls.preview_url,
            public_url: pageUrls.pickLiveUrl(urls),
            page_urls: urls,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleRender(req, res) {
    var body = await readJsonBody(req);
    var tree = body.tree;

    if (!tree || !tree.page || !Array.isArray(tree.sections)) {
        return res.status(400).json({ error: 'tree inválida.' });
    }

    try {
        var html = pageRenderer.renderPageBody(tree, {
            mode: 'preview',
            showPreviewBanner: false,
        });

        return res.status(200).json({ html: html });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleSave(req, res) {
    var body = await readJsonBody(req);
    var slugs = readSlugs(req.query, body);
    var baseline = body.baseline;
    var working = body.tree;

    if (!slugs.offer || !slugs.funnel || !slugs.page) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel, page.' });
    }

    if (!baseline || !working) {
        return res.status(400).json({ error: 'baseline e tree são obrigatórios.' });
    }

    try {
        var scoped = await scope.resolveEditorScope(slugs.offer, slugs.funnel, slugs.page);
        var savedTree = await save.saveTree(
            scoped.offer.id,
            scoped.tree.page.id,
            baseline,
            working
        );

        if (body.create_revision) {
            await pageRevisions.createRevision({
                offer_id: scoped.offer.id,
                page_id: scoped.tree.page.id,
                tree: savedTree,
                source: body.revision_source || 'manual',
                label: body.revision_label || '',
            });
        }

        return res.status(200).json({
            ok: true,
            tree: savedTree,
            mutations: save.buildMutations(baseline, working),
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleListTemplates(req, res) {
    try {
        return res.status(200).json(templateCatalog.listTemplates());
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleMaterializeTemplate(req, res) {
    var body = await readJsonBody(req);
    var templateId = String(body.template_id || req.query.template || '').trim();

    if (!templateId) {
        return res.status(400).json({ error: 'template_id em falta.' });
    }

    try {
        var payload = templateApply.materializeTemplateSections(templateId);
        return res.status(200).json(payload);
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleAiLocal(req, res) {
    var body = await readJsonBody(req);
    var slugs = readSlugs(req.query, body);
    var prompt = String(body.prompt || '').trim();
    var tree = body.tree;
    var selected = body.selected || { type: null, id: null };

    if (!slugs.offer || !slugs.funnel || !slugs.page) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel, page.' });
    }

    if (!tree || !tree.page || !Array.isArray(tree.sections)) {
        return res.status(400).json({ error: 'tree inválida.' });
    }

    try {
        var scoped = await scope.resolveEditorScope(slugs.offer, slugs.funnel, slugs.page);

        if (tree.page.id !== scoped.tree.page.id) {
            return res.status(403).json({
                error: 'A árvore enviada não corresponde à página autorizada.',
                code: 'CROSS_PAGE_ACCESS',
            });
        }

        var result = aiAssistant.applyLocalAssistant(prompt, tree, selected);

        return res.status(200).json(Object.assign({}, result, {
            offer_id: scoped.offer.id,
            page_id: scoped.tree.page.id,
        }));
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleAiAgentTask(req, res) {
    var body = await readJsonBody(req);
    var slugs = readSlugs(req.query, body);
    var prompt = String(body.prompt || '').trim();

    if (!slugs.offer || !slugs.funnel || !slugs.page) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel, page.' });
    }

    if (!prompt) {
        return res.status(400).json({ error: 'prompt em falta.' });
    }

    try {
        var scoped = await scope.resolveEditorScope(slugs.offer, slugs.funnel, slugs.page);
        var pageScope = {
            offer_id: scoped.offer.id,
            offer_slug: scoped.offer.slug,
            funnel_id: scoped.tree.funnel.id,
            funnel_slug: scoped.tree.funnel.slug,
            page_id: scoped.tree.page.id,
            page_slug: scoped.tree.page.slug,
        };
        var agentPrompt = aiContext.buildPageBuilderAgentPrompt(pageScope, prompt);
        var task = await aiTasks.createTask({
            prompt: agentPrompt,
            offer_id: scoped.offer.id,
            task_type: 'page_builder',
            requested_by: 'page-builder',
            metadata: {
                source: 'page-builder',
                page_builder: pageScope,
                user_prompt: prompt,
            },
        });

        return res.status(201).json({
            task: task,
            page_scope: pageScope,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleScreenshotAnalyze(req, res) {
    var body = await readJsonBody(req);
    var slugs = readSlugs(req.query, body);

    if (!slugs.offer || !slugs.funnel || !slugs.page) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel, page.' });
    }

    try {
        await scope.resolveEditorScope(slugs.offer, slugs.funnel, slugs.page);
        var result = await screenshotAnalyze.analyzeScreenshot({
            image_base64: body.image_base64,
            mime_type: body.mime_type,
        });

        return res.status(200).json({
            source: result.source,
            model: result.model,
            summary: result.summary,
            confidence: result.blueprint.confidence,
            notes: result.blueprint.notes,
            sections: result.sections,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handlePublish(req, res) {
    var body = await readJsonBody(req);
    var slugs = readSlugs(req.query, body);
    var status = body.status === 'draft' ? 'draft' : 'published';
    var baseline = body.baseline;
    var working = body.tree;

    if (!slugs.offer || !slugs.funnel || !slugs.page) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel, page.' });
    }

    try {
        var scoped = await scope.resolveEditorScope(slugs.offer, slugs.funnel, slugs.page);
        var tree = await pagePublish.publishPage({
            offer_id: scoped.offer.id,
            page_id: scoped.tree.page.id,
            status: status,
            baseline: baseline,
            working: working,
        });
        var urls = pageUrls.buildPageUrls(slugs, scoped.offer);

        await pageRevisions.createRevision({
            offer_id: scoped.offer.id,
            page_id: scoped.tree.page.id,
            tree: tree,
            source: 'publish',
        });

        return res.status(200).json({
            ok: true,
            status: tree.page.status,
            published_at: tree.page.published_at || null,
            tree: tree,
            preview_url: urls.preview_url,
            public_url: pageUrls.pickLiveUrl(urls),
            page_urls: urls,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleListRevisions(req, res) {
    var slugs = readSlugs(req.query, null);

    if (!slugs.offer || !slugs.funnel || !slugs.page) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel, page.' });
    }

    try {
        var scoped = await scope.resolveEditorScope(slugs.offer, slugs.funnel, slugs.page);
        var revisions = await pageRevisions.listRevisions({
            offer_id: scoped.offer.id,
            page_id: scoped.tree.page.id,
        });

        return res.status(200).json({ revisions: revisions });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleRestoreRevision(req, res) {
    var body = await readJsonBody(req);
    var slugs = readSlugs(req.query, body);
    var revisionId = String(body.revision_id || '').trim();
    var currentTree = body.tree;

    if (!slugs.offer || !slugs.funnel || !slugs.page) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel, page.' });
    }

    if (!revisionId) {
        return res.status(400).json({ error: 'revision_id em falta.' });
    }

    if (!currentTree || !currentTree.page) {
        return res.status(400).json({ error: 'tree inválida.' });
    }

    try {
        var scoped = await scope.resolveEditorScope(slugs.offer, slugs.funnel, slugs.page);

        if (currentTree.page.id !== scoped.tree.page.id) {
            return res.status(403).json({
                error: 'A árvore enviada não corresponde à página autorizada.',
                code: 'CROSS_PAGE_ACCESS',
            });
        }

        var result = await pageRevisions.restoreRevision({
            offer_id: scoped.offer.id,
            page_id: scoped.tree.page.id,
            revision_id: revisionId,
            current_tree: scoped.tree,
        });

        return res.status(200).json({
            ok: true,
            tree: result.tree,
            restored_from: result.restored_from,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleCrossOfferCheck(req, res) {
    var body = await readJsonBody(req);
    var offerSlug = String(body.offer_slug || req.query.offer || '').trim();
    var targetOfferId = String(body.target_offer_id || '').trim();

    if (!offerSlug || !targetOfferId) {
        return res.status(400).json({ error: 'offer_slug e target_offer_id em falta.' });
    }

    try {
        var offer = await scope.resolveOfferBySlug(offerSlug);

        if (targetOfferId !== offer.id) {
            return res.status(403).json({
                error: 'Operação recusada: offer_id não corresponde à oferta autorizada.',
                code: 'CROSS_OFFER_ACCESS',
            });
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    var action = String(req.query.action || req.query.op || '').trim();

    if (req.method === 'GET') {
        if (action === 'hub_page_tree') {
            return handleGetTree(req, res);
        }

        if (action === 'hub_funnel_list') {
            return handleListFunnels(req, res);
        }

        if (action === 'hub_page_list') {
            return handleListPages(req, res);
        }

        if (action === 'hub_page_templates') {
            return handleListTemplates(req, res);
        }

        if (action === 'hub_page_revisions') {
            return handleListRevisions(req, res);
        }

        return res.status(400).json({ error: 'Acção GET inválida.' });
    }

    if (req.method === 'POST') {
        if (action === 'hub_page_render') {
            return handleRender(req, res);
        }

        if (action === 'hub_page_builder_save') {
            return handleSave(req, res);
        }

        if (action === 'hub_page_builder_cross_offer') {
            return handleCrossOfferCheck(req, res);
        }

        if (action === 'hub_page_template_materialize') {
            return handleMaterializeTemplate(req, res);
        }

        if (action === 'hub_page_builder_ai') {
            return handleAiLocal(req, res);
        }

        if (action === 'hub_page_builder_ai_agent') {
            return handleAiAgentTask(req, res);
        }

        if (action === 'hub_page_builder_screenshot') {
            return handleScreenshotAnalyze(req, res);
        }

        if (action === 'hub_page_builder_publish') {
            return handlePublish(req, res);
        }

        if (action === 'hub_page_revision_restore') {
            return handleRestoreRevision(req, res);
        }

        if (action === 'hub_funnel_create') {
            return handleCreateFunnel(req, res);
        }

        if (action === 'hub_page_create') {
            return handleCreatePage(req, res);
        }

        return res.status(400).json({ error: 'Acção POST inválida.' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
};

module.exports.handleGetTree = handleGetTree;
module.exports.handleSave = handleSave;
module.exports.handleRender = handleRender;
