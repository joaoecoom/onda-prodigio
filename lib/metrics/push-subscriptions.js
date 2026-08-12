var supabaseAdmin = require('../supabase-admin');

function getAdmin() {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    return admin;
}

async function upsertSubscription(subscription, userAgent) {
    var endpoint = subscription && subscription.endpoint;

    if (!endpoint) {
        throw new Error('Subscrição push inválida.');
    }

    var admin = getAdmin();
    var now = new Date().toISOString();
    var result = await admin.from('metrics_push_subscriptions').upsert({
        endpoint: endpoint,
        subscription_json: subscription,
        user_agent: String(userAgent || '').slice(0, 500),
        last_seen_at: now,
    }, {
        onConflict: 'endpoint',
    });

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível guardar subscrição.');
    }

    return { ok: true, endpoint: endpoint };
}

async function removeSubscription(endpoint) {
    if (!endpoint) {
        return { ok: true, removed: 0 };
    }

    var admin = getAdmin();
    var result = await admin.from('metrics_push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível remover subscrição.');
    }

    return { ok: true, removed: 1 };
}

async function listSubscriptions() {
    var admin = getAdmin();
    var result = await admin.from('metrics_push_subscriptions')
        .select('id, endpoint, subscription_json, user_agent, created_at, last_seen_at')
        .order('last_seen_at', { ascending: false });

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível listar subscrições.');
    }

    return result.data || [];
}

module.exports = {
    upsertSubscription: upsertSubscription,
    removeSubscription: removeSubscription,
    listSubscriptions: listSubscriptions,
};
