var grantAccess = require('./grant-access');
var productCheckoutConfig = require('../product-checkout-config');
var supabaseAdmin = require('../supabase-admin');

var MANUAL_ACCESS_MARKER = 'manual';

function isLiveStripeMetadata(metadata) {
    var data = metadata || {};

    return data.stripe_mode !== 'test' && data.checkout !== 'checkout9-test';
}

function escapeStripeSearchValue(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeEmail(email) {
    return supabaseAdmin.normalizeEmail(email || '');
}

function resolveProductsFromPaymentIntent(paymentIntent) {
    var metadata = paymentIntent.metadata || {};

    if (!isLiveStripeMetadata(metadata)) {
        return [];
    }

    if (paymentIntent.status !== 'succeeded') {
        return [];
    }

    return grantAccess.parseOrderBumps(metadata);
}

function resolveProductFromCheckoutSession(session) {
    var metadata = session.metadata || {};

    if (!isLiveStripeMetadata(metadata)) {
        return null;
    }

    if (session.status !== 'complete') {
        return null;
    }

    if (session.payment_status && session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        return null;
    }

    var productId = metadata.product_id || metadata.upsell || '';

    if (!productId || !productCheckoutConfig.getProduct(productId)) {
        return null;
    }

    return productId;
}

function buildEntitlementKey(row) {
    return String(row.product_id || '') + '::' + String(row.stripe_payment_intent_id || '') + '::' + String(row.stripe_subscription_id || '');
}

function addEntitlement(map, row) {
    var key = buildEntitlementKey(row);

    if (!row.product_id || map[key]) {
        return;
    }

    map[key] = row;
}

function buildEntitlementsFromPurchases(purchases) {
    var map = {};

    (purchases.paymentIntents || []).forEach(function (paymentIntent) {
        var productIds = resolveProductsFromPaymentIntent(paymentIntent);

        productIds.forEach(function (productId) {
            addEntitlement(map, {
                product_id: productId,
                stripe_payment_intent_id: paymentIntent.id,
                stripe_subscription_id: null,
                expires_at: null,
                amount_cents: Number(paymentIntent.amount || 0),
                currency: String(paymentIntent.currency || 'eur').toUpperCase(),
            });
        });
    });

    (purchases.checkoutSessions || []).forEach(function (session) {
        var productId = resolveProductFromCheckoutSession(session);

        if (!productId) {
            return;
        }

        var paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
        var subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

        addEntitlement(map, {
            product_id: productId,
            stripe_payment_intent_id: paymentIntentId,
            stripe_subscription_id: subscriptionId,
            expires_at: session.subscription_expires_at || null,
            amount_cents: Number(session.amount_total || 0),
            currency: String(session.currency || 'eur').toUpperCase(),
        });
    });

    return Object.values(map);
}

async function searchPaymentIntents(stripe, email) {
    var normalized = normalizeEmail(email);

    if (!normalized) {
        return [];
    }

    var escaped = escapeStripeSearchValue(normalized);
    var queries = [
        "metadata['email']:'" + escaped + "' AND status:'succeeded'",
        "receipt_email:'" + escaped + "' AND status:'succeeded'",
    ];
    var byId = {};

    for (var i = 0; i < queries.length; i += 1) {
        try {
            var result = await stripe.paymentIntents.search({
                query: queries[i],
                limit: 100,
            });

            (result.data || []).forEach(function (paymentIntent) {
                byId[paymentIntent.id] = paymentIntent;
            });
        } catch (error) {
            console.warn('Stripe PI search falhou:', queries[i], error.message);
        }
    }

    return Object.values(byId);
}

async function searchCheckoutSessions(stripe, email) {
    var normalized = normalizeEmail(email);

    if (!normalized) {
        return [];
    }

    var escaped = escapeStripeSearchValue(normalized);

    var queries = [
        "metadata['email']:'" + escaped + "' AND status:'complete'",
        "customer_email:'" + escaped + "' AND status:'complete'",
    ];
    var byId = {};

    for (var q = 0; q < queries.length; q += 1) {
        try {
            var result = await stripe.checkout.sessions.search({
                query: queries[q],
                limit: 100,
            });

            (result.data || []).forEach(function (session) {
                byId[session.id] = session;
            });
        } catch (error) {
            console.warn('Stripe checkout search falhou:', queries[q], error.message);
        }
    }

    var sessions = Object.values(byId);

    for (var i = 0; i < sessions.length; i += 1) {
        var session = sessions[i];

        if (typeof session.subscription === 'string' && session.subscription) {
            try {
                var subscription = await stripe.subscriptions.retrieve(session.subscription);
                var isActive = subscription.status === 'active' || subscription.status === 'trialing';

                session.subscription_expires_at = isActive && subscription.current_period_end
                    ? new Date(subscription.current_period_end * 1000).toISOString()
                    : new Date().toISOString();
            } catch (subscriptionError) {
                console.warn('Stripe subscription retrieve falhou:', session.subscription, subscriptionError.message);
            }
        }
    }

    return sessions;
}

async function fetchStripePurchasesForEmail(stripe, email) {
    if (!stripe) {
        return {
            paymentIntents: [],
            checkoutSessions: [],
        };
    }

    var paymentIntents = await searchPaymentIntents(stripe, email);
    var checkoutSessions = await searchCheckoutSessions(stripe, email);

    return {
        paymentIntents: paymentIntents,
        checkoutSessions: checkoutSessions,
    };
}

function isManualAccessRow(row) {
    return row.stripe_payment_intent_id === MANUAL_ACCESS_MARKER;
}

function sumPaidFromPurchases(purchases) {
    var totalByPi = {};
    var totalCents = 0;

    (purchases.paymentIntents || []).forEach(function (paymentIntent) {
        if (!isLiveStripeMetadata(paymentIntent.metadata || {})) {
            return;
        }

        if (!totalByPi[paymentIntent.id]) {
            totalByPi[paymentIntent.id] = true;
            totalCents += Number(paymentIntent.amount || 0);
        }
    });

    (purchases.checkoutSessions || []).forEach(function (session) {
        var metadata = session.metadata || {};

        if (!isLiveStripeMetadata(metadata)) {
            return;
        }

        var paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : '';

        if (paymentIntentId && totalByPi[paymentIntentId]) {
            return;
        }

        if (paymentIntentId) {
            totalByPi[paymentIntentId] = true;
        }

        totalCents += Number(session.amount_total || 0);
    });

    return Number((totalCents / 100).toFixed(2));
}

async function syncMemberEntitlementsFromStripe(admin, stripe, member, options) {
    options = options || {};

    if (!member || !member.id || !member.email) {
        return { ok: false, reason: 'missing_member' };
    }

    var purchases = await fetchStripePurchasesForEmail(stripe, member.email);
    var stripeEntitlements = buildEntitlementsFromPurchases(purchases);
    var entitledProductIds = {};

    stripeEntitlements.forEach(function (row) {
        entitledProductIds[row.product_id] = true;
    });

    var currentResult = await admin
        .from('member_products')
        .select('member_id, product_id, stripe_payment_intent_id, stripe_subscription_id, granted_at, expires_at')
        .eq('member_id', member.id);

    if (currentResult.error) {
        throw currentResult.error;
    }

    var currentRows = currentResult.data || [];
    var manualRows = currentRows.filter(isManualAccessRow);

    var deleteResult = await admin
        .from('member_products')
        .delete()
        .eq('member_id', member.id);

    if (deleteResult.error) {
        throw deleteResult.error;
    }

    var rowsToInsert = stripeEntitlements.slice();

    if (options.keepManual !== false) {
        manualRows.forEach(function (row) {
            rowsToInsert.push({
                product_id: row.product_id,
                stripe_payment_intent_id: MANUAL_ACCESS_MARKER,
                stripe_subscription_id: null,
                expires_at: row.expires_at || null,
            });
        });
    }

    if (rowsToInsert.length) {
        var upsertRows = rowsToInsert.map(function (row) {
            return {
                member_id: member.id,
                product_id: row.product_id,
                stripe_payment_intent_id: row.stripe_payment_intent_id || null,
                stripe_subscription_id: row.stripe_subscription_id || null,
                expires_at: row.expires_at || null,
            };
        });

        var upsertResult = await admin
            .from('member_products')
            .insert(upsertRows);

        if (upsertResult.error) {
            throw upsertResult.error;
        }
    }

    return {
        ok: true,
        member_id: member.id,
        email: member.email,
        stripe_products: Object.keys(entitledProductIds),
        stripe_entitlements: stripeEntitlements.length,
        manual_products: manualRows.map(function (row) {
            return row.product_id;
        }),
        total_paid_eur: sumPaidFromPurchases(purchases),
        payment_intents: (purchases.paymentIntents || []).length,
        checkout_sessions: (purchases.checkoutSessions || []).length,
    };
}

module.exports = {
    MANUAL_ACCESS_MARKER: MANUAL_ACCESS_MARKER,
    isManualAccessRow: isManualAccessRow,
    fetchStripePurchasesForEmail: fetchStripePurchasesForEmail,
    buildEntitlementsFromPurchases: buildEntitlementsFromPurchases,
    sumPaidFromPurchases: sumPaidFromPurchases,
    syncMemberEntitlementsFromStripe: syncMemberEntitlementsFromStripe,
    resolveProductsFromPaymentIntent: resolveProductsFromPaymentIntent,
};
