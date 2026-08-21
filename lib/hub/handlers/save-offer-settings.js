'use strict';

var metricsAuth = require('../../metrics/auth');
var offers = require('../offers');
var offerSettings = require('../offer-settings');

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
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        var body = await readJsonBody(req);
        var slug = String(body.slug || body.offer || req.query.slug || req.query.offer || '').trim();
        var patch = body.settings || body.patch || body;

        if (!slug) {
            return res.status(400).json({ error: 'Oferta em falta.' });
        }

        var updated = await offerSettings.updateOfferSettings(slug, patch);
        var refreshed = await offers.getOfferBySlug(slug, { forceRefresh: true });

        return res.status(200).json({
            ok: true,
            offer: offers.toPublicOffer(refreshed || updated),
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Não foi possível guardar definições.',
        });
    }
};
