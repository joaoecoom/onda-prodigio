var Stripe = require('stripe');

var WEBHOOK_URL = 'https://onda-prodigio.vercel.app/api/stripe-webhook';
var WEBHOOK_EVENTS = ['payment_intent.succeeded', 'payment_intent.payment_failed'];

function getAuthToken(req) {
    var header = req.headers.authorization || '';

    if (header.indexOf('Bearer ') === 0) {
        return header.slice(7).trim();
    }

    return '';
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var bootstrapSecret = process.env.BOOTSTRAP_SECRET;

    if (!bootstrapSecret) {
        return res.status(500).json({ error: 'BOOTSTRAP_SECRET em falta.' });
    }

    if (getAuthToken(req) !== bootstrapSecret) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        return res.status(500).json({ error: 'STRIPE_SECRET_KEY em falta.' });
    }

    var stripe = new Stripe(secretKey);
    var results = {
        webhook: null,
        env: {
            hasMetaAccessToken: Boolean(process.env.META_ACCESS_TOKEN),
            hasGa4ApiSecret: Boolean(process.env.GA4_API_SECRET),
            hasGtmWeb: Boolean(process.env.NEXT_PUBLIC_GTM_ID),
            hasServerContainerUrl: Boolean(process.env.SERVER_CONTAINER_URL),
            hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        },
    };

    try {
        var existing = await stripe.webhookEndpoints.list({ limit: 100 });
        var match = (existing.data || []).find(function (endpoint) {
            return endpoint.url === WEBHOOK_URL;
        });

        if (match) {
            results.webhook = {
                id: match.id,
                url: match.url,
                status: match.status,
                enabled_events: match.enabled_events,
                existed: true,
                secret: null,
                note: 'Webhook já existia. O signing secret só é mostrado na criação.',
            };
        } else {
            var created = await stripe.webhookEndpoints.create({
                url: WEBHOOK_URL,
                enabled_events: WEBHOOK_EVENTS,
                description: 'Onda Prodígio — tracking Purchase',
            });

            results.webhook = {
                id: created.id,
                url: created.url,
                status: created.status,
                enabled_events: created.enabled_events,
                existed: false,
                secret: created.secret,
            };
        }

        return res.status(200).json(results);
    } catch (error) {
        console.error('Bootstrap tracking falhou:', error);
        return res.status(500).json({
            error: error.message || 'Bootstrap falhou.',
        });
    }
};
