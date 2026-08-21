'use strict';

var constants = require('../funnel-engine/constants');

var SORT_GAP = constants.DEFAULT_SORT_GAP;

function normalizeSortOrders(items) {
    var sorted = items.slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    sorted.forEach(function (item, index) {
        item.sort_order = (index + 1) * SORT_GAP;
    });

    return sorted;
}

function buildOrder(ids, draggedId, targetId, placement) {
    var order = ids.filter(function (id) { return id !== draggedId; });
    var targetIndex = order.indexOf(targetId);

    if (targetIndex === -1) {
        order.push(draggedId);
        return order;
    }

    var insertAt = placement === 'after' ? targetIndex + 1 : targetIndex;
    order.splice(insertAt, 0, draggedId);
    return order;
}

module.exports = {
    SORT_GAP: SORT_GAP,
    normalizeSortOrders: normalizeSortOrders,
    buildOrder: buildOrder,
};
