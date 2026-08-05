var authHelpers = require('../auth-helpers');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var productId = typeof req.query.id === 'string' ? req.query.id.trim() : '';

    if (!productId) {
        return authHelpers.jsonError(res, 400, 'Produto em falta.');
    }

    try {
        var auth = await authHelpers.getAuthUserFromRequest(req);

        if (auth.error) {
            return authHelpers.jsonError(res, auth.status, auth.error);
        }

        var member = await authHelpers.getMemberByAuthUser(auth.admin, auth.user);
        var adminProfile = await authHelpers.getAdminByAuthUser(auth.admin, auth.user);
        var productIds = await authHelpers.getAccessibleProductIds(auth.admin, member, adminProfile);

        if (productIds.indexOf(productId) === -1) {
            return authHelpers.jsonError(res, 403, 'Não tens acesso a este produto.');
        }

        var productResult = await auth.admin
            .from('products')
            .select('id, name, description, image_url, sort_order')
            .eq('id', productId)
            .maybeSingle();

        if (productResult.error) {
            throw productResult.error;
        }

        if (!productResult.data) {
            return authHelpers.jsonError(res, 404, 'Produto não encontrado.');
        }

        var modulesResult = await auth.admin
            .from('content_modules')
            .select('id, product_id, title, description, type, youtube_id, pdf_path, image_url, sort_order')
            .eq('product_id', productId)
            .order('sort_order', { ascending: true });

        if (modulesResult.error) {
            throw modulesResult.error;
        }

        return res.status(200).json({
            product: Object.assign({}, productResult.data, {
                modules: modulesResult.data || [],
            }),
        });
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        return authHelpers.jsonError(res, 500, 'Não foi possível carregar o produto.');
    }
};
