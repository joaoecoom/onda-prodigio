'use strict';

var offers = require('./offers');
var integrationsStore = require('./integrations-store');
var launchReadiness = require('./launch-readiness');
var vercelDomains = require('./vercel-domains');

var WIZARD_STEPS = [
    {
        id: 'offer',
        title: 'Oferta',
        description: 'Nome, slug e estado base.',
        moduleId: 'definicoes',
        navKey: null,
        checkIds: ['offer'],
    },
    {
        id: 'product',
        title: 'Produto',
        description: 'Produto principal e checkout.',
        moduleId: 'integracoes',
        navKey: null,
        checkIds: ['product', 'checkout'],
    },
    {
        id: 'stripe',
        title: 'Stripe',
        description: 'Credenciais test/live e webhook.',
        moduleId: 'integracoes',
        navKey: null,
        checkIds: ['stripe', 'stripe_webhook'],
    },
    {
        id: 'funnel',
        title: 'Funil',
        description: 'Funnel e sales page publicada.',
        moduleId: 'funil',
        navKey: 'funil',
        checkIds: ['funnel', 'sales_page', 'cta_checkout'],
    },
    {
        id: 'tracking',
        title: 'Tracking',
        description: 'Pixel Meta, CAPI, GTM, Stape e moeda reporting — exclusivos desta oferta.',
        moduleId: 'tracking',
        navKey: null,
        checkIds: ['tracking_meta_pixel', 'tracking_meta_capi', 'tracking_ga4'],
    },
    {
        id: 'community',
        title: 'Comunidade',
        description: 'Produto, módulos e aulas.',
        moduleId: 'comunidade',
        navKey: null,
        checkIds: ['community', 'community_content', 'community_access'],
    },
    {
        id: 'domain',
        title: 'Domínio',
        description: 'Domínio custom, DNS e SSL.',
        moduleId: 'definicoes',
        navKey: null,
        checkIds: ['domain', 'domain_routing'],
    },
    {
        id: 'check',
        title: 'Launch Readiness',
        description: 'Health check completo.',
        moduleId: null,
        navKey: null,
        checkIds: ['commercial_smoke'],
    },
    {
        id: 'ready',
        title: 'Ready to Launch',
        description: 'Validação final antes de ir live.',
        moduleId: null,
        navKey: null,
        checkIds: [],
    },
];

function resolveStripeConnectionStatus(offer, integrationFlags) {
    var mode = offer && offer.mode === 'live' ? 'live' : 'test';
    var flags = integrationFlags || {};
    var secretKey = mode === 'live' ? 'stripe_secret_key' : 'stripe_test_secret_key';
    var publishableKey = mode === 'live' ? 'stripe_publishable_key' : 'stripe_test_publishable_key';
    var hasSecret = Boolean(flags[secretKey]);
    var hasPublishable = Boolean(flags[publishableKey]);

    if (!hasSecret && !hasPublishable) {
        return {
            status: 'not_configured',
            label: 'NOT CONFIGURED',
            mode: mode,
        };
    }

    if (!hasSecret || !hasPublishable) {
        return {
            status: 'error',
            label: 'ERROR',
            mode: mode,
            message: 'Chaves Stripe incompletas.',
        };
    }

    return {
        status: 'connected',
        label: mode === 'live' ? 'LIVE MODE' : 'TEST MODE',
        mode: mode,
    };
}

function stepStatusFromChecks(step, checksById) {
    if (!step.checkIds.length) {
        return 'pending';
    }

    var related = step.checkIds.map(function (id) {
        return checksById[id];
    }).filter(Boolean);

    if (!related.length) {
        return 'pending';
    }

    if (related.some(function (check) {
        return check.severity === 'critical' && check.status === 'fail';
    })) {
        return 'fail';
    }

    if (related.every(function (check) {
        return check.status === 'pass';
    })) {
        return 'pass';
    }

    if (related.some(function (check) {
        return check.status === 'warning';
    })) {
        return 'warning';
    }

    return 'pending';
}

