'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var productsService = require('../comunidade/products-service');

function normalizeBumpIds(raw) {
    if (!raw) {
        return [];
    }

    if (Array.isArray(raw)) {
        return raw.map(function (item) {
            return String(item || '').trim();
        }).filter(Boolean);
    }

    return String(raw)
        .split(',')
        .map(function (item) {
            return item.trim();
        })
        .filter(Boolean);
}

async function listOrderBumps(offerId, options) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var query = supabase
        .from('hub_offer_order_bumps')
        .select('bump_id, product_id, label, amount_cents, sort_order, is_active')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true });

    if (!options || options.activeOnly !== false) {
        query = query.eq('is_active', true);
    }

    var result = await query;

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível carregar order bumps.');
    }

    return result.data || [];
}

async function resolveSelectedBumps(offerId, selectedBumpIds) {
    var ids = normalizeBumpIds(selectedBumpIds);

    if (!ids.length) {
        return [];
    }

    var available = await listOrderBumps(offerId, { activeOnly: true });
    var byId = {};

    available.forEach(function (row) {
        byId[row.bump_id] = row;
    });

    var resolved = [];
    var seen = {};

    ids.forEach(function (bumpId) {
        if (seen[bumpId]) {
            return;
        }

        seen[bumpId] = true;

        var row = byId[bumpId];

        if (!row) {
            throw new Error('Order bump inválido para esta oferta: ' + bumpId);
        }

        resolved.push(row);
    });

    return resolved;
}

function computeCheckoutTotal(baseAmountCents, selectedBumps) {
    var total = parseInt(baseAmountCents, 10) || 0;

    (selectedBumps || []).forEach(function (bump) {
        total += parseInt(bump.amount_cents, 10) || 0;
    });

    return total;
}

function buildOrderLineItems(mainProduct, mainAmountCents, mainLabel, selectedBumps) {
    var items = [{
        type: 'main',
        product_id: mainProduct,
        bump_id: null,
        label: mainLabel,
        amount_cents: mainAmountCents,
    }];

    (selectedBumps || []).forEach(function (bump) {
        items.push({
            type: 'bump',
            product_id: bump.product_id,
            bump_id: bump.bump_id,
            label: bump.label,
            amount_cents: bump.amount_cents,
        });
    });

    return items;
}

function buildBumpMetadata(mainProductId, mainLabel, mainAmountCents, selectedBumps) {
    var lineItems = buildOrderLineItems(mainProductId, mainAmountCents, mainLabel, selectedBumps);
    var bumpIds = (selectedBumps || []).map(function (row) {
        return row.bump_id;
    });
    var bumpProductIds = (selectedBumps || []).map(function (row) {
        return row.product_id;
    });

    return {
        order_bumps: bumpIds.join(', '),
        bump_product_ids: bumpProductIds.join(', '),
        order_items: JSON.stringify(lineItems),
        order_item_count: String(lineItems.length),
    };
}

async function upsertOrderBump(offerId, row, options) {
    var opts = options || {};
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    await productsService.assertProductBelongsToOffer(row.product_id, offerId);

    var payload = {
        offer_id: offerId,
        bump_id: String(row.bump_id || '').trim(),
        product_id: String(row.product_id || '').trim(),
        label: String(row.label || row.bump_id || 'Order bump').trim(),
        amount_cents: parseInt(row.amount_cents, 10),
        sort_order: parseInt(row.sort_order, 10) || 1,
        is_active: row.is_active !== false,
        updated_at: new Date().toISOString(),
    };

    if (!payload.bump_id || !payload.product_id) {
        throw new Error('bump_id e product_id são obrigatórios.');
    }

    if (!Number.isFinite(payload.amount_cents) || payload.amount_cents < 50) {
        throw new Error('Valor do bump inválido (mínimo 50 cêntimos).');
    }

    var result = await supabase
        .from('hub_offer_order_bumps')
        .upsert(payload, { onConflict: 'offer_id,bump_id' })
        .select('*')
        .maybeSingle();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível guardar order bump.');
    }

    if (opts.skipCommerceSync) {
        return result.data;
    }

    var commerceSync = require('./commerce-sync');
    var stripeSync = await commerceSync.syncOfferCommerceSafe(offerId, {
        mode: opts.mode === 'live' ? 'live' : 'test',
        ensureWebhook: opts.ensureWebhook !== false,
    });

    return Object.assign({}, result.data || {}, {
        stripe_sync: stripeSync,
    });
}

function parseLineItemsFromMetadata(metadata) {
    var raw = metadata && metadata.order_items;

    if (!raw) {
        return [];
    }

    try {
        var parsed = JSON.parse(String(raw));

        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function parseProductIdsFromMetadata(metadata) {
    var data = metadata || {};
    var ids = [];
    var main = String(data.product_id || '').trim();

    if (main) {
        ids.push(main);
    }

    var bumpProducts = String(data.bump_product_ids || '')
        .split(',')
        .map(function (item) {
            return item.trim();
        })
        .filter(Boolean);

    bumpProducts.forEach(function (productId) {
        if (ids.indexOf(productId) === -1) {
            ids.push(productId);
        }
    });

    return ids;
}

module.exports = {
    normalizeBumpIds: normalizeBumpIds,
    listOrderBumps: listOrderBumps,
    resolveSelectedBumps: resolveSelectedBumps,
    computeCheckoutTotal: computeCheckoutTotal,
    buildOrderLineItems: buildOrderLineItems,
    buildBumpMetadata: buildBumpMetadata,
    upsertOrderBump: upsertOrderBump,
    parseLineItemsFromMetadata: parseLineItemsFromMetadata,
    parseProductIdsFromMetadata: parseProductIdsFromMetadata,
};
