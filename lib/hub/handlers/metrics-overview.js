'use strict';

var metricsAuth = require('../../metrics/auth');
var hubMetrics = require('../hub-metrics');

function sendUnauthorized(res) {
    return res.status(401).json({ error: 'Não autorizado.' });
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    try {
        var action = String(req.query.action || '').trim();

        if (action === 'hub_metrics') {
            var slug = String(req.query.slug || req.query.offer || '').trim();

            if (!slug) {
                return res.status(400).json({ error: 'Parâmetro slug em falta.' });
            }

            var offerMetrics = await hubMetrics.buildHubMetricsForOffer(slug, req.query);
            return res.status(200).json(offerMetrics);
        }

        var overview = await hubMetrics.buildHubMetricsOverview(req.query);
        return res.status(200).json(overview);
    } catch (error) {
        console.error('hub_metrics_overview falhou:', error);
        return res.status(500).json({
            error: error.message || 'Não foi possível carregar métricas.',
        });
    }
};
