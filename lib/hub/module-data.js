var offers = require('./offers');
var integrationKeys = require('./integration-keys');
var integrationsStore = require('./integrations-store');
var integrationResolver = require('./integration-resolver');
var geminiAssistant = require('./gemini-assistant');
var { getSupabaseAdmin } = require('../supabase-admin');

var META_UTM_TEMPLATE = 'utm_source=facebook&utm_medium=paid&utm_content={{ad.name}}&utm_campaign={{campaign.name}}&utm_term={{adset.name}}';

async function countQueue(table, status) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        return 0;
    }

    var query = supabase.from(table).select('id', { count: 'exact', head: true });

    if (status) {
        query = query.eq('status', status);
    }

    var result = await query;

    if (result.error) {
        return 0;
    }

    return result.count || 0;
}

async function getTrackingModule(offer, integrations) {
    var funnelBase = (offer.funnel_url || offer.site_url || '').replace(/\/$/, '');
    var usesEnvFallback = integrationResolver.usesEnvIntegrationFallback(offer.id);
    var commercialCurrency = (
        (offer.settings && offer.settings.commercial_currency) ||
        ((offer.checkouts || [])[0] && (offer.checkouts || [])[0].currency) ||
        'eur'
    ).toUpperCase();

        return {
            id: 'tracking',
            label: 'Tracking',
            isolated: !usesEnvFallback,
            uses_env_fallback: usesEnvFallback,
            gemini: require('./gemini-assistant').getStatus(),
        health: {
            pixel: Boolean(integrations.meta_pixel_id),
            capi: Boolean(integrations.meta_access_token),
            ga4: Boolean(integrations.ga4_measurement_id),
            stape: Boolean(integrations.server_container_url),
            gtm_server: Boolean(integrations.gtm_server_container),
        },
        values: {
            meta_pixel_id: integrations.meta_pixel_id || '—',
            ga4_measurement_id: integrations.ga4_measurement_id || '—',
            gtm_container_id: integrations.gtm_container_id || '—',
            gtm_server_container: integrations.gtm_server_container || '—',
            server_container_url: integrations.server_container_url || '—',
            meta_reporting_currency: integrations.meta_reporting_currency || commercialCurrency,
            commercial_currency: commercialCurrency,
        },
        utm_template: META_UTM_TEMPLATE,
        script_path: '/assets/tracking.js',
        funnel_url: funnelBase,
        meta_accounts: offer.meta_accounts || [],
    };
}

async function getRecuperaModule(offer) {
    var pendingFailed = await countQueue('failed_payment_recovery_queue', 'pending');
    var pendingNeverLoggedIn = await countQueue('never_logged_in_whatsapp_queue', 'pending');
    var offerFlows = [];

    try {
        var flowsService = require('./offer-flows');
        offerFlows = await flowsService.listFlows(offer && offer.id, { kind: 'recovery' });
    } catch (error) {
        offerFlows = [];
    }

    return {
        id: 'recupera',
        label: 'Recupera',
        offer: offer ? { id: offer.id, slug: offer.slug, name: offer.name } : null,
        queues: {
            failed_payments_pending: pendingFailed,
            never_logged_in_pending: pendingNeverLoggedIn,
        },
        flows: [
            {
                id: 'failed_payment',
                label: 'Pagamento falhado',
                channels: ['Email', 'WhatsApp'],
                status: 'live',
            },
            {
                id: 'abandoned_checkout',
                label: 'Checkout abandonado',
                channels: ['Email', 'WhatsApp'],
                status: 'live',
            },
            {
                id: 'never_logged_in',
                label: 'Nunca entrou na comunidade',
                channels: ['Email', 'WhatsApp'],
                status: 'live',
            },
        ].concat((offerFlows || []).map(function (flow) {
            return {
                id: flow.id,
                label: flow.name,
                channels: ['Email', 'WhatsApp'],
                status: flow.status === 'active' ? 'live' : 'soon',
                trigger: flow.trigger,
                nodes: ((flow.definition && flow.definition.nodes) || []).length,
                editable: true,
            };
        })),
        gemini: require('./gemini-assistant').getStatus(),
        actions: [
            { id: 'admin_failed_payments', label: 'Ver falhados no Dashboard' },
            { id: 'admin_resend_never_logged_in', label: 'Reenviar email a quem nunca entrou', method: 'POST' },
        ],
    };
}

