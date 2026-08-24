'use strict';

var hubConfig = require('../config');
var offerContext = require('../offer-context');

var RESERVED_FIRST_SEGMENTS = {
    api: true,
    hub: true,
    preview: true,
    p: true,
    editor: true,
    checkout9: true,
    'checkout9-test': true,
    checkout19: true,
    vsl19: true,
    obgd: true,
    'obgd-test': true,
    comunidade: true,
    metricas: true,
    adm: true,
    comprar: true,
    respostaquestionario: true,
    funnel: true,
};

function readHost(req) {
    return hubConfig.normalizeHost(
        req.headers['x-forwarded-host'] ||
        req.headers.host ||
        (req.query && req.query.host) ||
        ''
    );
}

function isReservedDomainPath(pathname) {
    var parts = String(pathname || '').split('/').filter(Boolean);

    if (parts.length !== 2) {
        return true;
    }

    return Boolean(RESERVED_FIRST_SEGMENTS[parts[0].toLowerCase()]);
}

async function resolveFunnelOfferFromHost(hostHeader) {
    var host = hubConfig.normalizeHost(hostHeader);

    if (!host || hubConfig.isHubHost(host)) {
        return null;
    }

    var offer = await offerContext.resolveOfferByDomain(host);

    if (!offer) {
        return null;
    }

    if (hubConfig.normalizeHost(offer.hub_domain) === host) {
        return null;
    }

    return offer;
}

module.exports = {
    readHost: readHost,
    isReservedDomainPath: isReservedDomainPath,
    resolveFunnelOfferFromHost: resolveFunnelOfferFromHost,
    RESERVED_FIRST_SEGMENTS: RESERVED_FIRST_SEGMENTS,
};
