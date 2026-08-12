var stripeEnv = require('../lib/stripe-env');
var productCheckoutConfig = require('../lib/product-checkout-config');

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

    var productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
    var product = productCheckoutConfig.getProduct(productId);

    if (!product) {
        return res.status(400).json({ error: 'Produto inválido.' });
    }

    var serverEvents = require('../lib/tracking/server-events');
    var metaUserData = require('../lib/tracking/meta-user-data');
    var identity = require('../lib/tracking/identity');
    var clientSecret = typeof body.client_secret === 'string' ? body.client_secret.trim() : '';
    var email = typeof body.email === 'string' ? body.email.trim() : '';
    var fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    var phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    var region = typeof body.region === 'string' ? body.region.trim() : '';
    var country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
    var phoneCountry = typeof body.phone_country === 'string' ? body.phone_country.trim().toUpperCase() : '';
    var amountCents = parseInt(body.amount_cents, 10);
    var tracking = body.tracking && typeof body.tracking === 'object' ? body.tracking : {};
    var userAgent = req.headers['user-agent'] || '';

    if (!clientSecret) {
        return res.status(400).json({ error: 'Sessão de pagamento inválida.' });
    }

    var paymentIntentId = clientSecret.split('_secret')[0];

    if (!paymentIntentId.startsWith('pi_')) {
        return res.status(400).json({ error: 'Sessão de pagamento inválida.' });
    }

    var expectedAmount = productCheckoutConfig.getAmountCentsForMode(productId, mode);

    try {
        var updatePayload = {
            receipt_email: email || undefined,
            metadata: Object.assign({
                product: product.name,
                product_id: productId,
                checkout_type: 'standalone',
                full_name: fullName || '',
                phone: phone || '',
                region: region || '',
                country: country || '',
                phone_country: phoneCountry || '',
                email: email || '',
                checkout: 'comprar-' + productId,
                stripe_mode: mode,
            }, serverEvents.buildStripeTrackingMetadata(tracking, userAgent)),
        };

        updatePayload.metadata.purchase_event_id = 'purchase_' + paymentIntentId;
        updatePayload.metadata.client_ip = identity.sanitizeMetadataValue(metaUserData.getClientIp(req), 45);

        if (email) {
            updatePayload.metadata.checkout_engaged = 'true';
        }

        if (body.payment_attempt === true) {
            updatePayload.metadata.payment_attempted = 'true';
        }

        if (Number.isFinite(amountCents) && amountCents === expectedAmount) {
            updatePayload.amount = amountCents;
        }

        await stripeClient.stripe.paymentIntents.update(paymentIntentId, updatePayload);

        var funnelResults = null;

        try {
            var updatedPaymentIntent = await stripeClient.stripe.paymentIntents.retrieve(paymentIntentId);
            funnelResults = await serverEvents.sendFunnelMetaEventsIfNeeded(updatedPaymentIntent, req);
            var funnelFlags = serverEvents.getFunnelMetaMetadataFlags(funnelResults || {});

            if (Object.keys(funnelFlags).length > 0) {
                await stripeClient.stripe.paymentIntents.update(paymentIntentId, {
                    metadata: funnelFlags,
                });
            }
        } catch (funnelError) {
            console.error('Meta funnel CAPI falhou:', paymentIntentId, funnelError.message);
        }

        return res.status(200).json({ ok: true, mode: mode });
    } catch (error) {
        console.error('Erro ao actualizar PaymentIntent do produto:', error);
        return res.status(500).json({ error: 'Não foi possível actualizar o pagamento.' });
    }
};
