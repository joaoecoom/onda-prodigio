var schedule = require('./never-logged-in-schedule');
var sendNeverLoggedInWhatsApp = require('./send-never-logged-in-whatsapp');
var sendNeverLoggedInEmail = require('./send-never-logged-in-email');
var phoneUtils = require('../whatsapp/phone');

var NEVER_LOGGED_IN_SKIP_EMAILS = {
    'teste.membro@example.com': true,
    'geral.joaoecoom@gmail.com': true,
    'jadparreira@gmail.com': true,
    'suporte.angelacampos@gmail.com': true,
};

function isNeverLoggedInMember(member) {
    if (!member || NEVER_LOGGED_IN_SKIP_EMAILS[member.email]) {
        return false;
    }

    return sendNeverLoggedInWhatsApp.hasLoggedIn(member) === false;
}

async function resolvePurchasedAt(admin, memberId) {
    var productsResult = await admin
        .from('member_products')
        .select('granted_at')
        .eq('member_id', memberId)
        .order('granted_at', { ascending: true })
        .limit(1);

    if (productsResult.error) {
        throw productsResult.error;
    }

    if (productsResult.data && productsResult.data.length && productsResult.data[0].granted_at) {
        return productsResult.data[0].granted_at;
    }

    var memberResult = await admin
        .from('members')
        .select('created_at')
        .eq('id', memberId)
        .maybeSingle();

    if (memberResult.error) {
        throw memberResult.error;
    }

    return memberResult.data && memberResult.data.created_at
        ? memberResult.data.created_at
        : new Date().toISOString();
}

async function cancelPendingForMember(admin, memberId, reason) {
    if (!admin || !memberId) {
        return;
    }

    try {
        await admin
            .from('never_logged_in_whatsapp_queue')
            .update({
                status: 'cancelled',
                skip_reason: reason || 'cancelled',
                processed_at: new Date().toISOString(),
            })
            .eq('member_id', memberId)
            .eq('status', 'pending');
    } catch (error) {
        console.warn('never_logged_in_whatsapp_queue cancel ignorado:', error.message);
    }
}

async function markQueueItem(admin, memberId, status, skipReason) {
    await admin
        .from('never_logged_in_whatsapp_queue')
        .update({
            status: status,
            skip_reason: skipReason || null,
            processed_at: new Date().toISOString(),
        })
        .eq('member_id', memberId);
}

/**
 * @param {{ admin: object, memberId: string, purchasedAt?: string|Date }} options
 */
async function enqueueNeverLoggedInFollowUp(options) {
    var admin = options.admin;
    var memberId = options.memberId;

    if (!admin || !memberId) {
        return { skipped: true, reason: 'missing_data' };
    }

    var memberResult = await admin
        .from('members')
        .select('id, email, full_name, phone, phone_country, login_count, last_login_at')
        .eq('id', memberId)
        .maybeSingle();

    if (memberResult.error) {
        throw memberResult.error;
    }

    if (!memberResult.data || !isNeverLoggedInMember(memberResult.data)) {
        await cancelPendingForMember(admin, memberId, 'logged_in');
        return { skipped: true, reason: 'logged_in' };
    }

    if (await sendNeverLoggedInWhatsApp.wasFollowUpAlreadySent(admin, memberId)) {
        await cancelPendingForMember(admin, memberId, 'already_sent');
        return { skipped: true, reason: 'already_sent' };
    }

    var purchasedAt = options.purchasedAt || await resolvePurchasedAt(admin, memberId);
    var sendAfter = schedule.computeSendAfter(purchasedAt);

    var upsertResult = await admin
        .from('never_logged_in_whatsapp_queue')
        .upsert({
            member_id: memberId,
            purchased_at: new Date(purchasedAt).toISOString(),
            send_after: sendAfter.toISOString(),
            status: 'pending',
            skip_reason: null,
            processed_at: null,
        }, {
            onConflict: 'member_id',
        })
        .select('member_id, purchased_at, send_after')
        .single();

    if (upsertResult.error) {
        if (String(upsertResult.error.message || '').toLowerCase().indexOf('never_logged_in_whatsapp_queue') !== -1) {
            return { skipped: true, reason: 'queue_table_missing' };
        }

        throw upsertResult.error;
    }

    return {
        ok: true,
        queued: true,
        member_id: memberId,
        purchased_at: upsertResult.data.purchased_at,
        send_after: upsertResult.data.send_after,
        schedule_hint: schedule.describeSchedule(purchasedAt, sendAfter),
    };
}

