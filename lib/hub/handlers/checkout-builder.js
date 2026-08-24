'use strict';

var metricsAuth = require('../../metrics/auth');
var offers = require('../offers');
var checkoutBuilder = require('../checkout-builder');
var offerProvisioning = require('../offer-provisioning');
var orderBumps = require('../order-bumps');
var commerceSync = require('../commerce-sync');

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

async function resolveOfferFromSlug(slug) {
    var offer = await offers.getOfferBySlug(slug);

    if (!offer) {
        var error = new Error('Oferta não encontrada.');
        error.statusCode = 404;
        throw error;
    }

    return offer;
}

module.exports = async function handler(req, res) {
    var action = String(req.query.action || req.query.checkout_action || '').trim();
    var slug = String(req.query.slug || req.query.offer || '').trim();
    var isPublicTemplate = action === 'hub_checkout_template' && req.method === 'GET';

    if (!isPublicTemplate && !metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    try {
        if (req.method === 'GET' && action === 'hub_checkout_template') {
            if (!slug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var offer = await resolveOfferFromSlug(slug);
            var template = await checkoutBuilder.getTemplate(offer.id);

            return res.status(200).json({ ok: true, template: template });
        }

        if (req.method === 'GET' && action === 'hub_checkout_builder') {
            if (!slug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var offerRow = await resolveOfferFromSlug(slug);
            var context = await checkoutBuilder.getCheckoutContext(offerRow.id);

            return res.status(200).json({ ok: true, module: context });
        }

        if (req.method === 'GET' && action === 'hub_list_checkouts') {
            if (!slug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var listOffer = await resolveOfferFromSlug(slug);
            var checkouts = await offerProvisioning.listOfferCheckouts(listOffer.id);

            return res.status(200).json({
                ok: true,
                offer: { id: listOffer.id, slug: listOffer.slug, name: listOffer.name },
                checkouts: checkouts,
            });
        }

        if (req.method === 'POST' && action === 'hub_save_checkout_template') {
            var body = await readJsonBody(req);
            var saveSlug = slug || String(body.slug || body.offer || '').trim();

            if (!saveSlug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var saveOffer = await resolveOfferFromSlug(saveSlug);
            var saved = await checkoutBuilder.saveTemplate(saveOffer.id, {
                html_top: body.html_top,
                html_bottom: body.html_bottom,
                custom_css: body.custom_css,
                settings: body.settings,
            });

            return res.status(200).json({ ok: true, template: saved });
        }

        if (req.method === 'POST' && action === 'hub_upsert_checkout') {
            var upsertBody = await readJsonBody(req);
            var upsertSlug = slug || String(upsertBody.slug || upsertBody.offer || '').trim();

            if (!upsertSlug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var upsertOffer = await resolveOfferFromSlug(upsertSlug);
            var checkout = await offerProvisioning.upsertOfferCheckout(upsertOffer.id, {
                checkout_id: upsertBody.checkout_id,
                label: upsertBody.label,
                amount_cents: upsertBody.amount_cents,
                currency: upsertBody.currency,
                product_id: upsertBody.product_id,
                path: upsertBody.path,
                test_path: upsertBody.test_path,
                success_path: upsertBody.success_path,
                cancel_path: upsertBody.cancel_path,
                sort_order: upsertBody.sort_order,
                is_active: upsertBody.is_active,
                mode: upsertBody.mode,
                skipCommerceSync: upsertBody.skip_commerce_sync === true,
                ensureWebhook: upsertBody.ensure_webhook !== false,
            });

            return res.status(200).json({
                ok: true,
                checkout: checkout,
                stripe_sync: checkout.stripe_sync || null,
            });
        }

        if (req.method === 'POST' && action === 'hub_deactivate_checkout') {
            var deactivateBody = await readJsonBody(req);
            var deactivateSlug = slug || String(deactivateBody.slug || deactivateBody.offer || '').trim();
            var deactivateId = String(deactivateBody.checkout_id || '').trim();

            if (!deactivateSlug || !deactivateId) {
                return res.status(400).json({ error: 'Oferta e checkout_id em falta.' });
            }

            var deactivateOffer = await resolveOfferFromSlug(deactivateSlug);
            var deactivated = await offerProvisioning.deactivateOfferCheckout(
                deactivateOffer.id,
                deactivateId
            );

            return res.status(200).json({ ok: true, checkout: deactivated });
        }

        if (req.method === 'POST' && action === 'hub_sync_checkout_stripe') {
            var syncBody = await readJsonBody(req);
            var syncSlug = slug || String(syncBody.slug || syncBody.offer || '').trim();

            if (!syncSlug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var syncOffer = await resolveOfferFromSlug(syncSlug);
            var syncResult = await commerceSync.syncOfferCommerce(syncOffer.id, {
                mode: syncBody.mode === 'live' ? 'live' : 'test',
                checkoutId: syncBody.checkout_id || 'main',
                ensureWebhook: syncBody.ensure_webhook !== false,
                syncBumps: syncBody.sync_bumps !== false,
            });

            return res.status(200).json({ ok: true, sync: syncResult });
        }

        if (req.method === 'POST' && action === 'hub_upsert_order_bump') {
            var bumpBody = await readJsonBody(req);
            var bumpSlug = slug || String(bumpBody.slug || bumpBody.offer || '').trim();

            if (!bumpSlug) {
                return res.status(400).json({ error: 'Oferta em falta.' });
            }

            var bumpOffer = await resolveOfferFromSlug(bumpSlug);
            var bumpId = String(bumpBody.bump_id || '').trim();
            var bumpLabel = String(bumpBody.label || bumpId || 'Order bump').trim();
            var bumpProductId = String(
                bumpBody.product_id || (bumpOffer.id + '-' + bumpId)
            ).trim();

            if (!bumpId) {
                return res.status(400).json({ error: 'bump_id em falta.' });
            }

            var supabase = require('../../supabase-admin').getSupabaseAdmin();

            if (supabase) {
                var existingProduct = await supabase
                    .from('products')
                    .select('id')
                    .eq('id', bumpProductId)
                    .maybeSingle();

                if (!existingProduct.data) {
                    var insertProduct = await supabase.from('products').insert({
                        id: bumpProductId,
                        name: bumpLabel,
                        description: '',
                        image_url: null,
                        sort_order: 100,
                        offer_id: bumpOffer.id,
                    });

                    if (insertProduct.error) {
                        throw new Error(insertProduct.error.message || 'Não foi possível criar produto do bump.');
                    }
                }
            }

            var bump = await orderBumps.upsertOrderBump(bumpOffer.id, {
                bump_id: bumpId,
                product_id: bumpProductId,
                label: bumpLabel,
                amount_cents: bumpBody.amount_cents,
                sort_order: bumpBody.sort_order,
                is_active: bumpBody.is_active,
            });

            return res.status(200).json({ ok: true, bump: bump });
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        var status = error.statusCode || 400;
        return res.status(status).json({
            error: error.message || 'Operação de checkout falhou.',
        });
    }
};
