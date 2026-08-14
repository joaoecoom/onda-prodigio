var funnelCheckoutConfig = require('./funnel-checkout-config');

function resolveStripeMode(req, body) {
    var fromBody = body && body.mode;
    var fromQuery = req && req.query && req.query.mode;
    var value = fromBody || fromQuery || 'live';

    return value === 'test' ? 'test' : 'live';
}

function resolveCheckoutId(req, body) {
    var fromBody = body && body.checkout_id;
    var fromQuery = req && req.query && req.query.checkout;

    return funnelCheckoutConfig.resolveCheckoutId(fromBody || fromQuery || 'checkout9');
}

function getStripeSettings(mode, checkoutId) {
    var checkout = funnelCheckoutConfig.getCheckoutConfig(checkoutId, mode);

    return {
        mode: mode === 'test' ? 'test' : 'live',
        secretKey: mode === 'test' ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY,
        publishableKey: mode === 'test'
            ? process.env.STRIPE_TEST_PUBLISHABLE_KEY
            : process.env.STRIPE_PUBLISHABLE_KEY,
        paymentMethodConfiguration: mode === 'test'
            ? (process.env.STRIPE_TEST_PAYMENT_METHOD_CONFIGURATION || 'pmc_1PjO9dAAQoQG6ncipbkkjfr9')
            : (process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION || 'pmc_1OuDi3AAQoQG6nciqBp2JYfG'),
        amountCents: checkout.amountCents,
        priceId: checkout.priceId,
        checkoutId: checkout.checkoutId,
        checkoutPath: checkout.checkoutPath,
        thankYouPath: checkout.thankYouPath,
        sourceCheckoutId: checkout.sourceCheckoutId,
    };
}

function getStripeClient(mode, checkoutId) {
    var Stripe = require('stripe');
    var settings = getStripeSettings(mode, checkoutId);

    if (!settings.secretKey) {
        return {
            error: isTestMissingKey(mode),
            settings: settings,
            stripe: null,
        };
    }

    return {
        error: null,
        settings: settings,
        stripe: new Stripe(settings.secretKey),
    };
}

function isTestMissingKey(mode) {
    if (mode === 'test') {
        return 'STRIPE_TEST_SECRET_KEY em falta.';
    }

    return 'STRIPE_SECRET_KEY em falta.';
}

module.exports = {
    resolveStripeMode: resolveStripeMode,
    resolveCheckoutId: resolveCheckoutId,
    getStripeSettings: getStripeSettings,
    getStripeClient: getStripeClient,
};
