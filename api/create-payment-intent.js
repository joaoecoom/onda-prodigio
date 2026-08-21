var stripeClient = require('../lib/hub/stripe-client');
var checkoutResolver = require('../lib/hub/checkout-resolver');
var productCheckoutConfig = require('../lib/product-checkout-config');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var body = req.body || {};
    var stripeEnv = require('../lib/stripe-env');
    var mode = stripeEnv.resolveStripeMode(req, body);
    var checkoutId = stripeEnv.resolveCheckoutId(req, body);
    var stripeContext = await stripeClient.resolveStripeContext(req, body);
    var stripeClientApi = stripeContext.stripe;
    var settings = stripeContext.settings;

    if (stripeContext.error || !stripeClientApi) {
        return res.status(500).json({ error: stripeContext.error || 'Stripe não configurado.' });
    }

    var serverEvents = require('../lib/tracking/server-events');
    var metaUserData = require('../lib/tracking/meta-user-data');
    var identity = require('../lib/tracking/identity');
    var email = typeof body.email === 'string' ? body.email.trim() : '';
    var fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    var phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    var region = typeof body.region === 'string' ? body.region.trim() : '';
    var country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
    var phoneCountry = typeof body.phone_country === 'string' ? body.phone_country.trim().toUpperCase() : '';
    var tracking = body.tracking && typeof body.tracking === 'object' ? body.tracking : {};
    var userAgent = req.headers['user-agent'] || '';
    var productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
    var selectedBumpIds = body.selected_bump_ids || body.order_bumps || [];
    var offerName = settings.offerName || 'Onda Prodígio';
    var amount = settings.amountCents;
    var metadata = null;

    if (checkoutId === 'main' && stripeContext.offer) {
        try {
            var resolved = await checkoutResolver.resolveUniversalCheckoutWithBumps(stripeContext.offer, {
                checkoutId: 'main',
                mode: mode,
                productId: productId || stripeContext.offer.primary_product_id,
                selectedBumpIds: selectedBumpIds,
            });
            var universal = resolved.checkout;

            if (!universal.isActive) {
                return res.status(400).json({ error: 'Checkout indisponível para esta oferta.' });
            }

            productId = universal.productId;
            amount = resolved.totalCents;

            metadata = {
                checkout_type: 'offer',
                checkout: 'main',
                product: offerName,
                product_id: productId,
                price_id: universal.priceId || '',
                full_name: fullName || '',
                phone: phone || '',
                region: region || '',
                country: country || '',
                phone_country: phoneCountry || '',
                email: email || '',
                stripe_mode: mode,
            };

            metadata = Object.assign(metadata, resolved.bumpMetadata);
        } catch (validationError) {
            return res.status(400).json({ error: validationError.message || 'Checkout inválido.' });
        }
    } else {
        var standaloneProduct = productId ? productCheckoutConfig.getProduct(productId) : null;
        amount = standaloneProduct
            ? productCheckoutConfig.getAmountCentsForMode(productId, mode)
            : settings.amountCents;

        if (standaloneProduct && standaloneProduct.billingType === 'subscription') {
            return res.status(400).json({ error: 'Este produto usa checkout por subscrição.' });
        }

        metadata = standaloneProduct ? {
            product: standaloneProduct.name,
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
        } : {
            product: offerName,
            price_id: settings.priceId || '',
            full_name: fullName || '',
            phone: phone || '',
            region: region || '',
            country: country || '',
            phone_country: phoneCountry || '',
            email: email || '',
            checkout: settings.checkoutId,
            stripe_mode: mode,
        };
    }

    if (!Number.isFinite(amount) || amount < 50) {
        return res.status(500).json({ error: 'Valor de pagamento inválido.' });
    }

    try {
        metadata = Object.assign(
            metadata,
            stripeClient.buildOfferMetadata(settings),
            serverEvents.buildStripeTrackingMetadata(tracking, userAgent)
        );

        var paymentIntent = await stripeClientApi.paymentIntents.create({
            amount: amount,
            currency: 'eur',
            payment_method_configuration: settings.paymentMethodConfiguration,
            automatic_payment_methods: {
                enabled: true,
            },
            excluded_payment_method_types: ['multibanco'],
            receipt_email: email || undefined,
            description: metadata.checkout_type === 'offer'
                ? offerName + ' — ' + (mode === 'test' ? 'teste' : 'acesso digital')
                : (mode === 'test' ? offerName + ' — teste de pagamento' : offerName + ' — acesso digital'),
            metadata: metadata,
        });

        await stripeClientApi.paymentIntents.update(paymentIntent.id, {
            metadata: Object.assign({}, paymentIntent.metadata || {}, {
                purchase_event_id: 'purchase_' + paymentIntent.id,
                client_ip: identity.sanitizeMetadataValue(metaUserData.getClientIp(req), 45),
            }),
        });

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            mode: mode,
            offerId: settings.offerId || undefined,
            offerSlug: settings.offerSlug || undefined,
            productId: productId || undefined,
            checkoutId: checkoutId,
        });
    } catch (error) {
        console.error('Erro ao criar PaymentIntent:', error);

        if (error && error.code === 'api_key_expired') {
            return res.status(500).json({ error: 'Chave Stripe expirada. Gera uma nova chave secreta no Dashboard da Stripe.' });
        }

        return res.status(500).json({ error: 'Não foi possível iniciar o pagamento. Tenta novamente.' });
    }
};
