var stripeEnv = require('../lib/stripe-env');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var body = req.body || {};
    var mode = stripeEnv.resolveStripeMode(req, body);
    var stripeClient = stripeEnv.getStripeClient(mode);

    if (stripeClient.error || !stripeClient.stripe) {
        return res.status(500).json({ error: stripeClient.error || 'Stripe não configurado.' });
    }

    var serverEvents = require('../lib/tracking/server-events');
    var email = typeof body.email === 'string' ? body.email.trim() : '';
    var fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    var phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    var region = typeof body.region === 'string' ? body.region.trim() : '';
    var country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
    var tracking = body.tracking && typeof body.tracking === 'object' ? body.tracking : {};
    var userAgent = req.headers['user-agent'] || '';
    var amount = stripeClient.settings.amountCents;

    if (!Number.isFinite(amount) || amount < 50) {
        return res.status(500).json({ error: 'Valor de pagamento inválido.' });
    }

    try {
        var paymentIntent = await stripeClient.stripe.paymentIntents.create({
            amount: amount,
            currency: 'eur',
            payment_method_configuration: stripeClient.settings.paymentMethodConfiguration,
            automatic_payment_methods: {
                enabled: true,
            },
            excluded_payment_method_types: ['multibanco'],
            receipt_email: email || undefined,
            description: mode === 'test'
                ? 'Onda Prodígio — teste de pagamento'
                : 'Onda Prodígio — acesso digital',
            metadata: Object.assign({
                product: 'Onda Prodígio',
                price_id: process.env.STRIPE_PRICE_ID || '',
                full_name: fullName || '',
                phone: phone || '',
                region: region || '',
                country: country || '',
                email: email || '',
                checkout: stripeClient.settings.checkoutId,
                stripe_mode: mode,
            }, serverEvents.buildStripeTrackingMetadata(tracking, userAgent)),
        });

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            mode: mode,
        });
    } catch (error) {
        console.error('Erro ao criar PaymentIntent:', error);

        if (error && error.code === 'api_key_expired') {
            return res.status(500).json({ error: 'Chave Stripe expirada. Gera uma nova chave secreta no Dashboard da Stripe.' });
        }

        return res.status(500).json({ error: 'Não foi possível iniciar o pagamento. Tenta novamente.' });
    }
};
