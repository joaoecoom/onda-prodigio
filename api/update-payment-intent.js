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
    var amountCents = parseInt(body.amount_cents, 10);
    var orderBumps = Array.isArray(body.order_bumps) ? body.order_bumps.filter(function (item) {
        return typeof item === 'string' && item.trim();
    }) : [];

    if (!clientSecret) {
        return res.status(400).json({ error: 'Sessão de pagamento inválida.' });
    }

    var paymentIntentId = clientSecret.split('_secret')[0];

    if (!paymentIntentId.startsWith('pi_')) {
        return res.status(400).json({ error: 'Sessão de pagamento inválida.' });
    }

    var stripe = new Stripe(secretKey);
    var baseAmount = parseInt(process.env.STRIPE_AMOUNT_CENTS || '900', 10);
    var bumpAmount = parseInt(process.env.STRIPE_BUMP_AMOUNT_CENTS || '500', 10);
    var maxBumps = 3;
    var maxAmount = baseAmount + (bumpAmount * maxBumps);

    try {
        var updatePayload = {
            receipt_email: email || undefined,
            metadata: {
                product: 'Onda Prodígio',
                price_id: process.env.STRIPE_PRICE_ID || '',
                full_name: fullName || '',
                phone: phone || '',
                region: region || '',
                checkout: 'checkout9',
                order_bumps: orderBumps.join(', '),
            },
        };

        if (Number.isFinite(amountCents) && amountCents >= baseAmount && amountCents <= maxAmount) {
            updatePayload.amount = amountCents;
        }

        await stripe.paymentIntents.update(paymentIntentId, updatePayload);

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro ao atualizar PaymentIntent:', error);
        return res.status(500).json({ error: 'Não foi possível atualizar o pagamento.' });
    }
};
