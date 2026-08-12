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

    if (!product || product.billingType !== 'subscription') {
        return res.status(400).json({ error: 'Produto de subscrição inválido.' });
    }

    var priceId = productCheckoutConfig.getClubePriceId(mode);

    if (!priceId) {
        return res.status(500).json({ error: 'Preço de subscrição ainda não configurado na Stripe.' });
    }

    var serverEvents = require('../lib/tracking/server-events');
    var email = typeof body.email === 'string' ? body.email.trim() : '';
    var fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    var phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    var phoneCountry = typeof body.phone_country === 'string' ? body.phone_country.trim().toUpperCase() : 'PT';
    var tracking = body.tracking && typeof body.tracking === 'object' ? body.tracking : {};
    var userAgent = req.headers['user-agent'] || '';

    if (!email) {
        return res.status(400).json({ error: 'Email em falta.' });
    }

    var origin = process.env.SITE_URL || 'https://onda-prodigio.vercel.app';
    var successParams = new URLSearchParams({
        compra: 'ok',
    });

    if (mode === 'test') {
        successParams.set('mode', 'test');
    }

    var successUrl = origin + '/comunidade/produto?id=' + encodeURIComponent(productId) + '&' + successParams.toString() + '&session_id={CHECKOUT_SESSION_ID}';
    var cancelUrl = origin + '/comprar/' + encodeURIComponent(productId) + (mode === 'test' ? '?mode=test' : '');

    try {
        var session = await stripeClient.stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: email,
            success_url: successUrl,
            cancel_url: cancelUrl,
            line_items: [{ price: priceId, quantity: 1 }],
            metadata: Object.assign({
                product_id: productId,
                checkout_type: 'standalone',
                checkout: 'comprar-' + productId,
                stripe_mode: mode,
                email: email,
                full_name: fullName || '',
                phone: phone || '',
                phone_country: phoneCountry || '',
            }, serverEvents.buildStripeTrackingMetadata(tracking, userAgent)),
        });

        return res.status(200).json({
            url: session.url,
            mode: mode,
        });
    } catch (error) {
        console.error('Erro ao criar checkout de subscrição:', error);
        return res.status(500).json({ error: 'Não foi possível iniciar a subscrição. Tenta novamente.' });
    }
};
