/**
 * Envia eventos para o container server-side (Stape / GTM Server).
 * Aceita config da oferta; faz fallback para env (legacy Onda).
 *
 * @param {object} params
 * @param {string} params.eventName
 * @param {object} [params.payload]
 * @param {string} [params.offerId]
 * @param {{ serverUrl?: string, serverContainerId?: string }} [params.config]
 */
async function sendGtmServerEvent(params) {
    var config = params.config || null;

    if (!config && params.offerId) {
        try {
            var runtime = require('../hub/offer-runtime-config');
            var integrations = await runtime.getOfferRuntimeIntegrations(params.offerId);
            config = runtime.gtmServerConfigFromIntegrations(integrations);
        } catch (error) {
            config = null;
        }
    }

    var serverUrl = (config && config.serverUrl) || process.env.SERVER_CONTAINER_URL || '';
    var serverContainerId = (config && config.serverContainerId) || process.env.GTM_SERVER_CONTAINER || '';

    if (!serverUrl) {
        return { skipped: true, reason: 'SERVER_CONTAINER_URL em falta.' };
    }

    var endpoint = String(serverUrl).replace(/\/$/, '') + '/data';

    var response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            event_name: params.eventName,
            event_data: params.payload || {},
            gtm_server_container: serverContainerId || '',
        }),
    });

    if (!response.ok) {
        var text = await response.text();
        throw new Error('GTM Server falhou: ' + text);
    }

    return { ok: true, offer_id: params.offerId || null };
}

module.exports = {
    sendGtmServerEvent: sendGtmServerEvent,
};
