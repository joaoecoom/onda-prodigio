var Stripe = require('stripe');
var supabaseAdmin = require('../supabase-admin');
var provisionalPassword = require('../comunidade/provisional-password');
var sendPurchaseEmail = require('../comunidade/send-purchase-email');
var neverLoggedInQueue = require('../comunidade/never-logged-in-queue');
var neverLoggedInSchedule = require('../comunidade/never-logged-in-schedule');
var sendNeverLoggedInWhatsApp = require('../comunidade/send-never-logged-in-whatsapp');
var phoneUtils = require('../whatsapp/phone');
var stripeEntitlements = require('../comunidade/stripe-entitlements');

var MEMBER_SELECT = 'id, email, full_name, password_set, phone, phone_country, created_at, updated_at, last_login_at, login_count';

async function fetchMembers(admin) {
    var membersResult = await admin
        .from('members')
        .select(MEMBER_SELECT)
        .order('created_at', { ascending: false });

    if (membersResult.error) {
        var message = String(membersResult.error.message || '');

        if (message.indexOf('last_login_at') !== -1 || message.indexOf('login_count') !== -1) {
            membersResult = await admin
                .from('members')
                .select('id, email, full_name, password_set, created_at, updated_at')
                .order('created_at', { ascending: false });
        }
    }

    if (membersResult.error) {
        throw membersResult.error;
    }

    return membersResult.data || [];
}

async function fetchMemberProducts(admin) {
    var result = await admin
        .from('member_products')
        .select('member_id, product_id, stripe_payment_intent_id, stripe_subscription_id, granted_at, expires_at');

    if (result.error) {
        throw result.error;
    }

    return result.data || [];
}

async function fetchProducts(admin) {
    var result = await admin
        .from('products')
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true });

    if (result.error) {
        throw result.error;
    }

    return result.data || [];
}

async function fetchAllModules(admin) {
    var result = await admin
        .from('content_modules')
        .select('id, product_id');

    if (result.error) {
        throw result.error;
    }

    return result.data || [];
}

async function fetchAllProgress(admin) {
    var result = await admin
        .from('member_module_progress')
        .select('member_id, module_id, progress_percent');

    if (result.error) {
        throw result.error;
    }

    return result.data || [];
}

async function fetchWhatsAppLogsByMember(admin) {
    try {
        var result = await admin
            .from('whatsapp_message_log')
            .select('member_id, phone, message_type, sent_at')
            .order('sent_at', { ascending: false });

        if (result.error) {
            if (String(result.error.message || '').toLowerCase().indexOf('whatsapp_message_log') !== -1) {
                return {};
            }

            throw result.error;
        }

        var latestByMember = {};

        (result.data || []).forEach(function (row) {
            if (!row.member_id || latestByMember[row.member_id]) {
                return;
            }

            latestByMember[row.member_id] = {
                sent_at: row.sent_at,
                phone: row.phone || '',
                message_type: row.message_type || '',
            };
        });

        return latestByMember;
    } catch (error) {
        console.warn('whatsapp_message_log indisponível no admin:', error.message);
        return {};
    }
}

async function buildPaymentAmountMap(stripe, memberProducts) {
    var paymentIntentIds = {};

    memberProducts.forEach(function (row) {
        if (row.stripe_payment_intent_id && row.stripe_payment_intent_id !== stripeEntitlements.MANUAL_ACCESS_MARKER) {
            paymentIntentIds[row.stripe_payment_intent_id] = true;
        }
    });

    var ids = Object.keys(paymentIntentIds);
    var amountByPi = {};

    if (!stripe || !ids.length) {
        return amountByPi;
    }

    for (var i = 0; i < ids.length; i += 1) {
        try {
            var pi = await stripe.paymentIntents.retrieve(ids[i]);
            amountByPi[ids[i]] = {
                amount: Number(pi.amount || 0) / 100,
                currency: String(pi.currency || 'eur').toUpperCase(),
            };
        } catch (error) {
            amountByPi[ids[i]] = { amount: null, currency: 'EUR', error: error.message };
        }
    }

    return amountByPi;
}

function computeProgressPercent(memberId, productIds, modules, progressRows) {
    var moduleIds = modules
        .filter(function (moduleItem) {
            return productIds.indexOf(moduleItem.product_id) !== -1;
        })
        .map(function (moduleItem) {
            return moduleItem.id;
        });

    if (!moduleIds.length) {
        return 0;
    }

    var progressByModule = {};

    progressRows.forEach(function (row) {
        if (row.member_id === memberId) {
            progressByModule[row.module_id] = row.progress_percent || 0;
        }
    });

    var total = 0;

    moduleIds.forEach(function (moduleId) {
        total += progressByModule[moduleId] || 0;
    });

    return Math.round(total / moduleIds.length);
}

