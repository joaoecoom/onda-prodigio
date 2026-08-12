var supabaseAdmin = require('../supabase-admin');
var commentReplyEmail = require('../email/comment-reply-email');

var REPLY_INTERVAL_MS = 5 * 60 * 1000;
var ANGELA_VOICE = [
    'Escreves em português de Portugal, com tom caloroso, próximo e profissional.',
    'Assinas como Angela Campos, professora e criadora do método Onda Prodígio.',
    'Usas frases claras, empáticas e práticas — como numa conversa com uma mãe ou pai preocupado(a).',
    'Evitas jargão clínico pesado; dás passos concretos quando fizer sentido.',
    'Podes usar ocasionalmente um emoji suave (🌊 💛) mas sem exagerar.',
    'Não prometas resultados milagrosos; reforça consistência e paciência.',
    'Respostas entre 80 e 180 palavras.',
].join(' ');

function getLisbonDateString(date) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: process.env.METRICS_TIMEZONE || 'Europe/Lisbon',
    }).format(date || new Date());
}

function isAiEnabled() {
    return Boolean(String(process.env.OPENAI_API_KEY || '').trim());
}

async function generateAiReplyText(comment, productName) {
    var apiKey = String(process.env.OPENAI_API_KEY || '').trim();

    if (!apiKey) {
        return (
            'Obrigada por partilhares connosco 🌊\n\n' +
            'Recebi a tua mensagem e quero que saibas que faz todo o sentido teres esta dúvida — muitas famílias passam exactamente pelo mesmo.\n\n' +
            'Continua a aplicar o método com calma, em pequenos passos, e observa o teu filho com carinho. Se precisares de mais orientação específica, deixa-nos mais detalhes aqui na comunidade.\n\n' +
            'Com carinho,\nAngela Campos'
        );
    }

    var model = String(process.env.OPENAI_COMMENT_MODEL || 'gpt-4o-mini').trim();
    var prompt = (
        'Contexto: área de membros do curso "' + (productName || 'Onda Prodígio') + '".\n' +
        'Pergunta/comentário da mãe/pai:\n"""' + comment.content + '"""\n\n' +
        'Responde como Angela Campos. ' + ANGELA_VOICE + '\n' +
        'Fecha com "Com carinho," numa linha e "Angela Campos" na seguinte.'
    );

    var response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            temperature: 0.7,
            messages: [
                { role: 'system', content: 'És Angela Campos, professora portuguesa especializada em desenvolvimento infantil e método Onda Prodígio.' },
                { role: 'user', content: prompt },
            ],
        }),
    });

    var data = await response.json();

    if (!response.ok) {
        throw new Error((data.error && data.error.message) || 'OpenAI falhou.');
    }

    var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    return String(text || '').trim();
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

    var productResult = await admin
        .from('products')
        .select('name')
        .eq('id', comment.product_id)
        .maybeSingle();

    if (productResult.error) {
        throw productResult.error;
    }

    var replyText = await generateAiReplyText(comment, productResult.data ? productResult.data.name : 'Onda Prodígio');

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
        ai_enabled: isAiEnabled(),
    };
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
    isAiEnabled: isAiEnabled,
    REPLY_INTERVAL_MS: REPLY_INTERVAL_MS,
};
