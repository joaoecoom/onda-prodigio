'use strict';

var funnelCheckoutConfig = require('../funnel-checkout-config');

function isUniversalOfferCheckout(metadata) {
    var meta = metadata || {};

    return meta.checkout_type === 'offer' || meta.checkout === 'main';
}

function shouldSendPurchaseTracking(metadata) {
    var meta = metadata || {};

    if (isUniversalOfferCheckout(meta)) {
        return true;
    }

    return meta.stripe_mode !== 'test' && meta.checkout !== 'checkout9-test';
}

function shouldSendFailedPaymentTracking(metadata) {
    return shouldSendPurchaseTracking(metadata);
}

module.exports = {
    isUniversalOfferCheckout: isUniversalOfferCheckout,
    shouldSendPurchaseTracking: shouldSendPurchaseTracking,
    shouldSendFailedPaymentTracking: shouldSendFailedPaymentTracking,
    UNIVERSAL_CHECKOUT_ID: funnelCheckoutConfig.UNIVERSAL_CHECKOUT_ID,
};
