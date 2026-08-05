var supabaseAdmin = require('../supabase-admin');

var MAIN_PRODUCT_ID = 'onda-prodigio';

var BUMP_ID_MAP = {
    'tardes-sem-brigas': 'tardes-sem-brigas',
    'caixa-super-truques': 'caixa-super-truques',
    'grandes-mentes': 'grandes-mentes',
};

function parseOrderBumps(metadata) {
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

    var fullName = metadata.full_name || '';
    var productIds = parseOrderBumps(metadata);
    var authUser = await ensureAuthUser(admin, email, fullName);

    var memberResult = await admin
        .from('members')
        .upsert({
            email: email,
            auth_user_id: authUser.id,
            full_name: fullName || null,
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

    if (!member.password_set && authUser.user_metadata && authUser.user_metadata.password_set) {
        await admin.from('members').update({ password_set: true }).eq('id', member.id);
        member.password_set = true;
    }

    var entitlementRows = productIds.map(function (productId) {
        return {
            member_id: member.id,
            product_id: productId,
            stripe_payment_intent_id: paymentIntent.id,
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

    return {
        email: email,
        member_id: member.id,
        products: productIds,
        password_set: member.password_set,
    };
}

module.exports = {
    MAIN_PRODUCT_ID: MAIN_PRODUCT_ID,
    parseOrderBumps: parseOrderBumps,
    grantAccessFromPaymentIntent: grantAccessFromPaymentIntent,
};
