(function () {
    var CHECKOUT_URL = document.documentElement.getAttribute('data-stripe-mode') === 'test'
        ? '/checkout9-test/'
        : '/checkout9/';
    var POLL_MS = 2000;
    var MAX_ATTEMPTS = 30;
    var ENABLE_POST_CHECKOUT_UPSELLS = false;
    var PAYMENT_INTENT_STORAGE_KEY = 'onda-obgd-payment-intent';

    var content = document.getElementById('obgd-content');
    var loading = document.getElementById('obgd-loading');
    var loadingText = document.getElementById('obgd-loading-text');
    var successBar = document.getElementById('obgd-success-bar');
    var previewBanner = document.getElementById('obgd-preview-banner');

    function isPreviewMode() {
        var params = new URLSearchParams(window.location.search);
        return params.get('preview') === '1';
    }

    function rememberPaymentIntentId(paymentIntentId) {
        if (window.sessionStorage && paymentIntentId) {
            window.sessionStorage.setItem(PAYMENT_INTENT_STORAGE_KEY, paymentIntentId);
        }
    }

    function getStoredPaymentIntentId() {
        if (!window.sessionStorage) {
            return '';
        }

        return window.sessionStorage.getItem(PAYMENT_INTENT_STORAGE_KEY) || '';
    }

    function getPaymentIntentId() {
        var params = new URLSearchParams(window.location.search);
        var paymentIntentId = params.get('payment_intent') || '';
        var clientSecret = params.get('payment_intent_client_secret') || '';

        if (!paymentIntentId && clientSecret.indexOf('_secret') !== -1) {
            paymentIntentId = clientSecret.split('_secret')[0];
        }

        if (paymentIntentId) {
            rememberPaymentIntentId(paymentIntentId);
            return paymentIntentId;
        }

        return getStoredPaymentIntentId();
    }

    function setLoadingMessage(text) {
        if (loadingText) {
            loadingText.textContent = text;
        }
    }

    function redirectToCheckout() {
        window.location.replace(CHECKOUT_URL);
    }

    function showThankYouPage(options) {
        options = options || {};

        if (loading) {
            loading.hidden = true;
            loading.setAttribute('aria-hidden', 'true');
        }

        if (loadingText) {
            loadingText.textContent = '';
        }

        if (previewBanner) {
            previewBanner.hidden = !isPreviewMode();
        }

        if (successBar) {
            successBar.hidden = options.showSuccessBar !== true;
        }

        if (content) {
            content.hidden = false;
        }

        if (window.history && typeof window.history.replaceState === 'function') {
            var nextUrl = window.location.pathname;

            if (options.keepPreviewParam || isPreviewMode()) {
                nextUrl += '?preview=1';
            }

            window.history.replaceState({}, document.title, nextUrl);
        }
    }

    function showPreviewPage() {
        showThankYouPage({ keepPreviewParam: true, showSuccessBar: true });
    }

    async function completeVerifiedPurchase(result, paymentIntentId) {
        await trackVerifiedPurchase(result, paymentIntentId);

        if (ENABLE_POST_CHECKOUT_UPSELLS) {
            var params = new URLSearchParams(window.location.search);

            if (!params.get('upsells')) {
                window.location.replace('/obgd/upsell1' + window.location.search);
                return;
            }
        }

        showThankYouPage({ showSuccessBar: true });
    }

    async function verifyPurchaseOnce(paymentIntentId) {
        var modeQuery = document.documentElement.getAttribute('data-stripe-mode') === 'test' ? '&mode=test' : '';
        var response = await fetch(
            window.location.origin + '/api/verify-payment?payment_intent=' + encodeURIComponent(paymentIntentId) + modeQuery
        );
        var data = await response.json();

        return {
            ok: response.ok,
            verified: Boolean(data.verified),
            status: data.status || 'unknown',
            amountCents: data.amount_cents || 0,
            orderBumps: Array.isArray(data.order_bumps) ? data.order_bumps : [],
            email: data.email || '',
            full_name: data.full_name || '',
            phone: data.phone || '',
            country: data.country || '',
            region: data.region || '',
            phone_country: data.phone_country || '',
        };
    }

    async function trackVerifiedPurchase(result, paymentIntentId) {
        if (!window.OndaTracking) {
            return;
        }

        if (typeof window.OndaTracking.bootstrap === 'function') {
            await window.OndaTracking.bootstrap().catch(function () {});
        }

        if (typeof window.OndaTracking.setMetaAdvancedMatching === 'function') {
            await window.OndaTracking.setMetaAdvancedMatching({
                email: result.email || '',
                full_name: result.full_name || '',
                phone: result.phone || '',
                country: result.country || '',
                phoneCountry: result.phone_country || '',
                region: result.region || '',
            }).catch(function () {});
        }

        var payload = {
            transactionId: paymentIntentId,
            amountCents: result.amountCents,
            orderBumps: result.orderBumps,
        };

        for (var attempt = 0; attempt < 6; attempt += 1) {
            if (typeof window.OndaTracking.wasPurchaseTracked === 'function' &&
                window.OndaTracking.wasPurchaseTracked(paymentIntentId)) {
                return;
            }

            if (typeof window.OndaTracking.trackPurchaseAsync === 'function') {
                await window.OndaTracking.trackPurchaseAsync(payload);
            }

            if (typeof window.OndaTracking.wasPurchaseTracked === 'function' &&
                window.OndaTracking.wasPurchaseTracked(paymentIntentId)) {
                return;
            }

            await new Promise(function (resolve) {
                setTimeout(resolve, 500);
            });
        }
    }

    async function verifyPurchase() {
        if (isPreviewMode()) {
            showPreviewPage();
            return;
        }

        var paymentIntentId = getPaymentIntentId();
        var redirectStatus = new URLSearchParams(window.location.search).get('redirect_status') || '';

        if (!paymentIntentId || paymentIntentId.indexOf('pi_') !== 0) {
            showThankYouPage({ showSuccessBar: false });
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
                    await completeVerifiedPurchase(result, paymentIntentId);
                    return;
                }

                if (redirectStatus === 'succeeded' && attempt >= 2) {
                    await completeVerifiedPurchase(result, paymentIntentId);
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

            await completeVerifiedPurchase(result, paymentIntentId);
        } catch (error) {
            redirectToCheckout();
        }
    }

    verifyPurchase();
})();
