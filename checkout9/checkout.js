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
    var lastLinkedEmail = '';

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
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

    function getBillingDefaults() {
        var email = form.email ? form.email.value.trim() : '';
        var fullName = form.full_name ? form.full_name.value.trim() : '';
        var phone = normalizePhone(form.phone ? form.phone.value : '');

        return {
            billingDetails: {
                email: email || undefined,
                name: fullName || undefined,
                phone: phone ? '+351' + phone : undefined,
                address: {
                    country: 'PT',
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
        var region = form.region.value;

        if (!email || !emailConfirm || !fullName || !phone || !region) {
            showMessage('Preenche todos os campos dos dados pessoais.', 'error');
            return null;
        }

        if (email !== emailConfirm) {
            showMessage('Os e-mails não coincidem.', 'error');
            return null;
        }

        if (phone.length < 9) {
            showMessage('Introduz um número de telemóvel válido.', 'error');
            return null;
        }

        showMessage('');
        return {
            email: email,
            email_confirm: emailConfirm,
            full_name: fullName,
            phone: phone,
            region: region,
        };
    }

    function setSubmitLoading(loading) {
        isSubmitting = loading;
        submitBtn.disabled = loading || !isReady;
        submitBtn.textContent = loading ? 'A processar…' : 'Pagar 9,00 €';
    }

    function setPaymentLoading(loading) {
        if (paymentBlock) {
            paymentBlock.classList.toggle('is-loading', loading);
        }

        submitBtn.disabled = loading || !isReady;
    }

    async function loadStripe() {
        var response = await fetch(getApiBase() + '/api/config');

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
            body: JSON.stringify(payload || {}),
        });

        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
        }

        return data.clientSecret;
    }

    async function syncPaymentIntent(payload) {
        if (!clientSecret || !payload) {
            return;
        }

        await fetch(getApiBase() + '/api/update-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_secret: clientSecret,
                email: payload.email,
                full_name: payload.full_name,
                phone: payload.phone,
                region: payload.region,
            }),
        });
    }

    function getReturnUrl() {
        return getApiBase() + '/checkout9/success.html';
    }

    function getConfirmParams(payload) {
        return {
            return_url: getReturnUrl(),
            receipt_email: payload.email,
        };
    }

    function scrollToFirstFormIssue() {
        var firstInvalid = form.querySelector(':invalid');

        if (firstInvalid && typeof firstInvalid.focus === 'function') {
            firstInvalid.focus();
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                // ignore unmount errors during refresh
            }

            expressCheckoutElement = null;
        }

        expressCheckoutHost.innerHTML = '';
        expressCheckoutElement = elements.create('expressCheckout', {
            buttonHeight: 48,
            emailRequired: true,
            paymentMethodOrder: ['link', 'applePay', 'googlePay'],
            paymentMethods: {
                link: 'auto',
                applePay: 'always',
                googlePay: 'always',
                amazonPay: 'never',
                paypal: 'never',
                klarna: 'never',
            },
        });

        expressCheckoutElement.on('availablePaymentMethodsChange', function (event) {
            var methods = event.availablePaymentMethods || {};
            var hasMethods = Boolean(methods.link || methods.applePay || methods.googlePay);

            updateExpressCheckoutVisibility(hasMethods);
        });

        expressCheckoutElement.on('click', function (event) {
            var payload = validateForm();

            if (!payload) {
                scrollToFirstFormIssue();
                if (typeof event.reject === 'function') {
                    event.reject();
                }
                return;
            }

            syncBillingDefaults();

            if (typeof event.resolve === 'function') {
                event.resolve({
                    emailRequired: true,
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
            syncBillingDefaults();

            var result = await stripe.confirmPayment({
                elements: elements,
                clientSecret: clientSecret,
                confirmParams: getConfirmParams(payload),
            });

            if (result.error) {
                showMessage(result.error.message || 'O pagamento não foi concluído.', 'error');
                setSubmitLoading(false);

                if (event && typeof event.paymentFailed === 'function') {
                    event.paymentFailed({
                        reason: 'fail',
                        message: result.error.message || 'O pagamento não foi concluído.',
                    });
                }
            }
        });

        await expressCheckoutElement.mount('#express-checkout-element');
    }

    async function mountPaymentElement(secret) {
        if (paymentElement) {
            try {
                await paymentElement.unmount();
            } catch (error) {
                // ignore unmount errors during refresh
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
                    '.Label': {
                        fontWeight: '700',
                        fontSize: '0.82rem',
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
                    phone: 'never',
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
    }

    async function refreshPaymentIntentFromEmail() {
        var email = form.email ? form.email.value.trim() : '';

        if (!isValidEmail(email) || email === lastLinkedEmail || isRefreshing) {
            return;
        }

        lastLinkedEmail = email;
        syncBillingDefaults();
    }

    async function initializeCheckout() {
        setPaymentLoading(true);
        showMessage('');

        try {
            await loadStripe();
            var secret = await createPaymentIntent({});
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
        syncBillingDefaults();

        var submitResult = await elements.submit();

        if (submitResult.error) {
            showMessage(submitResult.error.message || 'Verifica os dados de pagamento.', 'error');
            setSubmitLoading(false);
            return;
        }

        var result = await stripe.confirmPayment({
            elements: elements,
            confirmParams: getConfirmParams(payload),
        });

        if (result.error) {
            showMessage(result.error.message || 'O pagamento não foi concluído.', 'error');
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

    if (form.email) {
        form.email.addEventListener('blur', refreshPaymentIntentFromEmail);
    }

    submitBtn.addEventListener('click', submitPayment);
    initializeCheckout();
})();
