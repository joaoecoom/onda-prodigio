var { buffer } = require('micro');
var stripeClient = require('../lib/hub/stripe-client');
var serverEvents = require('../lib/tracking/server-events');
var commerceEvents = require('../lib/tracking/commerce-events');

module.exports.config = {
    api: {
        bodyParser: false,
    },
};

async function resolveWebhookStripeClient(event, fallbackStripe) {
    var metadata = {};

    if (event && event.data && event.data.object && event.data.object.metadata) {
        metadata = event.data.object.metadata;
    }

    var offerContextResult = await stripeClient.resolveStripeContextFromMetadata(metadata);

    if (offerContextResult && offerContextResult.stripe) {
        return offerContextResult.stripe;
    }

    return fallbackStripe;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var signature = req.headers['stripe-signature'];

    if (!signature) {
        return res.status(400).json({ error: 'Assinatura Stripe em falta.' });
    }

    var rawBody;
    var verified;

    try {
        rawBody = await buffer(req);
        verified = await stripeClient.verifyWebhookEvent(rawBody, signature, req);
    } catch (error) {
        console.error('Webhook Stripe inválido:', error.message);
        return res.status(400).json({ error: 'Webhook inválido.' });
    }

    if (verified.error || !verified.event) {
        console.error('Webhook Stripe inválido:', verified.error || 'evento em falta');
        return res.status(400).json({ error: verified.error || 'Webhook inválido.' });
    }

    var event = verified.event;
    var stripe = verified.stripe;

    if (!stripe) {
        return res.status(500).json({ error: 'Stripe não configurado.' });
    }

    try {
        var trackingResults = null;
        var claim = await require('../lib/hub/stripe-events').claimStripeEvent(event);

        if (claim.already_processed) {
            console.log('Stripe event duplicate skipped:', event.id, event.type);
            return res.status(200).json({
                received: true,
                duplicate: true,
            });
        }

        if (event.type === 'charge.refunded') {
            try {
                var hubOrdersRefund = require('../lib/hub/orders');
                var refundResult = await hubOrdersRefund.markOrderRefundedFromCharge(event.data.object);
                console.log('Hub order refund:', event.data.object.id, JSON.stringify(refundResult));
            } catch (refundError) {
                console.error('Erro ao processar refund:', refundError);
            }
        }

        if (event.type === 'payment_intent.succeeded') {
            var metadata = event.data.object.metadata || {};

            try {
                var hubOrders = require('../lib/hub/orders');
                var orderResult = await hubOrders.upsertOrderFromPaymentIntent(event.data.object);
                console.log('Hub order:', event.data.object.id, JSON.stringify(orderResult));
            } catch (orderError) {
                console.error('Erro ao guardar order:', orderError);
            }

            if (commerceEvents.shouldSendPurchaseTracking(metadata)) {
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

            if (commerceEvents.shouldSendPurchaseTracking(metadata)) {
                try {
                    var pushNotify = require('../lib/metrics/push-notify');
                    var pushResult = await pushNotify.notifySaleFromPaymentIntent(event.data.object);
                    console.log('Metrics push:', event.data.object.id, JSON.stringify(pushResult));
                } catch (pushError) {
                    console.error('Erro ao enviar push métricas:', pushError);
                }
            }
        }

        if (event.type === 'checkout.session.completed') {
            var session = event.data.object;
            var sessionMetadata = session.metadata || {};
            stripe = await resolveWebhookStripeClient(event, stripe);

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
            stripe = await resolveWebhookStripeClient(event, stripe);

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
            stripe = await resolveWebhookStripeClient(event, stripe);

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
