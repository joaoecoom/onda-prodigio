var metaCapi = require('../lib/tracking/meta-capi');

function getAuthToken(req) {
    var header = req.headers.authorization || '';

    if (header.indexOf('Bearer ') === 0) {
        return header.slice(7).trim();
    }

    return '';
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var bootstrapSecret = process.env.BOOTSTRAP_SECRET;

    if (!bootstrapSecret || getAuthToken(req) !== bootstrapSecret) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    var pixelId = process.env.META_PIXEL_ID;
    var accessToken = process.env.META_ACCESS_TOKEN;
    var results = {
        env: {
            hasMetaPixelId: Boolean(pixelId),
            hasMetaAccessToken: Boolean(accessToken),
            hasMetaTestEventCode: Boolean(process.env.META_TEST_EVENT_CODE),
        },
        token: null,
        test_event: null,
        dataset_quality: null,
    };

    if (!pixelId || !accessToken) {
        return res.status(200).json(results);
    }

    try {
        var tokenRes = await fetch(
            'https://graph.facebook.com/v21.0/debug_token?input_token=' +
            encodeURIComponent(accessToken) +
            '&access_token=' +
            encodeURIComponent(accessToken)
        );
        results.token = await tokenRes.json();

        var eventId = 'meta_healthcheck_' + Date.now();
        results.test_event = await metaCapi.sendMetaEvent({
            eventName: 'PageView',
            eventId: eventId,
            user: {
                clientIpAddress: '8.8.8.8',
                clientUserAgent: 'OndaProdigioHealthcheck/1.0',
            },
            customData: {
                content_name: 'healthcheck',
            },
        });

        var qualityRes = await fetch(
            'https://graph.facebook.com/v21.0/' +
            encodeURIComponent(pixelId) +
            '/da_checks?fields=event_name,passed,action_required&access_token=' +
            encodeURIComponent(accessToken)
        );
        results.dataset_quality = await qualityRes.json();
    } catch (error) {
        results.error = error.message;
        results.metaResponse = error.metaResponse || null;
    }

    return res.status(200).json(results);
};
