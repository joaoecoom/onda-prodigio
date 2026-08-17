var metricsAuth = require('../../metrics/auth');
var offers = require('../offers');
var modules = require('../modules');
var integrationKeys = require('../integration-keys');

function sendUnauthorized(res) {
    return res.status(401).json({ error: 'Não autorizado.' });
}

function getOfferSlug(req) {
    var slug = req.query.slug;

    if (Array.isArray(slug) && slug[1]) {
        return slug[1];
    }

    if (typeof slug === 'string') {
        var parts = slug.split('/').filter(Boolean);

        if (parts[0] === 'offer' && parts[1]) {
            return parts[1];
        }
    }

    return String(req.query.offer || '').trim();
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    var slug = getOfferSlug(req);

    if (!slug) {
        return res.status(400).json({ error: 'Oferta em falta.' });
    }

    var offer = await offers.getOfferBySlug(slug);

    if (!offer) {
        return res.status(404).json({ error: 'Oferta não encontrada.' });
    }

    var includeIntegrations = String(req.query.integrations || '').trim() === '1';
    var integrations = null;

    if (includeIntegrations) {
        integrations = await offers.getOfferIntegrations(offer.id, {
            includeSecrets: false,
        });
    }

    var payload = offers.toPublicOffer(Object.assign({}, offer, {
        integrations: integrations,
    }), {
        includeIntegrations: includeIntegrations,
    });

    payload.modules = modules.getModulesForOffer(offer);
    payload.integration_groups = integrationKeys.INTEGRATION_GROUPS;

    return res.status(200).json({ offer: payload });
};
