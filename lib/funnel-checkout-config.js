var FUNNEL_CHECKOUTS = {
    checkout9: {
        id: 'checkout9',
        amountCentsEnv: 'STRIPE_AMOUNT_CENTS',
        defaultAmountCents: 900,
        priceIdEnv: 'STRIPE_PRICE_ID',
        path: '/checkout9/',
        label: '€9',
        testId: 'checkout9-test',
        testPath: '/checkout9-test/',
    },
    checkout19: {
        id: 'checkout19',
        amountCentsEnv: 'STRIPE_AMOUNT_CENTS_19',
        defaultAmountCents: 1900,
        priceIdEnv: 'STRIPE_PRICE_ID_19',
        path: '/checkout19/',
        label: '€19',
        testId: null,
        testPath: null,
    },
};

var ONDA_PRODIGIO_CHECKOUT_IDS = ['checkout9', 'checkout19'];

function resolveCheckoutId(raw) {
    var id = String(raw || '').trim();

    if (FUNNEL_CHECKOUTS[id]) {
        return id;
    }

    return 'checkout9';
}

function getCheckoutConfig(checkoutId, mode) {
    var config = FUNNEL_CHECKOUTS[resolveCheckoutId(checkoutId)];
    var isTest = mode === 'test';

    if (isTest) {
        return {
            checkoutId: config.testId || 'checkout9-test',
            amountCents: parseInt(process.env.STRIPE_AMOUNT_CENTS || '900', 10),
            priceId: process.env.STRIPE_PRICE_ID || '',
            checkoutPath: config.testPath || '/checkout9-test/',
            thankYouPath: '/obgd-test/',
            label: config.label,
            sourceCheckoutId: config.id,
        };
    }

    return {
        checkoutId: config.id,
        amountCents: parseInt(process.env[config.amountCentsEnv] || String(config.defaultAmountCents), 10),
        priceId: process.env[config.priceIdEnv] || '',
        checkoutPath: config.path,
        thankYouPath: '/obgd/',
        label: config.label,
        sourceCheckoutId: config.id,
    };
}

function isOndaProdigioFunnelCheckout(checkoutId) {
    return ONDA_PRODIGIO_CHECKOUT_IDS.indexOf(String(checkoutId || '').trim()) !== -1;
}

function parseCheckoutFilter(query) {
    var value = String((query && (query.checkout_variant || query.checkout)) || 'all').trim();

    if (!value || value === 'all') {
        return null;
    }

    if (isOndaProdigioFunnelCheckout(value)) {
        return value;
    }

    return null;
}

function getCheckoutFilterLabel(checkoutFilter) {
    if (!checkoutFilter) {
        return 'Onda Prodígio · €9 + €19';
    }

    var config = FUNNEL_CHECKOUTS[checkoutFilter];

    return config
        ? ('Onda Prodígio · ' + config.label)
        : 'Onda Prodígio';
}

function getRecoveryCheckoutPath(checkoutId) {
    var config = getCheckoutConfig(checkoutId, 'live');
    return config.checkoutPath;
}

module.exports = {
    FUNNEL_CHECKOUTS: FUNNEL_CHECKOUTS,
    ONDA_PRODIGIO_CHECKOUT_IDS: ONDA_PRODIGIO_CHECKOUT_IDS,
    resolveCheckoutId: resolveCheckoutId,
    getCheckoutConfig: getCheckoutConfig,
    isOndaProdigioFunnelCheckout: isOndaProdigioFunnelCheckout,
    parseCheckoutFilter: parseCheckoutFilter,
    getCheckoutFilterLabel: getCheckoutFilterLabel,
    getRecoveryCheckoutPath: getRecoveryCheckoutPath,
};
