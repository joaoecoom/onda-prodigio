(function () {
    var CHECKOUT_URL = '/checkout9/';
    var content = document.getElementById('obgd-content');
    var loading = document.getElementById('obgd-loading');

    function getPaymentIntentId() {
        var params = new URLSearchParams(window.location.search);
        return params.get('payment_intent') || '';
    }

    function redirectToCheckout() {
        window.location.replace(CHECKOUT_URL);
    }

    async function verifyPurchase() {
        var paymentIntentId = getPaymentIntentId();

        if (!paymentIntentId || paymentIntentId.indexOf('pi_') !== 0) {
            redirectToCheckout();
            return;
        }

        try {
            var response = await fetch(
                window.location.origin + '/api/verify-payment?payment_intent=' + encodeURIComponent(paymentIntentId)
            );
            var data = await response.json();

            if (!response.ok || !data.verified) {
                redirectToCheckout();
                return;
            }

            if (loading) {
                loading.hidden = true;
            }

            if (content) {
                content.hidden = false;
            }

            if (window.history && typeof window.history.replaceState === 'function') {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            redirectToCheckout();
        }
    }

    verifyPurchase();
})();
