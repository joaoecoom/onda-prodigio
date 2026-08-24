var hubConfig = require('./config');
var offers = require('./offers');
var workspaceResolver = require('./workspace-resolver');
var { getSupabaseAdmin } = require('../supabase-admin');

var SECRET_INTEGRATION_SUFFIXES = [
    '_secret',
    '_token',
    '_password',
    '_key',
    'access_token',
    'service_role',
    'webhook_secret',
    'api_secret',
];

function normalizeIdentifier(input) {
    if (!input || typeof input !== 'object') {
        return {};
    }

    return {
        offer_id: String(input.offer_id || input.id || '').trim(),
        slug: offers.normalizeSlug(input.slug || ''),
        domain: hubConfig.normalizeHost(input.domain || input.hostname || input.host || ''),
    };
}

function isSecretIntegrationKey(key) {
    var normalized = String(key || '').toLowerCase();

    return SECRET_INTEGRATION_SUFFIXES.some(function (suffix) {
        return normalized.indexOf(suffix) !== -1;
    });
}

function sanitizeIntegrationsForAgent(integrations) {
    var safe = {};

    Object.keys(integrations || {}).forEach(function (key) {
        var value = integrations[key];

        if (!value || value === '••••••••') {
            return;
        }

        if (isSecretIntegrationKey(key)) {
            safe[key] = value ? '[configured]' : '';
            return;
        }

        safe[key] = value;
    });

    return safe;
}

async function fetchOfferDomains(offerId) {
    var supabase = getSupabaseAdmin();

    if (!supabase || !offerId) {
        return [];
    }

    var result = await supabase
        .from('hub_offer_domains')
        .select('domain, domain_type, is_primary, status, status_message, dns_records, last_checked_at')
        .eq('offer_id', offerId)
        .order('is_primary', { ascending: false });

    if (result.error) {
        return [];
    }

    return result.data || [];
}

async function fetchPrimaryProduct(productId) {
    var supabase = getSupabaseAdmin();

    if (!supabase || !productId) {
        return null;
    }

    var result = await supabase
        .from('products')
        .select('id, name, description, billing_type, sort_order')
        .eq('id', productId)
        .maybeSingle();

    if (result.error || !result.data) {
        return null;
    }

    return result.data;
}

async function resolveOfferRecord(identifier, options) {
    var id = normalizeIdentifier(identifier);
    var forceRefresh = options && options.forceRefresh;

    if (id.offer_id) {
        var offersList = await offers.listOffers({ forceRefresh: forceRefresh });
        var byId = offersList.find(function (offer) {
            return offer.id === id.offer_id;
        });

        if (byId) {
            return byId;
        }
    }

    if (id.slug) {
        var bySlug = await offers.getOfferBySlug(id.slug, { forceRefresh: forceRefresh });

        if (bySlug) {
            return bySlug;
        }
    }

    if (id.domain) {
        var byDomain = await resolveOfferByDomain(id.domain, { forceRefresh: forceRefresh });

        if (byDomain) {
            return byDomain;
        }
    }

    return null;
}

function hostFromUrl(value) {
    if (!value) {
        return '';
    }

    try {
        return hubConfig.normalizeHost(new URL(value).hostname);
    } catch (error) {
        return hubConfig.normalizeHost(value);
    }
}

async function resolveOfferByDomain(domain, options) {
    var normalized = hubConfig.normalizeHost(domain);

    if (!normalized) {
        return null;
    }

    var supabase = getSupabaseAdmin();

    if (supabase) {
        var domainResult = await supabase
            .from('hub_offer_domains')
            .select('offer_id')
            .eq('domain', normalized)
            .limit(1)
            .maybeSingle();

        if (!domainResult.error && domainResult.data && domainResult.data.offer_id) {
            var offersList = await offers.listOffers(options);
            var match = offersList.find(function (offer) {
                return offer.id === domainResult.data.offer_id;
            });

            if (match) {
                return match;
            }
        }
    }

    var offersListFallback = await offers.listOffers(options);

    return offersListFallback.find(function (offer) {
        return hubConfig.normalizeHost(offer.funnel_domain) === normalized ||
            hubConfig.normalizeHost(offer.hub_domain) === normalized ||
            hostFromUrl(offer.site_url) === normalized ||
            hostFromUrl(offer.funnel_url) === normalized;
    }) || null;
}

async function getDefaultOffer(options) {
    var offersList = await offers.listOffers(options);
    var active = offersList.filter(function (offer) {
        return offer.status === 'active';
    });

    if (active.length) {
        return active.sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        })[0];
    }

    if (offersList.length) {
        return offersList[0];
    }

    return offers.getEnvFallbackOffer();
}

