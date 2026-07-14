function resolveStripeMode(req, body) {
    var fromBody = body && body.mode;
    var fromQuery = req && req.query && req.query.mode;
    var value = fromBody || fromQuery || 'live';

    return value === 'test' ? 'test' : 'live';
}

function getStripeSettings(mode) {
    var isTest = mode === 'test';

    return {
        mode: isTest ? 'test' : 'live',
        secretKey: isTest ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY,
        publishableKey: isTest
            ? process.env.STRIPE_TEST_PUBLISHABLE_KEY
            : process.env.STRIPE_PUBLISHABLE_KEY,
        paymentMethodConfiguration: isTest
            ? (process.env.STRIPE_TEST_PAYMENT_METHOD_CONFIGURATION || 'pmc_1PjO9dAAQoQG6ncipbkkjfr9')
            : (process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION || 'pmc_1OuDi3AAQoQG6nciqBp2JYfG'),
        amountCents: parseInt(process.env.STRIPE_AMOUNT_CENTS || '900', 10),
        checkoutId: isTest ? 'checkout9-test' : 'checkout9',
        thankYouPath: isTest ? '/obgd-test/' : '/obgd/',
    };
}

function getStripeClient(mode) {
    var Stripe = require('stripe');
    var settings = getStripeSettings(mode);

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
    getStripeSettings: getStripeSettings,
    getStripeClient: getStripeClient,
};
