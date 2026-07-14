/**
 * Envia eventos para o container server-side (Stape / GTM Server).
 * Requer configuração manual do Data Client / tag no GTM Server.
 *
 * @param {object} params
 * @param {string} params.eventName
 * @param {object} [params.payload]
 */
async function sendGtmServerEvent(params) {
    var serverUrl = process.env.SERVER_CONTAINER_URL;
    var serverContainerId = process.env.GTM_SERVER_CONTAINER;

    if (!serverUrl) {
        return { skipped: true, reason: 'SERVER_CONTAINER_URL em falta.' };
    }

    var endpoint = serverUrl.replace(/\/$/, '') + '/data';

    var response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-GTM-Server-Preview': serverContainerId || '',
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

    return { ok: true };
}

module.exports = {
    sendGtmServerEvent: sendGtmServerEvent,
};
