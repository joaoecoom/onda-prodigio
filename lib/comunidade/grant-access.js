var supabaseAdmin = require('../supabase-admin');
var upsellConfig = require('../upsell-config');
var provisionalPassword = require('./provisional-password');
var sendPurchaseEmail = require('./send-purchase-email');
var sendPurchaseWhatsApp = require('./send-purchase-whatsapp');
var stripeEntitlements = require('./stripe-entitlements');

var MAIN_PRODUCT_ID = 'onda-prodigio';

var UPSELL_PRODUCT_IDS = Object.keys(upsellConfig.UPSELLS || {});

function areUpsellsEnabled() {
    return String(process.env.COMUNIDADE_UPSELLS_ENABLED || '').trim() === 'true';
}

function isUpsellProduct(productId) {
    return UPSELL_PRODUCT_IDS.indexOf(productId) !== -1;
}

var BUMP_ID_MAP = {
    'tardes-sem-brigas': 'tardes-sem-brigas',
    'caixa-super-truques': 'caixa-super-truques',
    'grandes-mentes': 'grandes-mentes',
};

function memberNeverLoggedIn(member) {
    if (!member) {
        return true;
    }

    if (member.last_login_at) {
        return false;
    }

    return member.login_count == null || Number(member.login_count) === 0;
}

function isLiveStripeMetadata(metadata) {
    var data = metadata || {};

    return data.stripe_mode !== 'test' && data.checkout !== 'checkout9-test';
}

function parseStandaloneProduct(metadata) {
    if (metadata.checkout_type !== 'standalone') {
        return null;
    }

    var productId = typeof metadata.product_id === 'string' ? metadata.product_id.trim() : '';

    return productId || null;
}

function parseOrderBumps(metadata) {
    var standaloneProductId = parseStandaloneProduct(metadata);

    if (standaloneProductId) {
        return [standaloneProductId];
    }

    var raw = metadata.order_bumps || '';
    var items = String(raw).split(',').map(function (item) {
        return item.trim();
    }).filter(Boolean);

    var productIds = [MAIN_PRODUCT_ID];

    items.forEach(function (bumpId) {
        if (BUMP_ID_MAP[bumpId]) {
            productIds.push(BUMP_ID_MAP[bumpId]);
        }
    });

    return productIds.filter(function (id, index, list) {
        return list.indexOf(id) === index;
    });
}

async function ensureAuthUser(admin, email, fullName) {
    var normalizedEmail = supabaseAdmin.normalizeEmail(email);

    var existingList = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
    });

    if (existingList.error) {
        throw existingList.error;
    }

    var existingUser = (existingList.data.users || []).find(function (user) {
        return supabaseAdmin.normalizeEmail(user.email) === normalizedEmail;
    });

    if (existingUser) {
        return existingUser;
    }

    var created = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: {
            full_name: fullName || '',
        },
    });

    if (created.error) {
        if (created.error.message && created.error.message.toLowerCase().indexOf('already') !== -1) {
            var retryList = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });

            if (retryList.error) {
                throw retryList.error;
            }

            var retryUser = (retryList.data.users || []).find(function (user) {
                return supabaseAdmin.normalizeEmail(user.email) === normalizedEmail;
            });

            if (retryUser) {
                return retryUser;
            }
        }

        throw created.error;
    }

    return created.data.user;
}

async function grantProductAccess(admin, member, productId, options) {
    options = options || {};

    var row = {
        member_id: member.id,
        product_id: productId,
        stripe_payment_intent_id: options.stripePaymentIntentId || null,
        stripe_subscription_id: options.stripeSubscriptionId || null,
        expires_at: options.expiresAt || null,
    };

    var entitlementResult = await admin
        .from('member_products')
        .upsert(row, {
            onConflict: 'member_id,product_id',
            ignoreDuplicates: false,
        });

    if (entitlementResult.error) {
        throw entitlementResult.error;
    }

    return row;
}

