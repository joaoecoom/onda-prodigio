var stripeEnv = require('../lib/stripe-env');
var upsellConfig = require('../lib/upsell-config');

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

    var upsellId = typeof body.upsell_id === 'string' ? body.upsell_id.trim() : '';
    var paymentIntentId = typeof body.payment_intent_id === 'string' ? body.payment_intent_id.trim() : '';
    var upsell = upsellConfig.getUpsell(upsellId);

    if (!upsell || !paymentIntentId || paymentIntentId.indexOf('pi_') !== 0) {
        return res.status(400).json({ error: 'Pedido de upsell inválido.' });
    }

    try {
        var paymentIntent = await stripeClient.stripe.paymentIntents.retrieve(paymentIntentId);
        var metadata = paymentIntent.metadata || {};
        var email = (metadata.email || paymentIntent.receipt_email || '').trim();

        if (!email) {
            return res.status(400).json({ error: 'Email da compra em falta.' });
        }

        var origin = process.env.SITE_URL || 'https://onda-prodigio.vercel.app';
        var nextParams = new URLSearchParams({
            payment_intent: paymentIntentId,
        });

        if (mode === 'test') {
            nextParams.set('mode', 'test');
        }

        var successUrl = origin + upsell.nextPath + '?' + nextParams.toString() + '&upsell=' + encodeURIComponent(upsellId) + '&upsell_status=accepted&session_id={CHECKOUT_SESSION_ID}';
        var cancelUrl = origin + upsell.nextPath + '?' + nextParams.toString() + '&upsell=' + encodeURIComponent(upsellId) + '&upsell_status=skipped';

        var sessionPayload = {
            customer_email: email,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                product_id: upsell.id,
                parent_payment_intent: paymentIntentId,
                checkout: stripeClient.settings.checkoutId,
                stripe_mode: mode,
                upsell: upsell.id,
                email: email,
                full_name: metadata.full_name || '',
            },
        };

        if (upsell.billingType === 'subscription') {
            var priceId = mode === 'test'
                ? process.env.STRIPE_TEST_CLUBE_PRICE_ID
                : process.env.STRIPE_CLUBE_PRICE_ID;

            if (!priceId) {
                return res.status(500).json({ error: 'Preço de subscrição do Clube ainda não configurado na Stripe.' });
            }

            sessionPayload.mode = 'subscription';
            sessionPayload.line_items = [{ price: priceId, quantity: 1 }];
        } else {
            var amountCents = parseInt(
                mode === 'test'
                    ? (process.env.STRIPE_TEST_CODIGO_AMOUNT_CENTS || process.env.STRIPE_CODIGO_AMOUNT_CENTS || '4700')
                    : (process.env.STRIPE_CODIGO_AMOUNT_CENTS || '4700'),
                10
            );

            sessionPayload.mode = 'payment';
            sessionPayload.line_items = [{
                price_data: {
                    currency: 'eur',
                    unit_amount: amountCents,
                    product_data: {
                        name: upsell.name,
                    },
                },
                quantity: 1,
            }];
        }

        var session = await stripeClient.stripe.checkout.sessions.create(sessionPayload);

        return res.status(200).json({
            url: session.url,
            mode: mode,
        });
    } catch (error) {
        console.error('Erro ao criar upsell checkout:', error);
        return res.status(500).json({ error: 'Não foi possível iniciar o pagamento desta oferta.' });
    }
};
