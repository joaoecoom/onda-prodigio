'use strict';

var offerContext = require('../offer-context');
var funnelEngine = require('../funnel-engine');
var quizEngine = require('../quiz-engine');

function sendError(res, error) {
    var status = error.status || 400;

    if (error.code === 'NOT_FOUND') {
        status = 404;
    }

    if (error.code === 'CROSS_OFFER_ACCESS' || error.code === 'OFFER_MISMATCH') {
        status = 403;
    }

    return res.status(status).json({
        error: error.message || 'Pedido falhou.',
        code: error.code || 'ERROR',
    });
}

async function resolveFunnel(offerSlug, funnelSlug) {
    var offer = await offerContext.resolveOfferContext({ slug: offerSlug });
    var funnels = await funnelEngine.listFunnels(offer.id);
    var funnel = funnels.find(function (row) { return row.slug === funnelSlug; });

    if (!funnel) {
        var error = new Error('Funnel não encontrado.');
        error.code = 'NOT_FOUND';
        throw error;
    }

    if (funnel.offer_id !== offer.id) {
        var mismatch = new Error('Funnel não pertence à oferta.');
        mismatch.code = 'CROSS_OFFER_ACCESS';
        throw mismatch;
    }

    return { offer: offer, funnel: funnel };
}

async function handleGetQuiz(req, res) {
    var offerSlug = String(req.query.offer || req.query.offer_slug || '').trim();
    var funnelSlug = String(req.query.funnel || req.query.funnel_slug || '').trim();

    if (!offerSlug || !funnelSlug) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel.' });
    }

    try {
        var scoped = await resolveFunnel(offerSlug, funnelSlug);
        var quiz = await quizEngine.loadQuizBundle(scoped.funnel.id, scoped.offer.id);

        return res.status(200).json({
            offer: { id: scoped.offer.id, slug: scoped.offer.slug, name: scoped.offer.name },
            funnel: {
                id: scoped.funnel.id,
                slug: scoped.funnel.slug,
                name: scoped.funnel.name,
                type: scoped.funnel.type,
                settings: scoped.funnel.settings || {},
            },
            quiz: quiz,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleSaveQuiz(req, res) {
    var body = req.body || {};
    var offerSlug = String(body.offer || body.offer_slug || '').trim();
    var funnelSlug = String(body.funnel || body.funnel_slug || '').trim();

    if (!offerSlug || !funnelSlug) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel.' });
    }

    try {
        var scoped = await resolveFunnel(offerSlug, funnelSlug);

        if (scoped.funnel.type !== 'quiz') {
            return res.status(400).json({ error: 'Funnel não é do tipo quiz.' });
        }

        if (body.settings && typeof body.settings === 'object') {
            await funnelEngine.updateFunnel(scoped.offer.id, scoped.funnel.id, {
                settings: Object.assign({}, scoped.funnel.settings || {}, body.settings),
            });
        }

        var saved = await quizEngine.saveQuizDefinition(scoped.offer.id, scoped.funnel.id, {
            questions: body.questions || [],
            results: body.results || [],
        });

        return res.status(200).json({
            ok: true,
            quiz: saved,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handleSubmitQuiz(req, res) {
    var body = req.body || {};
    var offerSlug = String(body.offer || body.offer_slug || '').trim();
    var funnelSlug = String(body.funnel || body.funnel_slug || '').trim();

    if (!offerSlug || !funnelSlug) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel.' });
    }

    try {
        var scoped = await resolveFunnel(offerSlug, funnelSlug);
        var result = await quizEngine.submitQuiz(scoped.offer.id, scoped.funnel.id, {
            answers: body.answers || {},
            email: body.email || '',
            full_name: body.full_name || '',
            phone: body.phone || '',
            metadata: body.metadata || {},
        });

        return res.status(200).json({
            ok: true,
            submission_id: result.submission.id,
            total_score: result.total_score,
            result: result.result,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function handlePublishQuiz(req, res) {
    var body = req.body || {};
    var offerSlug = String(body.offer || body.offer_slug || '').trim();
    var funnelSlug = String(body.funnel || body.funnel_slug || '').trim();
    var pageSlug = String(body.page || body.page_slug || 'quiz').trim();

    if (!offerSlug || !funnelSlug) {
        return res.status(400).json({ error: 'Parâmetros em falta: offer, funnel.' });
    }

    try {
        var scoped = await resolveFunnel(offerSlug, funnelSlug);
        var pages = await funnelEngine.listPages(scoped.offer.id, scoped.funnel.id);
        var page = pages.find(function (row) { return row.slug === pageSlug; });

        if (!page) {
            page = await funnelEngine.createPage(scoped.offer.id, scoped.funnel.id, {
                name: 'Quiz',
                slug: pageSlug,
                type: 'custom',
                status: 'published',
            });
        } else if (page.status !== 'published') {
            page = await funnelEngine.updatePage(scoped.offer.id, page.id, { status: 'published' });
        }

        if (scoped.funnel.status !== 'active') {
            await funnelEngine.updateFunnel(scoped.offer.id, scoped.funnel.id, { status: 'active' });
        }

        return res.status(200).json({
            ok: true,
            page: page,
            preview_url: '/preview/' + encodeURIComponent(offerSlug) + '/' +
                encodeURIComponent(funnelSlug) + '/' + encodeURIComponent(page.slug) + '?preview=1',
            public_url: '/p/' + encodeURIComponent(offerSlug) + '/' +
                encodeURIComponent(funnelSlug) + '/' + encodeURIComponent(page.slug),
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = async function handler(req, res) {
    var action = String(req.query.action || '').trim();

    if (req.method === 'GET' && action === 'hub_quiz_get') {
        return handleGetQuiz(req, res);
    }

    if (req.method === 'POST') {
        if (action === 'hub_quiz_save') {
            return handleSaveQuiz(req, res);
        }

        if (action === 'hub_quiz_submit') {
            return handleSubmitQuiz(req, res);
        }

        if (action === 'hub_quiz_publish') {
            return handlePublishQuiz(req, res);
        }
    }

    return res.status(400).json({ error: 'Acção quiz inválida.' });
};

module.exports.handleGetQuiz = handleGetQuiz;
module.exports.handleSaveQuiz = handleSaveQuiz;
module.exports.handleSubmitQuiz = handleSubmitQuiz;
module.exports.handlePublishQuiz = handlePublishQuiz;
