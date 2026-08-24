'use strict';

var hubConfig = require('../config');

function encodeSlug(value) {
    return encodeURIComponent(String(value || '').trim());
}

function hostFromUrl(value) {
    if (!value) {
        return '';
    }

    try {
        return hubConfig.normalizeHost(new URL(value).hostname);
    } catch (error) {
        return hubConfig.normalizeHost(value);
    }
}

function getFunnelOrigin(offer) {
    if (!offer) {
        return '';
    }

    var domain = hubConfig.normalizeHost(offer.funnel_domain) ||
        hostFromUrl(offer.funnel_url) ||
        hostFromUrl(offer.site_url);

    return domain ? 'https://' + domain : '';
}

function buildPageUrls(slugs, offer) {
    var offerSlug = encodeSlug(slugs.offer);
    var funnelSlug = encodeSlug(slugs.funnel);
    var pageSlug = encodeSlug(slugs.page);
    var previewPath = '/preview/' + offerSlug + '/' + funnelSlug + '/' + pageSlug + '?preview=1';
    var publicPath = '/p/' + offerSlug + '/' + funnelSlug + '/' + pageSlug;
    var domainPath = '/' + funnelSlug + '/' + pageSlug;
    var origin = getFunnelOrigin(offer);

    var urls = {
        preview_url: previewPath,
        public_url: publicPath,
        public_absolute_url: publicPath,
        domain_public_url: null,
        funnel_origin: origin || null,
    };

    if (origin) {
        urls.public_absolute_url = origin + publicPath;
        urls.domain_public_url = origin + domainPath;
    }

    return urls;
}

function pickLiveUrl(urls) {
    if (!urls) {
        return '';
    }

    return urls.domain_public_url || urls.public_absolute_url || urls.public_url || '';
}

module.exports = {
    encodeSlug: encodeSlug,
    hostFromUrl: hostFromUrl,
    getFunnelOrigin: getFunnelOrigin,
    buildPageUrls: buildPageUrls,
    pickLiveUrl: pickLiveUrl,
};
