'use strict';

var offerContext = require('../hub/offer-context');
var hubConfig = require('../hub/config');
var offers = require('../hub/offers');

async function resolveFromRequest(req) {
    var slug = String(
        (req.query && (req.query.offer || req.query.slug)) || ''
    ).trim();

    if (slug) {
        var bySlug = await offerContext.resolveOfferContext({ slug: slug }, { allowDefault: false });

        if (bySlug) {
            return bySlug;
        }

        return offers.getOfferBySlug(slug);
    }

    var host = hubConfig.normalizeHost(
        (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || ''
    );

    if (!host) {
        return null;
    }

    if (hubConfig.isHubHost(host)) {
        return null;
    }

    return offerContext.resolveOfferByDomain(host);
}

function getOfferIdFromRequest(req) {
    return resolveFromRequest(req).then(function (offer) {
        return offer && offer.id ? offer.id : '';
    });
}

module.exports = {
    resolveFromRequest: resolveFromRequest,
    getOfferIdFromRequest: getOfferIdFromRequest,
};
