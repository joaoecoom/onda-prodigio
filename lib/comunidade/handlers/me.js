var authHelpers = require('../auth-helpers');
var memberActivity = require('../member-activity');
var offerResolver = require('../offer-resolver');

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

        var offer = await offerResolver.resolveFromRequest(req);
        var offerId = offer && offer.id ? offer.id : '';

        var member = await authHelpers.getMemberByAuthUser(auth.admin, auth.user);
        var adminProfile = await authHelpers.getAdminByAuthUser(auth.admin, auth.user);

        if (!member && !adminProfile) {
            return authHelpers.jsonError(res, 403, 'Sem acesso à comunidade.');
        }

        var productIds = await authHelpers.getAccessibleProductIds(
            auth.admin,
            member,
            adminProfile,
            { offerId: offerId }
        );

        if (member) {
            await memberActivity.recordLogin(auth.admin, member.id);
        }

        return res.status(200).json({
            email: auth.user.email,
            name: (member && member.full_name) || (adminProfile && adminProfile.name) || '',
            role: adminProfile ? 'admin' : 'member',
            offer_id: offerId || null,
            product_ids: productIds,
        });
    } catch (error) {
        console.error('Erro ao obter sessão:', error);
        return authHelpers.jsonError(res, 500, 'Não foi possível obter a sessão.');
    }
};
