'use strict';

var metricsAuth = require('../../metrics/auth');
var domainAvailability = require('../domain-availability');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var isPublicCheck = req.query.action === 'hub_check_domain';

    if (!isPublicCheck && !metricsAuth.isAuthorized(req)) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    var domain = String(req.query.domain || req.query.funnel_domain || '').trim();
    var excludeOffer = String(req.query.exclude_offer || req.query.offer || '').trim();

    if (!domain) {
        return res.status(400).json({ error: 'Domínio em falta.' });
    }

    try {
        var result = await domainAvailability.checkDomainAvailability(domain, {
            excludeOfferId: excludeOffer || undefined,
        });

        return res.status(200).json({
            ok: true,
            check: result,
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Verificação de domínio falhou.',
        });
    }
};
