var stripeEnv = require('../lib/stripe-env');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ verified: false, error: 'Método não permitido.' });
    }

    var mode = stripeEnv.resolveStripeMode(req, null);
    var stripeClient = stripeEnv.getStripeClient(mode);

    if (stripeClient.error || !stripeClient.stripe) {
        return res.status(500).json({ verified: false, error: stripeClient.error || 'Stripe não configurado.' });
    }

    var paymentIntentId = typeof req.query.payment_intent === 'string' ? req.query.payment_intent.trim() : '';

    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
        return res.status(400).json({ verified: false, error: 'Pagamento inválido.' });
    }

    try {
        var paymentIntent = await stripeClient.stripe.paymentIntents.retrieve(paymentIntentId);

        if (!paymentIntent || paymentIntent.status !== 'succeeded') {
            return res.status(403).json({
                verified: false,
                status: paymentIntent ? paymentIntent.status : 'unknown',
            });
        }

        return res.status(200).json({
            verified: true,
            status: paymentIntent.status,
            mode: mode,
            transaction_id: paymentIntent.id,
            amount_cents: paymentIntent.amount,
            currency: paymentIntent.currency,
            order_bumps: String(paymentIntent.metadata.order_bumps || '')
                .split(',')
                .map(function (item) { return item.trim(); })
                .filter(Boolean),
        });
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        return res.status(403).json({ verified: false, error: 'Pagamento não confirmado.' });
    }
};
