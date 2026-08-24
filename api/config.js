var stripeClient = require('../lib/hub/stripe-client');
var checkoutResolver = require('../lib/hub/checkout-resolver');
var productCheckoutConfig = require('../lib/product-checkout-config');

module.exports = async function handler(req, res) {
    var stripeContext = await stripeClient.resolveStripeContext(req, req.query || {});
    var settings = stripeContext.settings;
    var checkoutId = require('../lib/stripe-env').resolveCheckoutId(req, null);
    var productId = typeof req.query.product_id === 'string' ? req.query.product_id.trim() : '';

    if (stripeContext.error || !settings.publishableKey) {
        return res.status(500).json({ error: stripeContext.error || 'Stripe não configurado.' });
    }

    if (checkoutId === 'main' && stripeContext.offer) {
        try {
            var universal = await checkoutResolver.resolveUniversalCheckout(stripeContext.offer, {
                checkoutId: 'main',
                mode: settings.mode,
                productId: productId || stripeContext.offer.primary_product_id,
            });

            var bumps = await checkoutResolver.listCheckoutBumps(stripeContext.offer);

            return res.status(200).json({
                publishableKey: settings.publishableKey,
                amountCents: universal.amountCents,
                currency: universal.currency,
                productId: universal.productId,
                productName: settings.offerName || stripeContext.offer.name,
                mode: settings.mode,
                checkoutId: 'main',
                checkoutPath: universal.checkoutPath,
                thankYouPath: universal.successPath,
                offerId: settings.offerId || undefined,
                offerSlug: settings.offerSlug || undefined,
                orderBumps: bumps.map(function (row) {
                    return {
                        bumpId: row.bump_id,
                        productId: row.product_id,
                        label: row.label,
                        amountCents: row.amount_cents,
                    };
                }),
            });
        } catch (error) {
            return res.status(400).json({ error: error.message || 'Checkout indisponível.' });
        }
    }

    if (productId) {
        var product = productCheckoutConfig.getProduct(productId);

        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        return res.status(200).json({
            product: productCheckoutConfig.toPublicProduct(product, settings.mode),
            publishableKey: settings.publishableKey,
            mode: settings.mode,
            offerId: settings.offerId || undefined,
            offerSlug: settings.offerSlug || undefined,
        });
    }

    return res.status(200).json({
        publishableKey: settings.publishableKey,
        amountCents: settings.amountCents,
        currency: 'eur',
        productName: settings.offerName || 'Onda Prodígio',
        mode: settings.mode,
        checkoutId: settings.checkoutId,
        checkoutPath: settings.checkoutPath,
        thankYouPath: settings.thankYouPath,
        offerId: settings.offerId || undefined,
        offerSlug: settings.offerSlug || undefined,
    });
};
