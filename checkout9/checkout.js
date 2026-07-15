(function () {
    var form = document.getElementById('checkout-form');
    var paymentElementHost = document.getElementById('payment-element');
    var expressCheckoutHost = document.getElementById('express-checkout-element');
    var expressCheckoutEmpty = document.getElementById('express-checkout-empty');
    var expressCheckoutDivider = document.getElementById('express-checkout-divider');
    var paymentMessage = document.getElementById('payment-message');
    var submitBtn = document.getElementById('submit-payment');
    var paymentBlock = document.getElementById('checkout-payment-block');

    if (!form || !paymentElementHost || !submitBtn) {
        return;
    }

    var stripe = null;
    var elements = null;
    var paymentElement = null;
    var expressCheckoutElement = null;
    var clientSecret = null;
    var isSubmitting = false;
    var isReady = false;

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
        { code: 'AT', label: 'Áustria', dial: '43', flag: '🇦🇹' },
        { code: 'SE', label: 'Suécia', dial: '46', flag: '🇸🇪' },
        { code: 'NO', label: 'Noruega', dial: '47', flag: '🇳🇴' },
        { code: 'DK', label: 'Dinamarca', dial: '45', flag: '🇩🇰' },
        { code: 'US', label: 'Estados Unidos', dial: '1', flag: '🇺🇸' },
        { code: 'CA', label: 'Canadá', dial: '1', flag: '🇨🇦' },
        { code: 'BR', label: 'Brasil', dial: '55', flag: '🇧🇷' },
        { code: 'AO', label: 'Angola', dial: '244', flag: '🇦🇴' },
        { code: 'MZ', label: 'Moçambique', dial: '258', flag: '🇲🇿' },
        { code: 'CV', label: 'Cabo Verde', dial: '238', flag: '🇨🇻' },
        { code: 'GW', label: 'Guiné-Bissau', dial: '245', flag: '🇬🇼' },
        { code: 'ST', label: 'São Tomé e Príncipe', dial: '239', flag: '🇸🇹' },
        { code: 'AE', label: 'Emirados Árabes Unidos', dial: '971', flag: '🇦🇪' },
        { code: 'ZA', label: 'África do Sul', dial: '27', flag: '🇿🇦' },
        { code: 'AU', label: 'Austrália', dial: '61', flag: '🇦🇺' },
        { code: 'NZ', label: 'Nova Zelândia', dial: '64', flag: '🇳🇿' },
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

    function getSelectedPhoneCountryCode() {
        return phoneCountryField ? phoneCountryField.value : '';
    }

    function isPortuguesePhoneSelected() {
        return getSelectedPhoneCountryCode() === 'PT';
    }

    function getSelectedCountryCode() {
        return countryField ? countryField.value : '';
    }

    function isPortugalSelected() {
        return getSelectedCountryCode() === 'PT';
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
            regionOtherField.hidden = isPortugal || !getSelectedCountryCode();
            regionOtherField.required = Boolean(getSelectedCountryCode()) && !isPortugal;
            regionOtherField.disabled = isPortugal || !getSelectedCountryCode();
        }
    }

    function syncLocationFields() {
        syncRegionFields();
        syncBillingDefaults();
    }

    function getRegionValue() {
        if (isPortugalSelected()) {
            return regionField ? regionField.value : '';
        }

        return regionOtherField ? regionOtherField.value.trim() : '';
    }

    function getCheckoutAmountCents() {
        if (window.CheckoutOrderBumps) {
            return window.CheckoutOrderBumps.getTotalCents();
        }

        return 900;
    }

    function getOrderBumpIds() {
        if (window.CheckoutOrderBumps) {
            return window.CheckoutOrderBumps.getSelectedBumpIds();
        }

        return [];
    }

    function getPayButtonLabel() {
        if (window.CheckoutOrderBumps) {
            return 'Pagar ' + window.CheckoutOrderBumps.formatEuro(getCheckoutAmountCents());
        }

        return 'Pagar 9,00 €';
    }

    function getStripeMode() {
        return document.documentElement.getAttribute('data-stripe-mode') === 'test' ? 'test' : 'live';
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

    function validateForm() {
        var email = form.email.value.trim();
        var emailConfirm = form.email_confirm.value.trim();
        var fullName = form.full_name.value.trim();
        var phone = normalizePhone(form.phone.value);
        var country = getSelectedCountryCode();
        var phoneCountry = getSelectedPhoneCountryCode();
        var region = getRegionValue();

        if (!email || !emailConfirm || !fullName || !phone || !country || !phoneCountry || !region) {
            showMessage('Preenche todos os campos dos dados pessoais.', 'error');
            return null;
        }

        if (email !== emailConfirm) {
            showMessage('Os e-mails não coincidem.', 'error');
            return null;
        }

        if (isPortuguesePhoneSelected() && phone.length < 9) {
            showMessage('Introduz um número de telemóvel válido.', 'error');
            return null;
        }

        if (!isPortuguesePhoneSelected() && phone.length < 6) {
            showMessage('Introduz um número de telemóvel válido.', 'error');
            return null;
        }

        showMessage('');
        return {
            email: email,
            email_confirm: emailConfirm,
            full_name: fullName,
            phone: phone,
            country: country,
            phone_country: phoneCountry,
            region: region,
        };
    }

    function setSubmitLoading(loading) {
        isSubmitting = loading;
        submitBtn.disabled = loading || !isReady;
        submitBtn.textContent = loading ? 'A processar…' : getPayButtonLabel();
    }

    function setPaymentLoading(loading) {
        if (paymentBlock) {
            paymentBlock.classList.toggle('is-loading', loading);
        }

        submitBtn.disabled = loading || !isReady;
    }

    function scrollToFirstFormIssue() {
        var firstInvalid = form.querySelector(':invalid');

        if (firstInvalid && typeof firstInvalid.focus === 'function') {
            firstInvalid.focus();
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function getTrackingPayload() {
        if (window.OndaTracking && typeof window.OndaTracking.getStripeTrackingMetadata === 'function') {
            return window.OndaTracking.getStripeTrackingMetadata();
        }

        return {};
    }

    function trackCheckoutStarted() {
        if (window.OndaTracking && typeof window.OndaTracking.trackCheckoutStarted === 'function') {
            window.OndaTracking.trackCheckoutStarted();
        }
    }

    function trackPaymentSubmitted() {
        if (window.OndaTracking && typeof window.OndaTracking.trackPaymentSubmitted === 'function') {
            window.OndaTracking.trackPaymentSubmitted();
        }
    }

    function trackPaymentFailed(message) {
        if (window.OndaTracking && typeof window.OndaTracking.trackPaymentFailed === 'function') {
            window.OndaTracking.trackPaymentFailed({
                error_message: message || '',
            });
        }
    }

    function trackPaymentSucceeded(paymentIntentId) {
        if (window.OndaTracking && typeof window.OndaTracking.trackPaymentSucceeded === 'function') {
            window.OndaTracking.trackPaymentSucceeded({
                transaction_id: paymentIntentId || '',
            });
        }
    }

    function getPaymentIntentId() {
        return clientSecret ? clientSecret.split('_secret')[0] : '';
    }

    function getReturnUrl() {
        return getApiBase() + (isTestMode() ? '/obgd-test/' : '/obgd/');
    }

    function redirectToSuccess() {
        var paymentIntentId = clientSecret ? clientSecret.split('_secret')[0] : '';
        var url = getReturnUrl();

        if (paymentIntentId) {
            url += '?payment_intent=' + encodeURIComponent(paymentIntentId);
        }

        window.location.href = url;
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
                    trackPaymentSucceeded(getPaymentIntentId());
                    redirectToSuccess();
                    return;
                }

                if (status === 'canceled' || status === 'requires_payment_method') {
                    trackPaymentFailed('Pagamento MB WAY não concluído.');
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


    async function loadStripe() {
        var response = await fetch(withModeQuery(getApiBase() + '/api/config'));

        if (!response.ok) {
            throw new Error('Não foi possível carregar a configuração de pagamento.');
        }

        var config = await response.json();

        if (!window.Stripe) {
            throw new Error('Stripe.js não carregou.');
        }

        stripe = window.Stripe(config.publishableKey);
        return config;
    }

    async function createPaymentIntent(payload) {
        var response = await fetch(getApiBase() + '/api/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(withModePayload(Object.assign({}, payload || {}, {
                tracking: getTrackingPayload(),
            }))),
        });

        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
        }

        return data.clientSecret;
    }

    async function syncPaymentIntent(payload) {
        var response = await fetch(getApiBase() + '/api/update-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(withModePayload({
                client_secret: clientSecret,
                amount_cents: getCheckoutAmountCents(),
                order_bumps: getOrderBumpIds(),
                email: payload ? payload.email : '',
                email_confirm: payload ? payload.email_confirm : '',
                full_name: payload ? payload.full_name : '',
                phone: payload ? payload.phone : '',
                country: payload ? payload.country : '',
                phone_country: payload ? payload.phone_country : '',
                region: payload ? payload.region : '',
                tracking: getTrackingPayload(),
            })),
        });

        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível actualizar o pagamento.');
        }
    }

    async function syncOrderTotal() {
        if (!clientSecret) {
            return;
        }

        await syncPaymentIntent(null);

        if (elements && typeof elements.fetchUpdates === 'function') {
            await elements.fetchUpdates();
        }
    }


    function updateExpressCheckoutVisibility(hasMethods) {
        if (expressCheckoutEmpty) {
            expressCheckoutEmpty.hidden = hasMethods;
        }

        if (expressCheckoutHost) {
            expressCheckoutHost.hidden = !hasMethods;
        }

        if (expressCheckoutDivider) {
            expressCheckoutDivider.hidden = !hasMethods;
        }
    }

    async function mountExpressCheckoutElement() {
        if (!expressCheckoutHost || !elements) {
            return;
        }

        if (expressCheckoutElement) {
            try {
                await expressCheckoutElement.unmount();
            } catch (error) {
                // ignore
            }

            expressCheckoutElement = null;
        }

        expressCheckoutHost.innerHTML = '';
        expressCheckoutElement = elements.create('expressCheckout', {
            buttonHeight: 48,
            emailRequired: true,
            paymentMethodOrder: ['applePay', 'googlePay'],
            paymentMethods: {
                applePay: 'always',
                googlePay: 'always',
                link: 'never',
                amazonPay: 'never',
                paypal: 'never',
                klarna: 'never',
            },
        });

        expressCheckoutElement.on('availablePaymentMethodsChange', function (event) {
            var methods = event.availablePaymentMethods || {};
            var hasMethods = Boolean(methods.applePay || methods.googlePay);

            updateExpressCheckoutVisibility(hasMethods);
        });

        expressCheckoutElement.on('click', async function (event) {
            var payload = validateForm();

            if (!payload) {
                scrollToFirstFormIssue();

                if (typeof event.reject === 'function') {
                    event.reject();
                }

                return;
            }

            try {
                syncBillingDefaults();
                await syncPaymentIntent(payload);
            } catch (error) {
                showMessage(error.message || 'Não foi possível preparar o pagamento.', 'error');

                if (typeof event.reject === 'function') {
                    event.reject();
                }

                return;
            }

            if (typeof event.resolve === 'function') {
                event.resolve({
                    emailRequired: true,
                    email: payload.email,
                });
            }
        });

        expressCheckoutElement.on('confirm', async function (event) {
            var payload = validateForm();

            if (!payload) {
                showMessage('Preenche todos os campos dos dados pessoais antes de pagar.', 'error');
                scrollToFirstFormIssue();

                if (event && typeof event.paymentFailed === 'function') {
                    event.paymentFailed({
                        reason: 'fail',
                        message: 'Preenche todos os campos dos dados pessoais antes de pagar.',
                    });
                }

                return;
            }

            setSubmitLoading(true);
            showMessage('');

            try {
                syncBillingDefaults();
                await syncPaymentIntent(payload);
                trackPaymentSubmitted();

                var result = await stripe.confirmPayment({
                    elements: elements,
                    clientSecret: clientSecret,
                    confirmParams: getConfirmParams(payload),
                });

                if (result.error) {
                    trackPaymentFailed(result.error.message);
                    showMessage(result.error.message || 'O pagamento não foi concluído.', 'error');

                    if (event && typeof event.paymentFailed === 'function') {
                        event.paymentFailed({
                            reason: 'fail',
                            message: result.error.message || 'O pagamento não foi concluído.',
                        });
                    }

                    return;
                }

                var status = result.paymentIntent ? result.paymentIntent.status : '';

                if (status === 'succeeded') {
                    trackPaymentSucceeded(getPaymentIntentId());
                    redirectToSuccess();
                    return;
                }

                showMessage('Não foi possível concluir o pagamento. Tenta novamente.', 'error');
            } catch (error) {
                trackPaymentFailed(error.message);
                showMessage(error.message || 'Erro ao processar o pagamento.', 'error');

                if (event && typeof event.paymentFailed === 'function') {
                    event.paymentFailed({
                        reason: 'fail',
                        message: error.message || 'Erro ao processar o pagamento.',
                    });
                }
            } finally {
                setSubmitLoading(false);
            }
        });

        await expressCheckoutElement.mount('#express-checkout-element');
    }

    function getElementsAppearance() {
        return {
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
                '.Label': {
                    fontWeight: '700',
                    fontSize: '0.82rem',
                },
            },
        };
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
            appearance: getElementsAppearance(),
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
                    address: {
                        country: 'never',
                    },
                },
            },
            defaultValues: getBillingDefaults(),
        });

        await mountExpressCheckoutElement();
        await paymentElement.mount('#payment-element');
        syncBillingDefaults();
        isReady = true;
        submitBtn.disabled = false;
        submitBtn.textContent = getPayButtonLabel();
    }

    async function initializeCheckout() {
        setPaymentLoading(true);
        showMessage('');

        try {
            await loadStripe();
            var secret = await createPaymentIntent({});
            trackCheckoutStarted();
            await mountPaymentElement(secret);
        } catch (error) {
            showMessage(error.message || 'Erro ao carregar os métodos de pagamento.', 'error');
        } finally {
            setPaymentLoading(false);
        }
    }

    async function submitPayment(event) {
        event.preventDefault();

        if (isSubmitting || !stripe || !elements || !clientSecret || !isReady) {
            return;
        }

        var payload = validateForm();

        if (!payload) {
            scrollToFirstFormIssue();
            return;
        }

        setSubmitLoading(true);
        showMessage('');

        try {
            syncBillingDefaults();
            await syncPaymentIntent(payload);
            trackPaymentSubmitted();

            var submitResult = await elements.submit();

            if (submitResult.error) {
                trackPaymentFailed(submitResult.error.message);
                showMessage(submitResult.error.message || 'Verifica o método de pagamento seleccionado.', 'error');
                return;
            }

            var result = await stripe.confirmPayment({
                elements: elements,
                confirmParams: getConfirmParams(payload),
                redirect: 'if_required',
            });

            if (result.error) {
                trackPaymentFailed(result.error.message);
                showMessage(result.error.message || 'O pagamento não foi concluído.', 'error');
                return;
            }

            var status = result.paymentIntent ? result.paymentIntent.status : '';

            if (status === 'succeeded') {
                trackPaymentSucceeded(getPaymentIntentId());
                redirectToSuccess();
                return;
            }

            if (status === 'requires_action' || status === 'processing') {
                setSubmitLoading(false);
                await waitForMbWayConfirmation();
                return;
            }

            trackPaymentFailed('Pagamento não concluído.');
            showMessage('Não foi possível concluir o pagamento. Tenta novamente.', 'error');
        } catch (error) {
            trackPaymentFailed(error.message);
            showMessage(error.message || 'Erro ao processar o pagamento.', 'error');
        } finally {
            setSubmitLoading(false);
        }
    }

    ['email', 'full_name', 'phone'].forEach(function (fieldName) {
        var field = form[fieldName];

        if (!field) {
            return;
        }

        field.addEventListener('input', syncBillingDefaults);
        field.addEventListener('blur', syncBillingDefaults);
    });

    if (countryField) {
        countryField.addEventListener('change', syncLocationFields);
    }

    if (regionOtherField) {
        regionOtherField.addEventListener('input', syncBillingDefaults);
        regionOtherField.addEventListener('blur', syncBillingDefaults);
    }

    if (regionField) {
        regionField.addEventListener('change', syncBillingDefaults);
    }

    if (phoneCountryField) {
        phoneCountryField.addEventListener('change', syncBillingDefaults);
    }

    populateCountrySelect();
    populatePhoneCountrySelect();
    syncLocationFields();

    submitBtn.addEventListener('click', submitPayment);

    document.addEventListener('checkout:total-change', function () {
        if (submitBtn && !isSubmitting) {
            submitBtn.textContent = getPayButtonLabel();
        }

        syncOrderTotal().catch(function (error) {
            showMessage(error.message || 'Não foi possível actualizar o total.', 'error');
        });
    });

    initializeCheckout();
})();
