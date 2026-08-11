var Stripe = require('stripe');
var { buffer } = require('micro');
var serverEvents = require('../lib/tracking/server-events');

module.exports.config = {
    api: {
        bodyParser: false,
    },
};

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;
    var webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey) {
        return res.status(500).json({ error: 'Stripe não configurado.' });
    }

    if (!webhookSecret) {
        return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET em falta.' });
    }

    var stripe = new Stripe(secretKey);
    var signature = req.headers['stripe-signature'];

    if (!signature) {
        return res.status(400).json({ error: 'Assinatura Stripe em falta.' });
    }

    var event;

    try {
        var rawBody = await buffer(req);
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
        console.error('Webhook Stripe inválido:', error.message);
        return res.status(400).json({ error: 'Webhook inválido.' });
    }

    try {
        var trackingResults = null;

        if (event.type === 'payment_intent.succeeded') {
            var metadata = event.data.object.metadata || {};

            if (metadata.stripe_mode !== 'test' && metadata.checkout !== 'checkout9-test') {
                trackingResults = await serverEvents.sendPurchaseFromPaymentIntent(event.data.object, req);
                console.log('Purchase tracking:', event.data.object.id, JSON.stringify(trackingResults));
            }

            try {
                var grantAccess = require('../lib/comunidade/grant-access');
                var accessResult = await grantAccess.grantAccessFromPaymentIntent(event.data.object);

                console.log('Comunidade access:', event.data.object.id, JSON.stringify(accessResult));
            } catch (accessError) {
                console.error('Erro ao criar acesso à comunidade:', accessError);
            }
        }

        if (event.type === 'checkout.session.completed') {
            var session = event.data.object;
            var sessionMetadata = session.metadata || {};

            if (sessionMetadata.stripe_mode !== 'test' && sessionMetadata.checkout !== 'checkout9-test') {
                try {
                    var vturbConversion = require('../lib/tracking/vturb-conversion');
                    var vturbResult = await vturbConversion.sendFromCheckoutSession(session, req);
                    console.log('VTurb upsell:', session.id, JSON.stringify(vturbResult));
                } catch (vturbError) {
                    console.error('VTurb upsell falhou:', vturbError);
                }
            }

            try {
                var grantAccessCheckout = require('../lib/comunidade/grant-access');
                var checkoutResult = await grantAccessCheckout.grantAccessFromCheckoutSession(stripe, event.data.object);

                console.log('Upsell access:', event.data.object.id, JSON.stringify(checkoutResult));
            } catch (checkoutAccessError) {
                console.error('Erro ao criar acesso de upsell:', checkoutAccessError);
            }
        }

        if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
            try {
                var grantAccessSubscription = require('../lib/comunidade/grant-access');
                var subscriptionResult = await grantAccessSubscription.updateSubscriptionAccess(stripe, event.data.object);

                console.log('Subscription access:', event.data.object.id, JSON.stringify(subscriptionResult));
            } catch (subscriptionAccessError) {
                console.error('Erro ao actualizar subscrição:', subscriptionAccessError);
            }
        }

        if (event.type === 'payment_intent.payment_failed') {
            var failedMetadata = event.data.object.metadata || {};

            if (failedMetadata.payment_attempted !== 'true') {
                try {
                    await stripe.paymentIntents.update(event.data.object.id, {
                        metadata: {
                            payment_attempted: 'true',
                        },
                    });
                } catch (metadataError) {
                    console.error('Erro ao marcar payment_attempted:', event.data.object.id, metadataError.message);
                }
            }

            if (failedMetadata.stripe_mode !== 'test' && failedMetadata.checkout !== 'checkout9-test') {
                trackingResults = await serverEvents.sendPaymentFailedFromPaymentIntent(event.data.object, req);
                console.log('Payment failed tracking:', event.data.object.id, JSON.stringify(trackingResults));

                try {
                    var failedPaymentQueue = require('../lib/comunidade/failed-payment-recovery-queue');
                    var recoveryResult = await failedPaymentQueue.enqueueFailedPaymentRecovery({
                        paymentIntent: event.data.object,
                    });
                    console.log('Payment failed WhatsApp queue:', event.data.object.id, JSON.stringify(recoveryResult));
                } catch (recoveryError) {
                    console.error('Erro ao enfileirar WhatsApp de pagamento falhado:', recoveryError);
                }
            }
        }

        return res.status(200).json({
            received: true,
            tracking: trackingResults,
        });
    } catch (error) {
        console.error('Erro ao processar webhook Stripe:', error);
        return res.status(500).json({ error: 'Erro ao processar webhook.' });
    }
};
