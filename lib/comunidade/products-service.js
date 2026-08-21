'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');

async function assertProductBelongsToOffer(productId, offerId) {
    if (!productId || !offerId) {
        return;
    }

    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Base de dados indisponível.');
    }

    var result = await admin
        .from('products')
        .select('id, offer_id')
        .eq('id', productId)
        .maybeSingle();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível validar o produto.');
    }

    if (!result.data) {
        throw new Error('Produto não encontrado.');
    }

    if (result.data.offer_id && result.data.offer_id !== offerId) {
        throw new Error('Produto não pertence a esta oferta.');
    }
}

async function listProductsForOffer(offerId, options) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Base de dados indisponível.');
    }

    var query = admin
        .from('products')
        .select('id, name, description, image_url, sort_order, offer_id')
        .order('sort_order', { ascending: true });

    if (offerId) {
        query = query.eq('offer_id', offerId);
    }

    var result = await query;

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível carregar produtos.');
    }

    return result.data || [];
}

module.exports = {
    assertProductBelongsToOffer: assertProductBelongsToOffer,
    listProductsForOffer: listProductsForOffer,
};
