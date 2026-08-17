var authHelpers = require('../auth-helpers');
var supabaseAdmin = require('../../supabase-admin');
var commentReplyEmail = require('../../email/comment-reply-email');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PATCH') {
        res.setHeader('Allow', 'GET, POST, DELETE, PATCH');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        var auth = await authHelpers.getAuthUserFromRequest(req);

        if (auth.error) {
            return authHelpers.jsonError(res, auth.status, auth.error);
        }

        var member = await authHelpers.getMemberByAuthUser(auth.admin, auth.user);
        var adminProfile = await authHelpers.getAdminByAuthUser(auth.admin, auth.user);

        if (!member && !adminProfile) {
            return authHelpers.jsonError(res, 403, 'Sem acesso.');
        }

        if (req.method === 'GET') {
            return handleGet(req, res, auth, member, adminProfile);
        }

        if (req.method === 'DELETE') {
            return handleDelete(req, res, auth, member, adminProfile);
        }

        if (req.method === 'PATCH') {
            return handlePatch(req, res, auth, adminProfile);
        }

        return handlePost(req, res, auth, member, adminProfile);
    } catch (error) {
        console.error('Erro nos comentários:', error);
        return authHelpers.jsonError(res, 500, 'Não foi possível processar os comentários.');
    }
};

async function handleGet(req, res, auth, member, adminProfile) {
    var productId = typeof req.query.product_id === 'string' ? req.query.product_id.trim() : '';
    var moduleId = typeof req.query.module_id === 'string' ? req.query.module_id.trim() : '';

    if (!productId) {
        return authHelpers.jsonError(res, 400, 'Produto em falta.');
    }

    if (!moduleId) {
        return authHelpers.jsonError(res, 400, 'Aula em falta.');
    }

    var productIds = await authHelpers.getAccessibleProductIds(auth.admin, member, adminProfile);

    if (productIds.indexOf(productId) === -1) {
        return authHelpers.jsonError(res, 403, 'Sem acesso a este produto.');
    }

    var moduleResult = await auth.admin
        .from('content_modules')
        .select('id')
        .eq('id', moduleId)
        .eq('product_id', productId)
        .maybeSingle();

    if (moduleResult.error) {
        throw moduleResult.error;
    }

    if (!moduleResult.data) {
        return authHelpers.jsonError(res, 404, 'Aula não encontrada.');
    }

    var commentsQuery = auth.admin
        .from('comments')
        .select('id, member_id, product_id, module_id, parent_id, content, is_admin, is_ai, is_hidden, admin_name, created_at, members(full_name, email)')
        .eq('product_id', productId)
        .eq('module_id', moduleId)
        .order('created_at', { ascending: true });

    if (!adminProfile) {
        commentsQuery = commentsQuery.eq('is_hidden', false);
    }

    var commentsResult = await commentsQuery;

    if (commentsResult.error) {
        throw commentsResult.error;
    }

    var commentRows = commentsResult.data || [];
    var commentIds = commentRows.map(function (row) {
        return row.id;
    });
    var likesByComment = {};
    var likedByMember = {};

    if (commentIds.length) {
        var likesResult = await auth.admin
            .from('comment_likes')
            .select('comment_id, member_id')
            .in('comment_id', commentIds);

        if (likesResult.error) {
            throw likesResult.error;
        }

        (likesResult.data || []).forEach(function (like) {
            likesByComment[like.comment_id] = (likesByComment[like.comment_id] || 0) + 1;

            if (member && like.member_id === member.id) {
                likedByMember[like.comment_id] = true;
            }
        });
    }

    var comments = commentRows.map(function (row) {
        return formatComment(row, {
            likeCount: likesByComment[row.id] || 0,
            likedByMe: Boolean(likedByMember[row.id]),
            canModerate: Boolean(adminProfile),
            memberId: member ? member.id : null,
        });
    });

    return res.status(200).json({
        comments: comments,
        member_id: member ? member.id : null,
    });
}

