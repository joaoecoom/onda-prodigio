var supabaseAdmin = require('../supabase-admin');
var commentReplyEmail = require('../email/comment-reply-email');
var commentAiKnowledge = require('./comment-ai-knowledge');

var REPLY_INTERVAL_MS = 5 * 60 * 1000;

function getLisbonDateString(date) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: process.env.METRICS_TIMEZONE || 'Europe/Lisbon',
    }).format(date || new Date());
}

function isAiEnabled() {
    return true;
}

async function getModuleContext(admin, moduleId) {
    if (!admin || !moduleId) {
        return '';
    }

    var result = await admin
        .from('content_modules')
        .select('title, description, parent_id')
        .eq('id', moduleId)
        .maybeSingle();

    if (result.error || !result.data) {
        return '';
    }

    var parts = [];
    var row = result.data;

    if (row.title) {
        parts.push('Módulo: ' + row.title);
    }

    if (row.description) {
        parts.push(row.description);
    }

    if (row.parent_id) {
        var parentResult = await admin
            .from('content_modules')
            .select('title, description')
            .eq('id', row.parent_id)
            .maybeSingle();

        if (!parentResult.error && parentResult.data) {
            if (parentResult.data.title) {
                parts.unshift('Secção: ' + parentResult.data.title);
            }

            if (parentResult.data.description) {
                parts.unshift(parentResult.data.description);
            }
        }
    }

    return parts.join('\n');
}

async function generateReplyText(comment, moduleContext) {
    var memberData = comment.members || {};

    return commentAiKnowledge.buildReply(comment, {
        moduleContext: moduleContext,
        memberName: memberData.full_name || '',
    });
}

async function hasStaffReply(admin, parentId) {
    var result = await admin
        .from('comments')
        .select('id')
        .eq('parent_id', parentId)
        .or('is_admin.eq.true,is_ai.eq.true')
        .limit(1);

    if (result.error) {
        throw result.error;
    }

    return (result.data || []).length > 0;
}

async function ensureDailyQueue(admin) {
    var today = getLisbonDateString();
    var runResult = await admin
        .from('comment_ai_daily_runs')
        .select('*')
        .eq('run_date', today)
        .maybeSingle();

    if (runResult.error) {
        throw runResult.error;
    }

    if (runResult.data && runResult.data.queue_built) {
        return { today: today, queued: 0, alreadyBuilt: true };
    }

    var pendingResult = await admin
        .from('comments')
        .select('id, created_at')
        .is('parent_id', null)
        .eq('is_admin', false)
        .eq('is_hidden', false)
        .or('ai_reply_status.eq.pending,ai_reply_status.is.null')
        .order('created_at', { ascending: true });

    if (pendingResult.error) {
        throw pendingResult.error;
    }

    var pending = pendingResult.data || [];
    var startAt = Date.now();
    var queued = 0;

    for (var i = 0; i < pending.length; i++) {
        var row = pending[i];
        var hasReply = await hasStaffReply(admin, row.id);

        if (hasReply) {
            await admin.from('comments').update({ ai_reply_status: 'done' }).eq('id', row.id);
            continue;
        }

        await admin.from('comments').update({
            ai_reply_status: 'queued',
            ai_scheduled_at: new Date(startAt + (queued * REPLY_INTERVAL_MS)).toISOString(),
        }).eq('id', row.id);

        queued += 1;
    }

    if (runResult.data) {
        await admin.from('comment_ai_daily_runs').update({
            queue_built: true,
            updated_at: new Date().toISOString(),
        }).eq('run_date', today);
    } else {
        await admin.from('comment_ai_daily_runs').insert({
            run_date: today,
            queue_built: true,
            replies_sent: 0,
        });
    }

    return { today: today, queued: queued, alreadyBuilt: false };
}

