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
    centsToValue: centsToValue,
};
