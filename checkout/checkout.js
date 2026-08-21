(function () {
    var params = new URLSearchParams(window.location.search);
    var offerSlug = params.get('offer') || '';
    var productId = params.get('product_id') || '';
    var mode = params.get('mode') === 'test' ? 'test' : 'live';

    var form = document.getElementById('checkout-form');
    var paymentHost = document.getElementById('payment-element');
    var paymentMessage = document.getElementById('payment-message');
    var submitBtn = document.getElementById('submit-payment');
    var titleEl = document.getElementById('checkout-title');
    var subtitleEl = document.getElementById('checkout-subtitle');
    var priceEl = document.getElementById('checkout-price');

    var stripe = null;
    var elements = null;
    var paymentElement = null;
    var clientSecret = null;
    var checkoutConfig = null;

    function showMessage(text, type) {
        paymentMessage.hidden = false;
        paymentMessage.textContent = text;
        paymentMessage.className = 'payment-message' + (type ? ' payment-message--' + type : '');
    }

    function formatPrice(cents, currency) {
        var value = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2).replace('.', ',');
        return value + (currency === 'eur' ? '€' : ' ' + String(currency || '').toUpperCase());
    }

    function configQuery() {
        var query = '/api/config?checkout=main&mode=' + encodeURIComponent(mode);

        if (offerSlug) query += '&offer=' + encodeURIComponent(offerSlug);
        if (productId) query += '&product_id=' + encodeURIComponent(productId);

        return query;
    }

    function paymentIntentPayload() {
        var tracking = window.OndaTracking ? window.OndaTracking.getStripeTrackingMetadata() : {};

        if (offerSlug) {
            tracking.offer_slug = offerSlug;
        }

        if (checkoutConfig && checkoutConfig.offerId) {
            tracking.offer_id = checkoutConfig.offerId;
        }

        return {
            mode: mode,
            checkout_id: 'main',
            offer_slug: offerSlug,
            product_id: checkoutConfig ? (checkoutConfig.productId || productId) : productId,
            full_name: form.full_name.value.trim(),
            email: form.email.value.trim(),
            phone: form.phone.value.trim(),
            tracking: tracking,
        };
    }

    function fireCheckoutTracking() {
        if (!window.OndaTracking || !checkoutConfig) {
            return;
        }

        window.OndaTracking.trackCheckoutStarted({
            amountCents: checkoutConfig.amountCents,
            productId: checkoutConfig.productId || productId,
            offerSlug: offerSlug,
        });
    }

    async function loadConfig() {
        var response = await fetch(configQuery());
        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Configuração indisponível.');
        }

        checkoutConfig = data;
        productId = data.productId || productId;
        titleEl.textContent = data.productName || 'Checkout';
        subtitleEl.textContent = mode === 'test'
            ? 'Modo teste — usa cartão 4242 4242 4242 4242'
            : 'Pagamento seguro';
        priceEl.textContent = formatPrice(data.amountCents, data.currency || 'eur');

        if (!window.Stripe) {
            throw new Error('Stripe.js não carregou.');
        }

        stripe = window.Stripe(data.publishableKey);
    }

    async function createPaymentIntent(override) {
        var payload = Object.assign(paymentIntentPayload(), override || {});
        var response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
        }

        clientSecret = data.clientSecret;
    }

    async function mountPaymentElement() {
        elements = stripe.elements({ clientSecret: clientSecret });
        paymentElement = elements.create('payment');
        paymentElement.mount(paymentHost);
        submitBtn.disabled = false;
    }

    function successUrl() {
        var base = checkoutConfig.thankYouPath || '/comunidade/';
        var url = new URL(base, window.location.origin);

        if (offerSlug) url.searchParams.set('offer', offerSlug);
        url.searchParams.set('welcome', '1');

        return url.toString();
    }

    async function boot() {
        if (!offerSlug) {
            showMessage('Oferta em falta na URL (?offer=).', 'error');
            return;
        }

        try {
            await loadConfig();
            fireCheckoutTracking();
            submitBtn.disabled = false;
        } catch (error) {
            showMessage(error.message || 'Erro ao carregar checkout.', 'error');
        }
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!checkoutConfig) {
            return;
        }

        submitBtn.disabled = true;
        showMessage('A processar pagamento…', 'info');

        try {
            if (!stripe) {
                stripe = window.Stripe(checkoutConfig.publishableKey);
            }

            if (window.OndaTracking) {
                window.OndaTracking.trackInitiateCheckout({
                    amountCents: checkoutConfig.amountCents,
                    productId: checkoutConfig.productId || productId,
                });
                window.OndaTracking.trackPaymentSubmitted({
                    amountCents: checkoutConfig.amountCents,
                });
            }

            await createPaymentIntent();

            if (paymentElement) {
                paymentElement.unmount();
            }

            await mountPaymentElement();

            var result = await stripe.confirmPayment({
                elements: elements,
                confirmParams: {
                    return_url: successUrl(),
                },
                redirect: 'if_required',
            });

            if (result.error) {
                showMessage(result.error.message || 'Pagamento falhou.', 'error');
                submitBtn.disabled = false;
                return;
            }

            if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
                window.location.href = successUrl();
            }
        } catch (error) {
            showMessage(error.message || 'Erro no pagamento.', 'error');
            submitBtn.disabled = false;
        }
    });

    boot();
})();
