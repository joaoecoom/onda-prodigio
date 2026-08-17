var metricsAuth = require('../../metrics/auth');
var offers = require('../offers');

function sendUnauthorized(res) {
    return res.status(401).json({ error: 'Não autorizado.' });
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    var items = await offers.listOffers();
    var publicOffers = items.map(function (offer) {
        return offers.toPublicOffer(offer);
    });

    return res.status(200).json({
        offers: publicOffers,
        count: publicOffers.length,
    });
};
