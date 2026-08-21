var supabaseAdmin = require('../supabase-admin');

async function getAuthUserFromRequest(req) {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        return { error: 'Supabase não configurado.', status: 500 };
    }

    var authHeader = req.headers.authorization || '';
    var token = authHeader.indexOf('Bearer ') === 0 ? authHeader.slice(7).trim() : '';

    if (!token) {
        return { error: 'Sessão em falta.', status: 401 };
    }

    var userResult = await admin.auth.getUser(token);

    if (userResult.error || !userResult.data.user) {
        return { error: 'Sessão inválida.', status: 401 };
    }

    return { admin: admin, user: userResult.data.user };
}

async function getMemberByAuthUser(admin, user) {
    var email = supabaseAdmin.normalizeEmail(user.email);
    var memberResult = await admin
        .from('members')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (memberResult.error) {
        throw memberResult.error;
    }

    return memberResult.data;
}

async function getAdminByAuthUser(admin, user) {
    var email = supabaseAdmin.normalizeEmail(user.email);
    var adminResult = await admin
        .from('admins')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (adminResult.error) {
        throw adminResult.error;
    }

    return adminResult.data;
}

async function getAccessibleProductIds(admin, member, adminProfile, options) {
    var offerId = options && options.offerId ? String(options.offerId).trim() : '';

    var query = admin
        .from('products')
        .select('id, offer_id')
        .order('sort_order', { ascending: true });

    if (offerId) {
        query = query.eq('offer_id', offerId);
    }

    if (adminProfile) {
        var allProducts = await query;

        if (allProducts.error) {
            throw allProducts.error;
        }

        return (allProducts.data || []).map(function (product) {
            return product.id;
        });
    }

    if (!member) {
        return [];
    }

    var accessResult = await admin
        .from('member_products')
        .select('product_id, expires_at')
        .eq('member_id', member.id);

    if (accessResult.error) {
        throw accessResult.error;
    }

    var now = Date.now();

    var accessibleIds = (accessResult.data || [])
        .filter(function (row) {
            if (!row.expires_at) {
                return true;
            }

            return new Date(row.expires_at).getTime() > now;
        })
        .map(function (row) {
            return row.product_id;
        });

    if (!offerId) {
        return accessibleIds;
    }

    if (!accessibleIds.length) {
        return [];
    }

    var offerProducts = await admin
        .from('products')
        .select('id')
        .eq('offer_id', offerId)
        .in('id', accessibleIds);

    if (offerProducts.error) {
        throw offerProducts.error;
    }

    var allowed = {};

    (offerProducts.data || []).forEach(function (row) {
        allowed[row.id] = true;
    });

    return accessibleIds.filter(function (productId) {
        return Boolean(allowed[productId]);
    });
}

function jsonError(res, status, message) {
    return res.status(status).json({ error: message });
}

module.exports = {
    getAuthUserFromRequest: getAuthUserFromRequest,
    getMemberByAuthUser: getMemberByAuthUser,
    getAdminByAuthUser: getAdminByAuthUser,
    getAccessibleProductIds: getAccessibleProductIds,
    jsonError: jsonError,
};
