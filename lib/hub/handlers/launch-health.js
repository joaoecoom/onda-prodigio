'use strict';

var metricsAuth = require('../../metrics/auth');
var launchReadiness = require('../launch-readiness');
var vercelDomains = require('../vercel-domains');
var offers = require('../offers');
var offerSettings = require('../offer-settings');

function sendUnauthorized(res) {
    return res.status(401).json({ error: 'Não autorizado.' });
}

function getOfferSlug(req) {
    return String(req.query.slug || req.query.offer || '').trim();
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    var slug = getOfferSlug(req);
    var action = String(req.query.launch_action || req.query.subaction || '').trim();

    if (!slug) {
        return res.status(400).json({ error: 'Parâmetro slug em falta.' });
    }

    try {
        if (req.method === 'POST' && action === 'verify_domain') {
            var body = req.body && typeof req.body === 'object' ? req.body : {};
            var domain = String(body.domain || req.query.domain || '').trim().toLowerCase();

            if (!domain) {
                var offer = await offers.getOfferBySlug(slug);

                if (!offer) {
                    return res.status(404).json({ error: 'Oferta não encontrada.' });
                }

                domain = String(offer.funnel_domain || '').trim().toLowerCase();
            }

            if (!domain) {
                return res.status(400).json({ error: 'Domínio em falta.' });
            }

            if (vercelDomains.isVercelConfigured()) {
                await vercelDomains.addProjectDomain(domain);
            }

            if (body.save !== false) {
                await offerSettings.updateOfferSettings(slug, { funnel_domain: domain });
            }

            var report = await launchReadiness.evaluateLaunchReadiness(slug, {
                refresh: true,
                syncDomain: true,
            });

            return res.status(200).json({
                ok: true,
                domain: domain,
                vercel_configured: vercelDomains.isVercelConfigured(),
                launch: report,
            });
        }

        var refresh = String(req.query.refresh || '') === '1';
        var syncDomain = String(req.query.sync_domain || '') === '1' || action === 'sync_domain';
        var report = await launchReadiness.evaluateLaunchReadiness(slug, {
            refresh: refresh,
            syncDomain: syncDomain,
        });

        return res.status(200).json(report);
    } catch (error) {
        console.error('hub_launch_health falhou:', error);
        return res.status(500).json({
            error: error.message || 'Não foi possível avaliar launch readiness.',
        });
    }
};
