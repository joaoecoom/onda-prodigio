'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var integrationResolver = require('./integration-resolver');

function getOffersModule() {
    return require('./offers');
}

function getFunnelEngine() {
    return require('./funnel-engine');
}

function getCheckoutBuilder() {
    return require('./checkout-builder');
}

function getOfferFlows() {
    return require('./offer-flows');
}

async function provisionOfferResources(offerRow) {
    var supabase = getSupabaseAdmin();

    if (!supabase || !offerRow) {
        throw new Error('Base de dados indisponível.');
    }

    var offerId = String(offerRow.id || offerRow.slug || '').trim();
    var name = String(offerRow.name || offerRow.slug || offerId).trim();

    if (!offerId) {
        throw new Error('Oferta inválida.');
    }

    var productId = offerId;
    var commercialCurrency = integrationResolver.normalizeCurrency(
        (offerRow.settings && offerRow.settings.commercial_currency) || offerRow.currency
    );

    var existingProduct = await supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .maybeSingle();

    if (existingProduct.error) {
        throw new Error(existingProduct.error.message || 'Não foi possível validar o produto.');
    }

    if (!existingProduct.data) {
        var insertProduct = await supabase.from('products').insert({
            id: productId,
            name: name,
            description: '',
            image_url: null,
            sort_order: 1,
            offer_id: offerId,
        });

        if (insertProduct.error) {
            throw new Error(insertProduct.error.message || 'Não foi possível criar o produto da oferta.');
        }
    } else {
        await supabase
            .from('products')
            .update({ offer_id: offerId, name: name })
            .eq('id', productId);
    }

    await supabase
        .from('hub_offers')
        .update({
            primary_product_id: productId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', offerId);

    var existingCheckout = await supabase
        .from('hub_offer_checkouts')
        .select('checkout_id')
        .eq('offer_id', offerId)
        .limit(1);

    var createdCheckout = false;

    if (!existingCheckout.error && !(existingCheckout.data || []).length) {
        var initialAmount = parseInt(offerRow.settings && offerRow.settings.initial_amount_cents, 10);
        var amountCents = Number.isFinite(initialAmount) && initialAmount >= 50 ? initialAmount : 100;

        await supabase.from('hub_offer_checkouts').insert({
            offer_id: offerId,
            checkout_id: 'main',
            product_id: productId,
            label: 'Checkout Principal',
            path: '/checkout/?offer=' + encodeURIComponent(offerId),
            test_path: '/checkout/?offer=' + encodeURIComponent(offerId) + '&mode=test',
            amount_cents: amountCents,
            currency: commercialCurrency,
            success_path: '/comunidade/?offer=' + encodeURIComponent(offerId),
            sort_order: 1,
            is_active: true,
        });
        createdCheckout = true;
    }

    var structure = await provisionOfferStructure(offerId, name);

    return {
        offer_id: offerId,
        product_id: productId,
        created_product: !existingProduct.data,
        created_checkout: createdCheckout,
        structure: structure,
    };
}

/**
 * Seeds structural assets for ANY new offer (no secrets copied).
 * Idempotent — skips when funnel/pages already exist.
 */
async function provisionOfferStructure(offerId, offerName) {
    var result = {
        funnel_id: null,
        page_id: null,
        created_funnel: false,
        created_page: false,
        checkout_template: false,
        recovery_flow: false,
    };

    try {
        var funnelEngine = getFunnelEngine();
        var funnels = await funnelEngine.listFunnels(offerId);

        if (!(funnels || []).length) {
            var funnel = await funnelEngine.createFunnel(offerId, {
                name: 'Funil principal',
                slug: 'principal',
                type: 'vsl',
                status: 'draft',
                description: 'Funil criado automaticamente — configura pages e checkout.',
                settings: {
                    flow: [
                        {
                            id: 'step-sales',
                            kind: 'page',
                            page_type: 'sales',
                            label: 'Sales Page',
                            sort_order: 100,
                            active_page_id: null,
                            variant_page_ids: [],
                            checkout_id: 'main',
                            lane: 'main',
                            parent_step_id: null,
                            is_step_active: true,
                        },
                        {
                            id: 'step-checkout',
                            kind: 'checkout',
                            page_type: 'checkout',
                            label: 'Checkout',
                            sort_order: 200,
                            active_page_id: null,
                            variant_page_ids: [],
                            checkout_id: 'main',
                            lane: 'main',
                            parent_step_id: null,
                            is_step_active: true,
                        },
                    ],
                },
            });

            result.funnel_id = funnel.id;
            result.created_funnel = true;

            var page = await funnelEngine.createPage(offerId, funnel.id, {
                name: 'Sales Page',
                slug: 'sales',
                type: 'sales',
                status: 'draft',
            });

            result.page_id = page.id;
            result.created_page = true;

            var checkoutPage = await funnelEngine.createPage(offerId, funnel.id, {
                name: 'Checkout',
                slug: 'checkout',
                type: 'checkout',
                status: 'draft',
            });

            try {
                var checkoutDefaultSeed = require('../page-builder/checkout-default-seed');
                await checkoutDefaultSeed.seedCheckoutDefaultPage(offerId, checkoutPage.id, {
                    offerName: name,
                });
            } catch (seedError) {
                result.checkout_page_seed_error = seedError.message || 'checkout_seed_failed';
            }

            result.checkout_page_id = checkoutPage.id;
            result.created_checkout_page = true;

            var flow = (funnel.settings && funnel.settings.flow) || [];
            flow = flow.map(function (step) {
                if (step.id === 'step-sales') {
                    return Object.assign({}, step, { active_page_id: page.id });
                }

                if (step.id === 'step-checkout' || step.kind === 'checkout') {
                    return Object.assign({}, step, { active_page_id: checkoutPage.id });
                }

                return step;
            });

            await funnelEngine.updateFunnel(offerId, funnel.id, {
                settings: Object.assign({}, funnel.settings || {}, { flow: flow }),
            });
        } else {
            result.funnel_id = funnels[0].id;
        }
    } catch (error) {
        result.funnel_error = error.message || 'funnel_seed_failed';
    }

    try {
        var checkoutBuilder = getCheckoutBuilder();
        await checkoutBuilder.ensureStarterTemplate(offerId, offerName, offerId);
        result.checkout_template = true;
    } catch (error) {
        result.checkout_template_error = error.message || 'checkout_template_failed';
    }

    try {
        var commerceSync = require('./commerce-sync');
        var stripeSync = await commerceSync.syncOfferCommerceSafe(offerId, {
            mode: 'test',
            ensureWebhook: true,
        });
        result.stripe_sync = stripeSync;
    } catch (error) {
        result.stripe_sync_error = error.message || 'stripe_sync_failed';
    }

    try {
        var offerFlows = getOfferFlows();
        var seeded = await offerFlows.ensureDefaultRecoveryFlow(offerId);
        result.recovery_flow = Boolean(seeded && seeded.id);
        result.recovery_flow_id = seeded && seeded.id;
    } catch (error) {
        result.recovery_flow_error = error.message || 'recovery_seed_failed';
    }

    return result;
}

async function listOfferCheckouts(offerId) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var result = await supabase
        .from('hub_offer_checkouts')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true });

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível listar checkouts.');
    }

    return result.data || [];
}

