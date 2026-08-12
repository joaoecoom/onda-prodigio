var productCheckoutConfig = require('../product-checkout-config');

function getSiteUrl() {
    return String(process.env.SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
}

async function fetchOwnedProductIds(admin, memberId) {
    if (!admin || !memberId) {
        return [];
    }

    var result = await admin
        .from('member_products')
        .select('product_id')
        .eq('member_id', memberId);

    if (result.error) {
        throw result.error;
    }

    return (result.data || []).map(function (row) {
        return row.product_id;
    });
}

function pickNextProductId(ownedProductIds, purchasedProductIds) {
    var owned = ownedProductIds || [];
    var purchasedId = (purchasedProductIds || []).find(Boolean) || 'onda-prodigio';
    var candidates = productCheckoutConfig.buildCandidateList(purchasedId, 1);
    var seen = {};
    var ordered = [];

    candidates.forEach(function (productId) {
        if (!seen[productId]) {
            seen[productId] = true;
            ordered.push(productId);
        }
    });

    productCheckoutConfig.getPurchasableProductIds().forEach(function (productId) {
        if (!seen[productId]) {
            seen[productId] = true;
            ordered.push(productId);
        }
    });

    for (var i = 0; i < ordered.length; i += 1) {
        var candidateId = ordered[i];

        if (owned.indexOf(candidateId) !== -1) {
            continue;
        }

        if (!productCheckoutConfig.getProduct(candidateId)) {
            continue;
        }

        return candidateId;
    }

    return null;
}

/**
 * @param {object} admin
 * @param {string} memberId
 * @param {string[]} purchasedProductIds
 * @returns {Promise<{ product_id: string, name: string, description: string, checkout_url: string }|null>}
 */
async function resolveNextProductOffer(admin, memberId, purchasedProductIds) {
    var owned = await fetchOwnedProductIds(admin, memberId);
    var nextId = pickNextProductId(owned, purchasedProductIds);

    if (!nextId) {
        return null;
    }

    var product = productCheckoutConfig.getProduct(nextId);

    if (!product) {
        return null;
    }

    return {
        product_id: nextId,
        name: product.name,
        description: product.description || '',
        checkout_url: getSiteUrl() + '/comprar/' + encodeURIComponent(nextId),
    };
}

module.exports = {
    resolveNextProductOffer: resolveNextProductOffer,
    pickNextProductId: pickNextProductId,
};
