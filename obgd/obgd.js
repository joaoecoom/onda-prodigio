(function () {
    var CHECKOUT_URL = '/checkout9/';
    var POLL_MS = 2000;
    var MAX_ATTEMPTS = 30;

    var content = document.getElementById('obgd-content');
    var loading = document.getElementById('obgd-loading');
    var loadingText = document.getElementById('obgd-loading-text');
    var successBar = document.getElementById('obgd-success-bar');

    function getPaymentIntentId() {
        var params = new URLSearchParams(window.location.search);
        var paymentIntentId = params.get('payment_intent') || '';
        var clientSecret = params.get('payment_intent_client_secret') || '';

        if (!paymentIntentId && clientSecret.indexOf('_secret') !== -1) {
            paymentIntentId = clientSecret.split('_secret')[0];
        }

        return paymentIntentId;
    }

    function setLoadingMessage(text) {
        if (loadingText) {
            loadingText.textContent = text;
        }
    }

    function redirectToCheckout() {
        window.location.replace(CHECKOUT_URL);
    }

    function showThankYouPage() {
        if (loading) {
            loading.hidden = true;
        }

        if (successBar) {
            successBar.hidden = false;
        }

        if (content) {
            content.hidden = false;
        }

        if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    async function verifyPurchaseOnce(paymentIntentId) {
        var response = await fetch(
            window.location.origin + '/api/verify-payment?payment_intent=' + encodeURIComponent(paymentIntentId)
        );
        var data = await response.json();

        return {
            ok: response.ok,
            verified: Boolean(data.verified),
            status: data.status || 'unknown',
        };
    }

    async function verifyPurchase() {
        var paymentIntentId = getPaymentIntentId();
        var redirectStatus = new URLSearchParams(window.location.search).get('redirect_status') || '';

        if (!paymentIntentId || paymentIntentId.indexOf('pi_') !== 0) {
            redirectToCheckout();
            return;
        }

        if (successBar) {
            successBar.hidden = true;
        }

        setLoadingMessage('A confirmar o seu pagamento…');

        try {
            for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
                var result = await verifyPurchaseOnce(paymentIntentId);

                if (result.verified) {
                    showThankYouPage();
                    return;
                }

                if (result.status === 'processing' || redirectStatus === 'processing') {
                    setLoadingMessage('Pagamento em processamento… Quase a terminar.');
                } else if (result.status === 'requires_action') {
                    setLoadingMessage('A aguardar confirmação final do pagamento…');
                } else if (result.status === 'requires_payment_method' || result.status === 'canceled') {
                    redirectToCheckout();
                    return;
                }

                await new Promise(function (resolve) {
                    setTimeout(resolve, POLL_MS);
                });
            }

            showThankYouPage();
        } catch (error) {
            redirectToCheckout();
        }
    }

    verifyPurchase();
})();
