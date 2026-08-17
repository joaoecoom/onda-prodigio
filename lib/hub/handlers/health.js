var metricsAuth = require('../../metrics/auth');
var offers = require('../offers');

function sendUnauthorized(res) {
    return res.status(401).json({ error: 'Não autorizado.' });
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    var items = await offers.listOffers({ forceRefresh: true });
    var first = items[0] || offers.getEnvFallbackOffer();

    return res.status(200).json({
        ok: true,
        hub: 'HUB DR Ecoom',
        offers_count: items.length,
        default_offer: first.slug,
        timestamp: new Date().toISOString(),
    });
};
