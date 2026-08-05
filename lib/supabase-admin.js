var { createClient } = require('@supabase/supabase-js');

var supabaseAdmin = null;

function getSupabaseAdmin() {
    if (supabaseAdmin) {
        return supabaseAdmin;
    }

    var url = process.env.SUPABASE_URL;
    var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        return null;
    }

    supabaseAdmin = createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return supabaseAdmin;
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

module.exports = {
    getSupabaseAdmin: getSupabaseAdmin,
    normalizeEmail: normalizeEmail,
};
