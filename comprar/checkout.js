(function () {
    var pathMatch = window.location.pathname.match(/\/comprar\/([^/?#]+)/);
    var productId = pathMatch ? decodeURIComponent(pathMatch[1]) : '';

    var form = document.getElementById('checkout-form');
    var paymentElementHost = document.getElementById('payment-element');
    var paymentMessage = document.getElementById('payment-message');
    var submitBtn = document.getElementById('submit-payment');
    var paymentPlaceholder = document.getElementById('payment-placeholder');
    var productSummaryTitle = document.getElementById('product-summary-title');
    var productSummaryImage = document.getElementById('product-summary-image');
    var productSummaryPrice = document.getElementById('product-summary-price');
    var productSummaryVat = document.getElementById('product-summary-vat');
    var orderSummaryLines = document.getElementById('order-summary-lines');
    var orderSummaryTotal = document.getElementById('order-summary-total');
    var offerBannerImage = document.getElementById('offer-banner-image');
    var paymentSubscriptionHint = document.getElementById('payment-subscription-hint');
    var paymentMbwayHint = document.getElementById('payment-mbway-hint');

    if (productId === 'onda-prodigio') {
        window.location.replace('/checkout9/');
        return;
    }

    if (!form || !productId) {
        if (productSummaryTitle) {
            productSummaryTitle.textContent = 'Produto não encontrado.';
        }
        return;
    }

    var stripe = null;
    var elements = null;
    var paymentElement = null;
    var clientSecret = null;
    var isSubmitting = false;
    var isReady = false;
    var isPaymentIntentPreparing = false;
    var formPrepareTimer = null;
    var productConfig = null;

    var countryField = form.country;
    var regionField = form.region;
    var regionOtherField = document.getElementById('region-other');
    var phoneCountryField = document.getElementById('phone-country');

    var COUNTRY_OPTIONS = [
        { code: 'PT', label: 'Portugal', dial: '351', flag: '🇵🇹' },
        { code: 'LU', label: 'Luxemburgo', dial: '352', flag: '🇱🇺' },
        { code: 'FR', label: 'França', dial: '33', flag: '🇫🇷' },
        { code: 'BE', label: 'Bélgica', dial: '32', flag: '🇧🇪' },
        { code: 'CH', label: 'Suíça', dial: '41', flag: '🇨🇭' },
        { code: 'DE', label: 'Alemanha', dial: '49', flag: '🇩🇪' },
        { code: 'ES', label: 'Espanha', dial: '34', flag: '🇪🇸' },
        { code: 'IT', label: 'Itália', dial: '39', flag: '🇮🇹' },
        { code: 'NL', label: 'Países Baixos', dial: '31', flag: '🇳🇱' },
        { code: 'GB', label: 'Reino Unido', dial: '44', flag: '🇬🇧' },
        { code: 'IE', label: 'Irlanda', dial: '353', flag: '🇮🇪' },
        { code: 'BR', label: 'Brasil', dial: '55', flag: '🇧🇷' },
        { code: 'AO', label: 'Angola', dial: '244', flag: '🇦🇴' },
        { code: 'MZ', label: 'Moçambique', dial: '258', flag: '🇲🇿' },
        { code: 'US', label: 'Estados Unidos', dial: '1', flag: '🇺🇸' },
        { code: 'CA', label: 'Canadá', dial: '1', flag: '🇨🇦' },
    ];

    function getCountryConfig(code) {
        return COUNTRY_OPTIONS.find(function (country) {
            return country.code === code;
        }) || null;
    }

    function populateCountrySelect() {
        if (!countryField) {
            return;
        }

        COUNTRY_OPTIONS.forEach(function (country) {
            var option = document.createElement('option');
            option.value = country.code;
            option.textContent = country.label;
            countryField.appendChild(option);
        });
    }

    function populatePhoneCountrySelect() {
        if (!phoneCountryField) {
            return;
        }

        COUNTRY_OPTIONS.forEach(function (country) {
            var option = document.createElement('option');
            option.value = country.code;
            option.textContent = country.flag + ' +' + country.dial;
            phoneCountryField.appendChild(option);
        });

        phoneCountryField.value = 'PT';
    }

    function isPortuguesePhoneSelected() {
        return phoneCountryField && phoneCountryField.value === 'PT';
    }

    function isPortugalSelected() {
        return countryField && countryField.value === 'PT';
    }

    function syncRegionFields() {
        var isPortugal = isPortugalSelected();

        if (regionField) {
            regionField.hidden = !isPortugal;
            regionField.required = isPortugal;
            regionField.disabled = !isPortugal;

            if (!isPortugal) {
                regionField.value = '';
            }
        }

        if (regionOtherField) {
            regionOtherField.hidden = isPortugal || !countryField.value;
            regionOtherField.required = Boolean(countryField.value) && !isPortugal;
            regionOtherField.disabled = isPortugal || !countryField.value;
        }

        syncBillingDefaults();
    }

    function getRegionValue() {
        if (isPortugalSelected()) {
            return regionField ? regionField.value : '';
        }

        return regionOtherField ? regionOtherField.value.trim() : '';
    }

    function formatEuro(cents) {
        if (!Number.isFinite(cents)) {
            return 'Subscrição mensal';
        }

        return (cents / 100).toFixed(2).replace('.', ',') + ' €';
    }

    function getCheckoutAmountCents() {
        return productConfig && productConfig.amountCents ? productConfig.amountCents : 0;
    }

    function getPayButtonLabel() {
        if (productConfig && productConfig.billingType === 'subscription') {
            return 'Continuar para subscrição';
        }

        return 'Pagar ' + formatEuro(getCheckoutAmountCents());
    }

    function getStripeMode() {
        var params = new URLSearchParams(window.location.search);
        return params.get('mode') === 'test' || document.documentElement.getAttribute('data-stripe-mode') === 'test'
            ? 'test'
            : 'live';
    }

    function isTestMode() {
        return getStripeMode() === 'test';
    }

    function withModeQuery(url) {
        if (!isTestMode()) {
            return url;
        }

        return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'mode=test';
    }

    function withModePayload(payload) {
        var body = Object.assign({}, payload || {});

        if (isTestMode()) {
            body.mode = 'test';
        }

        return body;
    }

    function getApiBase() {
        return window.location.origin;
    }

    function showMessage(text, type) {
        if (!paymentMessage) {
            return;
        }

        paymentMessage.textContent = text || '';
        paymentMessage.className = 'payment-message' + (type ? ' payment-message--' + type : '');
    }

    function normalizePhone(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function formatPhoneE164(phone, countryCode) {
        var digits = normalizePhone(phone);

        if (!digits) {
            return undefined;
        }

        if (digits.indexOf('00') === 0) {
            return '+' + digits.slice(2);
        }

        var country = getCountryConfig(countryCode || getSelectedPhoneCountryCode());

        if (!country) {
            return '+' + digits;
        }

        var dial = country.dial;

        if (digits.indexOf(dial) === 0 && digits.length > dial.length + 5) {
            return '+' + digits;
        }

        if (countryCode === 'PT' && digits.length === 9) {
            return '+351' + digits;
        }

        return '+' + dial + digits;
    }

    function getBillingDefaults() {
        var email = form.email ? form.email.value.trim() : '';
        var fullName = form.full_name ? form.full_name.value.trim() : '';
        var phone = form.phone ? form.phone.value : '';
        var country = getSelectedCountryCode();
        var phoneCountry = getSelectedPhoneCountryCode();
        var region = getRegionValue();

        return {
            billingDetails: {
                email: email || undefined,
                name: fullName || undefined,
                phone: formatPhoneE164(phone, phoneCountry),
                address: {
                    country: country || undefined,
                    state: region || undefined,
                },
            },
        };
    }

    function syncBillingDefaults() {
        if (!elements) {
            return;
        }

        elements.update(getBillingDefaults());
    }

    function getConfirmParams(payload) {
        return {
            return_url: getReturnUrl(),
            receipt_email: payload.email,
            payment_method_data: {
                billing_details: {
                    name: payload.full_name,
                    email: payload.email,
                    phone: formatPhoneE164(payload.phone, payload.phone_country),
                    address: {
                        country: payload.country,
                        state: payload.region || undefined,
                    },
                },
            },
        };
    }

    async function waitForMbWayConfirmation() {
        var attempts = 0;
        var maxAttempts = 60;

        showMessage('Confirma o pagamento na app MB WAY no teu telemóvel.', 'info');

        while (attempts < maxAttempts) {
            await new Promise(function (resolve) {
                setTimeout(resolve, 2000);
            });

            try {
                var retrieved = await stripe.retrievePaymentIntent(clientSecret);
                var status = retrieved.paymentIntent ? retrieved.paymentIntent.status : '';

                if (status === 'succeeded') {
                    redirectToSuccess();
                    return;
                }

                if (status === 'canceled' || status === 'requires_payment_method') {
                    showMessage('O pagamento não foi concluído. Tenta novamente.', 'error');
                    return;
                }
            } catch (error) {
                // continua a tentar
            }

            attempts += 1;
        }

        showMessage('Pagamento pendente. Abre a app MB WAY e confirma, ou tenta outra vez.', 'info');
    }

    function hidePaymentPlaceholder() {
        if (paymentPlaceholder) {
            paymentPlaceholder.hidden = true;
        }
    }

    function showPaymentPlaceholder() {
        if (paymentPlaceholder) {
            paymentPlaceholder.hidden = false;
        }
    }

    function setSubmitLoading(loading) {
        isSubmitting = loading;
        submitBtn.disabled = loading || (!isReady && productConfig && productConfig.billingType !== 'subscription');
        submitBtn.setAttribute('aria-busy', loading ? 'true' : 'false');
    }

    function setPaymentLoading(loading) {
        submitBtn.disabled = loading || !isReady;
    }

    function renderSummary() {
        if (!productConfig || !orderSummaryLines || !orderSummaryTotal) {
            return;
        }

        var html = '';

        html += '<div class="order-summary__row">';
        html += '<span class="order-summary__label">' + productConfig.name + '</span>';
        html += '<span class="order-summary__value">' + formatEuro(productConfig.amountCents) + '</span>';
        html += '</div>';

        orderSummaryLines.innerHTML = html;
        orderSummaryTotal.textContent = formatEuro(productConfig.amountCents);
    }

    function renderProductSummary() {
        if (!productConfig) {
            return;
        }

        var bannerSrc = productConfig.banner || productConfig.image;
        var priceLabel = formatEuro(productConfig.amountCents);

        document.title = 'Checkout — ' + productConfig.name;
        productSummaryTitle.textContent = productConfig.name;
        productSummaryImage.src = productConfig.image;
        productSummaryImage.alt = productConfig.name;
        productSummaryPrice.textContent = priceLabel;

        if (offerBannerImage && bannerSrc) {
            offerBannerImage.src = bannerSrc;
            offerBannerImage.alt = 'Compra 100% segura — ' + productConfig.name + ', ' + priceLabel;
        }

        if (productConfig.billingType === 'subscription') {
            productSummaryVat.textContent = productConfig.billingNote || 'Subscrição mensal';

            if (paymentPlaceholder) {
                paymentPlaceholder.hidden = true;
            }

            if (paymentSubscriptionHint) {
                paymentSubscriptionHint.hidden = false;
            }

            if (paymentMbwayHint) {
                paymentMbwayHint.hidden = true;
            }
        } else {
            productSummaryVat.textContent = 'IVA incluído';

            if (paymentMbwayHint) {
                paymentMbwayHint.hidden = false;
            }
        }

        renderSummary();
        submitBtn.textContent = getPayButtonLabel();
        submitBtn.disabled = productConfig.billingType === 'subscription' ? false : true;
    }

    function startCountdown() {
        var bar = document.getElementById('scarcity-bar');
        var minEl = document.getElementById('countdown-min');
        var secEl = document.getElementById('countdown-sec');
        var csEl = document.getElementById('countdown-cs');

        if (!bar || !minEl || !secEl || !csEl) {
            return;
        }

        var DURATION_MS = 10 * 60 * 1000;
        var STORAGE_KEY = 'onda-comprar-countdown-' + productId;

        function pad2(n) {
            return n < 10 ? '0' + n : String(n);
        }

        function getEndTime() {
            var stored = sessionStorage.getItem(STORAGE_KEY);
            var end = stored ? parseInt(stored, 10) : NaN;

            if (!stored || isNaN(end) || end <= Date.now()) {
                end = Date.now() + DURATION_MS;
                sessionStorage.setItem(STORAGE_KEY, String(end));
            }

            return end;
        }

        function render(msLeft) {
            if (msLeft <= 0) {
                minEl.textContent = '00';
                secEl.textContent = '00';
                csEl.textContent = '00';
                bar.classList.add('is-expired');
                return;
            }

            bar.classList.remove('is-expired');

            var totalCs = Math.floor(msLeft / 10);
            var cs = totalCs % 100;
            var totalSec = Math.floor(totalCs / 100);
            var sec = totalSec % 60;
            var min = Math.floor(totalSec / 60);

            minEl.textContent = pad2(min);
            secEl.textContent = pad2(sec);
            csEl.textContent = pad2(cs);
        }

        var endTime = getEndTime();

        function tick() {
            var msLeft = endTime - Date.now();
            render(msLeft);

            if (msLeft <= 0) {
                return;
            }

            requestAnimationFrame(tick);
        }

        tick();
    }

    function getTrackingPayload() {
        if (window.OndaTracking && typeof window.OndaTracking.getStripeTrackingMetadata === 'function') {
            return window.OndaTracking.getStripeTrackingMetadata();
        }

        return {};
    }

    function getReturnUrl() {
        var url = getApiBase() + '/comunidade/produto?id=' + encodeURIComponent(productId) + '&compra=ok';

        if (isTestMode()) {
            url += '&mode=test';
        }

        return url;
    }

    function redirectToSuccess() {
        window.location.href = getReturnUrl();
    }

    function validateForm() {
        if (!form.reportValidity()) {
            return null;
        }

        var email = form.email.value.trim();
        var emailConfirm = form.email_confirm.value.trim();

        if (email !== emailConfirm) {
            showMessage('Os e-mails não coincidem.', 'error');
            return null;
        }

        return {
            email: email,
            email_confirm: emailConfirm,
            full_name: form.full_name.value.trim(),
            phone: form.phone.value.trim(),
            country: countryField ? countryField.value : '',
            phone_country: phoneCountryField ? phoneCountryField.value : 'PT',
            region: getRegionValue(),
        };
    }

    async function loadProductConfig() {
        var response = await fetch(withModeQuery(
            getApiBase() + '/api/config?product_id=' + encodeURIComponent(productId)
        ));
        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Produto não encontrado.');
        }

        productConfig = data.product;

        if (!window.Stripe) {
            throw new Error('Stripe.js não carregou.');
        }

        stripe = window.Stripe(data.publishableKey);
        renderProductSummary();
    }

    async function createPaymentIntent(payload) {
        var response = await fetch(getApiBase() + '/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withModePayload(Object.assign({}, payload, {
                product_id: productId,
                tracking: getTrackingPayload(),
            }))),
        });
        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
        }

        return data.clientSecret;
    }

    async function syncPaymentIntent(payload, options) {
        if (!clientSecret) {
            return;
        }

        var response = await fetch(getApiBase() + '/api/update-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withModePayload({
                client_secret: clientSecret,
                product_id: productId,
                amount_cents: getCheckoutAmountCents(),
                email: payload ? payload.email : '',
                full_name: payload ? payload.full_name : '',
                phone: payload ? payload.phone : '',
                country: payload ? payload.country : '',
                phone_country: payload ? payload.phone_country : '',
                region: payload ? payload.region : '',
                tracking: getTrackingPayload(),
                payment_attempt: Boolean(options && options.paymentAttempt),
            })),
        });
        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível actualizar o pagamento.');
        }
    }

    async function mountPaymentElement(secret) {
        if (paymentElement) {
            try {
                await paymentElement.unmount();
            } catch (error) {
                // ignore
            }

            paymentElement = null;
        }

        clientSecret = secret;
        isReady = false;
        submitBtn.disabled = true;

        elements = stripe.elements({
            clientSecret: clientSecret,
            locale: 'pt',
            appearance: {
                theme: 'stripe',
                variables: {
                    colorPrimary: '#0077c8',
                    colorBackground: '#ffffff',
                    colorText: '#111111',
                    colorDanger: '#b42318',
                    borderRadius: '4px',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
                    spacingUnit: '4px',
                },
                rules: {
                    '.AccordionItem': {
                        border: '1px solid #cfd8e3',
                        boxShadow: 'none',
                        marginBottom: '0.65rem',
                    },
                    '.AccordionItem--selected': {
                        border: '1px solid #0077c8',
                    },
                },
            },
        });

        paymentElementHost.innerHTML = '';
        paymentElement = elements.create('payment', {
            layout: {
                type: 'accordion',
                defaultCollapsed: false,
                radios: true,
                spacedAccordionItems: true,
            },
            paymentMethodOrder: ['mb_way', 'card', 'klarna'],
            fields: {
                billingDetails: {
                    email: 'never',
                    name: 'never',
                    phone: 'auto',
                    address: { country: 'never' },
                },
            },
            defaultValues: getBillingDefaults(),
        });

        await paymentElement.mount('#payment-element');
        syncBillingDefaults();
        isReady = true;
        submitBtn.disabled = false;
        submitBtn.textContent = getPayButtonLabel();
    }

    async function ensurePaymentIntentReady(payload) {
        if (clientSecret) {
            await syncPaymentIntent(payload);
            return payload;
        }

        if (isPaymentIntentPreparing) {
            while (isPaymentIntentPreparing && !clientSecret) {
                await new Promise(function (resolve) {
                    setTimeout(resolve, 100);
                });
            }

            if (clientSecret) {
                await syncPaymentIntent(payload);
            }

            return payload;
        }

        isPaymentIntentPreparing = true;
        setPaymentLoading(true);

        try {
            var secret = await createPaymentIntent(payload);
            await mountPaymentElement(secret);
            await syncPaymentIntent(payload);
            hidePaymentPlaceholder();
        } finally {
            isPaymentIntentPreparing = false;
            setPaymentLoading(false);
        }

        return payload;
    }

    function schedulePaymentIntentPrepare() {
        if (!productConfig || productConfig.billingType === 'subscription') {
            return;
        }

        if (clientSecret || isPaymentIntentPreparing) {
            return;
        }

        if (formPrepareTimer) {
            clearTimeout(formPrepareTimer);
        }

        formPrepareTimer = setTimeout(function () {
            formPrepareTimer = null;
            var payload = validateForm();

            if (!payload) {
                return;
            }

            ensurePaymentIntentReady(payload).catch(function (error) {
                showMessage(error.message || 'Não foi possível preparar o pagamento.', 'error');
            });
        }, 400);
    }

    async function startSubscriptionCheckout(payload) {
        var response = await fetch(getApiBase() + '/api/create-upsell-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withModePayload(Object.assign({}, payload, {
                product_id: productId,
                checkout_type: 'standalone',
                tracking: getTrackingPayload(),
            }))),
        });
        var data = await response.json();

        if (!response.ok || !data.url) {
            throw new Error(data.error || 'Não foi possível iniciar a subscrição.');
        }

        window.location.href = data.url;
    }

    async function submitPayment(event) {
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        if (isSubmitting) {
            return;
        }

        var payload = validateForm();

        if (!payload) {
            return;
        }

        setSubmitLoading(true);
        showMessage('');

        try {
            if (productConfig.billingType === 'subscription') {
                await startSubscriptionCheckout(payload);
                return;
            }

            await ensurePaymentIntentReady(payload);

            if (!elements || !clientSecret || !isReady) {
                throw new Error('Os métodos de pagamento ainda não estão prontos. Tenta novamente.');
            }

            syncBillingDefaults();
            await syncPaymentIntent(payload, { paymentAttempt: true });

            var submitResult = await elements.submit();

            if (submitResult.error) {
                throw new Error(submitResult.error.message || 'Verifica o método de pagamento seleccionado.');
            }

            var result = await stripe.confirmPayment({
                elements: elements,
                confirmParams: getConfirmParams(payload),
                redirect: 'if_required',
            });

            if (result.error) {
                throw new Error(result.error.message || 'Pagamento recusado.');
            }

            var status = result.paymentIntent ? result.paymentIntent.status : '';

            if (status === 'succeeded') {
                redirectToSuccess();
                return;
            }

            if (status === 'requires_action' || status === 'processing') {
                setSubmitLoading(false);
                await waitForMbWayConfirmation();
                return;
            }

            showMessage('Não foi possível concluir o pagamento. Tenta novamente.', 'error');
        } catch (error) {
            showMessage(error.message || 'Erro ao processar o pagamento.', 'error');
        } finally {
            setSubmitLoading(false);
        }
    }

    function setupWatchers() {
        [form.email, form.email_confirm, form.full_name, form.phone, countryField, regionField, regionOtherField, phoneCountryField].forEach(function (field) {
            if (!field) {
                return;
            }

            field.addEventListener('input', schedulePaymentIntentPrepare);
            field.addEventListener('change', schedulePaymentIntentPrepare);
            field.addEventListener('blur', schedulePaymentIntentPrepare);
            field.addEventListener('input', syncBillingDefaults);
            field.addEventListener('change', syncBillingDefaults);
            field.addEventListener('blur', syncBillingDefaults);
        });

        if (countryField) {
            countryField.addEventListener('change', syncRegionFields);
        }
    }

    async function initialize() {
        populateCountrySelect();
        populatePhoneCountrySelect();
        syncRegionFields();
        setupWatchers();
        submitBtn.addEventListener('click', submitPayment);

        try {
            startCountdown();
            await loadProductConfig();

            if (productConfig.billingType !== 'subscription') {
                showPaymentPlaceholder();
            }
        } catch (error) {
            showMessage(error.message || 'Erro ao carregar o checkout.', 'error');
            submitBtn.disabled = true;
        }
    }

    initialize();
})();
