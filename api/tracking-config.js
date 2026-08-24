module.exports = async function handler(req, res) {
    var offerTracking = require('../lib/tracking/offer-tracking');
    var query = req.query || {};
    var hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    var context = null;

    if (query.offer || query.slug) {
        context = await offerTracking.resolveClientTrackingContext({
            slug: query.offer || query.slug,
        });
    } else if (hostHeader) {
        context = await offerTracking.resolveClientTrackingContext({
            domain: hostHeader,
        }, { allowDefault: true });
    } else {
        context = await offerTracking.resolveClientTrackingContext({}, { allowDefault: true });
    }

    return res.status(200).json(offerTracking.buildClientTrackingPayload(context));
};