async function getImpulsionaModule(offer) {
    var supabase = getSupabaseAdmin();
    var purchaseEmails = 0;
    var automationFlows = [];

    if (supabase) {
        var result = await supabase
            .from('purchase_email_log')
            .select('id', { count: 'exact', head: true });

        if (!result.error) {
            purchaseEmails = result.count || 0;
        }
    }

    try {
        var flowsService = require('./offer-flows');
        automationFlows = await flowsService.listFlows(offer && offer.id, { kind: 'automation' });
    } catch (error) {
        automationFlows = [];
    }

    return {
        id: 'impulsiona',
        label: 'Impulsiona',
        offer: offer ? { id: offer.id, slug: offer.slug, name: offer.name } : null,
        stats: {
            purchase_emails_sent: purchaseEmails,
        },
        flows: [
            {
                id: 'purchase_welcome',
                label: 'Email de boas-vindas pós-compra',
                channels: ['Email', 'WhatsApp'],
                status: 'live',
            },
            {
                id: 'comment_reply',
                label: 'Resposta a comentários (email)',
                channels: ['Email'],
                status: 'live',
            },
            {
                id: 'upsell_sequences',
                label: 'Sequências upsell / cross-sell',
                channels: ['Email', 'WhatsApp'],
                status: 'soon',
            },
        ].concat((automationFlows || []).map(function (flow) {
            return {
                id: flow.id,
                label: flow.name,
                channels: ['Email', 'WhatsApp'],
                status: flow.status === 'active' ? 'live' : 'soon',
                trigger: flow.trigger,
                nodes: ((flow.definition && flow.definition.nodes) || []).length,
                editable: true,
            };
        })),
        gemini: require('./gemini-assistant').getStatus(),
    };
}

async function getAiAgentModule(offer) {
    var aiTasks = require('./ai-tasks');
    var recentTasks = [];

    try {
        recentTasks = await aiTasks.listTasks({
            offer_id: offer.id,
            limit: 10,
        });
    } catch (error) {
        recentTasks = [];
    }

    return {
        id: 'ai-agent',
        label: 'AI Agent',
        offer: {
            id: offer.id,
            name: offer.name,
            slug: offer.slug,
        },
        task_types: ['general', 'analysis', 'content', 'code'],
        recent_tasks: recentTasks,
    };
}

async function getIntegracoesModule(offer) {
    var fields = await integrationsStore.getIntegrationDetails(offer.id, {
        includeSecrets: false,
    });
    var usesEnvFallback = integrationResolver.usesEnvIntegrationFallback(offer.id);
    var groups = {};

    Object.keys(integrationKeys.INTEGRATION_GROUPS).forEach(function (groupId) {
        var group = integrationKeys.INTEGRATION_GROUPS[groupId];
        groups[groupId] = {
            label: group.label,
            items: group.keys.map(function (key) {
                var field = fields.find(function (entry) {
                    return entry.key === key;
                }) || {
                    key: key,
                    label: key.replace(/_/g, ' '),
                    secret: false,
                    source: '',
                    configured: false,
                    value: '',
                };

                return field;
            }),
        };
    });

    var dbCount = fields.filter(function (field) {
        return field.source === 'db';
    }).length;
    var envCount = fields.filter(function (field) {
        return field.source === 'env';
    }).length;

    return {
        id: 'integracoes',
        label: 'Integrações',
        groups: groups,
        uses_env_fallback: usesEnvFallback,
        can_import_env: usesEnvFallback,
        stats: {
            db: dbCount,
            env: envCount,
            missing: fields.filter(function (field) {
                return !field.configured;
            }).length,
        },
    };
}

async function getFunilModule(offer) {
    var funnelEngine = require('./funnel-engine');
    var funnels = [];

    try {
        funnels = await funnelEngine.listFunnels(offer.id);
    } catch (error) {
        funnels = [];
    }

    return {
        id: 'funil',
        label: 'Funil',
        offer: {
            id: offer.id,
            slug: offer.slug,
            name: offer.name,
        },
        public_site_url: offer.funnel_url || (offer.funnel_domain ? 'https://' + offer.funnel_domain : ''),
        funnels: funnels,
        gemini: geminiAssistant.getStatus(),
    };
}

