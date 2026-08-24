/** @typedef {{ item_id: string, item_name: string, price: number, quantity: number, item_category: string }} TrackingItem */

var BUMP_CATALOG = {
    'tardes-sem-brigas': {
        item_id: 'tardes-sem-brigas',
        item_name: 'A Fábrica das Tardes Tranquilas',
        price: 5,
    },
    'caixa-super-truques': {
        item_id: 'caixa-super-truques',
        item_name: 'A Caixa dos Super Truques do Génio',
        price: 5,
    },
    'grandes-mentes': {
        item_id: 'grandes-mentes',
        item_name: 'Grandes Mentes',
        price: 5,
    },
};

var MAIN_PRODUCT = {
    item_id: 'onda-prodigio',
    item_name: 'Onda Prodígio',
    price: 9,
};

function parseOrderBumps(rawValue) {
    if (!rawValue) {
        return [];
    }

    return String(rawValue)
        .split(',')
        .map(function (item) {
            return item.trim();
        })
        .filter(Boolean);
}

function buildTrackingItemsFromPayment(metadata, amountCents) {
    var meta = metadata || {};
    var lineItems = [];

    try {
        if (meta.order_items) {
            lineItems = JSON.parse(String(meta.order_items));
        }
    } catch (error) {
        lineItems = [];
    }

    if (Array.isArray(lineItems) && lineItems.length) {
        return lineItems.map(function (item) {
            return {
                item_id: item.product_id,
                item_name: item.label || item.product_id,
                price: centsToValue(item.amount_cents),
                quantity: 1,
                item_category: item.type === 'bump' ? 'order_bump' : 'offer_product',
            };
        });
    }

    if (meta.checkout_type === 'offer' || meta.checkout === 'main' || meta.product_id) {
        var productId = String(meta.product_id || meta.offer_id || 'product').trim();
        var productName = String(meta.product || productId).trim();
        var items = [{
            item_id: productId,
            item_name: productName,
            price: centsToValue(amountCents),
            quantity: 1,
            item_category: 'offer_product',
        }];
        var bumpIds = parseOrderBumps(meta.order_bumps);

        bumpIds.forEach(function (bumpId) {
            var legacyBump = BUMP_CATALOG[bumpId];

            if (legacyBump) {
                items.push({
                    item_id: legacyBump.item_id,
                    item_name: legacyBump.item_name,
                    price: legacyBump.price,
                    quantity: 1,
                    item_category: 'order_bump',
                });
                return;
            }

            items.push({
                item_id: bumpId,
                item_name: bumpId,
                price: 0,
                quantity: 1,
                item_category: 'order_bump',
            });
        });

        return items;
    }

    if (meta.checkout_type === 'standalone' && meta.product_id) {
        return [{
            item_id: meta.product_id,
            item_name: meta.product || meta.product_id,
            price: centsToValue(amountCents),
            quantity: 1,
            item_category: 'standalone_product',
        }];
    }

    return buildTrackingItems(parseOrderBumps(meta.order_bumps));
}

function buildTrackingItems(orderBumpIds) {
    /** @type {TrackingItem[]} */
    var items = [
        {
            item_id: MAIN_PRODUCT.item_id,
            item_name: MAIN_PRODUCT.item_name,
            price: MAIN_PRODUCT.price,
            quantity: 1,
            item_category: 'produto_principal',
        },
    ];

    (orderBumpIds || []).forEach(function (bumpId) {
        var bump = BUMP_CATALOG[bumpId];

        if (!bump) {
            return;
        }

        items.push({
            item_id: bump.item_id,
            item_name: bump.item_name,
            price: bump.price,
            quantity: 1,
            item_category: 'order_bump',
        });
    });

    return items;
}

function centsToValue(cents) {
    return Number((Number(cents || 0) / 100).toFixed(2));
}

module.exports = {
    BUMP_CATALOG: BUMP_CATALOG,
    MAIN_PRODUCT: MAIN_PRODUCT,
    parseOrderBumps: parseOrderBumps,
    buildTrackingItems: buildTrackingItems,
    buildTrackingItemsFromPayment: buildTrackingItemsFromPayment,
    centsToValue: centsToValue,
};
