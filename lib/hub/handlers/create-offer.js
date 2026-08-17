var metricsAuth = require('../../metrics/auth');
var offers = require('../offers');
var modules = require('../modules');

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
        var created = await offers.createOffer(body);
        var offer = await offers.getOfferBySlug(created.slug, { forceRefresh: true });
        var payload = offers.toPublicOffer(offer || created);

        payload.modules = modules.getModulesForOffer(offer || created);

        return res.status(201).json({ offer: payload });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Não foi possível criar a oferta.',
        });
    }
};