function groupProductsByMember(memberProducts, products, amountByPi) {
    var nameById = {};

    products.forEach(function (product) {
        nameById[product.id] = product.name;
    });

    var grouped = {};

    memberProducts.forEach(function (row) {
        if (!grouped[row.member_id]) {
            grouped[row.member_id] = {
                products: [],
                total_paid_eur: 0,
                payment_intent_ids: {},
            };
        }

        var entry = grouped[row.member_id];
        var paymentInfo = row.stripe_payment_intent_id ? amountByPi[row.stripe_payment_intent_id] : null;

        entry.products.push({
            product_id: row.product_id,
            product_name: nameById[row.product_id] || row.product_id,
            granted_at: row.granted_at,
            expires_at: row.expires_at,
            stripe_payment_intent_id: row.stripe_payment_intent_id,
            stripe_subscription_id: row.stripe_subscription_id,
            amount: paymentInfo ? paymentInfo.amount : null,
            currency: paymentInfo ? paymentInfo.currency : null,
            access_source: stripeEntitlements.isManualAccessRow(row) ? 'manual' : (row.stripe_payment_intent_id ? 'stripe' : 'unknown'),
        });

        if (row.stripe_payment_intent_id && row.stripe_payment_intent_id !== stripeEntitlements.MANUAL_ACCESS_MARKER && paymentInfo && paymentInfo.amount != null) {
            if (!entry.payment_intent_ids[row.stripe_payment_intent_id]) {
                entry.payment_intent_ids[row.stripe_payment_intent_id] = true;
                entry.total_paid_eur += paymentInfo.amount;
            }
        }
    });

    Object.keys(grouped).forEach(function (memberId) {
        delete grouped[memberId].payment_intent_ids;
    });

    return grouped;
}

async function listMembersReport(options) {
    options = options || {};
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;
    var stripe = secretKey ? new Stripe(secretKey) : null;

    var members = await fetchMembers(admin);

    if (stripe && options.syncStripe !== false) {
        for (var syncIndex = 0; syncIndex < members.length; syncIndex += 1) {
            try {
                await stripeEntitlements.syncMemberEntitlementsFromStripe(admin, stripe, members[syncIndex], {
                    keepManual: true,
                });
            } catch (syncError) {
                console.error('Sync Stripe falhou para', members[syncIndex].email, syncError.message);
            }
        }
    }

    var memberProducts = await fetchMemberProducts(admin);
    var products = await fetchProducts(admin);
    var modules = await fetchAllModules(admin);
    var progressRows = await fetchAllProgress(admin);
    var whatsappLogs = await fetchWhatsAppLogsByMember(admin);
    var amountByPi = await buildPaymentAmountMap(stripe, memberProducts);
    var grouped = groupProductsByMember(memberProducts, products, amountByPi);
    var paidByMember = {};

    if (stripe) {
        for (var paidIndex = 0; paidIndex < members.length; paidIndex += 1) {
            var paidMember = members[paidIndex];

            try {
                var purchases = await stripeEntitlements.fetchStripePurchasesForEmail(stripe, paidMember.email);
                paidByMember[paidMember.id] = stripeEntitlements.sumPaidFromPurchases(purchases);
            } catch (paidError) {
                paidByMember[paidMember.id] = grouped[paidMember.id] ? grouped[paidMember.id].total_paid_eur : 0;
            }
        }
    }

    var rows = members.map(function (member) {
        var bundle = grouped[member.id] || { products: [], total_paid_eur: 0 };
        var productIds = bundle.products.map(function (item) {
            return item.product_id;
        });
        var hasStripePurchase = bundle.products.some(function (item) {
            return item.access_source === 'stripe' || (
                item.stripe_payment_intent_id &&
                item.stripe_payment_intent_id !== stripeEntitlements.MANUAL_ACCESS_MARKER
            );
        });
        var hasManualAccess = bundle.products.some(function (item) {
            return item.access_source === 'manual';
        });
        var whatsappLog = whatsappLogs[member.id] || null;
        var totalPaid = paidByMember[member.id] != null
            ? Number(paidByMember[member.id].toFixed(2))
            : Number(bundle.total_paid_eur.toFixed(2));

        return {
            id: member.id,
            email: member.email,
            full_name: member.full_name || '',
            phone: member.phone || '',
            phone_country: member.phone_country || '',
            password_set: member.password_set,
            created_at: member.created_at,
            updated_at: member.updated_at,
            last_login_at: member.last_login_at || null,
            login_count: member.login_count != null ? member.login_count : null,
            products: bundle.products,
            total_paid_eur: totalPaid,
            has_manual_access: hasManualAccess,
            progress_percent: computeProgressPercent(member.id, productIds, modules, progressRows),
            whatsapp_sent: Boolean(whatsappLog),
            whatsapp_sent_at: whatsappLog ? whatsappLog.sent_at : null,
            whatsapp_phone: whatsappLog ? whatsappLog.phone : '',
            whatsapp_eligible: hasStripePurchase || Boolean(member.phone),
        };
    });

    return {
        generated_at: new Date().toISOString(),
        member_count: rows.length,
        members: rows,
        products: products,
    };
}