function checksMap(checks) {
    var map = {};

    (checks || []).forEach(function (check) {
        map[check.id] = check;
    });

    return map;
}

async function getWizardState(slug, options) {
    var offer = await offers.getOfferBySlug(slug, { forceRefresh: true });

    if (!offer) {
        throw new Error('Oferta não encontrada.');
    }

    var report = await launchReadiness.evaluateLaunchReadiness(slug, {
        refresh: Boolean(options && options.refresh),
        syncDomain: Boolean(options && options.syncDomain),
    });

    var integrationFields = await integrationsStore.getIntegrationDetails(offer.id, {
        includeSecrets: false,
    });

    var integrationFlags = {};
    integrationFields.forEach(function (field) {
        integrationFlags[field.key] = field.configured;
    });

    var stripe = resolveStripeConnectionStatus(offer, integrationFlags);
    var checksById = checksMap(report.checks);

    var steps = WIZARD_STEPS.map(function (step, index) {
        var status = stepStatusFromChecks(step, checksById);
        var issue = (report.issues || []).find(function (row) {
            return step.checkIds.indexOf(row.id) !== -1;
        });

        return {
            index: index + 1,
            id: step.id,
            title: step.title,
            description: step.description,
            status: status,
            moduleId: step.moduleId,
            navKey: step.navKey,
            action: issue && issue.action ? issue.action : (step.moduleId ? {
                moduleId: step.moduleId,
                navKey: step.navKey,
                label: status === 'pass' ? 'Abrir' : 'Configurar',
            } : null),
            message: issue ? issue.message : '',
        };
    });

    if (report.readiness === 'ready') {
        steps[steps.length - 1].status = 'pass';
    }

    return {
        offer: {
            id: offer.id,
            slug: offer.slug,
            name: offer.name,
            status: offer.status,
            mode: offer.mode,
            primary_product_id: offer.primary_product_id,
        },
        stripe: stripe,
        domain: {
            configured: vercelDomains.isVercelConfigured(),
            funnel_domain: offer.funnel_domain || '',
        },
        launch: {
            readiness: report.readiness,
            label: report.label,
            emoji: report.emoji,
            summary: report.summary,
        },
        steps: steps,
        checks: report.checks,
        issues: report.issues,
    };
}

async function validateOffer(slug, options) {
    var state = await getWizardState(slug, Object.assign({}, options || {}, { refresh: true }));
    var criticalFails = (state.checks || []).filter(function (check) {
        return check.severity === 'critical' && check.status === 'fail';
    });

    return {
        ok: criticalFails.length === 0,
        ready: state.launch.readiness === 'ready',
        readiness: state.launch.readiness,
        label: state.launch.label,
        emoji: state.launch.emoji,
        failures: criticalFails,
        wizard: state,
    };
}

async function launchOffer(slug, options) {
    var validation = await validateOffer(slug, options);

    if (!validation.ok) {
        var error = new Error('Oferta não está pronta para launch.');
        error.code = 'NOT_READY';
        error.validation = validation;
        throw error;
    }

    if (validation.readiness !== 'ready') {
        var almostError = new Error('Oferta quase pronta — resolve avisos críticos antes do launch.');
        almostError.code = 'ALMOST_READY';
        almostError.validation = validation;
        throw almostError;
    }

    var offerSettings = require('./offer-settings');
    var updated = await offerSettings.updateOfferSettings(slug, {
        status: 'active',
    });

    var relaunch = await validateOffer(slug, { refresh: true });

    return {
        ok: true,
        offer: updated,
        launch: relaunch,
    };
}

module.exports = {
    WIZARD_STEPS: WIZARD_STEPS,
    resolveStripeConnectionStatus: resolveStripeConnectionStatus,
    getWizardState: getWizardState,
    validateOffer: validateOffer,
    launchOffer: launchOffer,
};
