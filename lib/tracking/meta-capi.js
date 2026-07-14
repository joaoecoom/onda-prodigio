var identity = require('./identity');

/**
 * @param {object} params
 * @param {string} params.eventName
 * @param {string} params.eventId
 * @param {number} [params.eventTime]
 * @param {object} [params.user]
 * @param {object} [params.customData]
 */
async function sendMetaEvent(params) {
    var pixelId = process.env.META_PIXEL_ID;
    var accessToken = process.env.META_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
        throw new Error('META_PIXEL_ID ou META_ACCESS_TOKEN em falta.');
    }

    var user = params.user || {};
    var userData = {};

    if (user.email) {
        userData.em = [identity.hashSha256(user.email)];
    }

    if (user.phone) {
        userData.ph = [identity.hashSha256(identity.normalizePhoneE164(user.phone))];
    }

    if (user.fbp) {
        userData.fbp = user.fbp;
    }

    if (user.fbc) {
        userData.fbc = user.fbc;
    }

    if (user.externalId) {
        userData.external_id = [user.externalId];
    }

    if (user.clientIpAddress) {
        userData.client_ip_address = user.clientIpAddress;
    }

    if (user.clientUserAgent) {
        userData.client_user_agent = user.clientUserAgent;
    }

    var payload = {
        data: [
            {
                event_name: params.eventName,
                event_time: identity.getEventTimeSeconds(params.eventTime),
                event_id: params.eventId,
                action_source: 'website',
                user_data: userData,
                custom_data: params.customData || {},
            },
        ],
    };

    var url = 'https://graph.facebook.com/v21.0/' + encodeURIComponent(pixelId) + '/events?access_token=' + encodeURIComponent(accessToken);

    var response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    var body = await response.json();

    if (!response.ok) {
        throw new Error('Meta CAPI falhou: ' + JSON.stringify(body));
    }

    return body;
}

module.exports = {
    sendMetaEvent: sendMetaEvent,
};
