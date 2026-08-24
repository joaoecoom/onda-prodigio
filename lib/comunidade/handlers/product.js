var authHelpers = require('../auth-helpers');
var unlockHelpers = require('../unlock-helpers');
var sponsorAds = require('../module-sponsor-ads');
var offerResolver = require('../offer-resolver');
var productsService = require('../products-service');

function buildModuleTree(rows) {
    var all = rows || [];
    var topLevel = all.filter(function (row) {
        return !row.parent_id;
    });

    return topLevel.map(function (moduleItem) {
        var aulas = all.filter(function (row) {
            return row.parent_id === moduleItem.id;
        }).sort(function (a, b) {
            return a.sort_order - b.sort_order;
        });

        return Object.assign({}, moduleItem, {
            aulas: aulas,
        });
    }).sort(function (a, b) {
        return a.sort_order - b.sort_order;
    });
}

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

        var offer = await offerResolver.resolveFromRequest(req);
        var offerId = offer && offer.id ? offer.id : '';

        if (offerId) {
            await productsService.assertProductBelongsToOffer(productId, offerId);
        }

        var member = await authHelpers.getMemberByAuthUser(auth.admin, auth.user);
        var adminProfile = await authHelpers.getAdminByAuthUser(auth.admin, auth.user);
        var productIds = await authHelpers.getAccessibleProductIds(
            auth.admin,
            member,
            adminProfile,
            { offerId: offerId }
        );

        if (productIds.indexOf(productId) === -1) {
            return authHelpers.jsonError(res, 403, 'Não tens acesso a este produto.');
        }

        var productResult = await auth.admin
            .from('products')
            .select('id, name, description, image_url, sort_order, offer_id')
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
            .select('id, product_id, parent_id, title, description, type, youtube_id, video_path, pdf_path, audio_path, image_url, sort_order, unlock_after_days')
            .eq('product_id', productId)
            .order('sort_order', { ascending: true });

        if (modulesResult.error) {
            throw modulesResult.error;
        }

        var grantedAt = null;

        if (member && !adminProfile) {
            var accessResult = await auth.admin
                .from('member_products')
                .select('granted_at')
                .eq('member_id', member.id)
                .eq('product_id', productId)
                .maybeSingle();

            if (accessResult.error) {
                throw accessResult.error;
            }

            grantedAt = accessResult.data ? accessResult.data.granted_at : null;
        }

        var modules = unlockHelpers.applyUnlockToModules(
            buildModuleTree(modulesResult.data),
            grantedAt,
            Boolean(adminProfile)
        );

        modules = sponsorAds.attachSponsorAdsToModules(
            modules,
            productId,
            productIds,
            Boolean(adminProfile)
        );

        return res.status(200).json({
            offer_id: offerId || productResult.data.offer_id || null,
            product: Object.assign({}, productResult.data, {
                access: {
                    granted_at: grantedAt,
                },
                modules: modules,
            }),
        });
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        return authHelpers.jsonError(
            res,
            error.message && error.message.indexOf('não pertence') !== -1 ? 403 : 500,
            error.message || 'Não foi possível carregar o produto.'
        );
    }
};
