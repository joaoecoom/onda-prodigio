var Stripe = require('stripe');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        return res.status(500).json({ error: 'Stripe não configurado.' });
    }

    var body = req.body || {};
    var clientSecret = typeof body.client_secret === 'string' ? body.client_secret.trim() : '';
    var email = typeof body.email === 'string' ? body.email.trim() : '';
    var fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    var phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    var region = typeof body.region === 'string' ? body.region.trim() : '';

    if (!clientSecret) {
        return res.status(400).json({ error: 'Sessão de pagamento inválida.' });
    }

    var paymentIntentId = clientSecret.split('_secret')[0];

    if (!paymentIntentId.startsWith('pi_')) {
        return res.status(400).json({ error: 'Sessão de pagamento inválida.' });
    }

    var stripe = new Stripe(secretKey);

    try {
        await stripe.paymentIntents.update(paymentIntentId, {
            receipt_email: email || undefined,
            metadata: {
                product: 'Onda Prodígio',
                price_id: process.env.STRIPE_PRICE_ID || '',
                full_name: fullName || '',
                phone: phone || '',
                region: region || '',
                checkout: 'checkout9',
            },
        });

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro ao atualizar PaymentIntent:', error);
        return res.status(500).json({ error: 'Não foi possível atualizar o pagamento.' });
    }
};
