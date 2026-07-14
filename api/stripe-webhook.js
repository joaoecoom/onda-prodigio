var Stripe = require('stripe');
var { buffer } = require('micro');
var serverEvents = require('../lib/tracking/server-events');

module.exports.config = {
    api: {
        bodyParser: false,
    },
};

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;
    var webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey) {
        return res.status(500).json({ error: 'Stripe não configurado.' });
    }

    if (!webhookSecret) {
        return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET em falta.' });
    }

    var stripe = new Stripe(secretKey);
    var signature = req.headers['stripe-signature'];

    if (!signature) {
        return res.status(400).json({ error: 'Assinatura Stripe em falta.' });
    }

    var event;

    try {
        var rawBody = await buffer(req);
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
        console.error('Webhook Stripe inválido:', error.message);
        return res.status(400).json({ error: 'Webhook inválido.' });
    }

    try {
        if (event.type === 'payment_intent.succeeded') {
            await serverEvents.sendPurchaseFromPaymentIntent(event.data.object, req);
        }

        if (event.type === 'payment_intent.payment_failed') {
            await serverEvents.sendPaymentFailedFromPaymentIntent(event.data.object, req);
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('Erro ao processar webhook Stripe:', error);
        return res.status(500).json({ error: 'Erro ao processar webhook.' });
    }
};
