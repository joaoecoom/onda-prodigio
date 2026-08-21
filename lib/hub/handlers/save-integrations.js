var metricsAuth = require('../../metrics/auth');
var offers = require('../offers');
var integrationsStore = require('../integrations-store');
var moduleData = require('../module-data');

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

    var body = await readJsonBody(req);
    var slug = String(body.slug || body.offer || req.query.slug || req.query.offer || '').trim();

    if (!slug) {
        return res.status(400).json({ error: 'Oferta em falta.' });
    }

    var offer = await offers.getOfferBySlug(slug);

    if (!offer) {
        return res.status(404).json({ error: 'Oferta não encontrada.' });
    }

    try {
        var result = await integrationsStore.saveOfferIntegrations(offer.id, body.integrations || body.values || {});
        var module = await moduleData.getModuleData(slug, 'integracoes');

        return res.status(200).json({
            ok: true,
            result: result,
            module: module,
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Não foi possível guardar integrações.',
        });
    }
};
