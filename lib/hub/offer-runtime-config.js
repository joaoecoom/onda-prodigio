'use strict';

/**
 * Resolve runtime integration config for an offer.
 * Secrets stay server-side — never return this object to the browser/chat.
 */

var integrationsStore = require('./integrations-store');
var integrationResolver = require('./integration-resolver');

async function getOfferRuntimeIntegrations(offerId) {
    var id = String(offerId || '').trim();

    if (!id) {
        return integrationResolver.resolveIntegrationsMap('', {}, { includeSecrets: true });
    }

    var stored = await integrationsStore.getStoredIntegrations(id);
    return integrationResolver.resolveIntegrationsMap(id, stored, { includeSecrets: true });
}

function gmailConfigFromIntegrations(integrations) {
    var map = integrations || {};

    return {
        user: String(map.gmail_user || '').trim(),
        appPassword: String(map.gmail_app_password || '').replace(/\s/g, ''),
        fromName: String(map.gmail_from_name || '').trim(),
    };
}

function whatsappConfigFromIntegrations(integrations) {
    var map = integrations || {};
    var enabled = String(map.whatsapp_enabled || '').trim().toLowerCase() === 'true';
    var baseUrl = String(map.evolution_api_url || '').trim().replace(/\/$/, '');
    var apiKey = String(map.evolution_api_key || '').trim();
    var instance = String(map.evolution_instance_name || '').trim();

    return {
        enabled: enabled,
        baseUrl: baseUrl,
        apiKey: apiKey,
        instance: instance,
        ready: Boolean(enabled && baseUrl && apiKey && instance),
    };
}

function gtmServerConfigFromIntegrations(integrations) {
    var map = integrations || {};

    return {
        serverUrl: String(map.server_container_url || '').trim(),
        serverContainerId: String(map.gtm_server_container || '').trim(),
    };
}

function vturbConfigFromIntegrations(integrations) {
    var map = integrations || {};

    return {
        apiToken: String(map.vturb_analytics_api_token || '').trim(),
        playerId: String(map.vturb_player_id || '').trim(),
    };
}

async function resolveGmailConfig(offerId) {
    if (!offerId) {
        return null;
    }

    var integrations = await getOfferRuntimeIntegrations(offerId);
    var config = gmailConfigFromIntegrations(integrations);

    if (!config.user || !config.appPassword) {
        return null;
    }

    return config;
}

async function resolveWhatsAppConfig(offerId) {
    if (!offerId) {
        return null;
    }

    var integrations = await getOfferRuntimeIntegrations(offerId);
    var config = whatsappConfigFromIntegrations(integrations);

    if (!config.ready) {
        return null;
    }

    return config;
}

module.exports = {
    getOfferRuntimeIntegrations: getOfferRuntimeIntegrations,
    gmailConfigFromIntegrations: gmailConfigFromIntegrations,
    whatsappConfigFromIntegrations: whatsappConfigFromIntegrations,
    gtmServerConfigFromIntegrations: gtmServerConfigFromIntegrations,
    vturbConfigFromIntegrations: vturbConfigFromIntegrations,
    resolveGmailConfig: resolveGmailConfig,
    resolveWhatsAppConfig: resolveWhatsAppConfig,
};
