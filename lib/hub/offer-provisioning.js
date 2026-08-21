'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');

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
    };
}

module.exports = {
    provisionOfferResources: provisionOfferResources,
};