async function grantProductAccess(memberId, productId) {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var memberResult = await admin
        .from('members')
        .select('id, email')
        .eq('id', memberId)
        .maybeSingle();

    if (memberResult.error) {
        throw memberResult.error;
    }

    if (!memberResult.data) {
        throw new Error('Membro não encontrado.');
    }

    var productResult = await admin
        .from('products')
        .select('id')
        .eq('id', productId)
        .maybeSingle();

    if (productResult.error) {
        throw productResult.error;
    }

    if (!productResult.data) {
        throw new Error('Produto não encontrado.');
    }

    var upsertResult = await admin
        .from('member_products')
        .upsert({
            member_id: memberId,
            product_id: productId,
            stripe_payment_intent_id: stripeEntitlements.MANUAL_ACCESS_MARKER,
            stripe_subscription_id: null,
        }, {
            onConflict: 'member_id,product_id',
        });

    if (upsertResult.error) {
        throw upsertResult.error;
    }

    return { ok: true, member_id: memberId, product_id: productId };
}

async function revokeProductAccess(memberId, productId) {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var deleteResult = await admin
        .from('member_products')
        .delete()
        .eq('member_id', memberId)
        .eq('product_id', productId);

    if (deleteResult.error) {
        throw deleteResult.error;
    }

    return { ok: true, member_id: memberId, product_id: productId };
}

async function resendAccessEmail(memberId, options) {
    options = options || {};
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var memberResult = await admin
        .from('members')
        .select('id, email, full_name, auth_user_id, password_set')
        .eq('id', memberId)
        .maybeSingle();

    if (memberResult.error) {
        throw memberResult.error;
    }

    if (!memberResult.data) {
        throw new Error('Membro não encontrado.');
    }

    var member = memberResult.data;

    if (!member.auth_user_id) {
        throw new Error('Membro sem conta Auth.');
    }

    var authUserResult = await admin.auth.admin.getUserById(member.auth_user_id);

    if (authUserResult.error || !authUserResult.data || !authUserResult.data.user) {
        throw authUserResult.error || new Error('Utilizador Auth não encontrado.');
    }

    var authUser = authUserResult.data.user;
    var password = provisionalPassword.generateProvisionalPassword();
    var updated = await admin.auth.admin.updateUserById(authUser.id, {
        password: password,
        user_metadata: Object.assign({}, authUser.user_metadata || {}, {
            password_set: true,
            provisional_password: true,
        }),
    });

    if (updated.error) {
        throw updated.error;
    }

    var productsResult = await admin
        .from('member_products')
        .select('product_id')
        .eq('member_id', member.id);

    if (productsResult.error) {
        throw productsResult.error;
    }

    var productIds = (productsResult.data || []).map(function (row) {
        return row.product_id;
    });

    if (!productIds.length) {
        throw new Error('Membro sem produtos.');
    }

    var emailResult = await sendPurchaseEmail.sendManualWelcomeEmail({
        admin: admin,
        memberId: member.id,
        email: member.email,
        fullName: member.full_name || '',
        productIds: productIds,
        password: password,
        retroactive: Boolean(options.retroactive),
    });

    if (!emailResult.ok) {
        throw new Error(emailResult.reason || 'Falha ao enviar email.');
    }

    await admin.from('members').update({
        password_set: true,
        updated_at: new Date().toISOString(),
    }).eq('id', member.id);

    return {
        ok: true,
        email: member.email,
        message_id: emailResult.message_id || '',
        password_reset: true,
    };
}