async function processNextDueReply(admin) {
    var dueResult = await admin
        .from('comments')
        .select('id, member_id, product_id, module_id, content, members(full_name, email)')
        .eq('ai_reply_status', 'queued')
        .lte('ai_scheduled_at', new Date().toISOString())
        .order('ai_scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (dueResult.error) {
        throw dueResult.error;
    }

    if (!dueResult.data) {
        return { processed: false, reason: 'nothing_due' };
    }

    var comment = dueResult.data;
    var hasReply = await hasStaffReply(admin, comment.id);

    if (hasReply) {
        await admin.from('comments').update({ ai_reply_status: 'done' }).eq('id', comment.id);
        return { processed: false, reason: 'already_answered', comment_id: comment.id };
    }

    var moduleContext = await getModuleContext(admin, comment.module_id);
    var replyText = await generateReplyText(comment, moduleContext);

    var insertResult = await admin
        .from('comments')
        .insert({
            product_id: comment.product_id,
            module_id: comment.module_id,
            parent_id: comment.id,
            content: replyText,
            is_admin: true,
            is_ai: true,
            admin_name: 'Angela Campos',
            member_id: null,
        })
        .select('id')
        .single();

    if (insertResult.error) {
        throw insertResult.error;
    }

    await admin.from('comments').update({ ai_reply_status: 'done' }).eq('id', comment.id);

    var today = getLisbonDateString();
    var runRow = await admin
        .from('comment_ai_daily_runs')
        .select('replies_sent')
        .eq('run_date', today)
        .maybeSingle();

    if (!runRow.error && runRow.data) {
        await admin.from('comment_ai_daily_runs').update({
            replies_sent: Number(runRow.data.replies_sent || 0) + 1,
            updated_at: new Date().toISOString(),
        }).eq('run_date', today);
    }

    var memberData = comment.members || {};
    var memberEmail = supabaseAdmin.normalizeEmail(memberData.email || '');

    if (memberEmail && comment.member_id) {
        var alreadySent = await admin
            .from('comment_reply_email_log')
            .select('id')
            .eq('comment_id', comment.id)
            .maybeSingle();

        if (!alreadySent.error && !alreadySent.data) {
            var emailResult = await commentReplyEmail.sendCommentReplyEmail({
                email: memberEmail,
                fullName: memberData.full_name || '',
                productId: comment.product_id,
                replyPreview: replyText,
            });

            if (emailResult.ok) {
                await admin.from('comment_reply_email_log').insert({
                    comment_id: comment.id,
                    member_id: comment.member_id,
                });
            }
        }
    }

    return {
        processed: true,
        comment_id: comment.id,
        reply_id: insertResult.data.id,
        mode: 'offline',
    };
}

async function refreshLegacyGenericReplies(admin) {
    var aiReplies = await admin
        .from('comments')
        .select('id, parent_id, content, module_id')
        .eq('is_ai', true)
        .not('parent_id', 'is', null);

    if (aiReplies.error) {
        throw aiReplies.error;
    }

    var updated = 0;
    var rows = aiReplies.data || [];

    for (var i = 0; i < rows.length; i++) {
        var reply = rows[i];

        if (!commentAiKnowledge.isGenericLegacyReply(reply.content)) {
            continue;
        }

        var parentResult = await admin
            .from('comments')
            .select('id, content, module_id, members(full_name)')
            .eq('id', reply.parent_id)
            .maybeSingle();

        if (parentResult.error || !parentResult.data) {
            continue;
        }

        var parent = parentResult.data;
        var moduleId = reply.module_id || parent.module_id;
        var moduleContext = await getModuleContext(admin, moduleId);
        var memberData = parent.members || {};
        var newText = commentAiKnowledge.buildReply(parent, {
            moduleContext: moduleContext,
            memberName: memberData.full_name || '',
        });

        if (newText === reply.content) {
            continue;
        }

        var updateResult = await admin
            .from('comments')
            .update({ content: newText })
            .eq('id', reply.id);

        if (!updateResult.error) {
            updated += 1;
        }
    }

    return { updated: updated, scanned: rows.length };
}

async function runDailyAiBatch() {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        throw new Error('Supabase não configurado.');
    }

    var queueInfo = await ensureDailyQueue(admin);
    var result = await processNextDueReply(admin);

    return {
        queue: queueInfo,
        result: result,
    };
}

module.exports = {
    runDailyAiBatch: runDailyAiBatch,
    refreshLegacyGenericReplies: refreshLegacyGenericReplies,
    isAiEnabled: isAiEnabled,
    REPLY_INTERVAL_MS: REPLY_INTERVAL_MS,
};
