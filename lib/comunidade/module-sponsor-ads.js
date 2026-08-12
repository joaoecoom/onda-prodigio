var productCheckoutConfig = require('../product-checkout-config');

function resolveSponsorAd(viewingProductId, moduleSortOrder, ownedProductIds, isAdmin) {
    if (isAdmin) {
        return null;
    }

    var owned = ownedProductIds || [];
    var sortOrder = Number(moduleSortOrder) || 1;
    var candidates = productCheckoutConfig.buildCandidateList(viewingProductId, sortOrder);
    var sponsorId = null;

    candidates.some(function (candidateId) {
        if (candidateId === viewingProductId) {
            return false;
        }

        if (owned.indexOf(candidateId) !== -1) {
            return false;
        }

        if (!productCheckoutConfig.getProduct(candidateId)) {
            return false;
        }

        sponsorId = candidateId;
        return true;
    });

    if (!sponsorId) {
        return null;
    }

    return productCheckoutConfig.getSponsorAdPayload(sponsorId, 'live');
}

function attachSponsorAdsToModules(modules, viewingProductId, ownedProductIds, isAdmin) {
    return (modules || []).map(function (moduleItem) {
        var sponsorAd = resolveSponsorAd(
            viewingProductId,
            moduleItem.sort_order,
            ownedProductIds,
            isAdmin
        );

        return Object.assign({}, moduleItem, {
            sponsor_ad: sponsorAd,
        });
    });
}

module.exports = {
    resolveSponsorAd: resolveSponsorAd,
    attachSponsorAdsToModules: attachSponsorAdsToModules,
};
