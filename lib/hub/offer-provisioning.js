'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');

function getOffersModule() {
    return require('./offers');
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

    if (!existingCheckout.error && !(existingCheckout.data || []).length) {
        await supabase.from('hub_offer_checkouts').insert({
            offer_id: offerId,
            checkout_id: 'main',
            product_id: productId,
            label: 'Checkout',
            path: '/checkout/?offer=' + encodeURIComponent(offerId),
            test_path: '/checkout/?offer=' + encodeURIComponent(offerId) + '&mode=test',
            amount_cents: 100,
            currency: 'eur',
            success_path: '/comunidade/?offer=' + encodeURIComponent(offerId),
            sort_order: 1,
            is_active: true,
        });
    }

    return {
        offer_id: offerId,
        product_id: productId,
        created_product: !existingProduct.data,
        created_checkout: !(existingCheckout.data || []).length,
    };
}

async function updateMainCheckout(offerId, patch) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var updates = {};

    if (patch.amount_cents != null) {
        var amount = parseInt(patch.amount_cents, 10);

        if (!Number.isFinite(amount) || amount < 50) {
            throw new Error('Preço inválido (mínimo 50 cêntimos).');
        }

        updates.amount_cents = amount;
    }

    if (patch.currency != null) {
        updates.currency = String(patch.currency || 'eur').trim().toLowerCase();
    }

    if (patch.label != null) {
        updates.label = String(patch.label || 'Checkout').trim();
    }

    if (!Object.keys(updates).length) {
        throw new Error('Nada para actualizar no checkout.');
    }

    var result = await supabase
        .from('hub_offer_checkouts')
        .update(updates)
        .eq('offer_id', offerId)
        .eq('checkout_id', 'main')
        .select('*')
        .maybeSingle();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível actualizar checkout.');
    }

    if (!result.data) {
        throw new Error('Checkout principal não encontrado.');
    }

    getOffersModule().clearOffersCache();

    return result.data;
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
    };
}

module.exports = {
    provisionOfferResources: provisionOfferResources,
    provisionOffer: provisionOffer,
    updateMainCheckout: updateMainCheckout,
};
