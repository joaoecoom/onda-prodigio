var { getSupabaseAdmin } = require('../supabase-admin');
var integrationKeys = require('./integration-keys');

var offersCache = {
    loadedAt: 0,
    offers: null,
};

var CACHE_TTL_MS = 30 * 1000;

function normalizeSlug(value) {
    return String(value || '').trim().toLowerCase();
}

function readEnvForKey(keyDef) {
    if (!keyDef) {
        return '';
    }

    var primary = String(process.env[keyDef.env] || '').trim();

    if (primary) {
        return primary;
    }

    if (keyDef.altEnv) {
        return String(process.env[keyDef.altEnv] || '').trim();
    }

    return '';
}

function getEnvFallbackOffer() {
    return {
        id: 'onda-prodigio',
        name: 'Onda Prodígio',
        slug: 'onda-prodigio',
        status: 'active',
        primary_product_id: 'onda-prodigio',
        site_url: String(process.env.SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, ''),
        funnel_url: String(process.env.SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, ''),
        branding: {
            from_name: String(process.env.GMAIL_FROM_NAME || 'Angela Campos — Onda Prodígio').trim(),
            accent: '#6366f1',
        },
        mode: 'live',
        sort_order: 1,
        meta_accounts: [
            {
                account_id: '1078209721038923',
                label: 'Onda Prodígio',
                is_default: true,
                sort_order: 1,
            },
        ],
        checkouts: [
            {
                checkout_id: 'checkout9',
                label: '€9',
                path: '/checkout9/',
                test_path: '/checkout9-test/',
                amount_cents: parseInt(process.env.STRIPE_AMOUNT_CENTS || '900', 10),
                stripe_price_id: process.env.STRIPE_PRICE_ID || '',
                stripe_test_price_id: process.env.STRIPE_TEST_PRICE_ID || '',
                sort_order: 1,
            },
            {
                checkout_id: 'checkout19',
                label: '€19',
                path: '/checkout19/',
                test_path: null,
                amount_cents: parseInt(process.env.STRIPE_AMOUNT_CENTS_19 || '1900', 10),
                stripe_price_id: process.env.STRIPE_PRICE_ID_19 || '',
                stripe_test_price_id: process.env.STRIPE_TEST_PRICE_ID_19 || '',
                sort_order: 2,
            },
        ],
    };
}

async function fetchOffersFromDb() {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        return null;
    }

    var offersResult = await supabase
        .from('hub_offers')
        .select('*')
        .neq('status', 'archived')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

    if (offersResult.error || !offersResult.data || !offersResult.data.length) {
        return null;
    }

    var offerIds = offersResult.data.map(function (offer) {
        return offer.id;
    });

    var metaResult = await supabase
        .from('hub_offer_meta_accounts')
        .select('*')
        .in('offer_id', offerIds)
        .order('sort_order', { ascending: true });

    var checkoutsResult = await supabase
        .from('hub_offer_checkouts')
        .select('*')
        .in('offer_id', offerIds)
        .order('sort_order', { ascending: true });

    var metaByOffer = {};
    (metaResult.data || []).forEach(function (row) {
        if (!metaByOffer[row.offer_id]) {
            metaByOffer[row.offer_id] = [];
        }

        metaByOffer[row.offer_id].push({
            account_id: row.account_id,
            label: row.label,
            is_default: row.is_default,
            sort_order: row.sort_order,
        });
    });

    var checkoutsByOffer = {};
    (checkoutsResult.data || []).forEach(function (row) {
        if (!checkoutsByOffer[row.offer_id]) {
            checkoutsByOffer[row.offer_id] = [];
        }

        checkoutsByOffer[row.offer_id].push({
            checkout_id: row.checkout_id,
            label: row.label,
            path: row.path,
            test_path: row.test_path,
            amount_cents: row.amount_cents,
            stripe_price_id: row.stripe_price_id,
            stripe_test_price_id: row.stripe_test_price_id,
            sort_order: row.sort_order,
        });
    });

    return offersResult.data.map(function (offer) {
        return {
            id: offer.id,
            name: offer.name,
            slug: offer.slug,
            status: offer.status,
            primary_product_id: offer.primary_product_id,
            site_url: offer.site_url,
            funnel_url: offer.funnel_url,
            branding: offer.branding || {},
            mode: offer.mode,
            sort_order: offer.sort_order,
            meta_accounts: metaByOffer[offer.id] || [],
            checkouts: checkoutsByOffer[offer.id] || [],
        };
    });
}