async function grantAccessFromPaymentIntent(paymentIntent) {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var metadata = paymentIntent.metadata || {};
    var email = supabaseAdmin.normalizeEmail(metadata.email || paymentIntent.receipt_email || '');

    if (!email) {
        return { skipped: true, reason: 'missing_email' };
    }

    if (!isLiveStripeMetadata(metadata)) {
        return { skipped: true, reason: 'test_or_invalid_checkout' };
    }

    if (paymentIntent.status !== 'succeeded') {
        return { skipped: true, reason: 'not_succeeded' };
    }

    var fullName = metadata.full_name || '';
    var phone = metadata.phone || '';
    var phoneCountry = metadata.phone_country || 'PT';
    var productIds = parseOrderBumps(metadata);
    var authUser = await ensureAuthUser(admin, email, fullName);

    var memberResult = await admin
        .from('members')
        .upsert({
            email: email,
            auth_user_id: authUser.id,
            full_name: fullName || null,
            phone: phone || null,
            phone_country: phoneCountry || null,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'email',
        })
        .select('*')
        .single();

    if (memberResult.error) {
        throw memberResult.error;
    }

    var member = memberResult.data;
    var hadPasswordSet = Boolean(member.password_set);
    var neverLoggedIn = memberNeverLoggedIn(member);
    var provisional = await provisionalPassword.setProvisionalPasswordIfNeeded(admin, authUser, member, {
        force: neverLoggedIn,
    });

    if (provisional.set) {
        member.password_set = true;
    }

    var entitlementRows = productIds.map(function (productId) {
        return {
            member_id: member.id,
            product_id: productId,
            stripe_payment_intent_id: paymentIntent.id,
            stripe_subscription_id: null,
            expires_at: null,
        };
    });

    var entitlementResult = await admin
        .from('member_products')
        .upsert(entitlementRows, {
            onConflict: 'member_id,product_id',
            ignoreDuplicates: false,
        });

    if (entitlementResult.error) {
        throw entitlementResult.error;
    }

    var emailResult = await sendPurchaseEmail.maybeSendAfterGrant({
        admin: admin,
        member: member,
        email: email,
        fullName: fullName,
        productIds: productIds,
        referenceId: paymentIntent.id,
        provisionalPassword: provisional.password,
        hadPasswordSet: hadPasswordSet,
    });

    var whatsappResult = await sendPurchaseWhatsApp.maybeSendAfterGrant({
        admin: admin,
        member: member,
        email: email,
        fullName: fullName,
        phone: phone,
        phoneCountry: phoneCountry,
        productIds: productIds,
        referenceId: paymentIntent.id,
        provisionalPassword: provisional.password,
    });

    await reconcileMemberAccessFromStripe(admin, member);

    return {
        email: email,
        member_id: member.id,
        products: productIds,
        password_set: member.password_set,
        provisional_password_set: provisional.set,
        email_result: emailResult,
        whatsapp_result: whatsappResult,
    };
}

