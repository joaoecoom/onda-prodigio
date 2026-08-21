'use strict';

/**
 * Products with hardcoded UI/logic in comunidade/produto.js.
 * All other products use the generic renderer (produto-generic.js).
 */
var LEGACY_PRODUCT_IDS = [
    'onda-prodigio',
    'clube-super-cerebros',
    'tardes-sem-brigas',
    'caixa-super-truques',
    'grandes-mentes',
    'codigo-autoridade',
];

function isLegacyProduct(productId) {
    return LEGACY_PRODUCT_IDS.indexOf(String(productId || '').trim()) !== -1;
}

function usesGenericRenderer(productId) {
    return Boolean(productId) && !isLegacyProduct(productId);
}

module.exports = {
    LEGACY_PRODUCT_IDS: LEGACY_PRODUCT_IDS.slice(),
    isLegacyProduct: isLegacyProduct,
    usesGenericRenderer: usesGenericRenderer,
};
