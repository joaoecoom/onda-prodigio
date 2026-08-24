var metricsAuth = require('../../metrics/auth');
var moduleData = require('../module-data');

function sendUnauthorized(res) {
    return res.status(401).json({ error: 'Não autorizado.' });
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    var slug = String(req.query.slug || req.query.offer || '').trim();
    var moduleId = String(req.query.module || '').trim();

    if (!slug || !moduleId) {
        return res.status(400).json({ error: 'Oferta ou módulo em falta.' });
    }

    try {
        var data = await moduleData.getModuleData(slug, moduleId);
        return res.status(200).json({ module: data });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Não foi possível carregar o módulo.',
        });
    }
};