async function grantAccessFromCheckoutSession(stripe, session) {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var metadata = session.metadata || {};
    var productId = metadata.product_id || metadata.upsell || '';

    var isStandaloneCheckout = metadata.checkout_type === 'standalone';

    if (!isLiveStripeMetadata(metadata)) {
        return { skipped: true, reason: 'test_or_invalid_checkout' };
    }

    if (isUpsellProduct(productId) && !areUpsellsEnabled() && !isStandaloneCheckout) {
        return {
            skipped: true,
            reason: 'upsells_not_enabled_yet',
            product_id: productId,
        };
    }

    var email = supabaseAdmin.normalizeEmail(
        metadata.email || (session.customer_details && session.customer_details.email) || session.customer_email || ''
    );

    if (!productId || !email) {
        return { skipped: true, reason: 'missing_product_or_email' };
    }

    var fullName = metadata.full_name || '';
    var phone = metadata.phone || '';
    var phoneCountry = metadata.phone_country || 'PT';
    var authUser = await ensureAuthUser(admin, email, fullName);

    var memberResult = await admin
        .from('members')
        .upsert({
            email: email,
            auth_user_id: authUser.id,
            full_name: fullName || null,
            phone: phone || null,
            phone_country: phoneCountry || null,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'email',
        })
        .select('*')
        .single();

    if (memberResult.error) {
        throw memberResult.error;
    }

    var member = memberResult.data;
    var hadPasswordSet = Boolean(member.password_set);
    var neverLoggedIn = memberNeverLoggedIn(member);
    var provisional = await provisionalPassword.setProvisionalPasswordIfNeeded(admin, authUser, member, {
        force: neverLoggedIn,
    });

    if (provisional.set) {
        member.password_set = true;
    }

    var options = {
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
        expiresAt: null,
    };

    if (options.stripeSubscriptionId && stripe) {
        var subscription = await stripe.subscriptions.retrieve(options.stripeSubscriptionId);
        options.expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
    }

    await grantProductAccess(admin, member, productId, options);

    var emailResult = await sendPurchaseEmail.maybeSendAfterGrant({
        admin: admin,
        member: member,
        email: email,
        fullName: fullName,
        productIds: [productId],
        referenceId: session.id,
        provisionalPassword: provisional.password,
        hadPasswordSet: hadPasswordSet,
    });

    var whatsappResult = await sendPurchaseWhatsApp.maybeSendAfterGrant({
        admin: admin,
        member: member,
        email: email,
        fullName: fullName,
        phone: phone,
        phoneCountry: phoneCountry,
        productIds: [productId],
        referenceId: session.id,
        provisionalPassword: provisional.password,
    });

    await reconcileMemberAccessFromStripe(admin, member);

    return {
        email: email,
        member_id: member.id,
        products: [productId],
        expires_at: options.expiresAt,
        password_set: member.password_set,
        provisional_password_set: provisional.set,
        email_result: emailResult,
        whatsapp_result: whatsappResult,
    };
}

async function reconcileMemberAccessFromStripe(admin, member) {
    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey || !member || !member.id) {
        return { skipped: true };
    }

    try {
        var Stripe = require('stripe');
        var stripe = new Stripe(secretKey);

        return await stripeEntitlements.syncMemberEntitlementsFromStripe(admin, stripe, member, {
            keepManual: true,
        });
    } catch (error) {
        console.error('Reconcile Stripe access falhou:', member.email || member.id, error.message);
        return { ok: false, error: error.message };
    }
}

async function updateSubscriptionAccess(stripe, subscription) {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin || !subscription || !subscription.id) {
        return { skipped: true, reason: 'missing_subscription' };
    }

    var expiresAt = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
    var isActive = subscription.status === 'active' || subscription.status === 'trialing';

    var updatePayload = {
        expires_at: isActive ? expiresAt : new Date().toISOString(),
    };

    var result = await admin
        .from('member_products')
        .update(updatePayload)
        .eq('stripe_subscription_id', subscription.id);

    if (result.error) {
        throw result.error;
    }

    return {
        subscription_id: subscription.id,
        expires_at: updatePayload.expires_at,
        status: subscription.status,
    };
}

module.exports = {
    MAIN_PRODUCT_ID: MAIN_PRODUCT_ID,
    UPSELL_PRODUCT_IDS: UPSELL_PRODUCT_IDS,
    areUpsellsEnabled: areUpsellsEnabled,
    isUpsellProduct: isUpsellProduct,
    parseOrderBumps: parseOrderBumps,
    isLiveStripeMetadata: isLiveStripeMetadata,
    grantAccessFromPaymentIntent: grantAccessFromPaymentIntent,
    grantAccessFromCheckoutSession: grantAccessFromCheckoutSession,
    updateSubscriptionAccess: updateSubscriptionAccess,
};