async function resendAccessToNeverLoggedIn(options) {
    options = options || {};
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var membersResult = await admin
        .from('members')
        .select('id, email, login_count, last_login_at')
        .order('created_at', { ascending: false });

    if (membersResult.error) {
        throw membersResult.error;
    }

    var skipEmails = {
        'teste.membro@example.com': true,
        'geral.joaoecoom@gmail.com': true,
        'jadparreira@gmail.com': true,
        'suporte.angelacampos@gmail.com': true,
    };

    var targets = (membersResult.data || []).filter(function (member) {
        if (skipEmails[member.email]) {
            return false;
        }

        if (member.last_login_at) {
            return false;
        }

        return member.login_count == null || Number(member.login_count) === 0;
    });

    var sent = [];
    var failed = [];

    for (var i = 0; i < targets.length; i += 1) {
        var target = targets[i];

        try {
            var result = await resendAccessEmail(target.id, {
                retroactive: options.retroactive !== false,
            });

            sent.push({
                email: target.email,
                message_id: result.message_id || '',
            });
        } catch (error) {
            failed.push({
                email: target.email,
                error: error.message || 'Falha ao reenviar.',
            });
        }
    }

    return {
        ok: failed.length === 0,
        target_count: targets.length,
        sent_count: sent.length,
        failed_count: failed.length,
        sent: sent,
        failed: failed,
    };
}

async function createMemberManually(payload) {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var email = supabaseAdmin.normalizeEmail(payload.email || '');
    var fullName = String(payload.full_name || '').trim();
    var productIds = Array.isArray(payload.product_ids)
        ? payload.product_ids.map(function (item) {
            return String(item || '').trim();
        }).filter(Boolean)
        : [];
    var sendEmail = payload.send_email !== false;

    if (!email || email.indexOf('@') === -1) {
        throw new Error('Email inválido.');
    }

    if (!productIds.length) {
        throw new Error('Selecciona pelo menos um produto.');
    }

    var existingMember = await admin
        .from('members')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

    if (existingMember.error) {
        throw existingMember.error;
    }

    if (existingMember.data) {
        throw new Error('Este email já existe. Usa a linha existente para dar acesso ou reenviar email.');
    }

    var productsResult = await admin
        .from('products')
        .select('id')
        .in('id', productIds);

    if (productsResult.error) {
        throw productsResult.error;
    }

    var validProductIds = (productsResult.data || []).map(function (row) {
        return row.id;
    });

    if (!validProductIds.length) {
        throw new Error('Nenhum produto válido seleccionado.');
    }

    var password = provisionalPassword.generateProvisionalPassword();
    var createdAuth = await admin.auth.admin.createUser({
        email: email,
        email_confirm: true,
        password: password,
        user_metadata: {
            full_name: fullName,
            password_set: true,
            provisional_password: true,
        },
    });

    if (createdAuth.error) {
        throw createdAuth.error;
    }

    var memberResult = await admin
        .from('members')
        .insert({
            email: email,
            auth_user_id: createdAuth.data.user.id,
            full_name: fullName || null,
            password_set: true,
        })
        .select('*')
        .single();

    if (memberResult.error) {
        throw memberResult.error;
    }

    var member = memberResult.data;
    var entitlementRows = validProductIds.map(function (productId) {
        return {
            member_id: member.id,
            product_id: productId,
            stripe_payment_intent_id: stripeEntitlements.MANUAL_ACCESS_MARKER,
            stripe_subscription_id: null,
        };
    });

    var entitlementResult = await admin
        .from('member_products')
        .upsert(entitlementRows, {
            onConflict: 'member_id,product_id',
        });

    if (entitlementResult.error) {
        throw entitlementResult.error;
    }

    var emailResult = null;

    if (sendEmail) {
        emailResult = await sendPurchaseEmail.sendManualWelcomeEmail({
            admin: admin,
            memberId: member.id,
            email: email,
            fullName: fullName,
            productIds: validProductIds,
            password: password,
        });

        if (!emailResult.ok) {
            throw new Error(emailResult.reason || 'Membro criado, mas falhou o envio de email.');
        }
    }

    return {
        ok: true,
        member_id: member.id,
        email: email,
        full_name: fullName,
        products: validProductIds,
        email_sent: Boolean(sendEmail && emailResult && emailResult.ok),
        message_id: emailResult ? emailResult.message_id || '' : '',
    };
}

var isNeverLoggedInMember = neverLoggedInQueue.isNeverLoggedInMember;

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

