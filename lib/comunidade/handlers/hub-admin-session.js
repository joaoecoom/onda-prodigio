'use strict';

var metricsAuth = require('../../metrics/auth');
var hubAdminAccess = require('../hub-admin-access');

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
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    if (!metricsAuth.isAuthorized(req)) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    try {
        var body = await readJsonBody(req);
        var offerSlug = String(body.offer || body.slug || req.query.offer || req.query.slug || '').trim();
        var requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
        var payload = await hubAdminAccess.createCommunityAdminSession({
            offerSlug: offerSlug,
            requestHost: requestHost,
        });

        return res.status(200).json(payload);
    } catch (error) {
        console.error('hub-admin-session falhou:', error);
        return res.status(400).json({
            error: error.message || 'Não foi possível abrir a comunidade como administrador.',
        });
    }
};
