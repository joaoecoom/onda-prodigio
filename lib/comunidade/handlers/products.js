var authHelpers = require('../auth-helpers');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        var auth = await authHelpers.getAuthUserFromRequest(req);

        if (auth.error) {
            return authHelpers.jsonError(res, auth.status, auth.error);
        }

        var member = await authHelpers.getMemberByAuthUser(auth.admin, auth.user);
        var adminProfile = await authHelpers.getAdminByAuthUser(auth.admin, auth.user);
        var accessibleProductIds = await authHelpers.getAccessibleProductIds(auth.admin, member, adminProfile);

        var productsResult = await auth.admin
            .from('products')
            .select('id, name, description, image_url, sort_order')
            .order('sort_order', { ascending: true });

        if (productsResult.error) {
            throw productsResult.error;
        }

        var allProductIds = (productsResult.data || []).map(function (product) {
            return product.id;
        });

        var modulesByProduct = {};

        if (allProductIds.length) {
            var modulesResult = await auth.admin
                .from('content_modules')
                .select('id, product_id, parent_id, title, description, type, image_url, sort_order')
                .in('product_id', allProductIds)
                .is('parent_id', null)
                .order('sort_order', { ascending: true });

            if (modulesResult.error) {
                throw modulesResult.error;
            }

            (modulesResult.data || []).forEach(function (moduleItem) {
                if (!modulesByProduct[moduleItem.product_id]) {
                    modulesByProduct[moduleItem.product_id] = [];
                }

                modulesByProduct[moduleItem.product_id].push(moduleItem);
            });
        }

        var products = (productsResult.data || []).map(function (product) {
            return Object.assign({}, product, {
                has_access: accessibleProductIds.indexOf(product.id) !== -1,
                modules: modulesByProduct[product.id] || [],
            });
        });

        return res.status(200).json({ products: products });
    } catch (error) {
        console.error('Erro ao listar produtos:', error);
        return authHelpers.jsonError(res, 500, 'Não foi possível carregar os produtos.');
    }
};
