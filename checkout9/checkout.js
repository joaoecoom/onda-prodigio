(function () {
    var form = document.getElementById('checkout-form');
    var paymentElementHost = document.getElementById('payment-element');
    var paymentMessage = document.getElementById('payment-message');
    var submitBtn = document.getElementById('submit-payment');
    var paymentBlock = document.getElementById('checkout-payment-block');

    if (!form || !paymentElementHost || !submitBtn) {
        return;
    }

    var stripe = null;
    var elements = null;
    var paymentElement = null;
    var clientSecret = null;
    var isSubmitting = false;
    var isReady = false;

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

    function formatPhoneE164(phone) {
        var digits = normalizePhone(phone);

        if (!digits) {
            return undefined;
        }

        if (digits.indexOf('351') === 0 && digits.length >= 12) {
            return '+' + digits;
        }

        return '+351' + digits;
    }

    function getConfirmParams(payload) {
        return {
            return_url: getReturnUrl(),
            receipt_email: payload.email,
            payment_method_data: {
                billing_details: {
                    name: payload.full_name,
                    email: payload.email,
                    phone: formatPhoneE164(payload.phone),
                    address: {
                        country: 'PT',
                    },
                },
            },
        };
    }

    function getBillingDefaults() {
        var email = form.email ? form.email.value.trim() : '';
        var fullName = form.full_name ? form.full_name.value.trim() : '';

        return {
            billingDetails: {
                email: email || undefined,
                name: fullName || undefined,
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

    function scrollToFirstFormIssue() {
        var firstInvalid = form.querySelector(':invalid');

        if (firstInvalid && typeof firstInvalid.focus === 'function') {
            firstInvalid.focus();
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function getReturnUrl() {
        return getApiBase() + '/checkout9/success.html';
    }

    function redirectToSuccess() {
        window.location.href = getReturnUrl();
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
        var response = await fetch(getApiBase() + '/api/update-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_secret: clientSecret,
                email: payload.email,
                email_confirm: payload.email_confirm,
                full_name: payload.full_name,
                phone: payload.phone,
                region: payload.region,
            }),
        });

        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível actualizar o pagamento.');
        }
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
                    phone: 'never',
                    address: {
                        country: 'never',
                    },
                },
            },
            defaultValues: getBillingDefaults(),
        });

        await paymentElement.mount('#payment-element');
        syncBillingDefaults();
        isReady = true;
        submitBtn.disabled = false;
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

        try {
            syncBillingDefaults();
            await syncPaymentIntent(payload);

            var submitResult = await elements.submit();

            if (submitResult.error) {
                showMessage(submitResult.error.message || 'Verifica o método de pagamento seleccionado.', 'error');
                return;
            }

            var result = await stripe.confirmPayment({
                elements: elements,
                confirmParams: getConfirmParams(payload),
                redirect: 'if_required',
            });

            if (result.error) {
                showMessage(result.error.message || 'O pagamento não foi concluído.', 'error');
                return;
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

    ['email', 'full_name', 'phone'].forEach(function (fieldName) {
        var field = form[fieldName];

        if (!field) {
            return;
        }

        field.addEventListener('input', syncBillingDefaults);
        field.addEventListener('blur', syncBillingDefaults);
    });

    submitBtn.addEventListener('click', submitPayment);
    initializeCheckout();
})();