async function ensureQueueForEligibleMembers(admin, stripe, members, memberProducts) {
    var queued = 0;
    var skipped = 0;

    for (var i = 0; i < members.length; i += 1) {
        var member = members[i];

        if (!isNeverLoggedInMember(member)) {
            continue;
        }

        if (await sendNeverLoggedInWhatsApp.wasFollowUpAlreadySent(admin, member.id)) {
            skipped += 1;
            continue;
        }

        var existing = await admin
            .from('never_logged_in_whatsapp_queue')
            .select('member_id, status')
            .eq('member_id', member.id)
            .maybeSingle();

        if (existing.error) {
            if (String(existing.error.message || '').toLowerCase().indexOf('never_logged_in_whatsapp_queue') !== -1) {
                return { queued: 0, skipped: 0, queue_table_missing: true };
            }

            throw existing.error;
        }

        if (existing.data && existing.data.status === 'pending') {
            skipped += 1;
            continue;
        }

        var purchasedAt = await resolvePurchasedAt(admin, member.id);
        var result = await enqueueNeverLoggedInFollowUp({
            admin: admin,
            memberId: member.id,
            purchasedAt: purchasedAt,
        });

        if (result.ok) {
            queued += 1;
        } else {
            skipped += 1;
        }
    }

    return { queued: queued, skipped: skipped };
}

async function resolvePhoneForMember(stripe, member, memberProducts) {
    if (member.phone) {
        return {
            phone: member.phone,
            phone_country: member.phone_country || 'PT',
        };
    }

    var paymentIntentId = '';

    (memberProducts || []).some(function (row) {
        if (row.member_id === member.id && row.stripe_payment_intent_id) {
            paymentIntentId = row.stripe_payment_intent_id;
            return true;
        }

        return false;
    });

    if (!paymentIntentId || !stripe) {
        return { phone: '', phone_country: 'PT' };
    }

    try {
        var Stripe = require('stripe');
        var pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        var metadata = pi.metadata || {};

        return {
            phone: metadata.phone || '',
            phone_country: metadata.phone_country || 'PT',
        };
    } catch (error) {
        return { phone: '', phone_country: 'PT' };
    }
}

async function listPendingTargets(admin) {
    var nowIso = new Date().toISOString();
    var queueResult = await admin
        .from('never_logged_in_whatsapp_queue')
        .select('member_id, purchased_at, send_after, status')
        .eq('status', 'pending')
        .lte('send_after', nowIso)
        .order('send_after', { ascending: true });

    if (queueResult.error) {
        if (String(queueResult.error.message || '').toLowerCase().indexOf('never_logged_in_whatsapp_queue') !== -1) {
            return { ready: [], waiting: [], queue_table_missing: true };
        }

        throw queueResult.error;
    }

    var waitingResult = await admin
        .from('never_logged_in_whatsapp_queue')
        .select('member_id, purchased_at, send_after, status')
        .eq('status', 'pending')
        .gt('send_after', nowIso)
        .order('send_after', { ascending: true });

    if (waitingResult.error) {
        throw waitingResult.error;
    }

    return {
        ready: queueResult.data || [],
        waiting: waitingResult.data || [],
    };
}

