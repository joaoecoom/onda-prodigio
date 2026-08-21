var { getSupabaseAdmin } = require('../supabase-admin');
var integrationKeys = require('./integration-keys');
var offers = require('./offers');

var SECRET_MASK = '••••••••';

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

function isMaskedValue(value) {
    return String(value || '').trim() === SECRET_MASK;
}

function isEmptyValue(value) {
    return !String(value || '').trim();
}

async function getStoredIntegrations(offerId) {
    var supabase = getSupabaseAdmin();
    var stored = {};

    if (!supabase) {
        return stored;
    }

    var result = await supabase
        .from('hub_offer_integrations')
        .select('integration_key, value, is_secret')
        .eq('offer_id', offerId);

    if (!result.error && result.data) {
        result.data.forEach(function (row) {
            stored[row.integration_key] = row.value;
        });
    }

    return stored;
}

async function getIntegrationDetails(offerId, options) {
    var includeSecrets = options && options.includeSecrets;
    var stored = await getStoredIntegrations(offerId);
    var fields = [];

    integrationKeys.listIntegrationKeys().forEach(function (key) {
        var keyDef = integrationKeys.getIntegrationKeyDef(key);
        var dbValue = stored[key] || '';
        var envValue = readEnvForKey(keyDef);
        var source = dbValue ? 'db' : (envValue ? 'env' : '');
        var value = dbValue || envValue || '';

        fields.push({
            key: key,
            label: key.replace(/_/g, ' '),
            secret: Boolean(keyDef && keyDef.secret),
            source: source,
            configured: Boolean(value),
            value: !includeSecrets && keyDef && keyDef.secret && value ? SECRET_MASK : value,
        });
    });

    return fields;
}

async function saveOfferIntegrations(offerId, patches) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var stored = await getStoredIntegrations(offerId);
    var rows = [];
    var updatedKeys = [];

    Object.keys(patches || {}).forEach(function (key) {
        var keyDef = integrationKeys.getIntegrationKeyDef(key);

        if (!keyDef) {
            return;
        }

        var incoming = patches[key];

        if (incoming === undefined || incoming === null) {
            return;
        }

        var normalized = String(incoming).trim();

        if (keyDef.secret && (isMaskedValue(normalized) || isEmptyValue(normalized))) {
            return;
        }

        if (!keyDef.secret && isEmptyValue(normalized)) {
            return;
        }

        rows.push({
            offer_id: offerId,
            integration_key: key,
            value: normalized,
            is_secret: Boolean(keyDef.secret),
            updated_at: new Date().toISOString(),
        });
        updatedKeys.push(key);
    });

    if (!rows.length) {
        return {
            updated: [],
            message: 'Nada para guardar.',
        };
    }

    var result = await supabase
        .from('hub_offer_integrations')
        .upsert(rows, { onConflict: 'offer_id,integration_key' });

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível guardar integrações.');
    }

    await supabase.from('hub_event_log').insert({
        offer_id: offerId,
        event_type: 'integrations_updated',
        source: 'hub',
        payload: {
            keys: updatedKeys,
        },
    });

    offers.clearOffersCache();

    return {
        updated: updatedKeys,
        message: 'Integrações guardadas.',
    };
}

async function importIntegrationsFromEnv(offerId) {
    var rows = [];
    var importedKeys = [];

    integrationKeys.listIntegrationKeys().forEach(function (key) {
        var keyDef = integrationKeys.getIntegrationKeyDef(key);
        var value = readEnvForKey(keyDef);

        if (!value) {
            return;
        }

        rows.push({
            offer_id: offerId,
            integration_key: key,
            value: value,
            is_secret: Boolean(keyDef.secret),
            updated_at: new Date().toISOString(),
        });
        importedKeys.push(key);
    });

    if (!rows.length) {
        return {
            imported: [],
            message: 'Nenhuma credencial encontrada no env.',
        };
    }

    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var result = await supabase
        .from('hub_offer_integrations')
        .upsert(rows, { onConflict: 'offer_id,integration_key' });

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível importar integrações.');
    }

    await supabase.from('hub_event_log').insert({
        offer_id: offerId,
        event_type: 'integrations_imported_env',
        source: 'hub',
        payload: {
            keys: importedKeys,
        },
    });

    offers.clearOffersCache();

    return {
        imported: importedKeys,
        message: importedKeys.length + ' credenciais importadas do env.',
    };
}

function buildIntegrationStatusSummary(offerId, details) {
    var fields = details || [];
    var byKey = {};

    fields.forEach(function (field) {
        byKey[field.key] = field.configured;
    });

    function groupConfigured(keys) {
        return keys.every(function (key) {
            return Boolean(byKey[key]);
        });
    }

    return {
        offer_id: offerId,
        stripe: {
            configured: groupConfigured([
                'stripe_test_secret_key',
                'stripe_test_publishable_key',
            ]) || groupConfigured([
                'stripe_secret_key',
                'stripe_publishable_key',
            ]),
            test_mode: groupConfigured([
                'stripe_test_secret_key',
                'stripe_test_publishable_key',
            ]),
            live_mode: groupConfigured([
                'stripe_secret_key',
                'stripe_publishable_key',
            ]),
            webhook: Boolean(byKey.stripe_webhook_secret),
        },
        meta: {
            configured: Boolean(byKey.meta_pixel_id) && Boolean(byKey.meta_access_token),
            pixel: Boolean(byKey.meta_pixel_id),
            capi: Boolean(byKey.meta_access_token),
        },
        ga4: {
            configured: Boolean(byKey.ga4_measurement_id) && Boolean(byKey.ga4_api_secret),
            measurement_id: Boolean(byKey.ga4_measurement_id),
            api_secret: Boolean(byKey.ga4_api_secret),
        },
    };
}

async function getIntegrationStatusSummary(offerId) {
    var details = await getIntegrationDetails(offerId, { includeSecrets: false });
    return buildIntegrationStatusSummary(offerId, details);
}

module.exports = {
    SECRET_MASK: SECRET_MASK,
    getIntegrationDetails: getIntegrationDetails,
    getIntegrationStatusSummary: getIntegrationStatusSummary,
    buildIntegrationStatusSummary: buildIntegrationStatusSummary,
    saveOfferIntegrations: saveOfferIntegrations,
    importIntegrationsFromEnv: importIntegrationsFromEnv,
};
