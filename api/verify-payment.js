var Stripe = require('stripe');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ verified: false, error: 'Método não permitido.' });
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        return res.status(500).json({ verified: false, error: 'Stripe não configurado.' });
    }

    var paymentIntentId = typeof req.query.payment_intent === 'string' ? req.query.payment_intent.trim() : '';

    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
        return res.status(400).json({ verified: false, error: 'Pagamento inválido.' });
    }

    var stripe = new Stripe(secretKey);

    try {
        var paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (!paymentIntent || paymentIntent.status !== 'succeeded') {
            return res.status(403).json({
                verified: false,
                status: paymentIntent ? paymentIntent.status : 'unknown',
            });
        }

        return res.status(200).json({
            verified: true,
            status: paymentIntent.status,
        });
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        return res.status(403).json({ verified: false, error: 'Pagamento não confirmado.' });
    }
};
