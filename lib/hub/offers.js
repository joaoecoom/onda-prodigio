var { getSupabaseAdmin } = require('../supabase-admin');
var integrationKeys = require('./integration-keys');
var integrationResolver = require('./integration-resolver');
var slugify = require('./slugify');
var hubConfig = require('./config');
var offerProvisioning = require('./offer-provisioning');
var domainAvailability = require('./domain-availability');

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
        funnel_domain: 'onda-prodigio.vercel.app',
        hub_domain: 'hub-dr-ecoom.vercel.app',
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
        agent_workspace_key: 'onda-prodigio',
        agent_branch: 'agent-proof-of-concept',
        settings: {},
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
            funnel_domain: offer.funnel_domain || '',
            hub_domain: offer.hub_domain || '',
            agent_workspace_key: offer.agent_workspace_key || offer.slug || offer.id,
            agent_branch: offer.agent_branch || 'agent-proof-of-concept',
            settings: offer.settings || {},
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

    return integrationResolver.resolveIntegrationsMap(offerId, stored, {
        includeSecrets: includeSecrets,
    });
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
        funnel_domain: offer.funnel_domain || '',
        hub_domain: offer.hub_domain || '',
        agent_workspace_key: offer.agent_workspace_key || offer.slug || offer.id,
        agent_branch: offer.agent_branch || 'agent-proof-of-concept',
        settings: offer.settings || {},
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

async function createOffer(input) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var name = String((input && input.name) || '').trim();

    if (!name) {
        throw new Error('Nome da oferta em falta.');
    }

    var slug = slugify.slugify((input && input.slug) || name);

    if (!slug) {
        throw new Error('Slug inválido.');
    }

    var existing = await supabase
        .from('hub_offers')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

    if (existing.error) {
        throw new Error(existing.error.message || 'Não foi possível validar a oferta.');
    }

    if (existing.data) {
        throw new Error('Já existe uma oferta com este identificador.');
    }

    var list = await supabase
        .from('hub_offers')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);

    var nextSort = list.data && list.data[0] ? list.data[0].sort_order + 1 : 1;
    var hubDomain = hubConfig.getHubHost();
    var funnelDomain = String((input && input.funnel_domain) || '').trim().toLowerCase();
    var funnelUrl = funnelDomain ? 'https://' + funnelDomain : '';

    if (funnelDomain) {
        var domainCheck = await domainAvailability.checkDomainAvailability(funnelDomain);

        if (!domainCheck.valid) {
            throw new Error(domainCheck.reason || 'Domínio inválido.');
        }

        if (!domainCheck.available) {
            throw new Error(domainCheck.reason || 'Domínio já utilizado.');
        }
    }

    var commercialCurrency = integrationResolver.normalizeCurrency(input && input.currency);
    var reportingCurrency = integrationResolver.normalizeCurrency(
        (input && input.meta_reporting_currency) || commercialCurrency
    ).toUpperCase();

    var insertResult = await supabase
        .from('hub_offers')
        .insert({
            id: slug,
            name: name,
            slug: slug,
            status: 'draft',
            primary_product_id: null,
            site_url: funnelUrl,
            funnel_url: funnelUrl,
            funnel_domain: funnelDomain,
            hub_domain: hubDomain,
            branding: {
                from_name: name,
                accent: '#7c6cff',
            },
            mode: 'test',
            sort_order: nextSort,
            agent_workspace_key: slug,
            agent_branch: 'agent-proof-of-concept',
            settings: {
                integrations_isolated: true,
                commercial_currency: commercialCurrency,
                initial_amount_cents: input && input.amount_cents != null
                    ? parseInt(input.amount_cents, 10)
                    : null,
            },
        })
        .select('*')
        .single();

    if (insertResult.error || !insertResult.data) {
        throw new Error((insertResult.error && insertResult.error.message) || 'Não foi possível criar a oferta.');
    }

    if (hubDomain) {
        await supabase.from('hub_offer_domains').insert({
            offer_id: slug,
            domain: hubDomain,
            domain_type: 'hub',
            is_primary: true,
        });
    }

    if (funnelDomain) {
        await supabase.from('hub_offer_domains').insert({
            offer_id: slug,
            domain: funnelDomain,
            domain_type: 'funnel',
            is_primary: true,
        });
    }

    await offerProvisioning.provisionOfferResources(insertResult.data);

    if (reportingCurrency) {
        await supabase.from('hub_offer_integrations').upsert({
            offer_id: slug,
            integration_key: 'meta_reporting_currency',
            value: reportingCurrency,
            is_secret: false,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'offer_id,integration_key' });
    }

    clearOffersCache();

    return insertResult.data;
}

async function findOrCreateOffer(input) {
    var slug = slugify.slugify((input && input.slug) || (input && input.name) || '');

    if (!slug) {
        throw new Error('Slug inválido.');
    }

    var existing = await getOfferBySlug(slug, { forceRefresh: true });

    if (existing) {
        return {
            offer: existing,
            created: false,
            existing: true,
        };
    }

    var created = await createOffer(input);

    return {
        offer: created,
        created: true,
        existing: false,
    };
}

var PROTECTED_OFFER_SLUGS = ['onda-prodigio'];

function isOfferDeletionAllowed(slug) {
    var normalized = normalizeSlug(slug);

    if (!normalized) {
        return false;
    }

    return PROTECTED_OFFER_SLUGS.indexOf(normalized) === -1;
}

async function archiveOffer(slug) {
    var normalizedSlug = normalizeSlug(slug);

    if (!normalizedSlug) {
        throw new Error('Oferta inválida.');
    }

    if (!isOfferDeletionAllowed(normalizedSlug)) {
        throw new Error('Esta oferta principal não pode ser apagada.');
    }

    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var existing = await supabase
        .from('hub_offers')
        .select('id, name, slug, status')
        .eq('slug', normalizedSlug)
        .neq('status', 'archived')
        .maybeSingle();

    if (existing.error) {
        throw new Error(existing.error.message || 'Não foi possível validar a oferta.');
    }

    if (!existing.data) {
        throw new Error('Oferta não encontrada.');
    }

    var updateResult = await supabase
        .from('hub_offers')
        .update({
            status: 'archived',
            updated_at: new Date().toISOString(),
        })
        .eq('id', existing.data.id)
        .select('*')
        .single();

    if (updateResult.error || !updateResult.data) {
        throw new Error((updateResult.error && updateResult.error.message) || 'Não foi possível apagar a oferta.');
    }

    await supabase.from('hub_event_log').insert({
        offer_id: existing.data.id,
        event_type: 'offer_archived',
        source: 'hub',
        payload: {
            slug: existing.data.slug,
            name: existing.data.name,
        },
    });

    clearOffersCache();

    return updateResult.data;
}

module.exports = {
    normalizeSlug: normalizeSlug,
    listOffers: listOffers,
    getOfferBySlug: getOfferBySlug,
    getOfferIntegrations: getOfferIntegrations,
    toPublicOffer: toPublicOffer,
    clearOffersCache: clearOffersCache,
    getEnvFallbackOffer: getEnvFallbackOffer,
    createOffer: createOffer,
    findOrCreateOffer: findOrCreateOffer,
    archiveOffer: archiveOffer,
    isOfferDeletionAllowed: isOfferDeletionAllowed,
    PROTECTED_OFFER_SLUGS: PROTECTED_OFFER_SLUGS,
    usesEnvIntegrationFallback: integrationResolver.usesEnvIntegrationFallback,
    LEGACY_ENV_FALLBACK_OFFERS: integrationResolver.LEGACY_ENV_FALLBACK_OFFERS,
};
