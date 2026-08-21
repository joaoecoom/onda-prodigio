'use strict';

var metricsAuth = require('../../metrics/auth');
var offerSetupWizard = require('../offer-setup-wizard');
var offerProvisioning = require('../offer-provisioning');
var offers = require('../offers');

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

function readSlug(req, body) {
    return String(
        (body && (body.slug || body.offer)) ||
        req.query.slug ||
        req.query.offer ||
        ''
    ).trim();
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    var action = String(req.query.action || '').trim();
    var body = req.method === 'POST' ? await readJsonBody(req) : {};
    var slug = readSlug(req, body);

    try {
        if (action === 'hub_offer_wizard') {
            if (!slug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var wizard = await offerSetupWizard.getWizardState(slug, {
                refresh: String(req.query.refresh || '').trim() === '1',
                syncDomain: String(req.query.sync_domain || '').trim() === '1',
            });

            return res.status(200).json({ ok: true, wizard: wizard });
        }

        if (action === 'hub_provision_offer') {
            if (!slug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var provisioned = await offerProvisioning.provisionOffer(slug);

            if (body.amount_cents != null || body.currency != null) {
                var offer = await offers.getOfferBySlug(slug, { forceRefresh: true });
                var checkout = await offerProvisioning.updateMainCheckout(offer.id, {
                    amount_cents: body.amount_cents,
                    currency: body.currency,
                    label: body.checkout_label,
                });
                provisioned.checkout = checkout;
            }

            return res.status(200).json({ ok: true, provision: provisioned });
        }

        if (action === 'hub_validate_offer') {
            if (!slug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var validation = await offerSetupWizard.validateOffer(slug, {
                syncDomain: Boolean(body.sync_domain),
            });

            return res.status(200).json({
                ok: validation.ok,
                ready: validation.ready,
                readiness: validation.readiness,
                label: validation.label,
                emoji: validation.emoji,
                failures: validation.failures,
                wizard: validation.wizard,
            });
        }

        if (action === 'hub_launch_offer') {
            if (!slug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var launched = await offerSetupWizard.launchOffer(slug, {
                syncDomain: Boolean(body.sync_domain),
            });

            return res.status(200).json({
                ok: true,
                offer: offers.toPublicOffer(
                    await offers.getOfferBySlug(slug, { forceRefresh: true })
                ),
                launch: launched.launch,
            });
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Acção inválida.' });
    } catch (error) {
        if (error.code === 'NOT_READY' || error.code === 'ALMOST_READY') {
            return res.status(409).json({
                ok: false,
                error: error.message,
                code: error.code,
                validation: error.validation,
            });
        }

        return res.status(400).json({
            error: error.message || 'Operação falhou.',
        });
    }
};