async function handlePost(req, res, auth, member, adminProfile) {
    var body = req.body || {};

    if (body.action === 'like' || body.action === 'unlike') {
        return handleLike(req, res, auth, member, body);
    }

    var productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
    var content = typeof body.content === 'string' ? body.content.trim() : '';
    var moduleId = typeof body.module_id === 'string' ? body.module_id.trim() : null;
    var parentId = typeof body.parent_id === 'string' ? body.parent_id.trim() : null;
    var isAdminReply = Boolean(body.admin_reply) && Boolean(adminProfile);

    if (!productId || content.length < 2) {
        return authHelpers.jsonError(res, 400, 'Comentário inválido.');
    }

    var productIds = await authHelpers.getAccessibleProductIds(auth.admin, member, adminProfile);

    if (productIds.indexOf(productId) === -1) {
        return authHelpers.jsonError(res, 403, 'Sem acesso a este produto.');
    }

    if (isAdminReply && !adminProfile) {
        return authHelpers.jsonError(res, 403, 'Apenas administradores podem responder como suporte.');
    }

    if (!isAdminReply && !member) {
        return authHelpers.jsonError(res, 403, 'Membros apenas.');
    }

    if (parentId) {
        var parentResult = await auth.admin
            .from('comments')
            .select('id, product_id, module_id, is_hidden')
            .eq('id', parentId)
            .maybeSingle();

        if (parentResult.error) {
            throw parentResult.error;
        }

        if (!parentResult.data || parentResult.data.product_id !== productId) {
            return authHelpers.jsonError(res, 400, 'Comentário pai inválido.');
        }

        if (parentResult.data.is_hidden && !adminProfile) {
            return authHelpers.jsonError(res, 403, 'Este comentário já não está disponível.');
        }

        moduleId = parentResult.data.module_id || moduleId;
    }

    if (!moduleId) {
        return authHelpers.jsonError(res, 400, 'Aula em falta.');
    }

    var moduleResult = await auth.admin
        .from('content_modules')
        .select('id')
        .eq('id', moduleId)
        .eq('product_id', productId)
        .maybeSingle();

    if (moduleResult.error) {
        throw moduleResult.error;
    }

    if (!moduleResult.data) {
        return authHelpers.jsonError(res, 400, 'Aula inválida.');
    }

    var insertPayload = {
        product_id: productId,
        module_id: moduleId,
        parent_id: parentId || null,
        content: content,
        is_admin: isAdminReply,
        is_ai: false,
        admin_name: isAdminReply ? (adminProfile.name || 'Angela Campos') : null,
        member_id: isAdminReply ? null : member.id,
        ai_reply_status: !isAdminReply && !parentId ? 'pending' : null,
        ai_scheduled_at: null,
    };

    var insertResult = await auth.admin
        .from('comments')
        .insert(insertPayload)
        .select('id, member_id, product_id, module_id, parent_id, content, is_admin, is_ai, is_hidden, admin_name, created_at, members(full_name, email)')
        .single();

    if (insertResult.error) {
        throw insertResult.error;
    }

    if (isAdminReply && parentId) {
        await auth.admin.from('comments').update({ ai_reply_status: 'done' }).eq('id', parentId);
        await maybeSendReplyEmail(auth.admin, parentId, content, productId);
    }

    return res.status(201).json({
        comment: formatComment(insertResult.data, {
            likeCount: 0,
            likedByMe: false,
            canModerate: Boolean(adminProfile),
            memberId: member ? member.id : null,
        }),
    });
}

async function handleLike(req, res, auth, member, body) {
    if (!member) {
        return authHelpers.jsonError(res, 403, 'Apenas membros podem gostar de comentários.');
    }

    var commentId = typeof body.comment_id === 'string' ? body.comment_id.trim() : '';

    if (!commentId) {
        return authHelpers.jsonError(res, 400, 'Comentário em falta.');
    }

    var commentResult = await auth.admin
        .from('comments')
        .select('id, product_id, is_hidden')
        .eq('id', commentId)
        .maybeSingle();

    if (commentResult.error) {
        throw commentResult.error;
    }

    if (!commentResult.data || commentResult.data.is_hidden) {
        return authHelpers.jsonError(res, 404, 'Comentário não encontrado.');
    }

    var productIds = await authHelpers.getAccessibleProductIds(auth.admin, member, null);

    if (productIds.indexOf(commentResult.data.product_id) === -1) {
        return authHelpers.jsonError(res, 403, 'Sem acesso a este produto.');
    }

    if (body.action === 'like') {
        await auth.admin.from('comment_likes').upsert({
            comment_id: commentId,
            member_id: member.id,
        }, { onConflict: 'comment_id,member_id', ignoreDuplicates: true });
    } else {
        await auth.admin
            .from('comment_likes')
            .delete()
            .eq('comment_id', commentId)
            .eq('member_id', member.id);
    }

    var countResult = await auth.admin
        .from('comment_likes')
        .select('id', { count: 'exact', head: true })
        .eq('comment_id', commentId);

    if (countResult.error) {
        throw countResult.error;
    }

    return res.status(200).json({
        ok: true,
        comment_id: commentId,
        like_count: countResult.count || 0,
        liked_by_me: body.action === 'like',
    });
}

