var Stripe = require('stripe');
var serverEvents = require('../lib/tracking/server-events');

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

    if (!bootstrapSecret || getAuthToken(req) !== bootstrapSecret) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        return res.status(500).json({ error: 'STRIPE_SECRET_KEY em falta.' });
    }

    var body = req.body || {};
    var paymentIntentId = typeof body.payment_intent === 'string' ? body.payment_intent.trim() : '';
    var replayAll = Boolean(body.all);
    var stripe = new Stripe(secretKey);
    var results = [];

    try {
        var paymentIntents = [];

        if (replayAll) {
            var listed = await stripe.paymentIntents.list({
                limit: 20,
            });

            paymentIntents = (listed.data || []).filter(function (paymentIntent) {
                var metadata = paymentIntent.metadata || {};
                return paymentIntent.status === 'succeeded' &&
                    metadata.checkout === 'checkout9' &&
                    metadata.stripe_mode !== 'test';
            });
        } else if (paymentIntentId) {
            paymentIntents = [await stripe.paymentIntents.retrieve(paymentIntentId)];
        } else {
            return res.status(400).json({ error: 'Indica payment_intent ou all=true.' });
        }

        for (var i = 0; i < paymentIntents.length; i += 1) {
            var paymentIntent = paymentIntents[i];

            if (!paymentIntent || paymentIntent.status !== 'succeeded') {
                results.push({
                    payment_intent: paymentIntent ? paymentIntent.id : paymentIntentId,
                    skipped: true,
                    reason: 'Pagamento não succeeded.',
                });
                continue;
            }

            var tracking = await serverEvents.sendPurchaseFromPaymentIntent(paymentIntent, req);

            results.push({
                payment_intent: paymentIntent.id,
                event_id: paymentIntent.metadata ? paymentIntent.metadata.purchase_event_id : '',
                amount: paymentIntent.amount,
                tracking: tracking,
            });
        }

        return res.status(200).json({
            replayed: results.length,
            results: results,
        });
    } catch (error) {
        console.error('Replay Purchase falhou:', error);
        return res.status(500).json({
            error: error.message || 'Replay falhou.',
        });
    }
};
