(function () {
    var state = {
        email: '',
        mode: 'email',
    };

    var stepEmail = document.getElementById('step-email');
    var stepPassword = document.getElementById('step-password');
    var stepCreatePassword = document.getElementById('step-create-password');
    var stepForgotPassword = document.getElementById('step-forgot-password');
    var loginError = document.getElementById('login-error');
    var loginInfo = document.getElementById('login-info');
    var emailInput = document.getElementById('email');
    var passwordInput = document.getElementById('password');
    var newPasswordInput = document.getElementById('new-password');
    var confirmPasswordInput = document.getElementById('confirm-password');
    var forgotEmailInput = document.getElementById('forgot-email');
    var forgotInfo = document.getElementById('forgot-info');
    var forgotForm = document.getElementById('forgot-form');
    var btnSendReset = document.getElementById('btn-send-reset');

    function resetForgotStep() {
        forgotInfo.hidden = false;
        forgotInfo.className = 'comunidade-alert comunidade-alert--info';
        forgotInfo.textContent = 'Introduz o email da compra. Enviaremos um link para redefinires a password.';
        forgotForm.hidden = false;
        btnSendReset.hidden = false;
    }

    function showError(message) {
        loginError.hidden = false;
        loginError.textContent = message;
    }

    function clearError() {
        loginError.hidden = true;
        loginError.textContent = '';
        loginError.className = 'comunidade-alert comunidade-alert--error';
    }

    function showStep(step) {
        stepEmail.classList.toggle('is-visible', step === 'email');
        stepPassword.classList.toggle('is-visible', step === 'password');
        stepCreatePassword.classList.toggle('is-visible', step === 'create');
        stepForgotPassword.classList.toggle('is-visible', step === 'forgot');
        state.mode = step;
        clearError();
    }

    async function boot() {
        var session = await window.ComunidadeAuth.getSession();

        if (session) {
            window.location.href = '/comunidade';
        }
    }

    async function checkEmail() {
        clearError();
        state.email = emailInput.value.trim().toLowerCase();

        if (!state.email) {
            showError('Introduz o email usado na compra.');
            return;
        }

        var response = await fetch('/api/comunidade/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.email }),
        });

        var data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Não foi possível verificar o email.');
            return;
        }

        if (data.status === 'no_access') {
            showError('Este email não tem acesso. Confirma que usaste o mesmo email da compra.');
            return;
        }

        if (data.status === 'needs_password') {
            showStep('create');
            return;
        }

        loginInfo.textContent = data.role === 'admin'
            ? 'Entrada de administrador para ' + state.email
            : 'Bem-vindo(a) de volta. Introduz a tua password.';

        showStep('password');
    }

    async function login() {
        clearError();

        var client = await window.ComunidadeAuth.getClient();
        var result = await client.auth.signInWithPassword({
            email: state.email,
            password: passwordInput.value,
        });

        if (result.error) {
            showError('Email ou password incorrectos.');
            return;
        }

        window.location.href = '/comunidade';
    }

    async function createPassword() {
        clearError();

        var password = newPasswordInput.value;
        var confirmPassword = confirmPasswordInput.value;

        if (password.length < 8) {
            showError('A password deve ter pelo menos 8 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            showError('As passwords não coincidem.');
            return;
        }

        var response = await fetch('/api/comunidade/set-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: state.email,
                password: password,
            }),
        });

        var data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Não foi possível criar a password.');
            return;
        }

        var client = await window.ComunidadeAuth.getClient();
        var result = await client.auth.signInWithPassword({
            email: state.email,
            password: password,
        });

        if (result.error) {
            showError('Password criada, mas não foi possível entrar automaticamente. Tenta login manual.');
            showStep('password');
            return;
        }

        window.location.href = '/comunidade';
    }

    function openForgotStep(prefillEmail) {
        resetForgotStep();
        forgotEmailInput.value = prefillEmail || state.email || emailInput.value.trim().toLowerCase();
        showStep('forgot');
    }

    async function sendPasswordReset() {
        clearError();

        var email = forgotEmailInput.value.trim().toLowerCase();

        if (!email) {
            showError('Introduz o email usado na compra.');
            return;
        }

        btnSendReset.disabled = true;

        var response = await fetch('/api/comunidade/request-password-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email }),
        });

        var data = await response.json();

        btnSendReset.disabled = false;

        if (!response.ok) {
            showError(data.error || 'Não foi possível enviar o email.');
            return;
        }

        forgotInfo.className = 'comunidade-alert comunidade-alert--info';
        forgotInfo.textContent = data.message || 'Enviámos um email com o link para redefinir a password.';
        forgotForm.hidden = true;
        btnSendReset.hidden = true;
    }

    document.getElementById('btn-check-email').addEventListener('click', checkEmail);
    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('btn-create-password').addEventListener('click', createPassword);
    document.getElementById('btn-forgot-from-email').addEventListener('click', function () {
        openForgotStep(emailInput.value.trim().toLowerCase());
    });
    document.getElementById('btn-forgot-from-password').addEventListener('click', function () {
        openForgotStep(state.email);
    });
    document.getElementById('btn-send-reset').addEventListener('click', sendPasswordReset);
    document.getElementById('btn-back').addEventListener('click', function () {
        showStep('email');
    });
    document.getElementById('btn-back-create').addEventListener('click', function () {
        showStep('email');
    });
    document.getElementById('btn-back-forgot').addEventListener('click', function () {
        resetForgotStep();
        showStep(state.email ? 'password' : 'email');
    });

    boot();
})();
