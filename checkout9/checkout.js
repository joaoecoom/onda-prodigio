(function () {
    var form = document.getElementById('checkout-form');
    var paymentSection = document.getElementById('checkout-payment-section');
    var paymentElementHost = document.getElementById('payment-element');
    var paymentMessage = document.getElementById('payment-message');
    var continueBtn = document.getElementById('continue-to-payment');
    var submitBtn = document.getElementById('submit-payment');
    var paymentActions = document.getElementById('payment-actions');

    if (!form || !paymentSection || !paymentElementHost) {
        return;
    }

    var stripe = null;
    var elements = null;
    var paymentElement = null;
    var clientSecret = null;
    var isInitializing = false;
    var isSubmitting = false;

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

    function setContinueLoading(loading) {
        if (!continueBtn) {
            return;
        }

        continueBtn.disabled = loading;
        continueBtn.textContent = loading ? 'A preparar pagamento…' : 'Continuar para pagamento';
    }

    function setSubmitLoading(loading) {
        if (!submitBtn) {
            return;
        }

        isSubmitting = loading;
        submitBtn.disabled = loading || !clientSecret;
        submitBtn.textContent = loading ? 'A processar…' : 'Pagar 9,00 €';
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
            body: JSON.stringify(payload),
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
                    colorPrimary: '#f04b4b',
                    borderRadius: '4px',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
                },
            },
        });

        paymentElementHost.innerHTML = '';
        paymentElement = elements.create('payment');
        await paymentElement.mount('#payment-element');

        if (paymentActions) {
            paymentActions.hidden = false;
        }

        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }

    async function initializePayment() {
        if (isInitializing || clientSecret) {
            paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        var payload = validateForm();

        if (!payload) {
            form.reportValidity();
            return;
        }

        isInitializing = true;
        setContinueLoading(true);
        showMessage('');

        try {
            if (!stripe) {
                await loadStripe();
            }

            var secret = await createPaymentIntent(payload);
            paymentSection.hidden = false;
            paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            await mountPaymentElement(secret);
        } catch (error) {
            showMessage(error.message || 'Erro ao preparar o pagamento.', 'error');
        } finally {
            isInitializing = false;
            setContinueLoading(false);
        }
    }

    async function submitPayment(event) {
        event.preventDefault();

        if (isSubmitting || !stripe || !elements || !clientSecret) {
            return;
        }

        var payload = validateForm();

        if (!payload) {
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

    if (continueBtn) {
        continueBtn.addEventListener('click', initializePayment);
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', submitPayment);
    }
})();