async function handlePatch(req, res, auth, adminProfile) {
    if (!adminProfile) {
        return authHelpers.jsonError(res, 403, 'Apenas administradores podem moderar comentários.');
    }

    var body = req.body || {};
    var commentId = typeof body.id === 'string' ? body.id.trim() : '';
    var hidden = body.hidden;

    if (!commentId || typeof hidden !== 'boolean') {
        return authHelpers.jsonError(res, 400, 'Pedido inválido.');
    }

    var commentResult = await auth.admin
        .from('comments')
        .select('id, product_id')
        .eq('id', commentId)
        .maybeSingle();

    if (commentResult.error) {
        throw commentResult.error;
    }

    if (!commentResult.data) {
        return authHelpers.jsonError(res, 404, 'Comentário não encontrado.');
    }

    var updateResult = await auth.admin
        .from('comments')
        .update({ is_hidden: hidden })
        .eq('id', commentId);

    if (updateResult.error) {
        throw updateResult.error;
    }

    return res.status(200).json({ ok: true, hidden: hidden });
}

async function handleDelete(req, res, auth, member, adminProfile) {
    var body = req.body || {};
    var commentId = typeof body.id === 'string' ? body.id.trim() : '';

    if (!commentId) {
        return authHelpers.jsonError(res, 400, 'Comentário em falta.');
    }

    var commentResult = await auth.admin
        .from('comments')
        .select('id, product_id, member_id')
        .eq('id', commentId)
        .maybeSingle();

    if (commentResult.error) {
        throw commentResult.error;
    }

    if (!commentResult.data) {
        return authHelpers.jsonError(res, 404, 'Comentário não encontrado.');
    }

    var isOwner = member && commentResult.data.member_id === member.id;

    if (!adminProfile && !isOwner) {
        return authHelpers.jsonError(res, 403, 'Não podes eliminar este comentário.');
    }

    var productIds = await authHelpers.getAccessibleProductIds(auth.admin, member, adminProfile);

    if (productIds.indexOf(commentResult.data.product_id) === -1) {
        return authHelpers.jsonError(res, 403, 'Sem acesso a este produto.');
    }

    var deleteResult = await auth.admin
        .from('comments')
        .delete()
        .eq('id', commentId);

    if (deleteResult.error) {
        throw deleteResult.error;
    }

    return res.status(200).json({ ok: true });
}

function formatComment(row, meta) {
    var memberData = row.members || null;
    var authorName = row.is_admin
        ? (row.admin_name || 'Angela Campos')
        : ((memberData && memberData.full_name) || maskEmail(memberData && memberData.email) || 'Membro');

    if (row.is_ai) {
        authorName = row.admin_name || 'Angela Campos';
    }

    return {
        id: row.id,
        member_id: row.member_id,
        product_id: row.product_id,
        module_id: row.module_id,
        parent_id: row.parent_id,
        content: row.content,
        is_admin: row.is_admin,
        is_ai: row.is_ai,
        is_hidden: row.is_hidden,
        author_name: authorName,
        created_at: row.created_at,
        like_count: meta.likeCount || 0,
        liked_by_me: Boolean(meta.likedByMe),
        can_delete: Boolean(meta.canModerate) || (meta.memberId && row.member_id === meta.memberId),
        can_moderate: Boolean(meta.canModerate),
        is_mine: Boolean(meta.memberId && row.member_id === meta.memberId),
    };
}

async function maybeSendReplyEmail(admin, parentId, replyText, productId) {
    var parentResult = await admin
        .from('comments')
        .select('id, member_id, members(full_name, email)')
        .eq('id', parentId)
        .maybeSingle();

    if (parentResult.error || !parentResult.data || !parentResult.data.member_id) {
        return;
    }

    var alreadySent = await admin
        .from('comment_reply_email_log')
        .select('id')
        .eq('comment_id', parentId)
        .maybeSingle();

    if (alreadySent.error || alreadySent.data) {
        return;
    }

    var memberData = parentResult.data.members || {};
    var memberEmail = supabaseAdmin.normalizeEmail(memberData.email || '');

    if (!memberEmail) {
        return;
    }

    var emailResult = await commentReplyEmail.sendCommentReplyEmail({
        email: memberEmail,
        fullName: memberData.full_name || '',
        productId: productId,
        replyPreview: replyText,
    });

    if (emailResult.ok) {
        await admin.from('comment_reply_email_log').insert({
            comment_id: parentId,
            member_id: parentResult.data.member_id,
        });
    }
}

function maskEmail(email) {
    var normalized = supabaseAdmin.normalizeEmail(email);

    if (!normalized) {
        return '';
    }

    var parts = normalized.split('@');

    if (parts.length !== 2) {
        return normalized;
    }

    return parts[0].slice(0, 2) + '***@' + parts[1];
}