async function listOffers(options) {
    var forceRefresh = options && options.forceRefresh;
    var now = Date.now();

    if (!forceRefresh && offersCache.offers && now - offersCache.loadedAt < CACHE_TTL_MS) {
        return offersCache.offers.slice();
    }

    var fromDb = await fetchOffersFromDb();

    if (fromDb && fromDb.length) {
        offersCache.offers = fromDb;
        offersCache.loadedAt = now;
        return fromDb.slice();
    }

    var fallback = [getEnvFallbackOffer()];
    offersCache.offers = fallback;
    offersCache.loadedAt = now;
    return fallback.slice();
}

async function getOfferBySlug(slug, options) {
    var normalized = normalizeSlug(slug);

    if (!normalized) {
        return null;
    }

    var offers = await listOffers(options);

    return offers.find(function (offer) {
        return offer.slug === normalized || offer.id === normalized;
    }) || null;
}

async function getOfferIntegrations(offerId, options) {
    var includeSecrets = options && options.includeSecrets;
    var supabase = getSupabaseAdmin();
    var stored = {};

    if (supabase) {
        var result = await supabase
            .from('hub_offer_integrations')
            .select('integration_key, value, is_secret')
            .eq('offer_id', offerId);

        if (!result.error && result.data) {
            result.data.forEach(function (row) {
                stored[row.integration_key] = row.value;
            });
        }
    }

    var resolved = {};

    integrationKeys.listIntegrationKeys().forEach(function (key) {
        var keyDef = integrationKeys.getIntegrationKeyDef(key);
        var value = stored[key];

        if (!value) {
            value = readEnvForKey(keyDef);
        }

        if (!includeSecrets && keyDef && keyDef.secret && value) {
            resolved[key] = '••••••••';
            return;
        }

        resolved[key] = value || '';
    });

    return resolved;
}

function toPublicOffer(offer, options) {
    var includeIntegrations = options && options.includeIntegrations;

    return {
        id: offer.id,
        name: offer.name,
        slug: offer.slug,
        status: offer.status,
        primary_product_id: offer.primary_product_id,
        site_url: offer.site_url,
        funnel_url: offer.funnel_url,
        branding: offer.branding || {},
        mode: offer.mode,
        sort_order: offer.sort_order,
        meta_accounts: (offer.meta_accounts || []).map(function (account) {
            return {
                account_id: account.account_id,
                label: account.label,
                is_default: account.is_default,
            };
        }),
        checkouts: (offer.checkouts || []).map(function (checkout) {
            return {
                checkout_id: checkout.checkout_id,
                label: checkout.label,
                path: checkout.path,
                test_path: checkout.test_path,
                amount_cents: checkout.amount_cents,
            };
        }),
        integrations: includeIntegrations ? offer.integrations : undefined,
    };
}

function clearOffersCache() {
    offersCache.loadedAt = 0;
    offersCache.offers = null;
}

module.exports = {
    normalizeSlug: normalizeSlug,
    listOffers: listOffers,
    getOfferBySlug: getOfferBySlug,
    getOfferIntegrations: getOfferIntegrations,
    toPublicOffer: toPublicOffer,
    clearOffersCache: clearOffersCache,
    getEnvFallbackOffer: getEnvFallbackOffer,
};