async function getDominiosModule(offer) {
    var hubConfig = require('./config');
    var hubAdminAccess = require('../comunidade/hub-admin-access');
    var { getSupabaseAdmin } = require('../supabase-admin');
    var domains = [];
    var supabase = getSupabaseAdmin();

    if (supabase) {
        var domainsResult = await supabase
            .from('hub_offer_domains')
            .select('domain, domain_type, is_primary')
            .eq('offer_id', offer.id)
            .order('domain_type', { ascending: true });

        if (!domainsResult.error) {
            domains = domainsResult.data || [];
        }
    }

    return {
        id: 'dominios',
        label: 'Domínios',
        offer: {
            slug: offer.slug,
            name: offer.name,
            funnel_domain: offer.funnel_domain || '',
            hub_domain: offer.hub_domain || hubConfig.getHubHost(),
            funnel_url: offer.funnel_url || '',
            site_url: offer.site_url || '',
        },
        domains: domains,
        urls: {
            funnel: offer.funnel_url || (offer.funnel_domain ? 'https://' + offer.funnel_domain : ''),
            community: hubAdminAccess.resolveCommunityUrl(offer),
            hub: hubConfig.getHubBaseUrl(),
        },
        gemini: require('./gemini-assistant').getStatus(),
    };
}

async function getCheckoutModule(offer) {
    var checkoutBuilder = require('./checkout-builder');
    var context = await checkoutBuilder.getCheckoutContext(offer.id);
    var checkout = (offer.checkouts || []).find(function (row) {
        return row.checkout_id === 'main';
    }) || (offer.checkouts || [])[0] || {};

    return {
        id: 'checkout',
        label: 'Checkout',
        offer: {
            id: offer.id,
            slug: offer.slug,
            name: offer.name,
        },
        checkout: {
            checkout_id: checkout.checkout_id || 'main',
            amount_cents: checkout.amount_cents || context.checkout && context.checkout.amountCents,
            currency: checkout.currency || (context.checkout && context.checkout.currency) || 'eur',
            path: checkout.path || context.preview_url,
        },
        template: context.template,
        order_bumps: context.order_bumps,
        preview_url: context.preview_url,
        live_url: checkout.path || ('/checkout/?offer=' + encodeURIComponent(offer.slug)),
        gemini: geminiAssistant.getStatus(),
    };
}

async function getDefinicoesModule(offer) {
    var commercialCurrency = integrationResolver.normalizeCurrency(
        (offer.settings && offer.settings.commercial_currency) ||
        ((offer.checkouts || [])[0] && (offer.checkouts || [])[0].currency)
    );

    return {
        id: 'definicoes',
        label: 'Definições',
        offer: {
            name: offer.name,
            slug: offer.slug,
            status: offer.status,
            mode: offer.mode,
            primary_product_id: offer.primary_product_id || '',
            commercial_currency: commercialCurrency,
            branding: offer.branding || {},
        },
        supported_currencies: integrationResolver.SUPPORTED_CURRENCIES,
    };
}

async function getModuleData(offerSlug, moduleId) {
    var offer = await offers.getOfferBySlug(offerSlug);

    if (!offer) {
        throw new Error('Oferta não encontrada.');
    }

    var integrations = await offers.getOfferIntegrations(offer.id, {
        includeSecrets: false,
    });

    if (moduleId === 'tracking') {
        return getTrackingModule(offer, integrations);
    }

    if (moduleId === 'recupera') {
        return getRecuperaModule(offer);
    }

    if (moduleId === 'impulsiona') {
        return getImpulsionaModule(offer);
    }

    if (moduleId === 'integracoes') {
        return getIntegracoesModule(offer);
    }

    if (moduleId === 'ai-agent') {
        return getAiAgentModule(offer);
    }

    if (moduleId === 'funil') {
        return getFunilModule(offer);
    }

    if (moduleId === 'dominios') {
        return getDominiosModule(offer);
    }

    if (moduleId === 'checkout') {
        return getCheckoutModule(offer);
    }

    if (moduleId === 'definicoes') {
        return getDefinicoesModule(offer);
    }

    throw new Error('Módulo não encontrado.');
}

module.exports = {
    getModuleData: getModuleData,
    META_UTM_TEMPLATE: META_UTM_TEMPLATE,
};
