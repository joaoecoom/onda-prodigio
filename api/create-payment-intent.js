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
    var email = typeof body.email === 'string' ? body.email.trim() : '';
    var fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    var phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    var region = typeof body.region === 'string' ? body.region.trim() : '';

    var amount = parseInt(process.env.STRIPE_AMOUNT_CENTS || '900', 10);

    if (!Number.isFinite(amount) || amount < 50) {
        return res.status(500).json({ error: 'Valor de pagamento inválido.' });
    }

    var stripe = new Stripe(secretKey);

    try {
        var paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'eur',
            automatic_payment_methods: {
                enabled: true,
            },
            receipt_email: email || undefined,
            description: 'Onda Prodígio — acesso digital',
            metadata: {
                product: 'Onda Prodígio',
                price_id: process.env.STRIPE_PRICE_ID || '',
                full_name: fullName || '',
                phone: phone || '',
                region: region || '',
                checkout: 'checkout9',
            },
        });

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('Erro ao criar PaymentIntent:', error);

        if (error && error.code === 'api_key_expired') {
            return res.status(500).json({ error: 'Chave Stripe expirada. Gera uma nova chave secreta no Dashboard da Stripe.' });
        }

        return res.status(500).json({ error: 'Não foi possível iniciar o pagamento. Tenta novamente.' });
    }
};
