(function () {
    var TOKEN_KEY = 'onda-metrics-token';
    var root = document.getElementById('hub-enter');
    var statusEl = document.getElementById('hub-enter-status');
    var params = new URLSearchParams(window.location.search);
    var offerSlug = params.get('offer') || 'onda-prodigio';
    var handoffId = params.get('handoff');

    function showError(message) {
        if (root) {
            root.classList.add('is-error');
        }

        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    function readHubToken() {
        try {
            var own = window.sessionStorage.getItem(TOKEN_KEY);

            if (own) {
                return own;
            }

            if (window.parent && window.parent !== window) {
                var parentToken = window.parent.sessionStorage.getItem(TOKEN_KEY);

                if (parentToken) {
                    return parentToken;
                }
            }

            if (window.top && window.top !== window) {
                return window.top.sessionStorage.getItem(TOKEN_KEY) || '';
            }
        } catch (error) {
            return '';
        }

        return '';
    }

    async function applySessionAndRedirect(data) {
        if (!window.ComunidadeAuth) {
            showError('Autenticação da comunidade indisponível.');
            return;
        }

        var client = await window.ComunidadeAuth.getClient();

        try {
            await client.auth.signOut();
        } catch (error) {
            /* ignora — vamos substituir a sessão */
        }

        var sessionResult = await client.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
        });

        if (sessionResult.error) {
            showError(sessionResult.error.message || 'Não foi possível guardar a sessão.');
            return;
        }

        try {
            window.sessionStorage.setItem('comunidade-gestor', '1');
            window.sessionStorage.setItem('comunidade-offer', data.offer_slug || offerSlug || '');
        } catch (storageError) {
            /* ignore */
        }

        var target = String(data.community_url || '/comunidade/').replace(/\/?$/, '/');
        var resolvedOffer = data.offer_slug || offerSlug;

        if (resolvedOffer) {
            target += '?offer=' + encodeURIComponent(resolvedOffer);
        }

        window.location.replace(target);
    }

    async function bootWithHandoff() {
        try {
            var response = await fetch(
                '/api/comunidade/hub-admin-handoff?handoff=' + encodeURIComponent(handoffId)
            );
            var data = await response.json();

            if (!response.ok) {
                showError(data.error || 'Não foi possível abrir a comunidade.');
                return;
            }

            await applySessionAndRedirect(data);
        } catch (error) {
            showError(error.message || 'Erro de ligação.');
        }
    }

    async function bootWithHubToken() {
        var hubToken = readHubToken();

        if (!hubToken) {
            showError('Sessão do HUB em falta. Volta ao HUB e entra outra vez.');
            return;
        }

        try {
            var response = await fetch('/api/comunidade/hub-admin-session', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + hubToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ offer: offerSlug }),
            });

            var data = await response.json();

            if (!response.ok) {
                showError(data.error || 'Não foi possível abrir a comunidade.');
                return;
            }

            if (data.enter_url && data.enter_url !== window.location.href.split('#')[0]) {
                window.location.replace(data.enter_url);
                return;
            }

            await applySessionAndRedirect(data);
        } catch (error) {
            showError(error.message || 'Erro de ligação.');
        }
    }

    async function boot() {
        if (handoffId) {
            await bootWithHandoff();
            return;
        }

        await bootWithHubToken();
    }

    boot();
})();