async function listNeverLoggedInWhatsAppTargets() {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;
    var stripe = secretKey ? new Stripe(secretKey) : null;
    var members = await fetchMembers(admin);
    var memberProducts = await fetchMemberProducts(admin);
    var products = await fetchProducts(admin);
    var nameById = {};

    products.forEach(function (product) {
        nameById[product.id] = product.name;
    });

    var productIdsByMember = {};

    memberProducts.forEach(function (row) {
        if (!productIdsByMember[row.member_id]) {
            productIdsByMember[row.member_id] = [];
        }

        productIdsByMember[row.member_id].push(row.product_id);
    });

    await neverLoggedInQueue.ensureQueueForEligibleMembers(admin, stripe, members, memberProducts);

    var queueState = await neverLoggedInQueue.listPendingTargets(admin);
    var queueByMember = {};

    (queueState.ready || []).concat(queueState.waiting || []).forEach(function (row) {
        queueByMember[row.member_id] = row;
    });

    var targets = [];
    var waitingTargets = [];
    var skippedNoPhone = [];

    for (var i = 0; i < members.length; i += 1) {
        var member = members[i];

        if (!isNeverLoggedInMember(member)) {
            continue;
        }

        var alreadySent = await sendNeverLoggedInWhatsApp.wasFollowUpAlreadySent(admin, member.id);
        var phoneInfo = await resolvePhoneForMember(stripe, member, memberProducts);
        var phoneDigits = phoneUtils.normalizePhoneForWhatsApp(phoneInfo.phone, phoneInfo.phone_country);
        var productIds = productIdsByMember[member.id] || [];
        var productNames = productIds.map(function (productId) {
            return nameById[productId] || productId;
        });
        var queueRow = queueByMember[member.id] || null;

        var entry = {
            member_id: member.id,
            email: member.email,
            full_name: member.full_name || '',
            phone_digits: phoneDigits,
            product_names: productNames,
            already_sent: alreadySent,
            purchased_at: queueRow ? queueRow.purchased_at : null,
            send_after: queueRow ? queueRow.send_after : null,
            ready_to_send: Boolean(queueRow && queueState.ready.some(function (item) {
                return item.member_id === member.id;
            })),
        };

        if (!phoneDigits) {
            skippedNoPhone.push(entry);
            continue;
        }

        if (alreadySent) {
            continue;
        }

        if (entry.ready_to_send) {
            targets.push(entry);
        } else if (queueRow) {
            waitingTargets.push(entry);
        }
    }

    return {
        pending_count: targets.length,
        waiting_count: waitingTargets.length,
        skipped_no_phone_count: skippedNoPhone.length,
        targets: targets,
        waiting_targets: waitingTargets,
        skipped_no_phone: skippedNoPhone,
        schedule: {
            cutoff_hour: neverLoggedInSchedule.cutoffHour(),
            peak_after_cutoff: neverLoggedInSchedule.peakAfter15h(),
            peak_before_cutoff: neverLoggedInSchedule.peakBefore15h(),
            timezone: neverLoggedInSchedule.TZ,
        },
    };
}

async function sendNextNeverLoggedInWhatsApp() {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var members = await fetchMembers(admin);
    var memberProducts = await fetchMemberProducts(admin);
    var stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

    await neverLoggedInQueue.ensureQueueForEligibleMembers(admin, stripe, members, memberProducts);

    return neverLoggedInQueue.processNextNeverLoggedInWhatsApp();
}

async function syncAllMembersFromStripe() {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new Error('STRIPE_SECRET_KEY em falta.');
    }

    var stripe = new Stripe(secretKey);
    var members = await fetchMembers(admin);
    var results = [];

    for (var i = 0; i < members.length; i += 1) {
        try {
            var result = await stripeEntitlements.syncMemberEntitlementsFromStripe(admin, stripe, members[i], {
                keepManual: true,
            });
            results.push(result);
        } catch (error) {
            results.push({
                ok: false,
                email: members[i].email,
                error: error.message,
            });
        }
    }

    return {
        synced: results.filter(function (item) {
            return item.ok;
        }).length,
        failed: results.filter(function (item) {
            return !item.ok;
        }).length,
        results: results,
    };
}

module.exports = {
    listMembersReport: listMembersReport,
    syncAllMembersFromStripe: syncAllMembersFromStripe,
    grantProductAccess: grantProductAccess,
    revokeProductAccess: revokeProductAccess,
    resendAccessEmail: resendAccessEmail,
    resendAccessToNeverLoggedIn: resendAccessToNeverLoggedIn,
    createMemberManually: createMemberManually,
    listNeverLoggedInWhatsAppTargets: listNeverLoggedInWhatsAppTargets,
    sendNextNeverLoggedInWhatsApp: sendNextNeverLoggedInWhatsApp,
};
