'use strict';

var funnelCheckoutConfig = require('../funnel-checkout-config');
var productsService = require('../comunidade/products-service');

function pickOfferCheckoutRow(offer, checkoutId) {
    var checkouts = offer && offer.checkouts ? offer.checkouts : [];
    var resolvedId = String(checkoutId || 'main').trim() || 'main';

    var match = checkouts.find(function (row) {
        return row.checkout_id === resolvedId;
    });

    if (match) {
        return match;
    }

    if (resolvedId === 'main') {
        return checkouts.find(function (row) {
            return row.checkout_id === 'main';
        }) || checkouts[0] || null;
    }

    return null;
}

async function resolveUniversalCheckout(offer, options) {
    var opts = options || {};
    var checkoutId = String(opts.checkoutId || 'main').trim() || 'main';
    var mode = opts.mode === 'test' ? 'test' : 'live';
    var productId = String(opts.productId || offer.primary_product_id || offer.id || '').trim();

    if (!offer || !offer.id) {
        throw new Error('Oferta em falta.');
    }

    if (!productId) {
        throw new Error('Produto em falta para checkout.');
    }

    await productsService.assertProductBelongsToOffer(productId, offer.id);

    var row = pickOfferCheckoutRow(offer, checkoutId);
    var funnelDefaults = funnelCheckoutConfig.getCheckoutConfig(checkoutId, mode);
    var amount = row && Number.isFinite(parseInt(row.amount_cents, 10))
        ? parseInt(row.amount_cents, 10)
        : funnelDefaults.amountCents;

    if (!Number.isFinite(amount) || amount < 50) {
        throw new Error('Valor de checkout inválido para esta oferta.');
    }

    var priceId = mode === 'test'
        ? ((row && row.stripe_test_price_id) || (row && row.stripe_price_id) || '')
        : ((row && row.stripe_price_id) || '');

    return {
        checkoutId: checkoutId,
        productId: (row && row.product_id) || productId,
        amountCents: amount,
        currency: (row && row.currency) || 'eur',
        priceId: priceId,
        checkoutPath: (row && row.path) || funnelDefaults.checkoutPath,
        testPath: (row && row.test_path) || funnelDefaults.checkoutPath,
        successPath: (row && row.success_path) || funnelDefaults.thankYouPath || '/comunidade/',
        cancelPath: (row && row.cancel_path) || funnelDefaults.checkoutPath,
        label: (row && row.label) || funnelDefaults.label,
        isActive: !row || row.is_active !== false,
    };
}

module.exports = {
    pickOfferCheckoutRow: pickOfferCheckoutRow,
    resolveUniversalCheckout: resolveUniversalCheckout,
};
