(function () {
    var CHECKOUT_URL = document.documentElement.getAttribute('data-stripe-mode') === 'test'
        ? '/checkout9-test/'
        : '/checkout9/';
    var POLL_MS = 2000;
    var MAX_ATTEMPTS = 30;
    var ENABLE_POST_CHECKOUT_UPSELLS = false;

    var content = document.getElementById('obgd-content');
    var loading = document.getElementById('obgd-loading');
    var loadingText = document.getElementById('obgd-loading-text');
    var successBar = document.getElementById('obgd-success-bar');
    var previewBanner = document.getElementById('obgd-preview-banner');

    function isPreviewMode() {
        var params = new URLSearchParams(window.location.search);
        return params.get('preview') === '1';
    }

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
            successBar.hidden = false;
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
        if (successBar) {
            successBar.hidden = false;
        }

        showThankYouPage({ keepPreviewParam: true });
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

        showThankYouPage();
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
        };
    }

    function trackVerifiedPurchase(result, paymentIntentId) {
        function fire() {
            if (!window.OndaTracking) {
                return Promise.resolve();
            }

            if (typeof window.OndaTracking.trackPurchaseAsync === 'function') {
                return window.OndaTracking.trackPurchaseAsync({
                    transactionId: paymentIntentId,
                    amountCents: result.amountCents,
                    orderBumps: result.orderBumps,
                });
            }

            if (typeof window.OndaTracking.trackPurchase === 'function') {
                window.OndaTracking.trackPurchase({
                    transactionId: paymentIntentId,
                    amountCents: result.amountCents,
                    orderBumps: result.orderBumps,
                });

                if (typeof window.OndaTracking.waitForTrackingFlush === 'function') {
                    return window.OndaTracking.waitForTrackingFlush(450);
                }
            }

            return Promise.resolve();
        }

        if (window.OndaTracking && typeof window.OndaTracking.bootstrap === 'function') {
            return window.OndaTracking.bootstrap().then(fire).catch(fire);
        }

        return fire();
    }

    async function verifyPurchase() {
        if (isPreviewMode()) {
            showPreviewPage();
            return;
        }

        var paymentIntentId = getPaymentIntentId();
        var redirectStatus = new URLSearchParams(window.location.search).get('redirect_status') || '';

        if (!paymentIntentId || paymentIntentId.indexOf('pi_') !== 0) {
            if (successBar) {
                successBar.hidden = true;
            }

            showThankYouPage();
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
