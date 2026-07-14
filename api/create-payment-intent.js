var Stripe = require('stripe');
var serverEvents = require('../lib/tracking/server-events');

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
    var tracking = body.tracking && typeof body.tracking === 'object' ? body.tracking : {};
    var userAgent = req.headers['user-agent'] || '';

    var amount = parseInt(process.env.STRIPE_AMOUNT_CENTS || '900', 10);

    if (!Number.isFinite(amount) || amount < 50) {
        return res.status(500).json({ error: 'Valor de pagamento inválido.' });
    }

    var stripe = new Stripe(secretKey);

    try {
        var paymentMethodConfiguration = process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION || 'pmc_1OuDi3AAQoQG6nciqBp2JYfG';

        var paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'eur',
            payment_method_configuration: paymentMethodConfiguration,
            automatic_payment_methods: {
                enabled: true,
            },
            excluded_payment_method_types: ['multibanco'],
            receipt_email: email || undefined,
            description: 'Onda Prodígio — acesso digital',
            metadata: Object.assign({
                product: 'Onda Prodígio',
                price_id: process.env.STRIPE_PRICE_ID || '',
                full_name: fullName || '',
                phone: phone || '',
                region: region || '',
                email: email || '',
                checkout: 'checkout9',
            }, serverEvents.buildStripeTrackingMetadata(tracking, userAgent)),
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
