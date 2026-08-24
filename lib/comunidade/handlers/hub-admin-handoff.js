'use strict';

var hubAdminAccess = require('../hub-admin-access');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var handoffId = String(req.query.handoff || '').trim();

    if (!handoffId) {
        return res.status(400).json({ error: 'Handoff em falta.' });
    }

    var payload = hubAdminAccess.consumeHandoffToken(handoffId);

    if (!payload) {
        return res.status(410).json({ error: 'Ligação expirada. Volta ao HUB e abre a comunidade outra vez.' });
    }

    return res.status(200).json({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        community_url: payload.community_url,
        offer_slug: payload.offer_slug || '',
    });
};
