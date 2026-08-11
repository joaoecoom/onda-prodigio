(function () {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token') || '';

    var stepLoading = document.getElementById('step-reset-loading');
    var stepForm = document.getElementById('step-reset-form');
    var stepInvalid = document.getElementById('step-reset-invalid');
    var resetError = document.getElementById('reset-error');
    var resetInfo = document.getElementById('reset-info');
    var resetEmailInput = document.getElementById('reset-email');
    var resetPasswordInput = document.getElementById('reset-password');
    var resetPasswordConfirmInput = document.getElementById('reset-password-confirm');

    function showStep(step) {
        stepLoading.classList.toggle('is-visible', step === 'loading');
        stepForm.classList.toggle('is-visible', step === 'form');
        stepInvalid.classList.toggle('is-visible', step === 'invalid');
    }

    function showError(message) {
        resetError.hidden = false;
        resetError.textContent = message;
    }

    function clearError() {
        resetError.hidden = true;
        resetError.textContent = '';
    }

    async function validateToken() {
        if (!token) {
            showStep('invalid');
            return;
        }

        var response = await fetch('/api/comunidade/verify-reset-token?token=' + encodeURIComponent(token));
        var data = await response.json();

        if (!response.ok || !data.valid) {
            showStep('invalid');
            return;
        }

        resetEmailInput.value = data.email || '';
        showStep('form');
    }

    async function submitReset() {
        clearError();

        var password = resetPasswordInput.value;
        var confirmPassword = resetPasswordConfirmInput.value;
        var email = resetEmailInput.value.trim().toLowerCase();

        if (password.length < 8) {
            showError('A password deve ter pelo menos 8 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            showError('As passwords não coincidem.');
            return;
        }

        var response = await fetch('/api/comunidade/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                password: password,
            }),
        });

        var data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Não foi possível redefinir a password.');
            return;
        }

        resetInfo.hidden = false;
        resetInfo.textContent = 'Password actualizada. A entrar…';

        var client = await window.ComunidadeAuth.getClient();
        var result = await client.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (result.error) {
            window.location.href = '/comunidade/login';
            return;
        }

        window.location.href = '/comunidade';
    }

    document.getElementById('btn-reset-password').addEventListener('click', function () {
        submitReset().catch(function () {
            showError('Erro de ligação. Tenta outra vez.');
        });
    });

    validateToken().catch(function () {
        showStep('invalid');
    });
})();
