'use strict';

var metricsAuth = require('../../metrics/auth');
var offers = require('../offers');

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string' && req.body.trim()) {
        return JSON.parse(req.body);
    }

    return {};
}

function sendUnauthorized(res) {
    return res.status(401).json({ error: 'Não autorizado.' });
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    try {
        var body = await readJsonBody(req);
        var slug = String(body.slug || body.offer || req.query.slug || req.query.offer || '').trim();

        if (!slug) {
            return res.status(400).json({ error: 'Oferta em falta.' });
        }

        var archived = await offers.archiveOffer(slug);
        var remaining = await offers.listOffers({ forceRefresh: true });

        return res.status(200).json({
            ok: true,
            slug: archived.slug,
            offers: remaining.map(function (offer) {
                return offers.toPublicOffer(offer);
            }),
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Não foi possível apagar a oferta.',
        });
    }
};
