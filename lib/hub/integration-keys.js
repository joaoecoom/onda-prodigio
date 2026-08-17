var INTEGRATION_KEYS = {
    meta_pixel_id: { env: 'META_PIXEL_ID', secret: false },
    meta_access_token: { env: 'META_ACCESS_TOKEN', altEnv: 'META_ADS_ACCESS_TOKEN', secret: true },
    meta_test_event_code: { env: 'META_TEST_EVENT_CODE', secret: true },
    meta_reporting_currency: { env: 'META_REPORTING_CURRENCY', secret: false },
    meta_eur_to_usd_rate: { env: 'META_EUR_TO_USD_RATE', secret: false },
    meta_eur_to_brl_rate: { env: 'META_EUR_TO_BRL_RATE', secret: false },
    ga4_measurement_id: { env: 'GA4_MEASUREMENT_ID', altEnv: 'NEXT_PUBLIC_GA4_ID', secret: false },
    gtm_container_id: { env: 'GTM_CONTAINER_ID', altEnv: 'NEXT_PUBLIC_GTM_ID', secret: false },
    gtm_server_container: { env: 'GTM_SERVER_CONTAINER', secret: false },
    server_container_url: { env: 'SERVER_CONTAINER_URL', secret: false },
    stripe_secret_key: { env: 'STRIPE_SECRET_KEY', secret: true },
    stripe_publishable_key: { env: 'STRIPE_PUBLISHABLE_KEY', secret: false },
    stripe_test_secret_key: { env: 'STRIPE_TEST_SECRET_KEY', secret: true },
    stripe_test_publishable_key: { env: 'STRIPE_TEST_PUBLISHABLE_KEY', secret: false },
    stripe_webhook_secret: { env: 'STRIPE_WEBHOOK_SECRET', secret: true },
    gmail_user: { env: 'GMAIL_USER', secret: false },
    gmail_app_password: { env: 'GMAIL_APP_PASSWORD', secret: true },
    gmail_from_name: { env: 'GMAIL_FROM_NAME', secret: false },
    whatsapp_enabled: { env: 'WHATSAPP_ENABLED', secret: false },
    evolution_api_url: { env: 'EVOLUTION_API_URL', secret: false },
    evolution_api_key: { env: 'EVOLUTION_API_KEY', secret: true },
    evolution_instance_name: { env: 'EVOLUTION_INSTANCE_NAME', secret: false },
    vturb_analytics_api_token: { env: 'VTURB_ANALYTICS_API_TOKEN', secret: true },
    vturb_player_id: { env: 'VTURB_PLAYER_ID', secret: false },
    supabase_url: { env: 'SUPABASE_URL', secret: false },
    supabase_anon_key: { env: 'SUPABASE_ANON_KEY', secret: false },
    supabase_service_role_key: { env: 'SUPABASE_SERVICE_ROLE_KEY', secret: true },
};

var INTEGRATION_GROUPS = {
    tracking: {
        label: 'Tracking',
        keys: [
            'meta_pixel_id',
            'meta_access_token',
            'meta_test_event_code',
            'meta_reporting_currency',
            'ga4_measurement_id',
            'gtm_container_id',
            'gtm_server_container',
            'server_container_url',
        ],
    },
    stripe: {
        label: 'Stripe',
        keys: [
            'stripe_secret_key',
            'stripe_publishable_key',
            'stripe_test_secret_key',
            'stripe_test_publishable_key',
            'stripe_webhook_secret',
        ],
    },
    gmail: {
        label: 'Gmail',
        keys: ['gmail_user', 'gmail_app_password', 'gmail_from_name'],
    },
    whatsapp: {
        label: 'WhatsApp',
        keys: ['whatsapp_enabled', 'evolution_api_url', 'evolution_api_key', 'evolution_instance_name'],
    },
    vturb: {
        label: 'VTurb',
        keys: ['vturb_analytics_api_token', 'vturb_player_id'],
    },
    supabase: {
        label: 'Supabase',
        keys: ['supabase_url', 'supabase_anon_key', 'supabase_service_role_key'],
    },
};

function getIntegrationKeyDef(key) {
    return INTEGRATION_KEYS[key] || null;
}

function listIntegrationKeys() {
    return Object.keys(INTEGRATION_KEYS);
}

module.exports = {
    INTEGRATION_KEYS: INTEGRATION_KEYS,
    INTEGRATION_GROUPS: INTEGRATION_GROUPS,
    getIntegrationKeyDef: getIntegrationKeyDef,
    listIntegrationKeys: listIntegrationKeys,
};
