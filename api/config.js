var stripeEnv = require('../lib/stripe-env');
var productCheckoutConfig = require('../lib/product-checkout-config');

module.exports = async function handler(req, res) {
    var mode = stripeEnv.resolveStripeMode(req, null);
    var settings = stripeEnv.getStripeSettings(mode);
    var productId = typeof req.query.product_id === 'string' ? req.query.product_id.trim() : '';

    if (!settings.publishableKey) {
        return res.status(500).json({ error: 'Stripe não configurado.' });
    }

    if (productId) {
        var product = productCheckoutConfig.getProduct(productId);

        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        return res.status(200).json({
            product: productCheckoutConfig.toPublicProduct(product, mode),
            publishableKey: settings.publishableKey,
            mode: settings.mode,
        });
    }

    return res.status(200).json({
        publishableKey: settings.publishableKey,
        amountCents: settings.amountCents,
        currency: 'eur',
        productName: 'Onda Prodígio',
        mode: settings.mode,
        checkoutPath: settings.checkoutId === 'checkout9-test' ? '/checkout9-test/' : '/checkout9/',
        thankYouPath: settings.thankYouPath,
    });
};
