'use strict';

var integrationKeys = require('./integration-keys');

var LEGACY_ENV_FALLBACK_OFFERS = ['onda-prodigio'];

var SUPPORTED_CURRENCIES = ['eur', 'usd', 'brl'];

function normalizeCurrency(value) {
    var normalized = String(value || 'eur').trim().toLowerCase();

    if (SUPPORTED_CURRENCIES.indexOf(normalized) === -1) {
        return 'eur';
    }

    return normalized;
}

function usesEnvIntegrationFallback(offerId) {
    var normalized = String(offerId || '').trim().toLowerCase();

    return LEGACY_ENV_FALLBACK_OFFERS.indexOf(normalized) !== -1;
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

function resolveIntegrationValue(offerId, key, storedValue, options) {
    var opts = options || {};
    var keyDef = integrationKeys.getIntegrationKeyDef(key);
    var value = String(storedValue || '').trim();

    if (!value && usesEnvIntegrationFallback(offerId)) {
        value = readEnvForKey(keyDef);
    }

    if (!opts.includeSecrets && keyDef && keyDef.secret && value) {
        return '••••••••';
    }

    return value || '';
}

function resolveIntegrationsMap(offerId, stored, options) {
    var resolved = {};

    integrationKeys.listIntegrationKeys().forEach(function (key) {
        resolved[key] = resolveIntegrationValue(offerId, key, stored && stored[key], options);
    });

    return resolved;
}

function describeKeySource(offerId, key, storedValue) {
    if (String(storedValue || '').trim()) {
        return 'db';
    }

    if (usesEnvIntegrationFallback(offerId)) {
        var keyDef = integrationKeys.getIntegrationKeyDef(key);
        var envValue = readEnvForKey(keyDef);

        if (envValue) {
            return 'env';
        }
    }

    return '';
}

module.exports = {
    LEGACY_ENV_FALLBACK_OFFERS: LEGACY_ENV_FALLBACK_OFFERS,
    SUPPORTED_CURRENCIES: SUPPORTED_CURRENCIES,
    normalizeCurrency: normalizeCurrency,
    usesEnvIntegrationFallback: usesEnvIntegrationFallback,
    readEnvForKey: readEnvForKey,
    resolveIntegrationValue: resolveIntegrationValue,
    resolveIntegrationsMap: resolveIntegrationsMap,
    describeKeySource: describeKeySource,
};
