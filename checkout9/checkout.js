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

    async function mountPaymentElement(secret) {
        clientSecret = secret;
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
            paymentMethodOrder: ['mb_way', 'multibanco', 'card', 'klarna', 'link'],
            defaultValues: {
                billingDetails: {
                    address: {
                        country: 'PT',
                    },
                },
            },
        });

        await paymentElement.mount('#payment-element');
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
            var firstInvalid = form.querySelector(':invalid');

            if (firstInvalid && typeof firstInvalid.focus === 'function') {
                firstInvalid.focus();
            }

            return;
        }

        setSubmitLoading(true);
        showMessage('');

        var returnUrl = getApiBase() + '/checkout9/success.html';

        var result = await stripe.confirmPayment({
            elements: elements,
            confirmParams: {
                return_url: returnUrl,
                receipt_email: payload.email,
                payment_method_data: {
                    billing_details: {
                        name: payload.full_name,
                        email: payload.email,
                        phone: '+351' + payload.phone,
                    },
                },
            },
        });

        if (result.error) {
            showMessage(result.error.message || 'O pagamento não foi concluído.', 'error');
            setSubmitLoading(false);
        }
    }

    submitBtn.addEventListener('click', submitPayment);
    initializeCheckout();
})();
