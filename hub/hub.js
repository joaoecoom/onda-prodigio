(function () {
    var TOKEN_KEY = 'onda-metrics-token';
    var OFFER_KEY = 'hub-selected-offer';
    var HUB_HOST = String(window.HUB_PLATFORM_HOST || 'hub-dr-ecoom.vercel.app').toLowerCase();

    var loginSection = document.getElementById('hub-login');
    var shellSection = document.getElementById('hub-shell');
    var loginForm = document.getElementById('hub-login-form');
    var loginError = document.getElementById('hub-login-error');
    var passwordInput = document.getElementById('hub-password');
    var pageTitle = document.getElementById('hub-page-title');
    var pageSub = document.getElementById('hub-page-sub');
    var listView = document.getElementById('hub-view-list');
    var offerView = document.getElementById('hub-view-offer');
    var offersRoot = document.getElementById('hub-offers');
    var offersCount = document.getElementById('hub-offers-count');
    var offerHead = document.getElementById('hub-offer-head');
    var modulesRoot = document.getElementById('hub-modules');
    var statusEl = document.getElementById('hub-status');
    var backButton = document.getElementById('hub-back');
    var refreshButton = document.getElementById('hub-refresh');
    var logoutButton = document.getElementById('hub-logout');

    var state = {
        offers: [],
        currentOffer: null,
        view: 'list',
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

    function authHeaders(tokenOverride) {
        return {
            Authorization: 'Bearer ' + (tokenOverride || getToken()),
            'Content-Type': 'application/json',
        };
    }

    async function apiFetch(path, options, tokenOverride) {
        var config = options || {};
        var headers = authHeaders(tokenOverride);

        if (config.body) {
            headers['Content-Type'] = 'application/json';
        }

        var response = await fetch(path, {
            method: config.method || 'GET',
            headers: headers,
            body: config.body ? JSON.stringify(config.body) : undefined,
        });

        if (response.status === 401) {
            clearToken();
            showShell(false);
            throw new Error('Palavra-passe incorrecta.');
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

    function setView(view) {
        state.view = view;
        listView.hidden = view !== 'list';
        offerView.hidden = view !== 'offer';
        backButton.hidden = view !== 'offer';

        if (view === 'list') {
            pageTitle.textContent = 'Ofertas';
            pageSub.textContent = 'Selecciona uma oferta para gerir tudo dentro dela.';
        }
    }

    function updateUrl(slug) {
        var url = new URL(window.location.href);

        if (slug) {
            url.searchParams.set('offer', slug);
        } else {
            url.searchParams.delete('offer');
        }

        window.history.replaceState({}, '', url.pathname + url.search);
    }

    function moduleIcon(label) {
        return label.slice(0, 2).toUpperCase();
    }

    function badgeForOffer(offer) {
        if (offer.status === 'active') {
            return { text: 'Activa', className: 'hub-offer__badge hub-offer__badge--live' };
        }

        if (offer.status === 'draft') {
            return { text: 'Rascunho', className: 'hub-offer__badge hub-offer__badge--draft' };
        }

        return { text: offer.status, className: 'hub-offer__badge' };
    }

    function badgeForStatus(status) {
        if (status === 'live') {
            return { text: 'Activo', className: 'hub-module__badge hub-module__badge--live' };
        }

        if (status === 'soon') {
            return { text: 'A configurar', className: 'hub-module__badge hub-module__badge--soon' };
        }

        return { text: 'Fase 2', className: 'hub-module__badge' };
    }

    function formatSiteHost(url) {
        if (!url) {
            return '';
        }

        try {
            return new URL(url).host;
        } catch (error) {
            return url;
        }
    }

    function getFunnelHost(offer) {
        if (offer.funnel_domain) {
            return offer.funnel_domain;
        }

        return formatSiteHost(offer.funnel_url || offer.site_url);
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

    function renderCreateCard() {
        var card = document.createElement('article');
        card.className = 'hub-offer hub-offer--create';

        card.innerHTML =
            '<div class="hub-offer__top">' +
                '<div class="hub-offer__index">+</div>' +
                '<span class="hub-offer__badge">Nova</span>' +
            '</div>' +
            '<h3 class="hub-offer__name">Nova oferta</h3>' +
            '<p class="hub-offer__url">Espaço virgem — funil, tracking, métricas e automações.</p>' +
            '<form class="hub-create-form" id="hub-create-form">' +
                '<input class="hub-login__input" id="hub-create-name" type="text" placeholder="Nome da oferta" required>' +
                '<input class="hub-login__input" id="hub-create-domain" type="text" placeholder="Domínio funil (opcional)">' +
                '<button class="hub-login__button" type="submit">Criar oferta</button>' +
                '<p class="hub-create-form__error" id="hub-create-error" hidden></p>' +
            '</form>';

        var form = card.querySelector('#hub-create-form');
        form.addEventListener('submit', handleCreateOffer);

        return card;
    }

    function renderOffersList() {
        offersRoot.innerHTML = '';

        state.offers.forEach(function (offer, index) {
            var badge = badgeForOffer(offer);
            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'hub-offer';
            card.dataset.slug = offer.slug;

            var funnelHost = getFunnelHost(offer) || 'Funil por configurar';
            var checkoutSummary = formatCheckouts(offer);
            var metaCount = (offer.meta_accounts || []).length;

            card.innerHTML =
                '<div class="hub-offer__top">' +
                    '<div class="hub-offer__index">' + String(index + 1).padStart(2, '0') + '</div>' +
                    '<span class="' + badge.className + '">' + badge.text + '</span>' +
                '</div>' +
                '<h3 class="hub-offer__name">' + offer.name + '</h3>' +
                '<p class="hub-offer__url">Funil · ' + funnelHost + '</p>' +
                '<div class="hub-offer__meta">' +
                    '<span>' + checkoutSummary + '</span>' +
                    '<span>' + metaCount + ' conta Meta</span>' +
                '</div>' +
                '<span class="hub-offer__cta">Entrar na oferta →</span>';

            card.addEventListener('click', function () {
                openOffer(offer.slug);
            });

            offersRoot.appendChild(card);
        });

        offersRoot.appendChild(renderCreateCard());

        var activeCount = state.offers.filter(function (offer) {
            return offer.status === 'active';
        }).length;

        offersCount.textContent = state.offers.length + ' oferta' + (state.offers.length === 1 ? '' : 's') +
            ' · ' + activeCount + ' activa' + (activeCount === 1 ? '' : 's');
    }

    function renderOfferHead(offer) {
        var badge = badgeForOffer(offer);
        var funnelHost = getFunnelHost(offer) || 'Funil por configurar';

        offerHead.innerHTML =
            '<div class="hub-offer-head__top">' +
                '<span class="' + badge.className + '">' + badge.text + '</span>' +
            '</div>' +
            '<h2 class="hub-offer-head__name">' + offer.name + '</h2>' +
            '<p class="hub-offer-head__sub">Funil · ' + funnelHost + ' · ' + formatCheckouts(offer) + '</p>' +
            '<p class="hub-offer-head__hint">Tudo o que vês abaixo pertence a esta oferta — dashboard, tracking, recuperação, comunidade e integrações.</p>';
    }

    function renderModules(modules) {
        modulesRoot.innerHTML = '';

        modules.forEach(function (module) {
            var badge = badgeForStatus(module.status);
            var card = document.createElement('a');
            card.className = 'hub-module' + (module.status === 'live' ? '' : ' hub-module--disabled');
            card.href = module.status === 'live' ? module.href : '#';

            if (module.status !== 'live') {
                card.setAttribute('aria-disabled', 'true');
            }

            if (module.external && module.status === 'live') {
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
            }

            card.innerHTML =
                '<div class="hub-module__top">' +
                    '<div class="hub-module__icon">' + moduleIcon(module.label) + '</div>' +
                    '<span class="' + badge.className + '">' + badge.text + '</span>' +
                '</div>' +
                '<h2>' + module.label + '</h2>' +
                '<p>' + module.description + '</p>' +
                '<span class="hub-module__cta">' +
                    (module.status === 'live'
                        ? (module.external ? 'Abrir funil ↗' : 'Abrir módulo →')
                        : 'Pronto a configurar') +
                '</span>';

            modulesRoot.appendChild(card);
        });
    }

    async function loadOffers(tokenOverride) {
        var payload = await apiFetch('/api/sales-attribution?action=hub_offers', null, tokenOverride);
        state.offers = payload.offers || [];
        renderOffersList();
    }

    async function openOffer(slug, tokenOverride) {
        showStatus('A carregar oferta…');

        var payload = await apiFetch(
            '/api/sales-attribution?action=hub_offer&slug=' + encodeURIComponent(slug),
            null,
            tokenOverride
        );

        state.currentOffer = payload.offer;
        sessionStorage.setItem(OFFER_KEY, payload.offer.slug);
        pageTitle.textContent = payload.offer.name;
        pageSub.textContent = 'Gerir tudo desta oferta num só sítio.';
        renderOfferHead(payload.offer);
        renderModules(payload.offer.modules || []);
        setView('offer');
        updateUrl(payload.offer.slug);
        showStatus('');
    }

    async function bootstrapShell(tokenOverride, openSlug) {
        await loadOffers(tokenOverride);

        if (openSlug) {
            await openOffer(openSlug, tokenOverride);
            return;
        }

        setView('list');
        updateUrl('');
    }

    async function handleCreateOffer(event) {
        event.preventDefault();

        var form = event.currentTarget;
        var nameInput = form.querySelector('#hub-create-name');
        var domainInput = form.querySelector('#hub-create-domain');
        var errorEl = form.querySelector('#hub-create-error');
        var name = nameInput.value.trim();
        var funnelDomain = domainInput.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

        errorEl.hidden = true;

        if (!name) {
            errorEl.textContent = 'Introduz o nome da oferta.';
            errorEl.hidden = false;
            return;
        }

        try {
            showStatus('A criar oferta…');
            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_create_offer',
                {
                    method: 'POST',
                    body: {
                        name: name,
                        funnel_domain: funnelDomain,
                    },
                }
            );

            nameInput.value = '';
            domainInput.value = '';
            await loadOffers();
            await openOffer(payload.offer.slug);
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.hidden = false;
            showStatus('');
        }
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
            showShell(true);
            var params = new URLSearchParams(window.location.search);
            await bootstrapShell(password, params.get('offer'));
            passwordInput.value = '';
        } catch (error) {
            clearToken();
            showShell(false);
            loginError.textContent = error.message || 'Não foi possível entrar.';
            loginError.hidden = false;
        }
    });

    backButton.addEventListener('click', function () {
        state.currentOffer = null;
        setView('list');
        updateUrl('');
        showStatus('');
    });

    refreshButton.addEventListener('click', async function () {
        try {
            showStatus('A actualizar…');

            if (state.view === 'offer' && state.currentOffer) {
                await openOffer(state.currentOffer.slug);
            } else {
                await bootstrapShell();
            }
        } catch (error) {
            showStatus(error.message, true);
        }
    });

    logoutButton.addEventListener('click', function () {
        clearToken();
        sessionStorage.removeItem(OFFER_KEY);
        showShell(false);
        setView('list');
        showStatus('');
    });

    if (getToken()) {
        showShell(true);
        var savedOffer = new URLSearchParams(window.location.search).get('offer') ||
            sessionStorage.getItem(OFFER_KEY);
        bootstrapShell(null, savedOffer).catch(function () {
            clearToken();
            showShell(false);
        });
    } else {
        showShell(false);
    }
})();