async function processNextNeverLoggedInWhatsApp() {
    var supabaseAdmin = require('../supabase-admin');
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var Stripe = require('stripe');
    var stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
    var nowIso = new Date().toISOString();

    var queueResult = await admin
        .from('never_logged_in_whatsapp_queue')
        .select('member_id, purchased_at, send_after')
        .eq('status', 'pending')
        .lte('send_after', nowIso)
        .order('send_after', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (queueResult.error) {
        if (String(queueResult.error.message || '').toLowerCase().indexOf('never_logged_in_whatsapp_queue') !== -1) {
            return {
                ok: false,
                done: true,
                skipped: true,
                reason: 'queue_table_missing',
            };
        }

        throw queueResult.error;
    }

    if (!queueResult.data) {
        var waitingCountResult = await admin
            .from('never_logged_in_whatsapp_queue')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .gt('send_after', nowIso);

        return {
            ok: true,
            done: true,
            sent: null,
            pending_ready_count: 0,
            pending_waiting_count: waitingCountResult.count || 0,
        };
    }

    var queueItem = queueResult.data;
    var memberResult = await admin
        .from('members')
        .select('id, email, full_name, phone, phone_country, login_count, last_login_at')
        .eq('id', queueItem.member_id)
        .maybeSingle();

    if (memberResult.error || !memberResult.data) {
        await markQueueItem(admin, queueItem.member_id, 'cancelled', 'member_not_found');
        return processNextNeverLoggedInWhatsApp();
    }

    var member = memberResult.data;

    if (!isNeverLoggedInMember(member)) {
        await markQueueItem(admin, member.id, 'cancelled', 'logged_in');
        return {
            ok: true,
            done: false,
            skipped: true,
            reason: 'logged_in',
            email: member.email,
        };
    }

    if (
        await sendNeverLoggedInWhatsApp.wasFollowUpAlreadySent(admin, member.id) &&
        await sendNeverLoggedInEmail.wasFollowUpEmailAlreadySent(admin, member.id)
    ) {
        await markQueueItem(admin, member.id, 'cancelled', 'already_sent');
        return processNextNeverLoggedInWhatsApp();
    }

    var memberProductsResult = await admin.from('member_products').select('member_id, stripe_payment_intent_id, product_id');
    var memberProducts = memberProductsResult.error ? [] : (memberProductsResult.data || []);
    var phoneInfo = await resolvePhoneForMember(stripe, member, memberProducts);
    var phoneDigits = phoneUtils.normalizePhoneForWhatsApp(phoneInfo.phone, phoneInfo.phone_country);

    var productIds = memberProducts
        .filter(function (row) {
            return row.member_id === member.id;
        })
        .map(function (row) {
            return row.product_id;
        });

    var whatsappResult = await sendNeverLoggedInWhatsApp.sendNeverLoggedInFollowUp({
        admin: admin,
        member: member,
        productIds: productIds,
        phone: phoneInfo.phone,
        phoneCountry: phoneInfo.phone_country,
    });

    var emailResult = await sendNeverLoggedInEmail.sendNeverLoggedInFollowUpEmail({
        admin: admin,
        member: member,
        productIds: productIds,
    });

    var channelOk = Boolean(whatsappResult.ok || emailResult.ok);
    var bothSkipped = Boolean(whatsappResult.skipped && emailResult.skipped);

    if (channelOk) {
        await markQueueItem(admin, member.id, 'sent', null);

        var pendingReady = await admin
            .from('never_logged_in_whatsapp_queue')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .lte('send_after', nowIso);

        return {
            ok: true,
            done: false,
            sent: {
                email: member.email,
                phone: whatsappResult.phone || phoneDigits || '',
                message_id: whatsappResult.message_id || '',
                email_message_id: emailResult.message_id || '',
                send_after: queueItem.send_after,
                purchased_at: queueItem.purchased_at,
            },
            whatsapp_result: whatsappResult,
            email_result: emailResult,
            pending_ready_count: Math.max(0, (pendingReady.count || 1) - 1),
        };
    }

    if (bothSkipped) {
        await markQueueItem(admin, member.id, 'cancelled', emailResult.reason || whatsappResult.reason || 'skipped');

        if (
            whatsappResult.reason === 'no_whatsapp_account' ||
            whatsappResult.reason === 'already_sent' ||
            whatsappResult.reason === 'logged_in' ||
            whatsappResult.reason === 'missing_phone'
        ) {
            return processNextNeverLoggedInWhatsApp();
        }

        return {
            ok: false,
            done: false,
            skipped: true,
            reason: emailResult.reason || whatsappResult.reason,
            email: member.email,
            whatsapp_result: whatsappResult,
            email_result: emailResult,
        };
    }

    return {
        ok: false,
        done: false,
        reason: whatsappResult.reason || emailResult.reason || 'send_failed',
        email: member.email,
        whatsapp_result: whatsappResult,
        email_result: emailResult,
    };
}

module.exports = {
    NEVER_LOGGED_IN_SKIP_EMAILS: NEVER_LOGGED_IN_SKIP_EMAILS,
    isNeverLoggedInMember: isNeverLoggedInMember,
    enqueueNeverLoggedInFollowUp: enqueueNeverLoggedInFollowUp,
    ensureQueueForEligibleMembers: ensureQueueForEligibleMembers,
    cancelPendingForMember: cancelPendingForMember,
    listPendingTargets: listPendingTargets,
    processNextNeverLoggedInWhatsApp: processNextNeverLoggedInWhatsApp,
    resolvePurchasedAt: resolvePurchasedAt,
};
