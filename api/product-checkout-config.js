var stripeEnv = require('../lib/stripe-env');
var productCheckoutConfig = require('../lib/product-checkout-config');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var productId = typeof req.query.product_id === 'string' ? req.query.product_id.trim() : '';
    var mode = stripeEnv.resolveStripeMode(req, null);
    var settings = stripeEnv.getStripeSettings(mode);
    var product = productCheckoutConfig.getProduct(productId);

    if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    if (!settings.publishableKey) {
        return res.status(500).json({ error: 'Stripe não configurado.' });
    }

    return res.status(200).json({
        product: productCheckoutConfig.toPublicProduct(product, mode),
        publishableKey: settings.publishableKey,
        mode: settings.mode,
    });
};