async function resolveOfferContext(identifier, options) {
    var opts = options || {};
    var offer = await resolveOfferRecord(identifier, opts);

    if (!offer && opts.allowDefault !== false && !normalizeIdentifier(identifier).offer_id &&
        !normalizeIdentifier(identifier).slug && !normalizeIdentifier(identifier).domain) {
        offer = await getDefaultOffer(opts);
    }

    if (!offer) {
        var error = new Error('Oferta não encontrada.');
        error.code = 'OFFER_NOT_FOUND';
        throw error;
    }

    var includeSecrets = Boolean(opts.includeSecrets);
    var integrations = await offers.getOfferIntegrations(offer.id, { includeSecrets: includeSecrets });
    var domains = await fetchOfferDomains(offer.id);
    var primaryProduct = await fetchPrimaryProduct(offer.primary_product_id);
    var products = primaryProduct ? [primaryProduct] : [];

    var workspacePath = workspaceResolver.resolveWorkspacePathForOffer(offer);
    var legacyWorkspacePath = workspaceResolver.resolveLegacyWorkspacePathForOffer(offer);
    var branch = workspaceResolver.resolveBranchForOffer(offer);
    var safeIntegrations = sanitizeIntegrationsForAgent(integrations);

    var tracking = {
        meta_pixel_id: safeIntegrations.meta_pixel_id || '',
        ga4_measurement_id: safeIntegrations.ga4_measurement_id || '',
        gtm_container_id: safeIntegrations.gtm_container_id || '',
        gtm_server_container: safeIntegrations.gtm_server_container || '',
        server_container_url: safeIntegrations.server_container_url || '',
        meta_reporting_currency: safeIntegrations.meta_reporting_currency || '',
    };

    var context = {
        id: offer.id,
        slug: offer.slug,
        name: offer.name,
        status: offer.status,
        mode: offer.mode,
        primary_product_id: offer.primary_product_id || null,
        site_url: offer.site_url || '',
        funnel_url: offer.funnel_url || '',
        funnel_domain: offer.funnel_domain || '',
        hub_domain: offer.hub_domain || '',
        branding: offer.branding || {},
        settings: offer.settings || {},
        meta_accounts: offer.meta_accounts || [],
        checkouts: offer.checkouts || [],
        domains: domains,
        products: products,
        integrations: includeSecrets ? integrations : safeIntegrations,
        tracking: tracking,
        community: {
            primary_product_id: offer.primary_product_id || null,
            primary_product: primaryProduct,
        },
        workspace: {
            key: workspaceResolver.resolveWorkspaceKeyFromOffer(offer),
            path: workspacePath,
            legacy_path: legacyWorkspacePath,
            branch: branch,
        },
    };

    context.agentContext = buildAgentContextSummary(context);

    return context;
}

function buildAgentContextSummary(context) {
    var lines = [
        'You are working on a HUB DR Ecoom offer.',
        '',
        'Offer:',
        '- ID: ' + context.id,
        '- Name: ' + context.name,
        '- Slug: ' + context.slug,
        '- Status: ' + context.status,
        '- Mode: ' + context.mode,
    ];

    if (context.funnel_domain) {
        lines.push('- Funnel domain: ' + context.funnel_domain);
    }

    if (context.primary_product_id) {
        lines.push('- Primary product ID: ' + context.primary_product_id);
    }

    if (context.products.length) {
        lines.push('- Products: ' + context.products.map(function (product) {
            return product.id + ' (' + product.name + ')';
        }).join(', '));
    }

    if (context.branding && context.branding.from_name) {
        lines.push('- Branding from_name: ' + context.branding.from_name);
    }

    lines.push('');
    lines.push('Workspace:');
    lines.push('- Path: ' + context.workspace.path);
    lines.push('- Branch: ' + context.workspace.branch);

    lines.push('');
    lines.push('Rules:');
    lines.push('- Do not expose or request secrets.');
    lines.push('- Do not deploy, migrate, or force-push unless explicitly asked in the task.');
    lines.push('- Stay within the authorized workspace for this offer.');

    return lines.join('\n');
}

function buildAgentPrompt(context, userPrompt) {
    var summary = context.agentContext || buildAgentContextSummary(context);

    return summary + '\n\nTask:\n' + String(userPrompt || '').trim();
}

module.exports = {
    normalizeIdentifier: normalizeIdentifier,
    resolveOfferContext: resolveOfferContext,
    resolveOfferByDomain: resolveOfferByDomain,
    resolveOfferRecord: resolveOfferRecord,
    getDefaultOffer: getDefaultOffer,
    fetchOfferDomains: fetchOfferDomains,
    fetchPrimaryProduct: fetchPrimaryProduct,
    buildAgentContextSummary: buildAgentContextSummary,
    buildAgentPrompt: buildAgentPrompt,
    sanitizeIntegrationsForAgent: sanitizeIntegrationsForAgent,
    isSecretIntegrationKey: isSecretIntegrationKey,
};
