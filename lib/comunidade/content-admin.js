'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var offers = require('../hub/offers');
var reorder = require('../hub/page-builder/reorder');
var productsService = require('./products-service');

var MODULE_SELECT =
    'id, product_id, parent_id, title, description, type, youtube_id, video_path, pdf_path, audio_path, image_url, sort_order, unlock_after_days';

function buildModuleTree(rows) {
    var all = rows || [];
    var topLevel = all.filter(function (row) {
        return !row.parent_id;
    }).sort(function (a, b) {
        return a.sort_order - b.sort_order;
    });

    return topLevel.map(function (moduleItem) {
        var aulas = all.filter(function (row) {
            return row.parent_id === moduleItem.id;
        }).sort(function (a, b) {
            return a.sort_order - b.sort_order;
        });

        return Object.assign({}, moduleItem, { aulas: aulas });
    });
}

async function resolveProductId(options) {
    var productId = String((options && options.productId) || '').trim();
    var offerSlug = offers.normalizeSlug((options && options.offerSlug) || '');

    if (productId && offerSlug) {
        var offer = await offers.getOfferBySlug(offerSlug);

        if (offer && offer.id) {
            await productsService.assertProductBelongsToOffer(productId, offer.id);
        }
    }

    if (productId) {
        return productId;
    }

    if (offerSlug) {
        var offer = await offers.getOfferBySlug(offerSlug);

        if (offer && offer.primary_product_id) {
            return offer.primary_product_id;
        }

        if (offer && offer.slug) {
            return offer.slug;
        }
    }

    return 'onda-prodigio';
}

async function getProductRecord(admin, productId) {
    var result = await admin
        .from('products')
        .select('id, name, description, image_url, sort_order')
        .eq('id', productId)
        .maybeSingle();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível carregar o produto.');
    }

    if (!result.data) {
        throw new Error('Produto não encontrado.');
    }

    return result.data;
}

async function listModuleRows(admin, productId) {
    var result = await admin
        .from('content_modules')
        .select(MODULE_SELECT)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível carregar módulos.');
    }

    return result.data || [];
}

async function getContentTree(options) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var productId = await resolveProductId(options);
    var product = await getProductRecord(admin, productId);
    var rows = await listModuleRows(admin, productId);

    return {
        product: product,
        modules: buildModuleTree(rows),
        flat_count: rows.length,
    };
}

async function assertRowsSameParent(admin, productId, parentId, ids) {
    var query = admin
        .from('content_modules')
        .select('id, parent_id')
        .eq('product_id', productId)
        .in('id', ids);

    var result = await query;

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível validar a ordem.');
    }

    var rows = result.data || [];
    var expectedParent = parentId || null;

    if (rows.length !== ids.length) {
        throw new Error('Itens inválidos para reordenar.');
    }

    rows.forEach(function (row) {
        var rowParent = row.parent_id || null;

        if (rowParent !== expectedParent) {
            throw new Error('Só podes reordenar itens do mesmo nível.');
        }
    });
}

async function reorderContentItems(productId, parentId, orderedIds) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    if (!Array.isArray(orderedIds) || !orderedIds.length) {
        throw new Error('Ordem em falta.');
    }

    await assertRowsSameParent(admin, productId, parentId || null, orderedIds);

    var normalized = reorder.normalizeSortOrders(orderedIds.map(function (id, index) {
        return { id: id, sort_order: (index + 1) * reorder.SORT_GAP };
    }));

    for (var i = 0; i < normalized.length; i += 1) {
        var item = normalized[i];
        var updateResult = await admin
            .from('content_modules')
            .update({ sort_order: item.sort_order })
            .eq('id', item.id)
            .eq('product_id', productId);

        if (updateResult.error) {
            throw new Error(updateResult.error.message || 'Não foi possível guardar a ordem.');
        }
    }

    return getContentTree({ productId: productId });
}

