var stripeEnv = require('../lib/stripe-env');

module.exports = async function handler(req, res) {
    var mode = stripeEnv.resolveStripeMode(req, null);
    var settings = stripeEnv.getStripeSettings(mode);

    if (!settings.publishableKey) {
        return res.status(500).json({ error: 'Stripe não configurado.' });
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
