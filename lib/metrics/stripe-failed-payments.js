var Stripe = require('stripe');
var stripeSales = require('./stripe-sales');

function isCheckout9LivePayment(paymentIntent) {
    var metadata = paymentIntent.metadata || {};

    if (metadata.stripe_mode === 'test' || metadata.checkout === 'checkout9-test') {
        return false;
    }

    return metadata.checkout === 'checkout9';
}

function isFailedCheckoutPayment(paymentIntent) {
    if (!isCheckout9LivePayment(paymentIntent)) {
        return false;
    }

    if (paymentIntent.status === 'succeeded') {
        return false;
    }

    var metadata = paymentIntent.metadata || {};

    if (paymentIntent.last_payment_error) {
        return true;
    }

    if (metadata.payment_attempted === 'true') {
        return paymentIntent.status === 'requires_payment_method' ||
            paymentIntent.status === 'canceled';
    }

    return false;
}

function isAbandonedCheckoutPayment(paymentIntent) {
    if (!isCheckout9LivePayment(paymentIntent)) {
        return false;
    }

    if (paymentIntent.status === 'succeeded') {
        return false;
    }

    if (paymentIntent.last_payment_error) {
        return false;
    }

    var metadata = paymentIntent.metadata || {};

    if (metadata.payment_attempted === 'true') {
        return false;
    }

    return true;
}

function summarizeFailedPayment(paymentIntent) {
    var metadata = paymentIntent.metadata || {};
    var error = paymentIntent.last_payment_error || {};

    return {
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        failure_type: error.message ? 'payment_error' : 'abandoned',
        created: new Date(paymentIntent.created * 1000).toISOString(),
        amount_eur: Number((paymentIntent.amount / 100).toFixed(2)),
        email: metadata.email || metadata.customer_email || paymentIntent.receipt_email || '',
        phone: metadata.phone || '',
        phone_country: metadata.phone_country || metadata.country || 'PT',
        full_name: metadata.full_name || '',
        decline_code: error.decline_code || '',
        error_message: error.message || '',
        order_bumps: metadata.order_bumps || '',
        utm_campaign: metadata.utm_campaign || '',
        utm_content: metadata.utm_content || '',
        payment_attempted: metadata.payment_attempted === 'true',
    };
}

async function buildFailedPaymentsReport(query) {
    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new Error('STRIPE_SECRET_KEY em falta.');
    }

    var bounds = stripeSales.resolveDateBounds(query || {});
    var stripe = new Stripe(secretKey);
    var paymentIntents = await stripeSales.fetchPaymentIntents(stripe, bounds);
    var failed = paymentIntents
        .filter(isFailedCheckoutPayment)
        .map(summarizeFailedPayment)
        .sort(function (a, b) {
            return b.created.localeCompare(a.created);
        });
    var abandoned = paymentIntents
        .filter(isAbandonedCheckoutPayment)
        .map(summarizeFailedPayment)
        .sort(function (a, b) {
            return b.created.localeCompare(a.created);
        });

    return {
        summary: {
            total_failed: failed.length,
            total_abandoned: abandoned.length,
            total_payment_errors: failed.filter(function (row) {
                return Boolean(row.error_message);
            }).length,
            with_phone: failed.filter(function (row) {
                return Boolean(row.phone);
            }).length,
            with_email: failed.filter(function (row) {
                return Boolean(row.email);
            }).length,
            generated_at: new Date().toISOString(),
        },
        date_range: {
            from: bounds.from,
            to: bounds.to,
            timezone: bounds.timezone,
        },
        failed_payments: failed,
        abandoned_checkouts: abandoned,
    };
}

module.exports = {
    buildFailedPaymentsReport: buildFailedPaymentsReport,
    isFailedCheckoutPayment: isFailedCheckoutPayment,
    isAbandonedCheckoutPayment: isAbandonedCheckoutPayment,
    isCheckout9LivePayment: isCheckout9LivePayment,
    summarizeFailedPayment: summarizeFailedPayment,
};