function normalizeCheckoutId(value) {
    var normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);

    return normalized || 'main';
}

function buildCheckoutPaths(offerId, checkoutId) {
    var base = '/checkout/?offer=' + encodeURIComponent(offerId) +
        (checkoutId && checkoutId !== 'main' ? '&checkout_id=' + encodeURIComponent(checkoutId) : '');

    return {
        path: base,
        test_path: base + (base.indexOf('?') >= 0 ? '&' : '?') + 'mode=test',
        success_path: '/comunidade/?offer=' + encodeURIComponent(offerId),
    };
}

async function upsertOfferCheckout(offerId, patch) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var checkoutId = normalizeCheckoutId(patch && patch.checkout_id);
    var existingResult = await supabase
        .from('hub_offer_checkouts')
        .select('*')
        .eq('offer_id', offerId)
        .eq('checkout_id', checkoutId)
        .maybeSingle();

    if (existingResult.error) {
        throw new Error(existingResult.error.message || 'Não foi possível ler checkout.');
    }

    var existing = existingResult.data || null;
    var defaults = buildCheckoutPaths(offerId, checkoutId);
    var row = {
        offer_id: offerId,
        checkout_id: checkoutId,
        product_id: existing && existing.product_id
            ? existing.product_id
            : String((patch && patch.product_id) || offerId).trim(),
        label: existing && existing.label ? existing.label : (checkoutId === 'main' ? 'Checkout Principal' : checkoutId),
        path: existing && existing.path ? existing.path : defaults.path,
        test_path: existing && existing.test_path ? existing.test_path : defaults.test_path,
        amount_cents: existing && existing.amount_cents != null ? existing.amount_cents : 100,
        currency: existing && existing.currency
            ? existing.currency
            : integrationResolver.normalizeCurrency(null),
        success_path: existing && existing.success_path ? existing.success_path : defaults.success_path,
        cancel_path: existing && existing.cancel_path ? existing.cancel_path : null,
        sort_order: existing && existing.sort_order != null ? existing.sort_order : 1,
        is_active: existing && existing.is_active != null ? existing.is_active : true,
        stripe_test_price_id: existing && existing.stripe_test_price_id || null,
        stripe_price_id: existing && existing.stripe_price_id || null,
    };

    if (patch) {
        if (patch.label != null) {
            row.label = String(patch.label || 'Checkout').trim() || 'Checkout';
        }

        if (patch.amount_cents != null) {
            var amount = parseInt(patch.amount_cents, 10);

            if (!Number.isFinite(amount) || amount < 50) {
                throw new Error('Preço inválido (mínimo 50 cêntimos).');
            }

            row.amount_cents = amount;
        }

        if (patch.currency != null) {
            row.currency = integrationResolver.normalizeCurrency(patch.currency);
        }

        if (patch.product_id != null) {
            row.product_id = String(patch.product_id || offerId).trim() || offerId;
        }

        if (patch.path != null) {
            row.path = String(patch.path || '').trim() || defaults.path;
        }

        if (patch.test_path != null) {
            row.test_path = String(patch.test_path || '').trim() || defaults.test_path;
        }

        if (patch.success_path != null) {
            row.success_path = String(patch.success_path || '').trim() || defaults.success_path;
        }

        if (patch.cancel_path != null) {
            row.cancel_path = String(patch.cancel_path || '').trim() || null;
        }

        if (patch.sort_order != null) {
            var sortOrder = parseInt(patch.sort_order, 10);
            row.sort_order = Number.isFinite(sortOrder) ? sortOrder : row.sort_order;
        }

        if (patch.is_active != null) {
            row.is_active = patch.is_active !== false;
        }

        if (patch.stripe_test_price_id != null) {
            row.stripe_test_price_id = String(patch.stripe_test_price_id || '').trim() || null;
        }

        if (patch.stripe_price_id != null) {
            row.stripe_price_id = String(patch.stripe_price_id || '').trim() || null;
        }
    }

    var result = await supabase
        .from('hub_offer_checkouts')
        .upsert(row, { onConflict: 'offer_id,checkout_id' })
        .select('*')
        .single();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível guardar checkout.');
    }

    getOffersModule().clearOffersCache();

    if (patch && patch.skipCommerceSync) {
        return result.data;
    }

    var commerceSync = require('./commerce-sync');
    var stripeSync = await commerceSync.syncOfferCommerceSafe(offerId, {
        mode: patch && patch.mode === 'live' ? 'live' : 'test',
        ensureWebhook: !(patch && patch.ensureWebhook === false),
        checkoutId: checkoutId,
    });

    return Object.assign({}, result.data, {
        stripe_sync: stripeSync,
    });
}

