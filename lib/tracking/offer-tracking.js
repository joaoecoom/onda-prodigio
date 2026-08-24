'use strict';

var offerContext = require('../hub/offer-context');
var offers = require('../hub/offers');
var integrationResolver = require('../hub/integration-resolver');

function pickIntegrationValue(integrations, key, offerId) {
    var stored = integrations && integrations[key];

    if (stored) {
        return stored;
    }

    if (offerId && integrationResolver.usesEnvIntegrationFallback(offerId)) {
        return integrationResolver.readEnvForKey(
            require('../hub/integration-keys').getIntegrationKeyDef(key)
        );
    }

    return '';
}

function buildServerTrackingConfig(integrations, offer) {
    var offerId = offer ? offer.id : '';
    var siteUrl = (offer && (offer.funnel_url || offer.site_url)) || process.env.SITE_URL || '';
    var reportingCurrency = pickIntegrationValue(integrations, 'meta_reporting_currency', offerId) ||
        (offer && offer.settings && offer.settings.commercial_currency) ||
        'EUR';

    return {
        offer_id: offerId,
        offer_slug: offer ? offer.slug : '',
        offer_name: offer ? offer.name : '',
        meta_pixel_id: pickIntegrationValue(integrations, 'meta_pixel_id', offerId),
        meta_access_token: pickIntegrationValue(integrations, 'meta_access_token', offerId),
        meta_test_event_code: pickIntegrationValue(integrations, 'meta_test_event_code', offerId),
        meta_reporting_currency: String(reportingCurrency).toUpperCase(),
        ga4_measurement_id: pickIntegrationValue(integrations, 'ga4_measurement_id', offerId),
        ga4_api_secret: pickIntegrationValue(integrations, 'ga4_api_secret', offerId),
        gtm_container_id: pickIntegrationValue(integrations, 'gtm_container_id', offerId),
        gtm_server_container: pickIntegrationValue(integrations, 'gtm_server_container', offerId),
        server_container_url: pickIntegrationValue(integrations, 'server_container_url', offerId),
        site_url: siteUrl,
    };
}

function buildClientTrackingPayload(context) {
    var tracking = (context && context.tracking) || {};
    var offerId = context && context.id;
    var usesEnv = offerId && integrationResolver.usesEnvIntegrationFallback(offerId);
    var integrationKeys = require('../hub/integration-keys');
    var offerMeta = context ? {
        offer_id: context.id,
        offer_slug: context.slug,
        offer_name: context.name,
    } : {};

    function envOrEmpty(key) {
        if (!usesEnv) {
            return '';
        }

        return integrationResolver.readEnvForKey(integrationKeys.getIntegrationKeyDef(key)) || '';
    }

    return Object.assign({
        gtmContainerId: tracking.gtm_container_id || envOrEmpty('gtm_container_id'),
        gtmServerContainerId: tracking.gtm_server_container || envOrEmpty('gtm_server_container'),
        serverContainerUrl: tracking.server_container_url || envOrEmpty('server_container_url'),
        stapeGtmUrl: tracking.server_container_url || envOrEmpty('server_container_url'),
        ga4MeasurementId: tracking.ga4_measurement_id || envOrEmpty('ga4_measurement_id'),
        metaPixelId: tracking.meta_pixel_id || envOrEmpty('meta_pixel_id'),
        gtmWebEnabled: process.env.GTM_WEB_ENABLED === 'true',
        stapeCookieExtenderEnabled: process.env.STAPE_COOKIE_EXTENDER_ENABLED === 'true',
        metaReportingCurrency: (
            tracking.meta_reporting_currency ||
            (context && context.settings && context.settings.commercial_currency) ||
            envOrEmpty('meta_reporting_currency') ||
            'EUR'
        ).toUpperCase(),
        metaEurToUsdRate: parseFloat(process.env.META_EUR_TO_USD_RATE || '1.09'),
        metaEurToBrlRate: parseFloat(process.env.META_EUR_TO_BRL_RATE || '6.10'),
    }, offerMeta);
}

async function resolveServerTrackingFromMetadata(metadata) {
    var meta = metadata || {};
    var offerId = String(meta.offer_id || meta.hub_offer_id || '').trim();
    var offerSlug = String(meta.offer_slug || meta.hub_offer_slug || '').trim();

    if (offerId || offerSlug) {
        try {
            var context = await offerContext.resolveOfferContext(
                offerId ? { offer_id: offerId } : { slug: offerSlug }
            );
            var integrations = await offers.getOfferIntegrations(context.id, { includeSecrets: true });

            return buildServerTrackingConfig(integrations, context);
        } catch (error) {
            // fall through to default offer
        }
    }

    var fallback = await offerContext.resolveOfferContext({}, { allowDefault: true });
    var fallbackIntegrations = await offers.getOfferIntegrations(fallback.id, { includeSecrets: true });

    return buildServerTrackingConfig(fallbackIntegrations, fallback);
}

async function resolveClientTrackingContext(identifier, options) {
    try {
        if (identifier && (identifier.slug || identifier.offer_id || identifier.domain)) {
            return await offerContext.resolveOfferContext(identifier, options);
        }

        return await offerContext.resolveOfferContext({}, Object.assign({ allowDefault: true }, options));
    } catch (error) {
        return null;
    }
}

module.exports = {
    buildServerTrackingConfig: buildServerTrackingConfig,
    buildClientTrackingPayload: buildClientTrackingPayload,
    resolveServerTrackingFromMetadata: resolveServerTrackingFromMetadata,
    resolveClientTrackingContext: resolveClientTrackingContext,
};
