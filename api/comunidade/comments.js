var authHelpers = require('../../lib/comunidade/auth-helpers');
var supabaseAdmin = require('../../lib/supabase-admin');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
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

        return handlePost(req, res, auth, member, adminProfile);
    } catch (error) {
        console.error('Erro nos comentários:', error);
        return authHelpers.jsonError(res, 500, 'Não foi possível processar os comentários.');
    }
};

async function handleGet(req, res, auth, member, adminProfile) {
    var productId = typeof req.query.product_id === 'string' ? req.query.product_id.trim() : '';

    if (!productId) {
        return authHelpers.jsonError(res, 400, 'Produto em falta.');
    }

    var productIds = await authHelpers.getAccessibleProductIds(auth.admin, member, adminProfile);

    if (productIds.indexOf(productId) === -1) {
        return authHelpers.jsonError(res, 403, 'Sem acesso a este produto.');
    }

    var commentsResult = await auth.admin
        .from('comments')
        .select('id, member_id, product_id, module_id, parent_id, content, is_admin, admin_name, created_at, members(full_name, email)')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

    if (commentsResult.error) {
        throw commentsResult.error;
    }

    var comments = (commentsResult.data || []).map(formatComment);

    return res.status(200).json({ comments: comments });
}

async function handlePost(req, res, auth, member, adminProfile) {
    var body = req.body || {};
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
        return authHelpers.jsonError(res, 403, 'Apenas administradores podem responder.');
    }

    if (!isAdminReply && !member) {
        return authHelpers.jsonError(res, 403, 'Membros apenas.');
    }

    var insertPayload = {
        product_id: productId,
        module_id: moduleId || null,
        parent_id: parentId || null,
        content: content,
        is_admin: isAdminReply,
        admin_name: isAdminReply ? adminProfile.name : null,
        member_id: isAdminReply ? null : member.id,
    };

    var insertResult = await auth.admin
        .from('comments')
        .insert(insertPayload)
        .select('id, member_id, product_id, module_id, parent_id, content, is_admin, admin_name, created_at, members(full_name, email)')
        .single();

    if (insertResult.error) {
        throw insertResult.error;
    }

    return res.status(201).json({
        comment: formatComment(insertResult.data),
    });
}

function formatComment(row) {
    var memberData = row.members || null;

    return {
        id: row.id,
        product_id: row.product_id,
        module_id: row.module_id,
        parent_id: row.parent_id,
        content: row.content,
        is_admin: row.is_admin,
        author_name: row.is_admin
            ? (row.admin_name || 'Suporte')
            : ((memberData && memberData.full_name) || maskEmail(memberData && memberData.email) || 'Membro'),
        created_at: row.created_at,
    };
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
