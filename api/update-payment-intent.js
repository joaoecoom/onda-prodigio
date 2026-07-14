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
    var clientSecret = typeof body.client_secret === 'string' ? body.client_secret.trim() : '';
    var email = typeof body.email === 'string' ? body.email.trim() : '';
    var fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    var phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    var region = typeof body.region === 'string' ? body.region.trim() : '';
    var country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
    var amountCents = parseInt(body.amount_cents, 10);
    var orderBumps = Array.isArray(body.order_bumps) ? body.order_bumps.filter(function (item) {
        return typeof item === 'string' && item.trim();
    }) : [];
    var tracking = body.tracking && typeof body.tracking === 'object' ? body.tracking : {};
    var userAgent = req.headers['user-agent'] || '';

    if (!clientSecret) {
        return res.status(400).json({ error: 'Sessão de pagamento inválida.' });
    }

    var paymentIntentId = clientSecret.split('_secret')[0];

    if (!paymentIntentId.startsWith('pi_')) {
        return res.status(400).json({ error: 'Sessão de pagamento inválida.' });
    }

    var baseAmount = stripeClient.settings.amountCents;
    var bumpAmount = parseInt(process.env.STRIPE_BUMP_AMOUNT_CENTS || '500', 10);
    var maxBumps = 3;
    var maxAmount = baseAmount + (bumpAmount * maxBumps);

    try {
        var updatePayload = {
            receipt_email: email || undefined,
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
                order_bumps: orderBumps.join(', '),
            }, serverEvents.buildStripeTrackingMetadata(tracking, userAgent)),
        };

        if (Number.isFinite(amountCents) && amountCents >= baseAmount && amountCents <= maxAmount) {
            updatePayload.amount = amountCents;
        }

        await stripeClient.stripe.paymentIntents.update(paymentIntentId, updatePayload);

        return res.status(200).json({ ok: true, mode: mode });
    } catch (error) {
        console.error('Erro ao atualizar PaymentIntent:', error);
        return res.status(500).json({ error: 'Não foi possível atualizar o pagamento.' });
    }
};
