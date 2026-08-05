var authHelpers = require('../auth-helpers');
var progressHelpers = require('../progress-helpers');

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

        return handlePost(req, res, auth, member);
    } catch (error) {
        console.error('Erro no progresso:', error);
        return authHelpers.jsonError(res, 500, 'Não foi possível processar o progresso.');
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

    if (!member) {
        return res.status(200).json({ progress: {} });
    }

    var modulesResult = await auth.admin
        .from('content_modules')
        .select('id')
        .eq('product_id', productId);

    if (modulesResult.error) {
        throw modulesResult.error;
    }

    var moduleIds = (modulesResult.data || []).map(function (row) {
        return row.id;
    });

    if (!moduleIds.length) {
        return res.status(200).json({ progress: {} });
    }

    var progressResult = await auth.admin
        .from('member_module_progress')
        .select('module_id, progress_percent')
        .eq('member_id', member.id)
        .in('module_id', moduleIds);

    if (progressResult.error) {
        throw progressResult.error;
    }

    return res.status(200).json({
        progress: progressHelpers.buildProgressMap(progressResult.data),
    });
}

async function handlePost(req, res, auth, member) {
    if (!member) {
        return authHelpers.jsonError(res, 403, 'Apenas membros registam progresso.');
    }

    var body = req.body || {};
    var productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
    var moduleId = typeof body.module_id === 'string' ? body.module_id.trim() : '';
    var progressPercent = progressHelpers.normalizeProgress(body.progress_percent);

    if (!productId || !moduleId) {
        return authHelpers.jsonError(res, 400, 'Progresso inválido.');
    }

    if (progressPercent <= 0) {
        return authHelpers.jsonError(res, 400, 'Progresso inválido.');
    }

    var productIds = await authHelpers.getAccessibleProductIds(auth.admin, member, null);

    if (productIds.indexOf(productId) === -1) {
        return authHelpers.jsonError(res, 403, 'Sem acesso a este produto.');
    }

    var moduleResult = await auth.admin
        .from('content_modules')
        .select('id, product_id')
        .eq('id', moduleId)
        .maybeSingle();

    if (moduleResult.error) {
        throw moduleResult.error;
    }

    if (!moduleResult.data || moduleResult.data.product_id !== productId) {
        return authHelpers.jsonError(res, 404, 'Conteúdo não encontrado.');
    }

    var existingResult = await auth.admin
        .from('member_module_progress')
        .select('progress_percent')
        .eq('member_id', member.id)
        .eq('module_id', moduleId)
        .maybeSingle();

    if (existingResult.error) {
        throw existingResult.error;
    }

    var nextProgress = progressPercent;

    if (existingResult.data) {
        nextProgress = Math.max(existingResult.data.progress_percent || 0, progressPercent);
    }

    var upsertResult = await auth.admin
        .from('member_module_progress')
        .upsert({
            member_id: member.id,
            module_id: moduleId,
            progress_percent: nextProgress,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'member_id,module_id',
        })
        .select('module_id, progress_percent')
        .single();

    if (upsertResult.error) {
        throw upsertResult.error;
    }

    return res.status(200).json({
        module_id: upsertResult.data.module_id,
        progress_percent: upsertResult.data.progress_percent,
    });
}
