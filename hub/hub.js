(function () {
    var TOKEN_KEY = 'hub-dr-ecoom-token';
    var OFFER_KEY = 'hub-selected-offer';

    var loginSection = document.getElementById('hub-login');
    var shellSection = document.getElementById('hub-shell');
    var loginForm = document.getElementById('hub-login-form');
    var loginError = document.getElementById('hub-login-error');
    var passwordInput = document.getElementById('hub-password');
    var offersRoot = document.getElementById('hub-offers');
    var offersCount = document.getElementById('hub-offers-count');
    var modulesTitle = document.getElementById('hub-modules-title');
    var offerSub = document.getElementById('hub-offer-sub');
    var modulesRoot = document.getElementById('hub-modules');
    var statusEl = document.getElementById('hub-status');
    var refreshButton = document.getElementById('hub-refresh');
    var logoutButton = document.getElementById('hub-logout');

    var state = {
        offers: [],
        currentOffer: null,
    };

    function getToken() {
        return sessionStorage.getItem(TOKEN_KEY) || '';
    }

    function setToken(token) {
        sessionStorage.setItem(TOKEN_KEY, token);
    }

    function clearToken() {
        sessionStorage.removeItem(TOKEN_KEY);
    }

    function showStatus(message, isError) {
        if (!message) {
            statusEl.hidden = true;
            statusEl.textContent = '';
            return;
        }

        statusEl.hidden = false;
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#fca5a5' : '#9aa4b2';
    }

    function authHeaders() {
        return {
            Authorization: 'Bearer ' + getToken(),
        };
    }

    async function apiFetch(path) {
        var response = await fetch(path, {
            headers: authHeaders(),
        });

        if (response.status === 401) {
            clearToken();
            showShell(false);
            throw new Error('Sessão expirada. Entra outra vez.');
        }

        var payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || 'Erro ao carregar o HUB.');
        }

        return payload;
    }

    function showShell(isAuthenticated) {
        loginSection.hidden = isAuthenticated;
        shellSection.hidden = !isAuthenticated;
    }

    function moduleIcon(label) {
        return label.slice(0, 2).toUpperCase();
    }

    function badgeForStatus(status) {
        if (status === 'live') {
            return { text: 'Activo', className: 'hub-module__badge hub-module__badge--live' };
        }

        if (status === 'soon') {
            return { text: 'Em breve', className: 'hub-module__badge hub-module__badge--soon' };
        }

        return { text: 'Fase 2', className: 'hub-module__badge' };
    }

    function formatSiteHost(url) {
        if (!url) {
            return 'Sem URL';
        }

        try {
            return new URL(url).host;
        } catch (error) {
            return url;
        }
    }

    function formatCheckouts(offer) {
        var checkouts = offer.checkouts || [];

        if (!checkouts.length) {
            return 'Sem checkouts';
        }

        return checkouts.map(function (checkout) {
            return checkout.label;
        }).join(' + ');
    }

    function renderOffers(selectedSlug) {
        offersRoot.innerHTML = '';

        state.offers.forEach(function (offer, index) {
            var isSelected = offer.slug === selectedSlug;
            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'hub-offer' + (isSelected ? ' hub-offer--active' : '');
            card.dataset.slug = offer.slug;

            var statusLabel = offer.status === 'active' ? 'Activa' : offer.status;
            var metaCount = (offer.meta_accounts || []).length;
            var checkoutSummary = formatCheckouts(offer);

            card.innerHTML =
                '<div class="hub-offer__top">' +
                    '<div class="hub-offer__index">' + String(index + 1).padStart(2, '0') + '</div>' +
                    '<span class="hub-offer__badge hub-offer__badge--live">' + statusLabel + '</span>' +
                '</div>' +
                '<h3 class="hub-offer__name">' + offer.name + '</h3>' +
                '<p class="hub-offer__url">' + formatSiteHost(offer.site_url) + '</p>' +
                '<div class="hub-offer__meta">' +
                    '<span>' + checkoutSummary + '</span>' +
                    '<span>' + metaCount + ' conta Meta</span>' +
                '</div>';

            card.addEventListener('click', function () {
                selectOffer(offer.slug);
            });

            offersRoot.appendChild(card);
        });

        var label = state.offers.length === 1
            ? '1 oferta activa'
            : state.offers.length + ' ofertas activas';

        offersCount.textContent = label;
    }

    function renderModules(modules) {
        modulesRoot.innerHTML = '';

        if (!modules.length) {
            modulesRoot.innerHTML = '<p class="hub-empty">Sem módulos para esta oferta.</p>';
            return;
        }

        modules.forEach(function (module) {
            var badge = badgeForStatus(module.status);
            var card = document.createElement('a');
            card.className = 'hub-module' + (module.status === 'live' ? '' : ' hub-module--disabled');
            card.href = module.status === 'live' ? module.href : '#';

            if (module.status !== 'live') {
                card.setAttribute('aria-disabled', 'true');
            }

            card.innerHTML =
                '<div class="hub-module__top">' +
                    '<div class="hub-module__icon">' + moduleIcon(module.label) + '</div>' +
                    '<span class="' + badge.className + '">' + badge.text + '</span>' +
                '</div>' +
                '<h2>' + module.label + '</h2>' +
                '<p>' + module.description + '</p>' +
                '<span class="hub-module__cta">' +
                    (module.status === 'live' ? 'Abrir módulo →' : 'Disponível na próxima fase') +
                '</span>';

            modulesRoot.appendChild(card);
        });
    }

    function getInitialSlug() {
        var saved = sessionStorage.getItem(OFFER_KEY);
        var savedOffer = state.offers.find(function (offer) {
            return offer.slug === saved;
        });

        if (savedOffer) {
            return savedOffer.slug;
        }

        return state.offers[0] ? state.offers[0].slug : '';
    }

    async function loadOfferDetail(slug) {
        var payload = await apiFetch('/api/hub/offer/' + encodeURIComponent(slug));
        state.currentOffer = payload.offer;
        sessionStorage.setItem(OFFER_KEY, payload.offer.slug);

        modulesTitle.textContent = 'Módulos — ' + payload.offer.name;
        offerSub.textContent = formatSiteHost(payload.offer.site_url) + ' · ' + formatCheckouts(payload.offer);
        renderOffers(payload.offer.slug);
        renderModules(payload.offer.modules || []);
        showStatus('');
    }

    async function selectOffer(slug) {
        if (!slug || slug === (state.currentOffer && state.currentOffer.slug)) {
            renderOffers(slug);
            return;
        }

        showStatus('A carregar oferta…');
        await loadOfferDetail(slug);
    }

    async function bootstrapShell() {
        showShell(true);
        showStatus('A carregar ofertas…');

        var payload = await apiFetch('/api/hub/offers');
        state.offers = payload.offers || [];

        if (!state.offers.length) {
            offersRoot.innerHTML = '<p class="hub-empty">Nenhuma oferta encontrada.</p>';
            offersCount.textContent = '0 ofertas';
            showStatus('Nenhuma oferta encontrada.', true);
            return;
        }

        var slug = getInitialSlug();
        await loadOfferDetail(slug);
    }

    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        loginError.hidden = true;

        var password = passwordInput.value.trim();

        if (!password) {
            loginError.textContent = 'Introduz a palavra-passe.';
            loginError.hidden = false;
            return;
        }

        setToken(password);

        try {
            await bootstrapShell();
            passwordInput.value = '';
        } catch (error) {
            clearToken();
            loginError.textContent = error.message;
            loginError.hidden = false;
        }
    });

    refreshButton.addEventListener('click', async function () {
        try {
            showStatus('A actualizar…');
            await bootstrapShell();
        } catch (error) {
            showStatus(error.message, true);
        }
    });

    logoutButton.addEventListener('click', function () {
        clearToken();
        sessionStorage.removeItem(OFFER_KEY);
        showShell(false);
        showStatus('');
    });

    if (getToken()) {
        bootstrapShell().catch(function () {
            clearToken();
            showShell(false);
        });
    } else {
        showShell(false);
    }
})();
