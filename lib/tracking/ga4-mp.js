/**
 * @param {object} params
 * @param {string} params.eventName
 * @param {string} params.clientId
 * @param {object} [params.params]
 */
async function sendGa4Event(params) {
    var measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.GA4_MEASUREMENT_ID;
    var apiSecret = process.env.GA4_API_SECRET;

    if (!measurementId || !apiSecret) {
        throw new Error('GA4_MEASUREMENT_ID ou GA4_API_SECRET em falta.');
    }

    if (!params.clientId) {
        throw new Error('GA4 client_id em falta.');
    }

    var url = 'https://www.google-analytics.com/mp/collect?measurement_id=' +
        encodeURIComponent(measurementId) +
        '&api_secret=' +
        encodeURIComponent(apiSecret);

    var payload = {
        client_id: params.clientId,
        events: [
            {
                name: params.eventName,
                params: params.params || {},
            },
        ],
    };

    var response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        var text = await response.text();
        throw new Error('GA4 MP falhou: ' + text);
    }

    return { ok: true };
}

module.exports = {
    sendGa4Event: sendGa4Event,
};