async function updateMainCheckout(offerId, patch) {
    return upsertOfferCheckout(offerId, Object.assign({}, patch || {}, {
        checkout_id: 'main',
    }));
}

async function deactivateOfferCheckout(offerId, checkoutId) {
    var id = normalizeCheckoutId(checkoutId);

    if (id === 'main') {
        throw new Error('Não podes desactivar o checkout principal.');
    }

    return upsertOfferCheckout(offerId, {
        checkout_id: id,
        is_active: false,
        skipCommerceSync: true,
    });
}

async function provisionOffer(slugOrOffer) {
    var offers = getOffersModule();
    var offer = null;

    if (typeof slugOrOffer === 'string') {
        offer = await offers.getOfferBySlug(slugOrOffer, { forceRefresh: true });
    } else {
        offer = slugOrOffer;
    }

    if (!offer) {
        throw new Error('Oferta não encontrada.');
    }

    var result = await provisionOfferResources(offer);

    return {
        ok: true,
        offer_id: result.offer_id,
        product_id: result.product_id,
        created_product: result.created_product,
        created_checkout: result.created_checkout,
        structure: result.structure,
    };
}

module.exports = {
    provisionOfferResources: provisionOfferResources,
    provisionOfferStructure: provisionOfferStructure,
    provisionOffer: provisionOffer,
    updateMainCheckout: updateMainCheckout,
    listOfferCheckouts: listOfferCheckouts,
    upsertOfferCheckout: upsertOfferCheckout,
    deactivateOfferCheckout: deactivateOfferCheckout,
    normalizeCheckoutId: normalizeCheckoutId,
};