async function updateContentItem(itemId, patch) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var allowed = {
        title: true,
        description: true,
        type: true,
        youtube_id: true,
        video_path: true,
        pdf_path: true,
        audio_path: true,
        image_url: true,
        unlock_after_days: true,
    };

    var updates = {};

    Object.keys(patch || {}).forEach(function (key) {
        if (!allowed[key]) {
            return;
        }

        if (key === 'unlock_after_days') {
            updates[key] = parseInt(patch[key], 10) || 0;
            return;
        }

        updates[key] = patch[key] == null ? null : String(patch[key]).trim();
    });

    if (!Object.keys(updates).length) {
        throw new Error('Nada para actualizar.');
    }

    if (updates.type && updates.type !== 'video' && updates.type !== 'ebook') {
        throw new Error('Tipo inválido.');
    }

    var existing = await admin
        .from('content_modules')
        .select('id, product_id')
        .eq('id', itemId)
        .maybeSingle();

    if (existing.error || !existing.data) {
        throw new Error('Conteúdo não encontrado.');
    }

    var updateResult = await admin
        .from('content_modules')
        .update(updates)
        .eq('id', itemId)
        .select(MODULE_SELECT)
        .single();

    if (updateResult.error || !updateResult.data) {
        throw new Error((updateResult.error && updateResult.error.message) || 'Não foi possível actualizar.');
    }

    return updateResult.data;
}

async function getNextSortOrder(admin, productId, parentId) {
    var query = admin
        .from('content_modules')
        .select('sort_order')
        .eq('product_id', productId)
        .order('sort_order', { ascending: false })
        .limit(1);

    if (parentId) {
        query = query.eq('parent_id', parentId);
    } else {
        query = query.is('parent_id', null);
    }

    var result = await query;

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível calcular ordem.');
    }

    var current = result.data && result.data[0] ? result.data[0].sort_order : 0;

    return current + reorder.SORT_GAP;
}

async function createContentModule(productId, input) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var title = String((input && input.title) || '').trim();

    if (!title) {
        throw new Error('Título em falta.');
    }

    await getProductRecord(admin, productId);

    var insertResult = await admin
        .from('content_modules')
        .insert({
            product_id: productId,
            parent_id: null,
            title: title,
            description: String((input && input.description) || '').trim(),
            type: 'video',
            sort_order: await getNextSortOrder(admin, productId, null),
            unlock_after_days: parseInt(input && input.unlock_after_days, 10) || 0,
        })
        .select(MODULE_SELECT)
        .single();

    if (insertResult.error || !insertResult.data) {
        throw new Error((insertResult.error && insertResult.error.message) || 'Não foi possível criar módulo.');
    }

    return insertResult.data;
}

async function createContentLesson(productId, parentId, input) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var title = String((input && input.title) || '').trim();
    var parent = String(parentId || '').trim();

    if (!title || !parent) {
        throw new Error('Módulo ou título em falta.');
    }

    var parentResult = await admin
        .from('content_modules')
        .select('id, product_id, parent_id')
        .eq('id', parent)
        .eq('product_id', productId)
        .maybeSingle();

    if (parentResult.error || !parentResult.data || parentResult.data.parent_id) {
        throw new Error('Módulo pai inválido.');
    }

    var contentType = String((input && input.type) || 'video').trim();

    if (contentType !== 'video' && contentType !== 'ebook') {
        contentType = 'video';
    }

    var insertResult = await admin
        .from('content_modules')
        .insert({
            product_id: productId,
            parent_id: parent,
            title: title,
            description: String((input && input.description) || '').trim(),
            type: contentType,
            sort_order: await getNextSortOrder(admin, productId, parent),
            unlock_after_days: parseInt(input && input.unlock_after_days, 10) || 0,
        })
        .select(MODULE_SELECT)
        .single();

    if (insertResult.error || !insertResult.data) {
        throw new Error((insertResult.error && insertResult.error.message) || 'Não foi possível criar aula.');
    }

    return insertResult.data;
}

async function getContentItem(itemId) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var result = await admin
        .from('content_modules')
        .select(MODULE_SELECT)
        .eq('id', itemId)
        .maybeSingle();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível carregar o item.');
    }

    if (!result.data) {
        throw new Error('Conteúdo não encontrado.');
    }

    return result.data;
}

async function deleteContentItem(itemId) {
    var admin = getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var existing = await getContentItem(itemId);
    var deleteResult = await admin
        .from('content_modules')
        .delete()
        .eq('id', itemId);

    if (deleteResult.error) {
        throw new Error(deleteResult.error.message || 'Não foi possível apagar.');
    }

    return {
        deleted_id: itemId,
        product_id: existing.product_id,
        was_module: !existing.parent_id,
    };
}

module.exports = {
    buildModuleTree: buildModuleTree,
    resolveProductId: resolveProductId,
    getContentTree: getContentTree,
    getContentItem: getContentItem,
    reorderContentItems: reorderContentItems,
    updateContentItem: updateContentItem,
    createContentModule: createContentModule,
    createContentLesson: createContentLesson,
    deleteContentItem: deleteContentItem,
};
