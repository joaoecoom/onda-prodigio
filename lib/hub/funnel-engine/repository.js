var { getSupabaseAdmin } = require('../../supabase-admin');

function nowIso() {
    return new Date().toISOString();
}

function dbError(result, message) {
    throw new Error((result.error && result.error.message) || message);
}

function getClient() {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    return supabase;
}

async function insertRow(table, row) {
    var supabase = getClient();
    var result = await supabase.from(table).insert(row).select('*').single();

    if (result.error || !result.data) {
        dbError(result, 'Não foi possível criar ' + table + '.');
    }

    return result.data;
}

async function updateRow(table, id, patch) {
    var supabase = getClient();
    var result = await supabase
        .from(table)
        .update(Object.assign({}, patch, { updated_at: nowIso() }))
        .eq('id', id)
        .select('*')
        .single();

    if (result.error || !result.data) {
        dbError(result, 'Não foi possível actualizar ' + table + '.');
    }

    return result.data;
}

async function deleteRow(table, id) {
    var supabase = getClient();
    var result = await supabase.from(table).delete().eq('id', id);

    if (result.error) {
        dbError(result, 'Não foi possível eliminar ' + table + '.');
    }
}

async function getById(table, id) {
    var supabase = getClient();
    var result = await supabase.from(table).select('*').eq('id', id).maybeSingle();

    if (result.error) {
        dbError(result, 'Não foi possível carregar ' + table + '.');
    }

    return result.data || null;
}

async function getFunnelByOfferAndSlug(offerId, slug) {
    var supabase = getClient();
    var result = await supabase
        .from('funnels')
        .select('*')
        .eq('offer_id', offerId)
        .eq('slug', slug)
        .maybeSingle();

    if (result.error) {
        dbError(result, 'Não foi possível carregar funnel.');
    }

    return result.data || null;
}

async function getPageByFunnelAndSlug(funnelId, slug) {
    var supabase = getClient();
    var result = await supabase
        .from('pages')
        .select('*')
        .eq('funnel_id', funnelId)
        .eq('slug', slug)
        .maybeSingle();

    if (result.error) {
        dbError(result, 'Não foi possível carregar page.');
    }

    return result.data || null;
}

async function listFunnels(offerId) {
    var supabase = getClient();
    var result = await supabase
        .from('funnels')
        .select('*')
        .eq('offer_id', offerId)
        .order('created_at', { ascending: true });

    if (result.error) {
        dbError(result, 'Não foi possível listar funnels.');
    }

    return result.data || [];
}

async function listPages(funnelId) {
    var supabase = getClient();
    var result = await supabase
        .from('pages')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (result.error) {
        dbError(result, 'Não foi possível listar pages.');
    }

    return result.data || [];
}

async function listPagesByOffer(offerId) {
    var supabase = getClient();
    var result = await supabase
        .from('pages')
        .select('*')
        .eq('offer_id', offerId)
        .order('created_at', { ascending: true });

    if (result.error) {
        dbError(result, 'Não foi possível listar pages da oferta.');
    }

    return result.data || [];
}

async function listSections(pageId) {
    var supabase = getClient();
    var result = await supabase
        .from('page_sections')
        .select('*')
        .eq('page_id', pageId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (result.error) {
        dbError(result, 'Não foi possível listar sections.');
    }

    return result.data || [];
}

async function listBlocks(sectionId) {
    var supabase = getClient();
    var result = await supabase
        .from('page_blocks')
        .select('*')
        .eq('section_id', sectionId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (result.error) {
        dbError(result, 'Não foi possível listar blocks.');
    }

    return result.data || [];
}

async function listBlocksByPageId(pageId) {
    var supabase = getClient();
    var result = await supabase
        .from('page_blocks')
        .select('*')
        .eq('page_id', pageId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (result.error) {
        dbError(result, 'Não foi possível listar blocks da page.');
    }

    return result.data || [];
}

async function reorderRows(table, items) {
    var supabase = getClient();

    for (var i = 0; i < items.length; i += 1) {
        var item = items[i];
        var result = await supabase
            .from(table)
            .update({ sort_order: item.sort_order, updated_at: nowIso() })
            .eq('id', item.id);

        if (result.error) {
            dbError(result, 'Não foi possível reordenar ' + table + '.');
        }
    }
}

module.exports = {
    insertRow: insertRow,
    updateRow: updateRow,
    deleteRow: deleteRow,
    getById: getById,
    getFunnelByOfferAndSlug: getFunnelByOfferAndSlug,
    getPageByFunnelAndSlug: getPageByFunnelAndSlug,
    listFunnels: listFunnels,
    listPages: listPages,
    listPagesByOffer: listPagesByOffer,
    listSections: listSections,
    listBlocks: listBlocks,
    listBlocksByPageId: listBlocksByPageId,
    reorderRows: reorderRows,
};
