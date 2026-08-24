'use strict';

var metricsAuth = require('../../metrics/auth');
var offers = require('../offers');
var checkoutBuilder = require('../checkout-builder');

function sendUnauthorized(res) {
    return res.status(401).json({ error: 'Não autorizado.' });
}

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string' && req.body.trim()) {
        return JSON.parse(req.body);
    }

    return {};
}

module.exports = async function handler(req, res) {
    var action = String(req.query.action || req.query.checkout_action || '').trim();
    var slug = String(req.query.slug || req.query.offer || '').trim();
    var isPublicTemplate = action === 'hub_checkout_template' && req.method === 'GET';

    if (!isPublicTemplate && !metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    try {
        if (req.method === 'GET' && action === 'hub_checkout_template') {
            if (!slug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var offer = await offers.getOfferBySlug(slug);

            if (!offer) {
                return res.status(404).json({ error: 'Oferta não encontrada.' });
            }

            var template = await checkoutBuilder.getTemplate(offer.id);

            return res.status(200).json({ ok: true, template: template });
        }

        if (req.method === 'GET' && action === 'hub_checkout_builder') {
            if (!slug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var offerRow = await offers.getOfferBySlug(slug);

            if (!offerRow) {
                return res.status(404).json({ error: 'Oferta não encontrada.' });
            }

            var context = await checkoutBuilder.getCheckoutContext(offerRow.id);

            return res.status(200).json({ ok: true, module: context });
        }

        if (req.method === 'POST' && action === 'hub_save_checkout_template') {
            var body = await readJsonBody(req);
            var saveSlug = slug || String(body.slug || body.offer || '').trim();

            if (!saveSlug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var saveOffer = await offers.getOfferBySlug(saveSlug);

            if (!saveOffer) {
                return res.status(404).json({ error: 'Oferta não encontrada.' });
            }

            var saved = await checkoutBuilder.saveTemplate(saveOffer.id, {
                html_top: body.html_top,
                html_bottom: body.html_bottom,
                custom_css: body.custom_css,
                settings: body.settings,
            });

            return res.status(200).json({ ok: true, template: saved });
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Operação de checkout falhou.',
        });
    }
};
