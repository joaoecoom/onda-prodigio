(function () {
    var TOKEN_KEY = 'onda-metrics-token';

    (function migrateAuthTokenToLocalStorage() {
        var session = sessionStorage.getItem(TOKEN_KEY);

        if (session && !localStorage.getItem(TOKEN_KEY)) {
            localStorage.setItem(TOKEN_KEY, session);
        }
    })();

    var NAV_INTENT_KEY = 'hub-nav-intent';
    var HUB_HOST = String(window.HUB_PLATFORM_HOST || 'hub-dr-ecoom.vercel.app').toLowerCase();

    var SIDEBAR_COLLAPSED_KEY = 'hub-sidebar-collapsed';

    var PLATFORM_NAV = [
        { id: 'home', label: 'Início', icon: 'home' },
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'offers', label: 'Ofertas', icon: 'offers' },
        { id: 'settings', label: 'Definições', icon: 'definicoes' },
    ];

    var NAV_GROUPS = [
        {
            id: 'visao',
            label: 'Visão geral',
            items: [
                { type: 'home', id: 'home', label: 'Overview' },
                { type: 'module', id: 'dashboard', label: 'Vendas' },
            ],
        },
        {
            id: 'construir',
            label: 'Construir',
            items: [
                { type: 'module', id: 'funil', label: 'Funis' },
                { type: 'module', id: 'comunidade', label: 'Comunidade' },
            ],
        },
        {
            id: 'crescer',
            label: 'Crescer',
            items: [
                { type: 'module', id: 'tracking', label: 'Tracking' },
                { type: 'module', id: 'recupera', label: 'Recuperação' },
                { type: 'module', id: 'impulsiona', label: 'Automações' },
            ],
        },
        {
            id: 'inteligencia',
            label: 'Inteligência',
            items: [
                { type: 'module', id: 'ai-agent', label: 'AI Agent' },
            ],
        },
        {
            id: 'sistema',
            label: 'Sistema',
            items: [
                { type: 'module', id: 'integracoes', label: 'Integrações' },
                { type: 'module', id: 'dominios', label: 'Domínios' },
                { type: 'module', id: 'definicoes', label: 'Definições' },
            ],
        },
    ];

    var loginSection = document.getElementById('hub-login');
    var shellSection = document.getElementById('hub-shell');
    var loginForm = document.getElementById('hub-login-form');
    var loginError = document.getElementById('hub-login-error');
    var passwordInput = document.getElementById('hub-password');
    var breadcrumbEl = document.getElementById('hub-breadcrumb');
    var shellEl = document.getElementById('hub-shell');
    var sidebarEl = document.getElementById('hub-sidebar');
    var sidebarToggle = document.getElementById('hub-sidebar-toggle');
    var sidebarLogo = document.getElementById('hub-sidebar-logo');
    var offerSwitcher = document.getElementById('hub-offer-switcher');
    var offerSwitcherTrigger = document.getElementById('hub-offer-switcher-trigger');
    var offerSwitcherMenu = document.getElementById('hub-offer-switcher-menu');
    var switcherAvatar = document.getElementById('hub-switcher-avatar');
    var switcherName = document.getElementById('hub-switcher-name');
    var switcherStatus = document.getElementById('hub-switcher-status');
    var commandTrigger = document.getElementById('hub-command-trigger');
    var listView = document.getElementById('hub-view-list');
    var homeView = document.getElementById('hub-view-home');
    var moduleView = document.getElementById('hub-view-module');
    var homeRoot = document.getElementById('hub-home');
    var sidebarNav = document.getElementById('hub-sidebar-nav');
    var sidebarHome = document.getElementById('hub-sidebar-home');
    var sidebarContext = document.getElementById('hub-sidebar-context');
    var sidebarOffersBtn = document.getElementById('hub-sidebar-offers');
    var offersRoot = document.getElementById('hub-offers');
    var offersCount = document.getElementById('hub-offers-count');
    var platformHero = document.getElementById('hub-platform-hero');
    var platformPanelHome = document.getElementById('hub-platform-panel-home');
    var platformPanelDashboard = document.getElementById('hub-platform-panel-dashboard');
    var platformPanelOffers = document.getElementById('hub-platform-panel-offers');
    var platformPanelSettings = document.getElementById('hub-platform-panel-settings');
    var platformMetricsHome = document.getElementById('hub-platform-metrics-home');
    var platformMetricsDashboard = document.getElementById('hub-platform-metrics-dashboard');
    var platformSettingsRoot = document.getElementById('hub-platform-settings');
    var modulePanel = document.getElementById('hub-module-panel');
    var statusEl = document.getElementById('hub-status');
    var refreshButton = document.getElementById('hub-refresh');
    var logoutButton = document.getElementById('hub-logout');
    var wizardOverlay = document.getElementById('hub-wizard-overlay');
    var wizardStepsEl = document.getElementById('hub-wizard-steps');
    var wizardBodyEl = document.getElementById('hub-wizard-body');
    var wizardFootEl = document.getElementById('hub-wizard-foot');
    var wizardCloseBtn = document.getElementById('hub-wizard-close');

    var state = {
        offers: [],
        currentOffer: null,
        currentModules: [],
        currentModule: null,
        moduleNavKey: null,
        platformMetrics: null,
        offerMetrics: null,
        launchReadiness: null,
        geminiStatus: null,
        platformSection: 'home',
        view: 'list',
        wizard: {
            open: false,
            step: 1,
            slug: null,
            data: null,
            busy: false,
        },
    };

    function chatContext() {
        return {
            view: state.view,
            offer: state.currentOffer,
            module: state.currentModule,
        };
    }

    function refreshHubChat() {
        if (window.HubChat) {
            window.HubChat.refresh();
        }
    }

    async function refreshGeminiStatus() {
        try {
            var payload = await apiFetch('/api/sales-attribution?action=hub_gemini_status');
            state.geminiStatus = payload.gemini || { configured: false };
        } catch (error) {
            state.geminiStatus = { configured: false, error: error.message };
        }

        return state.geminiStatus;
    }

    function isGeminiConfigured(moduleData) {
        if (moduleData && moduleData.gemini && moduleData.gemini.configured) {
            return true;
        }

        return Boolean(state.geminiStatus && state.geminiStatus.configured);
    }

    function mountGeminiPanel(container, options) {
        if (!container) {
            return;
        }

        if (!window.HubGemini) {
            container.innerHTML =
                '<div class="dr-alert dr-alert--warning">' +
                    '<div class="dr-alert__body">' +
                        '<strong>Assistente Gemini indisponível</strong>' +
                        '<p>Recarrega a página (Cmd+Shift+R) para actualizar os scripts do HUB.</p>' +
                    '</div>' +
                '</div>';
            return;
        }

        window.HubGemini.mount(container, Object.assign({
            offer: state.currentOffer,
            apiFetch: apiFetch,
            geminiConfigured: isGeminiConfigured(options && options.moduleData),
            onStatus: showStatus,
        }, options || {}));
    }

    function setNavIntent(slug, moduleId, navKey) {
        sessionStorage.setItem(NAV_INTENT_KEY, JSON.stringify({
            slug: slug,
            module: moduleId || null,
            navKey: navKey || null,
        }));
    }

    function getNavIntent() {
        try {
            return JSON.parse(sessionStorage.getItem(NAV_INTENT_KEY) || 'null');
        } catch (error) {
            return null;
        }
    }

    function clearNavIntent() {
        sessionStorage.removeItem(NAV_INTENT_KEY);
    }

    function readBootstrapTarget() {
        var params = new URLSearchParams(window.location.search);
        var offerParam = String(params.get('offer') || '').trim();
        var moduleParam = String(params.get('module') || '').trim();
        var intent = getNavIntent();
        var path = window.location.pathname.replace(/\/$/, '');

        var pathModuleMap = {
            '/funil': 'funil',
            '/checkout-builder': 'checkout',
            '/integracoes': 'integracoes',
            '/tracking': 'tracking',
            '/ai-agent': 'ai-agent',
            '/recupera': 'recupera',
            '/impulsiona': 'impulsiona',
            '/dominios': 'dominios',
            '/definicoes': 'definicoes',
        };

        if (offerParam && pathModuleMap[path]) {
            return {
                slug: offerParam,
                module: pathModuleMap[path],
                reason: 'module-path',
            };
        }

        if (offerParam && moduleParam) {
            return {
                slug: offerParam,
                module: moduleParam,
                reason: 'deep-link',
            };
        }

        if (intent && intent.slug && offerParam && intent.slug === offerParam) {
            return {
                slug: intent.slug,
                module: intent.module || null,
                navKey: intent.navKey || null,
                reason: 'session-refresh',
            };
        }

        return null;
    }

    function getToken() {
        var local = localStorage.getItem(TOKEN_KEY);

        if (local) {
            return local;
        }

        var session = sessionStorage.getItem(TOKEN_KEY);

        if (session) {
            localStorage.setItem(TOKEN_KEY, session);
            return session;
        }

        return '';
    }

    function setToken(token) {
        localStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(TOKEN_KEY, token);
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
    }

    function showStatus(message, isError) {
        if (!message) {
            statusEl.hidden = true;
            statusEl.textContent = '';
            statusEl.className = 'hub-status';
            return;
        }

        statusEl.hidden = false;
        statusEl.textContent = message;
        statusEl.className = 'hub-status' + (isError ? ' is-error' : ' is-info');
    }

    function navIcon(key) {
        if (window.PlatformIcons) {
            return window.PlatformIcons.moduleIcon(key);
        }

        return '<span class="dr-icon">•</span>';
    }

    function iconSvg(name) {
        if (window.PlatformIcons) {
            return window.PlatformIcons.svg(name);
        }

        return '';
    }

    function applyStaticIcons(root) {
        var scope = root || document;

        scope.querySelectorAll('[data-icon]').forEach(function (el) {
            var name = el.getAttribute('data-icon');

            if (window.PlatformIcons) {
                el.innerHTML = window.PlatformIcons.svg(name).replace(/^<span[^>]*>|<\/span>$/g, '');
            }
        });
    }

    function isSidebarCollapsed() {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    }

    function updateSidebarToggleUi(collapsed) {
        if (!sidebarToggle) {
            return;
        }

        var iconName = collapsed ? 'chevronRight' : 'panelLeft';
        var label = collapsed ? 'Expandir menu' : 'Recolher menu';
        var iconEl = sidebarToggle.querySelector('.hub-sidebar__collapse-icon');
        var labelEl = sidebarToggle.querySelector('.hub-sidebar__collapse-label');

        sidebarToggle.setAttribute('aria-label', label);
        sidebarToggle.setAttribute('title', label);

        if (labelEl) {
            labelEl.textContent = label;
        }

        if (iconEl && window.PlatformIcons) {
            iconEl.innerHTML = window.PlatformIcons.svg(iconName)
                .replace(/^<span[^>]*>|<\/span>$/g, '');
        }

        if (sidebarLogo) {
            sidebarLogo.title = collapsed ? 'Expandir sidebar' : '';
        }
    }

    function setSidebarCollapsed(collapsed) {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');

        if (shellEl) {
            shellEl.classList.toggle('hub-shell--collapsed', collapsed);
        }

        if (sidebarEl) {
            sidebarEl.classList.toggle('hub-sidebar--collapsed', collapsed);
        }

        updateSidebarToggleUi(collapsed);
    }

    function renderBreadcrumb() {
        if (!breadcrumbEl) {
            return;
        }

        var parts = [];

        if (state.view === 'list') {
            var section = PLATFORM_NAV.find(function (entry) {
                return entry.id === state.platformSection;
            }) || PLATFORM_NAV[0];
            parts.push('<span class="hub-breadcrumb__current">' + escapeHtml(section.label) + '</span>');
        } else if (state.currentOffer) {
            parts.push('<button type="button" class="hub-breadcrumb__link" data-bc="list">Plataforma</button>');
            parts.push('<span class="hub-breadcrumb__sep" aria-hidden="true">/</span>');
            parts.push('<button type="button" class="hub-breadcrumb__link" data-bc="home">' +
                escapeHtml(state.currentOffer.name) + '</button>');

            if (state.view === 'module' && state.currentModule) {
                var mod = findModule(state.currentModule);
                var moduleLabel = mod ? mod.label : state.currentModule;

                parts.push('<span class="hub-breadcrumb__sep" aria-hidden="true">/</span>');
                parts.push('<span class="hub-breadcrumb__current">' +
                    escapeHtml(moduleLabel) + '</span>');
            } else if (state.view === 'home') {
                parts.push('<span class="hub-breadcrumb__sep" aria-hidden="true">/</span>');
                parts.push('<span class="hub-breadcrumb__current">Overview</span>');
            }
        }

        breadcrumbEl.innerHTML = parts.join('');

        breadcrumbEl.querySelectorAll('[data-bc]').forEach(function (button) {
            button.addEventListener('click', function () {
                var target = button.getAttribute('data-bc');

                if (target === 'list') {
                    sidebarOffersBtn.click();
                    return;
                }

                if (target === 'home') {
                    goOfferHome();
                }
            });
        });
    }

    function offerStatusClass(status) {
        if (status === 'active') {
            return 'dr-status--live';
        }

        if (status === 'draft') {
            return 'dr-status--draft';
        }

        return 'dr-status--paused';
    }

    function offerStatusLabel(status) {
        if (status === 'active') {
            return 'Live';
        }

        if (status === 'draft') {
            return 'Rascunho';
        }

        return status || '—';
    }

    function renderOfferSwitcher() {
        if (!offerSwitcher) {
            return;
        }

        if (state.view === 'list' || !state.currentOffer) {
            offerSwitcher.hidden = true;
            return;
        }

        offerSwitcher.hidden = false;

        if (switcherAvatar) {
            switcherAvatar.textContent = offerInitial(state.currentOffer.name);
        }

        if (switcherName) {
            switcherName.textContent = state.currentOffer.name;
        }

        if (switcherStatus) {
            var statusClass = offerStatusClass(state.currentOffer.status);
            switcherStatus.className = 'hub-offer-switcher__status dr-status ' + statusClass;
            switcherStatus.innerHTML = '<span class="dr-status__dot"></span><span>' +
                escapeHtml(offerStatusLabel(state.currentOffer.status)) + '</span>';
        }

        if (!offerSwitcherMenu) {
            return;
        }

        var menuHtml = state.offers.map(function (offer) {
            var isActive = state.currentOffer && offer.slug === state.currentOffer.slug;
            return '<button type="button" class="hub-offer-switcher__option' +
                (isActive ? ' is-active' : '') +
                '" data-offer-slug="' + escapeHtml(offer.slug) + '" role="option">' +
                '<span class="hub-offer-switcher__avatar">' + escapeHtml(offerInitial(offer.name)) + '</span>' +
                '<span class="hub-offer-switcher__option-body">' +
                    '<strong>' + escapeHtml(offer.name) + '</strong>' +
                    '<span class="dr-status ' + offerStatusClass(offer.status) + '">' +
                        '<span class="dr-status__dot"></span>' + escapeHtml(offerStatusLabel(offer.status)) +
                    '</span>' +
                '</span></button>';
        }).join('');

        menuHtml += '<button type="button" class="hub-offer-switcher__create" id="hub-switcher-create">' +
            iconSvg('plus') + '<span>Criar nova oferta</span></button>';

        offerSwitcherMenu.innerHTML = menuHtml;

        offerSwitcherMenu.querySelectorAll('[data-offer-slug]').forEach(function (button) {
            button.addEventListener('click', function () {
                closeOfferSwitcherMenu();
                openOffer(button.getAttribute('data-offer-slug'));
            });
        });

        var createBtn = offerSwitcherMenu.querySelector('#hub-switcher-create');

        if (createBtn) {
            createBtn.addEventListener('click', function () {
                closeOfferSwitcherMenu();
                sidebarOffersBtn.click();
                setTimeout(function () {
                    var input = document.getElementById('hub-create-name');

                    if (input) {
                        input.focus();
                    }
                }, 120);
            });
        }
    }

    function closeOfferSwitcherMenu() {
        if (!offerSwitcherMenu || !offerSwitcherTrigger) {
            return;
        }

        offerSwitcherMenu.hidden = true;
        offerSwitcherTrigger.setAttribute('aria-expanded', 'false');
    }

    function toggleOfferSwitcherMenu() {
        if (!offerSwitcherMenu || !offerSwitcherTrigger) {
            return;
        }

        var willOpen = offerSwitcherMenu.hidden;
        offerSwitcherMenu.hidden = !willOpen;
        offerSwitcherTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');

        if (willOpen) {
            renderOfferSwitcher();
        }
    }

    function hasConfiguredIntegrations(offer) {
        var integrations = (offer && offer.integrations) || {};
        var stripeKeys = ['stripe_secret_key', 'stripe_test_secret_key', 'stripe_publishable_key'];

        return stripeKeys.some(function (key) {
            return Boolean(String(integrations[key] || '').trim());
        });
    }

    function getCommandItems() {
        var items = [
            { label: 'Criar uma página de vendas', keywords: ['page', 'funil', 'criar'], action: 'create-page' },
            { label: 'Criar um funil', keywords: ['funnel', 'funil'], action: 'create-funnel' },
            { label: 'Analisar vendas', keywords: ['vendas', 'metricas', 'dashboard'], action: 'open-dashboard' },
            { label: 'Optimizar esta oferta', keywords: ['ai', 'agent'], action: 'open-ai' },
            { label: 'Configurar tracking', keywords: ['pixel', 'capi'], action: 'open-tracking' },
            { label: 'Abrir integrações', keywords: ['stripe', 'credenciais'], action: 'open-integrations' },
        ];

        if (state.view === 'list') {
            items.unshift({ label: 'Ir para Início', keywords: ['inicio', 'home', 'dashboard', 'ofertas'], action: 'list-offers' });
        }

        return items.map(function (item) {
            return Object.assign({}, item, {
                icon: iconSvg('sparkles'),
            });
        });
    }

    function runCommandAction(item) {
        if (!item) {
            return;
        }

        if (item.action === 'list-offers') {
            sidebarOffersBtn.click();
            return;
        }

        if (!state.currentOffer) {
            if (window.PlatformUI) {
                window.PlatformUI.toast('Abre uma oferta primeiro.', 'info');
            }

            return;
        }

        if (item.action === 'create-funnel' || item.action === 'create-page') {
            openModule('funil');
            return;
        }

        if (item.action === 'open-dashboard') {
            openModule('dashboard');
            return;
        }

        if (item.action === 'open-ai') {
            openModule('ai-agent');
            return;
        }

        if (item.action === 'open-tracking') {
            openModule('tracking');
            return;
        }

        if (item.action === 'open-integrations') {
            openModule('integracoes');
        }
    }

    function initPlatformUi() {
        applyStaticIcons(document);
        updateSidebarToggleUi(isSidebarCollapsed());

        if (!localStorage.getItem(SIDEBAR_COLLAPSED_KEY) &&
            window.matchMedia('(max-width: 960px)').matches) {
            setSidebarCollapsed(true);
        } else {
            setSidebarCollapsed(isSidebarCollapsed());
        }

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                setSidebarCollapsed(!isSidebarCollapsed());
            });
        }

        if (sidebarLogo) {
            sidebarLogo.addEventListener('click', function () {
                if (isSidebarCollapsed()) {
                    setSidebarCollapsed(false);
                }
            });
        }

        if (offerSwitcherTrigger) {
            offerSwitcherTrigger.addEventListener('click', function (event) {
                event.stopPropagation();
                toggleOfferSwitcherMenu();
            });
        }

        document.addEventListener('click', function (event) {
            if (offerSwitcher && !offerSwitcher.contains(event.target)) {
                closeOfferSwitcherMenu();
            }
        });

        if (commandTrigger && window.PlatformUI) {
            commandTrigger.addEventListener('click', function () {
                window.PlatformUI.openCommand(getCommandItems(), runCommandAction);
            });

            window.PlatformUI.initCommandPalette();
            window.PlatformUI.initKeyboardShortcut(getCommandItems, runCommandAction);
        }
    }

    function offerInitial(name) {
        var trimmed = String(name || '').trim();

        if (!trimmed) {
            return '?';
        }

        return trimmed.charAt(0).toUpperCase();
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

        if (window.HubChat) {
            if (isAuthenticated) {
                window.HubChat.show();
                window.HubChat.refresh();
            } else {
                window.HubChat.hide();
            }
        }
    }

    function setView(view) {
        state.view = view;
        listView.hidden = view !== 'list';
        homeView.hidden = view !== 'home';
        moduleView.hidden = view !== 'module';

        if (sidebarContext) {
            if (view === 'list') {
                sidebarContext.textContent = 'Sales Platform';
            } else if (state.currentOffer) {
                sidebarContext.textContent = state.currentOffer.name;
            }
        }

        renderSidebar();
        renderBreadcrumb();
        renderOfferSwitcher();
        refreshHubChat();
    }

    function findModule(moduleId) {
        return (state.currentModules || []).find(function (entry) {
            return entry.id === moduleId;
        }) || null;
    }

    function computeOnboardingSteps(offer, modules) {
        var hasIntegrations = hasConfiguredIntegrations(offer);
        var funnelModule = (modules || []).find(function (entry) {
            return entry.id === 'funil';
        });
        var hasFunnel = funnelModule && funnelModule.status === 'live';
        var hasTracking = (modules || []).some(function (entry) {
            return entry.id === 'tracking' && entry.status === 'live';
        });

        return [
            {
                id: 'offer',
                label: 'Oferta criada',
                description: 'Espaço isolado para funil, checkout e automações.',
                done: true,
            },
            {
                id: 'integrations',
                label: hasIntegrations ? 'Stripe conectado' : 'Integrações por configurar',
                description: hasIntegrations
                    ? 'Credenciais principais detectadas nesta oferta.'
                    : 'Liga Stripe, Meta e tracking antes de publicar.',
                done: hasIntegrations,
                moduleId: 'integracoes',
                cta: hasIntegrations ? 'Rever integrações' : 'Configurar integrações',
            },
            {
                id: 'funnel',
                label: hasFunnel ? 'Funil disponível no Page Engine' : 'Funil ainda não publicado',
                description: hasFunnel
                    ? 'Cria e publica pages no construtor visual.'
                    : 'Cria o primeiro funil e publica a page principal.',
                done: hasFunnel,
                moduleId: 'funil',
                cta: hasFunnel ? 'Abrir funis' : 'Abrir construtor',
            },
            {
                id: 'tracking',
                label: hasTracking ? 'Tracking activo' : 'Tracking por activar',
                description: hasTracking
                    ? 'Pixel, CAPI e scripts prontos para o funil.'
                    : 'Configura pixel Meta, GA4 e snippet no funil.',
                done: hasTracking,
                moduleId: 'tracking',
                cta: hasTracking ? 'Ver tracking' : 'Configurar tracking',
            },
        ];
    }

    function renderSidebar() {
        if (!sidebarNav) {
            return;
        }

        var html = '';

        if (state.view === 'list') {
            if (sidebarEl) {
                sidebarEl.classList.add('hub-sidebar--list');
            }

            if (sidebarHome) {
                sidebarHome.hidden = true;
                sidebarHome.innerHTML = '';
            }

            if (sidebarOffersBtn) {
                sidebarOffersBtn.hidden = true;
            }

            html += '<div class="hub-sidebar__group"><div class="hub-sidebar__group-label">Plataforma</div>';

            PLATFORM_NAV.forEach(function (item) {
                html += '<button type="button" class="hub-sidebar__link' +
                    (state.platformSection === item.id ? ' is-active' : '') +
                    '" data-platform-nav="' + escapeHtml(item.id) + '" title="' + escapeHtml(item.label) + '">' +
                    '<span class="hub-sidebar__icon">' + navIcon(item.icon || item.id) + '</span>' +
                    '<span class="hub-sidebar__label">' + escapeHtml(item.label) + '</span></button>';
            });

            html += '</div>';
            sidebarNav.innerHTML = html;
            bindSidebarNav();
            applyStaticIcons(sidebarNav);
            updateSidebarToggleUi(isSidebarCollapsed());
            return;
        }

        if (sidebarEl) {
            sidebarEl.classList.remove('hub-sidebar--list');
        }

        if (sidebarHome) {
            sidebarHome.hidden = true;
            sidebarHome.innerHTML = '';
        }

        if (sidebarOffersBtn) {
            sidebarOffersBtn.hidden = false;
        }

        if (!state.currentOffer) {
            sidebarNav.innerHTML = '';
            return;
        }

        NAV_GROUPS.forEach(function (group) {
            html += '<div class="hub-sidebar__group"><div class="hub-sidebar__group-label">' +
                escapeHtml(group.label) + '</div>';

            group.items.forEach(function (item) {
                if (item.type === 'home') {
                    html += '<button type="button" class="hub-sidebar__link' +
                        (state.view === 'home' ? ' is-active' : '') +
                        '" data-nav="home" title="Overview">' +
                        '<span class="hub-sidebar__icon">' + navIcon('home') + '</span>' +
                        '<span class="hub-sidebar__label">' + escapeHtml(item.label) + '</span></button>';
                    return;
                }

                if (item.type === 'soon') {
                    html += '<button type="button" class="hub-sidebar__link is-disabled" disabled title="' +
                        escapeHtml(item.label) + ' (em breve)">' +
                        '<span class="hub-sidebar__icon">' + navIcon(item.id) + '</span>' +
                        '<span class="hub-sidebar__label">' + escapeHtml(item.label) + '</span></button>';
                    return;
                }

                if (item.type === 'checkout') {
                    var checkouts = state.currentOffer.checkouts || [];
                    var hasCheckout = checkouts.length > 0;
                    html += '<button type="button" class="hub-sidebar__link' +
                        (!hasCheckout ? ' is-disabled' : '') +
                        '" data-nav="checkout"' +
                        (!hasCheckout ? ' disabled title="Checkout (sem checkout configurado)"' :
                            ' title="Checkout"') + '>' +
                        '<span class="hub-sidebar__icon">' + navIcon('checkout') + '</span>' +
                        '<span class="hub-sidebar__label">' + escapeHtml(item.label) + '</span></button>';
                    return;
                }

                var module = findModule(item.id);

                if (!module) {
                    return;
                }

                var isActive = state.view === 'module' && state.currentModule === module.id &&
                    (item.navKey || module.id) === (state.moduleNavKey || state.currentModule);
                var isLive = module.status === 'live';
                var navKeyAttr = item.navKey || module.id;

                html += '<button type="button" class="hub-sidebar__link' +
                    (isActive ? ' is-active' : '') +
                    (!isLive ? ' is-disabled' : '') +
                    '" data-nav="module" data-module="' + escapeHtml(module.id) + '"' +
                    ' data-nav-key="' + escapeHtml(navKeyAttr) + '"' +
                    ' title="' + escapeHtml(item.label) + '"' +
                    (!isLive ? ' disabled' : '') + '>' +
                    '<span class="hub-sidebar__icon">' + navIcon(item.navKey || module.id) + '</span>' +
                    '<span class="hub-sidebar__label">' + escapeHtml(item.label) + '</span></button>';
            });

            html += '</div>';
        });

        sidebarNav.innerHTML = html;
        bindSidebarNav();
        applyStaticIcons(sidebarNav);
        updateSidebarToggleUi(isSidebarCollapsed());
    }

    function bindSidebarNav(root) {
        var scope = root || sidebarNav;

        if (!scope) {
            return;
        }

        scope.querySelectorAll('[data-nav], [data-platform-nav]').forEach(function (button) {
            button.addEventListener('click', function () {
                var platformNav = button.getAttribute('data-platform-nav');

                if (platformNav) {
                    setPlatformSection(platformNav);
                    return;
                }

                var nav = button.getAttribute('data-nav');

                if (nav === 'list') {
                    return;
                }

                if (nav === 'home') {
                    goOfferHome();
                    return;
                }

                if (nav === 'module') {
                    var moduleId = button.getAttribute('data-module');
                    var navKey = button.getAttribute('data-nav-key') || moduleId;
                    var moduleEntry = findModule(moduleId);

                    if (moduleEntry && moduleEntry.status === 'live') {
                        if (moduleEntry.embed) {
                            openEmbedModule(moduleEntry);
                        } else {
                            openModule(moduleId, null, navKey);
                        }
                    }
                }
            });
        });
    }

    function modulePipelineStatus(modules, id) {
        var mod = (modules || []).find(function (entry) {
            return entry.id === id;
        });

        if (!mod) {
            return { label: 'Indisponível', className: 'dr-status--missing' };
        }

        if (mod.status === 'live') {
            return { label: 'Activo', className: 'dr-status--connected' };
        }

        return { label: 'Por configurar', className: 'dr-status--missing' };
    }

    function metricStripItem(label, value, hint) {
        return '<div class="hub-metrics-strip__item">' +
            '<div class="hub-metrics-strip__label">' + escapeHtml(label) + '</div>' +
            '<div class="hub-metrics-strip__value">' + escapeHtml(value || '—') + '</div>' +
            (hint
                ? '<div class="hub-metrics-strip__hint">' + escapeHtml(hint) + '</div>'
                : '') +
        '</div>';
    }

    function formatRoas(value) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) {
            return '—';
        }

        return Number(value).toLocaleString('pt-PT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function getPlatformHeroCopy(sectionId) {
        var map = {
            home: {
                eyebrow: 'Plataforma',
                title: 'Início',
                sub: 'Resumo rápido de receita, vendas e contas Meta ligadas.',
            },
            dashboard: {
                eyebrow: 'Plataforma',
                title: 'Dashboard',
                sub: 'Receita Stripe, gasto Meta, ROAS e detalhe por oferta.',
            },
            offers: {
                eyebrow: 'Plataforma',
                title: 'Ofertas',
                sub: 'Gere as tuas ofertas e respectivas máquinas de vendas.',
            },
            settings: {
                eyebrow: 'Plataforma',
                title: 'Definições',
                sub: 'Preferências globais da plataforma DR Ecoom.',
            },
        };

        return map[sectionId] || map.home;
    }

    function setPlatformSection(sectionId) {
        var exists = PLATFORM_NAV.some(function (entry) {
            return entry.id === sectionId;
        });

        state.platformSection = exists ? sectionId : 'home';
        state.currentOffer = null;
        state.currentModule = null;
        state.moduleNavKey = null;
        state.currentEmbed = null;
        clearNavIntent();
        setView('list');
        renderPlatformContent();
        updateUrl('');
        showStatus('');
    }

    function renderPlatformHero() {
        if (!platformHero) {
            return;
        }

        var copy = getPlatformHeroCopy(state.platformSection);

        platformHero.innerHTML =
            '<div>' +
                '<p class="hub-list-hero__eyebrow">' + escapeHtml(copy.eyebrow) + '</p>' +
                '<h2>' + escapeHtml(copy.title) + '</h2>' +
                '<p class="hub-list-hero__sub">' + escapeHtml(copy.sub) + '</p>' +
            '</div>';
    }

    function renderPlatformContent() {
        renderPlatformHero();

        if (platformPanelHome) {
            platformPanelHome.hidden = state.platformSection !== 'home';
        }

        if (platformPanelDashboard) {
            platformPanelDashboard.hidden = state.platformSection !== 'dashboard';
        }

        if (platformPanelOffers) {
            platformPanelOffers.hidden = state.platformSection !== 'offers';
        }

        if (platformPanelSettings) {
            platformPanelSettings.hidden = state.platformSection !== 'settings';
        }

        renderPlatformMetrics(state.platformMetrics);
        renderPlatformSettings();

        if (state.platformSection === 'offers') {
            renderOffersList();
        }
    }

    function buildMetricsStripHtml(totals, periodLabel, compact) {
        var items = compact
            ? [
                metricStripItem('Receita', formatMoneyEur(totals.revenue_eur)),
                metricStripItem('Vendas', formatMetricNumber(totals.sales)),
                metricStripItem('Gasto Meta', formatMoneyEur(totals.meta_spend_eur)),
                metricStripItem('ROAS', formatRoas(totals.roas)),
                metricStripItem('EPC', totals.epc != null ? formatMoneyEur(totals.epc) : '—'),
            ]
            : [
                metricStripItem('Receita', formatMoneyEur(totals.revenue_eur)),
                metricStripItem('Vendas', formatMetricNumber(totals.sales)),
                metricStripItem('Gasto Meta', formatMoneyEur(totals.meta_spend_eur)),
                metricStripItem('ROAS', formatRoas(totals.roas)),
                metricStripItem('EPC', totals.epc != null ? formatMoneyEur(totals.epc) : '—'),
                metricStripItem('Tráfego', formatMetricNumber(totals.traffic_sales), formatMoneyEur(totals.traffic_revenue_eur)),
            ];

        return '<section class="hub-metrics-strip" aria-label="Métricas da plataforma">' +
            items.join('') +
            (periodLabel ? '<div class="hub-metrics-strip__note">' + escapeHtml(periodLabel) + '</div>' : '') +
        '</section>';
    }

    function buildOfferRowsHtml(metricsPayload) {
        return (metricsPayload.offers || []).map(function (entry) {
            return '<button type="button" class="hub-platform-row" data-offer-slug="' + escapeHtml(entry.slug) + '">' +
                '<div class="hub-platform-row__main">' +
                    '<strong>' + escapeHtml(entry.name) + '</strong>' +
                    '<span class="hub-platform-row__meta">' + escapeHtml(offerStatusLabel(entry.status)) +
                        ' · ' + formatMetricNumber(entry.meta_accounts_count || 0) + ' contas Meta</span>' +
                '</div>' +
                '<div class="hub-platform-row__stats">' +
                    '<span>' + formatMoneyEur(entry.revenue_eur) + '</span>' +
                    '<span>' + formatMetricNumber(entry.sales) + ' vendas</span>' +
                    '<span>' + formatMoneyEur(entry.meta_spend_eur) + ' gasto</span>' +
                    '<span>ROAS ' + formatRoas(entry.roas) + '</span>' +
                '</div>' +
                '<span class="hub-platform-row__cta">→</span>' +
            '</button>';
        }).join('');
    }

    function buildRecentRowsHtml(metricsPayload) {
        return (metricsPayload.recent_sales || []).map(function (sale) {
            return '<div class="hub-platform-sale">' +
                '<div class="hub-platform-sale__main">' +
                    '<strong>' + escapeHtml(sale.offer_name || sale.offer_slug || 'Oferta') + '</strong>' +
                    '<span>' + escapeHtml(sale.source_label || sale.source || 'Venda') + '</span>' +
                '</div>' +
                '<div class="hub-platform-sale__meta">' +
                    '<span>' + formatMoneyEur(sale.amount_eur) + '</span>' +
                    '<span>' + escapeHtml(formatMetricDate(sale.created)) + '</span>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    function bindOfferRowClicks(root) {
        if (!root) {
            return;
        }

        root.querySelectorAll('[data-offer-slug]').forEach(function (button) {
            button.addEventListener('click', function () {
                openOffer(button.getAttribute('data-offer-slug'));
            });
        });
    }

    function renderPlatformSettings() {
        if (!platformSettingsRoot) {
            return;
        }

        var linkedAccounts = [];

        state.offers.forEach(function (offer) {
            (offer.meta_accounts || []).forEach(function (account) {
                linkedAccounts.push({
                    offer: offer.name,
                    slug: offer.slug,
                    account_id: account.account_id,
                    label: account.label,
                });
            });
        });

        var accountsHtml = linkedAccounts.length
            ? linkedAccounts.map(function (entry) {
                return '<div class="hub-platform-sale">' +
                    '<div class="hub-platform-sale__main">' +
                        '<strong>' + escapeHtml(entry.label || entry.account_id) + '</strong>' +
                        '<span>' + escapeHtml(entry.offer) + ' · act_' + escapeHtml(entry.account_id) + '</span>' +
                    '</div>' +
                    '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" data-open-offer="' +
                        escapeHtml(entry.slug) + '">Abrir oferta</button>' +
                '</div>';
            }).join('')
            : '<div class="dr-empty"><p class="dr-empty__title">Sem contas Meta ligadas</p>' +
                '<p class="dr-empty__text">Abre uma oferta → Integrações → Meta para adicionar contas de anúncios.</p></div>';

        platformSettingsRoot.innerHTML =
            '<article class="hub-panel">' +
                '<div class="hub-panel__head"><h2>Definições da plataforma</h2></div>' +
                '<p class="hub-panel__sub">Contas Meta ligadas por oferta e atalhos globais.</p>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>Contas Meta ligadas</h3>' +
                '<div class="hub-platform-recent">' + accountsHtml + '</div>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>Atalhos</h3>' +
                '<div class="hub-actions-row">' +
                    '<button type="button" class="hub-action-row" data-platform-nav-jump="dashboard">' +
                        '<span class="hub-action-row__icon">' + navIcon('dashboard') + '</span>' +
                        '<span><span class="hub-action-row__label">Dashboard completo</span>' +
                        '<span class="hub-action-row__desc">Receita, gasto Meta e ROAS</span></span>' +
                        '<span class="hub-action-row__plus">→</span>' +
                    '</button>' +
                    '<a class="hub-action-row" href="/metricas/?embed=1" target="_blank" rel="noopener">' +
                        '<span class="hub-action-row__icon">' + navIcon('analytics') + '</span>' +
                        '<span><span class="hub-action-row__label">Métricas avançadas</span>' +
                        '<span class="hub-action-row__desc">Abrir dashboard Stripe + Meta</span></span>' +
                        '<span class="hub-action-row__plus">↗</span>' +
                    '</a>' +
                '</div>' +
            '</article>';

        platformSettingsRoot.querySelectorAll('[data-open-offer]').forEach(function (button) {
            button.addEventListener('click', function () {
                openOffer(button.getAttribute('data-open-offer'));
            });
        });

        platformSettingsRoot.querySelectorAll('[data-platform-nav-jump]').forEach(function (button) {
            button.addEventListener('click', function () {
                setPlatformSection(button.getAttribute('data-platform-nav-jump'));
            });
        });
    }

    function renderPlatformMetrics(metricsPayload) {
        renderPlatformMetricsPanel(platformMetricsHome, metricsPayload, true);
        renderPlatformMetricsPanel(platformMetricsDashboard, metricsPayload, false);
    }

    function renderPlatformMetricsPanel(root, metricsPayload, compact) {
        if (!root) {
            return;
        }

        if (!metricsPayload || !metricsPayload.stripe_configured) {
            root.innerHTML =
                '<section class="hub-platform__block">' +
                    '<div class="hub-chart-empty">' +
                        '<p class="dr-empty__title">Métricas indisponíveis</p>' +
                        '<p class="dr-empty__text">Configure STRIPE_SECRET_KEY para ver receita e vendas reais.</p>' +
                    '</div>' +
                '</section>';
            return;
        }

        var totals = metricsPayload.totals || {};
        var periodLabel = getPeriodLabel(metricsPayload);
        var offerRows = buildOfferRowsHtml(metricsPayload);
        var recentRows = buildRecentRowsHtml(metricsPayload);
        var stripHtml = buildMetricsStripHtml(totals, compact ? '' : periodLabel, compact);

        if (compact) {
            root.innerHTML =
                '<section class="hub-platform__block">' +
                    stripHtml +
                '</section>' +
                '<section class="hub-platform__block">' +
                    '<div class="hub-section-mark">' +
                        '<h2>Por oferta</h2>' +
                        '<span class="hub-section__sub">' + escapeHtml(periodLabel) + '</span>' +
                    '</div>' +
                    '<div class="hub-platform-rows">' +
                        (offerRows || '<p class="hub-panel__sub">Sem vendas no período.</p>') +
                    '</div>' +
                '</section>' +
                '<section class="hub-platform__block">' +
                    '<div class="hub-section-mark">' +
                        '<h2>Vendas recentes</h2>' +
                    '</div>' +
                    '<div class="hub-platform-recent">' +
                        (recentRows ||
                            '<div class="dr-empty"><p class="dr-empty__title">Sem vendas recentes</p>' +
                            '<p class="dr-empty__text">As vendas Stripe aparecem aqui quando existirem.</p></div>') +
                    '</div>' +
                '</section>';
        } else {
            root.innerHTML =
                '<section class="hub-platform__block">' +
                    '<div class="hub-section-mark">' +
                        '<h2>Overview</h2>' +
                        '<span class="hub-section__sub">' + escapeHtml(periodLabel) + ' · todas as ofertas</span>' +
                    '</div>' +
                    stripHtml +
                '</section>' +
                '<section class="hub-platform__block">' +
                    '<div class="hub-section-mark">' +
                        '<h2>Resultados por oferta</h2>' +
                        '<span class="hub-section__sub">Receita Stripe + gasto Meta ligado</span>' +
                    '</div>' +
                    '<div class="hub-platform-rows">' +
                        (offerRows || '<p class="hub-panel__sub">Sem vendas no período.</p>') +
                    '</div>' +
                '</section>' +
                '<section class="hub-platform__block">' +
                    '<div class="hub-section-mark">' +
                        '<h2>Vendas recentes</h2>' +
                    '</div>' +
                    '<div class="hub-platform-recent">' +
                        (recentRows ||
                            '<div class="dr-empty"><p class="dr-empty__title">Sem vendas recentes</p>' +
                            '<p class="dr-empty__text">As vendas Stripe aparecem aqui quando existirem.</p></div>') +
                    '</div>' +
                '</section>';
        }

        bindOfferRowClicks(root);
    }

    function buildFunnelBreakdownHtml(metricsPayload) {
        var rows = (metricsPayload && metricsPayload.funnel_breakdown) || [];

        if (!rows.length) {
            return '';
        }

        var tableRows = rows.map(function (row) {
            var funnelLabel = row.funnel_label || row.funnel_slug || 'Desconhecido';
            var pageLabel = row.page_label && row.page_label !== '—' ? row.page_label : '—';

            return '<tr>' +
                '<td>' + escapeHtml(funnelLabel) + '</td>' +
                '<td>' + escapeHtml(pageLabel) + '</td>' +
                '<td>' + escapeHtml(formatMetricNumber(row.orders)) + '</td>' +
                '<td>' + escapeHtml(formatMoneyEur(row.revenue_eur)) + '</td>' +
                '<td>' + escapeHtml(row.aov_eur != null ? formatMoneyEur(row.aov_eur) : '—') + '</td>' +
            '</tr>';
        }).join('');

        return '<section class="hub-panel hub-panel--nested">' +
            '<div class="hub-section-mark"><h2>Por funil</h2></div>' +
            '<p class="hub-panel__sub">Atribuição via hub_orders.metadata (funnel_slug / page_slug).</p>' +
            '<div class="hub-table-wrap">' +
                '<table class="hub-table">' +
                    '<thead><tr>' +
                        '<th>Funil</th><th>Page</th><th>Orders</th><th>Receita</th><th>AOV</th>' +
                    '</tr></thead>' +
                    '<tbody>' + tableRows + '</tbody>' +
                '</table>' +
            '</div>' +
        '</section>';
    }

    function renderOfferHome(offer, modules, metricsPayload) {
        var steps = computeOnboardingSteps(offer, modules);
        var funnelHost = getFunnelHost(offer) || '';
        var publicUrl = funnelHost ? 'https://' + funnelHost.replace(/^https?:\/\//, '') : '';
        var statusClass = offerStatusClass(offer.status);
        var checkoutSummary = formatCheckouts(offer);
        var metrics = (metricsPayload && metricsPayload.metrics) || {};
        var periodLabel = getPeriodLabel(metricsPayload);
        var conversionHint = metrics.sales > 0 && metrics.traffic_sales > 0
            ? formatMetricNumber(Math.round((metrics.traffic_sales / metrics.sales) * 100)) + '% tráfego'
            : 'Sem dados';
        var funnelMod = (modules || []).find(function (entry) { return entry.id === 'funil'; });
        var funnelDesc = funnelMod && funnelMod.status === 'live' ? 'Page Engine activo' : 'Por configurar';
        var trackingMod = (modules || []).find(function (entry) { return entry.id === 'tracking'; });
        var trackingDesc = trackingMod && trackingMod.status === 'live' ? 'Meta + GA4 + GTM' : 'Por configurar';
        var communityMod = (modules || []).find(function (entry) { return entry.id === 'comunidade'; });
        var communityDesc = communityMod && communityMod.status === 'live' ? 'Comunidade activa' : 'Por configurar';

        var machineItems = [
            {
                icon: 'funnel',
                label: 'Funil',
                desc: funnelDesc,
                status: funnelMod && funnelMod.status === 'live'
                    ? { label: 'Activo', className: 'dr-status--connected' }
                    : { label: 'Por configurar', className: 'dr-status--missing' },
            },
            {
                icon: 'checkout',
                label: 'Checkout',
                desc: checkoutSummary,
                status: (offer.checkouts || []).length
                    ? { label: 'Activo', className: 'dr-status--connected' }
                    : { label: 'Por configurar', className: 'dr-status--missing' },
            },
            {
                icon: 'tracking',
                label: 'Tracking',
                desc: trackingDesc,
                status: trackingMod && trackingMod.status === 'live'
                    ? { label: 'Activo', className: 'dr-status--connected' }
                    : { label: 'Por configurar', className: 'dr-status--missing' },
            },
            {
                icon: 'community',
                label: 'Comunidade',
                desc: communityDesc,
                status: communityMod && communityMod.status === 'live'
                    ? { label: 'Activo', className: 'dr-status--connected' }
                    : { label: 'Por configurar', className: 'dr-status--missing' },
            },
        ];

        var machineHtml = machineItems.map(function (item) {
            return '<div class="hub-machine__item">' +
                '<span class="hub-machine__line" aria-hidden="true"></span>' +
                '<div>' +
                    '<strong>' + escapeHtml(item.label) + '</strong>' +
                    '<p>' + escapeHtml(item.desc) + '</p>' +
                '</div>' +
                '<span class="dr-status ' + item.status.className + '">' +
                    '<span class="dr-status__dot"></span>' + escapeHtml(item.status.label) +
                '</span>' +
            '</div>';
        }).join('');

        var quickActions = [
            { moduleId: 'funil', navKey: 'funil', label: 'Abrir funis', desc: 'Pages e funil visual' },
            { moduleId: 'funil', navKey: 'funil', label: 'Criar funil', desc: 'Novo funnel' },
            { moduleId: 'integracoes', label: 'Configurar checkout', desc: 'Stripe & credenciais' },
            { moduleId: 'tracking', label: 'Configurar tracking', desc: 'Meta, GA4 e GTM' },
            { openCommunity: true, label: 'Abrir comunidade', desc: 'Ver como gestor no domínio da oferta' },
        ];

        var quickHtml = quickActions.map(function (action) {
            if (action.openCommunity) {
                return '<button type="button" class="hub-action-row" data-open-community="1">' +
                    '<span class="hub-action-row__icon">' + navIcon('community') + '</span>' +
                    '<span><span class="hub-action-row__label">' + escapeHtml(action.label) + '</span>' +
                    '<span class="hub-action-row__desc">' + escapeHtml(action.desc) + '</span></span>' +
                    '<span class="hub-action-row__plus">↗</span>' +
                '</button>';
            }

            var mod = findModule(action.moduleId);
            var disabled = !mod || mod.status !== 'live';

            return '<button type="button" class="hub-action-row' + (disabled ? ' is-disabled' : '') +
                '" data-module="' + escapeHtml(action.moduleId) + '"' +
                (action.navKey ? ' data-nav-key="' + escapeHtml(action.navKey) + '"' : '') +
                (disabled ? ' disabled' : '') + '>' +
                '<span class="hub-action-row__icon">' + navIcon(action.navKey || action.moduleId) + '</span>' +
                '<span><span class="hub-action-row__label">' + escapeHtml(action.label) + '</span>' +
                '<span class="hub-action-row__desc">' + escapeHtml(action.desc) + '</span></span>' +
                '<span class="hub-action-row__plus">+</span>' +
            '</button>';
        }).join('');

        var alerts = steps.filter(function (step) {
            return !step.done && step.moduleId;
        }).slice(0, 3);

        var alertsHtml = alerts.length
            ? alerts.map(function (step) {
                return '<div class="dr-alert dr-alert--warning">' +
                    '<div class="dr-alert__body">' +
                        '<strong>' + escapeHtml(step.label) + '</strong>' +
                        '<p>' + escapeHtml(step.description || '') + '</p>' +
                    '</div>' +
                    '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" data-onboard-module="' +
                        escapeHtml(step.moduleId) + '">' + escapeHtml(step.cta || 'Configurar') + '</button>' +
                '</div>';
            }).join('')
            : '<p class="hub-panel__sub">Sem alertas — a máquina de vendas está configurada.</p>';

        homeRoot.innerHTML =
            '<div class="hub-overview">' +
                '<header class="hub-overview__head">' +
                    '<div>' +
                        '<h1>' + escapeHtml(offer.name) + '</h1>' +
                        '<span class="dr-status ' + statusClass + '">' +
                            '<span class="dr-status__dot"></span>' +
                            escapeHtml(offerStatusLabel(offer.status)) +
                        '</span>' +
                    '</div>' +
                    '<div class="hub-offer-hero__actions">' +
                        (offer.status !== 'active'
                            ? '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" data-offer-wizard="1">Continuar setup</button>'
                            : '') +
                        (publicUrl
                            ? '<a class="dr-btn dr-btn--ghost dr-btn--sm" href="' + escapeHtml(publicUrl) +
                                '" target="_blank" rel="noopener">' + iconSvg('externalLink') + ' Ver oferta</a>'
                            : '<span class="hub-offer-hero__hint">Domínio funil por configurar</span>') +
                    '</div>' +
                '</header>' +
                renderLaunchPanel(state.launchReadiness) +
                '<div class="hub-section-mark">' +
                    '<span class="hub-section__sub">' + escapeHtml(periodLabel) + '</span>' +
                '</div>' +
                '<section class="hub-metrics-strip" aria-label="Métricas">' +
                    metricStripItem('Receita', formatMoneyEur(metrics.revenue_eur)) +
                    metricStripItem('Vendas', formatMetricNumber(metrics.orders || metrics.sales)) +
                    metricStripItem('AOV', metrics.aov_eur != null ? formatMoneyEur(metrics.aov_eur) : '—') +
                    (metrics.gross_revenue_eur != null && metrics.refunds_eur > 0
                        ? metricStripItem('Bruto', formatMoneyEur(metrics.gross_revenue_eur)) +
                          metricStripItem('Reembolsos', formatMoneyEur(metrics.refunds_eur)) +
                          metricStripItem('Líquido', formatMoneyEur(metrics.net_revenue_eur))
                        : '') +
                    metricStripItem('Gasto Meta', formatMoneyEur(metrics.meta_spend_eur)) +
                    metricStripItem('ROAS', formatRoas(metrics.roas)) +
                    metricStripItem('CPA', metrics.cpa_eur != null ? formatMoneyEur(metrics.cpa_eur) : '—') +
                '</section>' +
                buildFunnelBreakdownHtml(metricsPayload) +
                '<section class="hub-chart-block">' +
                    '<div class="hub-chart-block__head">' +
                        '<h2>Receita</h2>' +
                        '<div class="dr-tabs" role="tablist" aria-label="Período">' +
                            '<button type="button" class="dr-tab is-active" disabled>Diário</button>' +
                            '<button type="button" class="dr-tab" disabled>Semanal</button>' +
                            '<button type="button" class="dr-tab" disabled>Mensal</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="hub-chart-empty">' +
                        '<p class="dr-empty__title">Ainda não há dados de performance.</p>' +
                        '<p class="dr-empty__text">Ligue o tracking e comece a enviar tráfego para esta oferta.</p>' +
                        '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" data-onboard-module="tracking">Configurar tracking</button>' +
                    '</div>' +
                '</section>' +
                '<section class="hub-machine">' +
                    '<div class="hub-section-mark"><h2>Estado da máquina de vendas</h2></div>' +
                    '<div class="hub-machine__list">' + machineHtml + '</div>' +
                '</section>' +
                '<section>' +
                    '<div class="hub-section-mark"><h2>Acções rápidas</h2></div>' +
                    '<div class="hub-actions-row">' + quickHtml + '</div>' +
                '</section>' +
                '<section>' +
                    '<div class="hub-section-mark"><h2>Actividade recente</h2></div>' +
                    '<div class="hub-activity-list">' +
                        ((metricsPayload && metricsPayload.recent_sales && metricsPayload.recent_sales.length)
                            ? metricsPayload.recent_sales.map(function (sale) {
                                return '<div class="hub-platform-sale">' +
                                    '<div class="hub-platform-sale__main">' +
                                        '<strong>' + escapeHtml(sale.source_label || 'Venda') + '</strong>' +
                                        '<span>' + escapeHtml(sale.email || sale.payment_intent || '') + '</span>' +
                                    '</div>' +
                                    '<div class="hub-platform-sale__meta">' +
                                        '<span>' + formatMoneyEur(sale.amount_eur) + '</span>' +
                                        '<span>' + escapeHtml(formatMetricDate(sale.created)) + '</span>' +
                                    '</div>' +
                                '</div>';
                            }).join('')
                            : '<div class="dr-empty"><p class="dr-empty__title">Sem eventos recentes</p>' +
                            '<p class="dr-empty__text">Vendas e publicações aparecem aqui quando existirem.</p></div>') +
                    '</div>' +
                '</section>' +
                '<section>' +
                    '<div class="hub-section-mark"><h2>Alertas</h2></div>' +
                    '<div class="hub-alerts">' + alertsHtml + '</div>' +
                '</section>' +
            '</div>';

        homeRoot.querySelectorAll('[data-onboard-module]').forEach(function (button) {
            button.addEventListener('click', function () {
                openModule(button.getAttribute('data-onboard-module'));
            });
        });

        homeRoot.querySelectorAll('[data-module]').forEach(function (button) {
            button.addEventListener('click', function () {
                var moduleId = button.getAttribute('data-module');
                var navKey = button.getAttribute('data-nav-key');
                var moduleEntry = findModule(moduleId);

                if (!moduleEntry || moduleEntry.status !== 'live') {
                    return;
                }

                if (moduleEntry.embed) {
                    openEmbedModule(moduleEntry);
                } else {
                    openModule(moduleId, null, navKey || moduleId);
                }
            });
        });

        homeRoot.querySelectorAll('[data-open-community]').forEach(function (button) {
            button.addEventListener('click', function () {
                openCommunityGestor();
            });
        });

        homeRoot.querySelectorAll('[data-offer-wizard]').forEach(function (button) {
            button.addEventListener('click', function () {
                openOfferWizard(state.currentOffer.slug, 2).catch(function (error) {
                    showStatus(error.message, true);
                });
            });
        });

        bindLaunchPanelEvents(homeRoot);
    }

    async function openCommunityGestor(offerSlug) {
        var slug = offerSlug || (state.currentOffer && state.currentOffer.slug) || 'onda-prodigio';
        var token = getToken();

        if (!token) {
            showStatus('Sessão do HUB em falta.', true);
            return;
        }

        showStatus('A preparar acesso de gestor à comunidade…', false);

        try {
            var response = await fetch('/api/comunidade/hub-admin-session', {
                method: 'POST',
                headers: authHeaders(token),
                body: JSON.stringify({ offer: slug }),
            });
            var data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Não foi possível abrir a comunidade.');
            }

            window.open(data.enter_url, '_blank', 'noopener');
            showStatus('');
        } catch (error) {
            showStatus(error.message || 'Não foi possível abrir a comunidade.', true);
        }
    }

    function bindOpenCommunityButtons(root) {
        (root || document).querySelectorAll('[data-open-community]').forEach(function (button) {
            if (button.dataset.communityBound === '1') {
                return;
            }

            button.dataset.communityBound = '1';
            button.addEventListener('click', function () {
                openCommunityGestor();
            });
        });
    }

    function goOfferHome() {
        if (!state.currentOffer) {
            return;
        }

        if (window.HubAI) {
            window.HubAI.stopPolling();
        }

        state.currentModule = null;
        state.moduleNavKey = null;
        state.currentEmbed = null;
        moduleView.classList.remove('hub-view--embed');
        renderOfferHome(state.currentOffer, state.currentModules, state.offerMetrics);
        setView('home');
        updateUrl(state.currentOffer.slug);
        showStatus('');
    }

    function updateUrl(slug, moduleId) {
        var url = new URL(window.location.href);

        if (slug) {
            url.searchParams.set('offer', slug);
        } else {
            url.searchParams.delete('offer');
        }

        if (slug && moduleId) {
            url.searchParams.set('module', moduleId);
        } else {
            url.searchParams.delete('module');
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

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatMoneyEur(value) {
        var amount = Number(value);

        if (!Number.isFinite(amount)) {
            return '—';
        }

        return amount.toLocaleString('pt-PT', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function formatMetricNumber(value) {
        var amount = Number(value);

        if (!Number.isFinite(amount)) {
            return '—';
        }

        return amount.toLocaleString('pt-PT');
    }

    function formatMetricDate(value) {
        if (!value) {
            return '—';
        }

        try {
            return new Date(value).toLocaleString('pt-PT', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (error) {
            return value;
        }
    }

    function getOfferMetricsMap(metricsPayload) {
        var map = {};

        ((metricsPayload && metricsPayload.offers) || []).forEach(function (entry) {
            map[entry.slug] = entry;
        });

        return map;
    }

    function getPeriodLabel(metricsPayload) {
        if (!metricsPayload || !metricsPayload.period) {
            return 'Últimos 30 dias';
        }

        if (metricsPayload.period.days) {
            return 'Últimos ' + metricsPayload.period.days + ' dias';
        }

        if (metricsPayload.period.from && metricsPayload.period.to) {
            return metricsPayload.period.from + ' → ' + metricsPayload.period.to;
        }

        return 'Período actual';
    }

    async function copyText(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            if (button) {
                var original = button.textContent;
                button.textContent = 'Copiado';
                setTimeout(function () {
                    button.textContent = original;
                }, 1400);
            }
        } catch (error) {
            showStatus('Não foi possível copiar.', true);
        }
    }

    function launchStatusClass(readiness) {
        if (readiness === 'ready') {
            return 'dr-status--connected';
        }

        if (readiness === 'almost_ready') {
            return 'dr-status--pending';
        }

        return 'dr-status--missing';
    }

    function renderLaunchCheckLine(check) {
        var icon = check.status === 'pass' ? '✓' : (check.status === 'warning' ? '⚠' : '✗');
        var cls = check.status === 'pass'
            ? 'hub-launch__check--pass'
            : (check.status === 'warning' ? 'hub-launch__check--warn' : 'hub-launch__check--fail');
        var actionBtn = check.action && check.status !== 'pass'
            ? '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm hub-launch__check-action" ' +
                'data-launch-action="' + escapeHtml(check.action.moduleId || '') + '"' +
                (check.action.navKey ? ' data-launch-nav="' + escapeHtml(check.action.navKey) + '"' : '') +
                '>' + escapeHtml(check.action.label || 'Corrigir') + '</button>'
            : '';

        return '<div class="hub-launch__check ' + cls + '">' +
            '<span class="hub-launch__icon" aria-hidden="true">' + icon + '</span>' +
            '<span class="hub-launch__label">' + escapeHtml(check.label) + '</span>' +
            '<span class="hub-launch__msg">' + escapeHtml(check.message || '') + '</span>' +
            actionBtn +
        '</div>';
    }

    function renderLaunchPanel(launch) {
        if (!launch) {
            return '<section class="hub-launch hub-launch--loading">' +
                '<p class="hub-panel__sub">A avaliar launch readiness…</p>' +
            '</section>';
        }

        var groupsHtml = (launch.groups || []).map(function (group) {
            return '<div class="hub-launch__group">' +
                '<h3>' + escapeHtml(group.label) + '</h3>' +
                group.checks.map(renderLaunchCheckLine).join('') +
            '</div>';
        }).join('');

        var issuesHtml = (launch.issues || []).slice(0, 6).map(function (issue) {
            var actionBtn = issue.action
                ? '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" data-launch-action="' +
                    escapeHtml(issue.action.moduleId || '') + '"' +
                    (issue.action.navKey ? ' data-launch-nav="' + escapeHtml(issue.action.navKey) + '"' : '') +
                    '>' + escapeHtml(issue.action.label || 'Corrigir') + '</button>'
                : '';

            return '<div class="dr-alert dr-alert--warning">' +
                '<div class="dr-alert__body">' +
                    '<strong>' + escapeHtml(issue.label) + '</strong>' +
                    '<p>' + escapeHtml(issue.message || '') + '</p>' +
                    (issue.solution ? '<p>' + escapeHtml(issue.solution) + '</p>' : '') +
                '</div>' +
                actionBtn +
            '</div>';
        }).join('');

        var launchReady = launch.readiness === 'ready';
        var launchActions =
            '<div class="hub-launch__actions">' +
                '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" data-launch-validate="1">Validar oferta</button>' +
                '<button type="button" class="dr-btn dr-btn--primary dr-btn--sm"' +
                    (launchReady ? '' : ' disabled') +
                    ' data-launch-go="1">Launch offer</button>' +
            '</div>';

        return '<section class="hub-launch" aria-label="Launch Status">' +
            '<div class="hub-launch__head">' +
                '<div>' +
                    '<h2>Launch Status</h2>' +
                    '<p class="hub-panel__sub">Verifica se a oferta está pronta para vender.</p>' +
                '</div>' +
                '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" data-launch-refresh="1">Actualizar</button>' +
            '</div>' +
            '<div class="hub-launch__summary dr-status ' + launchStatusClass(launch.readiness) + '">' +
                '<span class="dr-status__dot"></span>' +
                escapeHtml((launch.emoji || '') + ' ' + (launch.label || 'A avaliar')) +
                (launch.summary
                    ? ' · ' + escapeHtml(String(launch.summary.passed)) + ' OK' +
                        (launch.summary.failures ? ' · ' + launch.summary.failures + ' falhas' : '') +
                        (launch.summary.warnings ? ' · ' + launch.summary.warnings + ' avisos' : '')
                    : '') +
            '</div>' +
            launchActions +
            (issuesHtml ? '<div class="hub-launch__issues">' + issuesHtml + '</div>' : '') +
            '<details class="hub-launch__details">' +
                '<summary>Ver todos os checks</summary>' +
                '<div class="hub-launch__groups">' + groupsHtml + '</div>' +
            '</details>' +
        '</section>';
    }

    function bindLaunchPanelEvents(root) {
        if (!root) {
            return;
        }

        root.querySelectorAll('[data-launch-refresh]').forEach(function (button) {
            button.addEventListener('click', function () {
                if (!state.currentOffer) {
                    return;
                }

                loadLaunchReadiness(state.currentOffer.slug, true).then(function () {
                    renderOfferHome(state.currentOffer, state.currentModules, state.offerMetrics);
                });
            });
        });

        root.querySelectorAll('[data-launch-action]').forEach(function (button) {
            button.addEventListener('click', function () {
                var moduleId = button.getAttribute('data-launch-action');
                var navKey = button.getAttribute('data-launch-nav');

                if (!moduleId) {
                    return;
                }

                openModule(moduleId, null, navKey || moduleId);
            });
        });

        root.querySelectorAll('[data-launch-validate]').forEach(function (button) {
            button.addEventListener('click', function () {
                validateCurrentOffer();
            });
        });

        root.querySelectorAll('[data-launch-go]').forEach(function (button) {
            button.addEventListener('click', function () {
                launchCurrentOffer();
            });
        });
    }

    async function validateCurrentOffer() {
        if (!state.currentOffer) {
            return;
        }

        try {
            showStatus('A validar oferta…');
            var result = await apiFetch(
                '/api/sales-attribution?action=hub_validate_offer&slug=' +
                    encodeURIComponent(state.currentOffer.slug),
                { method: 'POST', body: {} }
            );

            state.launchReadiness = result.wizard ? result.wizard.launch : state.launchReadiness;

            if (result.ready) {
                showStatus('🟢 Oferta pronta para launch.');
            } else if (result.ok) {
                showStatus('🟡 Quase pronta — resolve avisos antes do launch.');
            } else {
                showStatus('🔴 Not ready — ' + (result.failures || []).length + ' falha(s) crítica(s).', true);
            }

            renderOfferHome(state.currentOffer, state.currentModules, state.offerMetrics);

            if (window.PlatformUI) {
                window.PlatformUI.toast(result.label || (result.ready ? 'Ready' : 'Not ready'), result.ready ? 'success' : 'warning');
            }
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    async function launchCurrentOffer() {
        if (!state.currentOffer) {
            return;
        }

        if (!window.confirm('Confirmar launch desta oferta? Só avança se todos os checks críticos passarem.')) {
            return;
        }

        try {
            showStatus('A lançar oferta…');
            var result = await apiFetch(
                '/api/sales-attribution?action=hub_launch_offer&slug=' +
                    encodeURIComponent(state.currentOffer.slug),
                { method: 'POST', body: {} }
            );

            await loadOffers();
            state.currentOffer = result.offer || state.currentOffer;
            state.launchReadiness = result.launch && result.launch.wizard
                ? result.launch.wizard.launch
                : state.launchReadiness;

            showStatus('🟢 Oferta activa — live.');
            renderOfferHome(state.currentOffer, state.currentModules, state.offerMetrics);
            renderSidebar();

            if (window.PlatformUI) {
                window.PlatformUI.toast('Oferta lançada com sucesso.', 'success');
            }
        } catch (error) {
            showStatus(error.message, true);
            await loadLaunchReadiness(state.currentOffer.slug, true);
            renderOfferHome(state.currentOffer, state.currentModules, state.offerMetrics);
        }
    }

    function wizardStepClass(status) {
        if (status === 'pass') {
            return 'is-pass';
        }

        if (status === 'fail') {
            return 'is-fail';
        }

        return '';
    }

    function closeOfferWizard() {
        state.wizard.open = false;
        state.wizard.busy = false;

        if (wizardOverlay) {
            wizardOverlay.hidden = true;
        }
    }

    async function openOfferWizard(slug, step) {
        state.wizard.open = true;
        state.wizard.slug = slug || null;
        state.wizard.step = step || (slug ? 2 : 1);
        state.wizard.data = null;
        state.wizard.error = null;
        state.wizard.loading = Boolean(slug && state.wizard.step > 2);

        if (wizardOverlay) {
            wizardOverlay.hidden = false;
        }

        renderOfferWizard();

        if (!slug) {
            return;
        }

        try {
            await refreshWizardData(slug);
            state.wizard.loading = false;
            state.wizard.error = null;
            renderOfferWizard();
        } catch (error) {
            state.wizard.loading = false;
            state.wizard.error = error.message || 'Não foi possível carregar o assistente.';
            renderOfferWizard();
        }
    }

    async function refreshWizardData(slug) {
        var payload = await apiFetch(
            '/api/sales-attribution?action=hub_offer_wizard&slug=' +
                encodeURIComponent(slug) + '&refresh=1'
        );
        state.wizard.data = payload.wizard;
        state.wizard.slug = slug;
    }

    function renderOfferWizard() {
        if (!wizardOverlay || !wizardStepsEl || !wizardBodyEl || !wizardFootEl) {
            return;
        }

        var steps = (state.wizard.data && state.wizard.data.steps) || [];
        var currentStep = state.wizard.step;

        wizardStepsEl.innerHTML = steps.length
            ? steps.map(function (step) {
                var active = step.index === currentStep ? ' is-active' : '';
                return '<span class="hub-wizard__step' + active + wizardStepClass(step.status) + '">' +
                    step.index + '. ' + escapeHtml(step.title) +
                '</span>';
            }).join('')
            : '<span class="hub-wizard__step is-active">1. Oferta</span>';

        if (state.wizard.loading) {
            wizardBodyEl.innerHTML =
                '<p class="hub-panel__sub">A carregar assistente de setup…</p>';
            wizardFootEl.innerHTML =
                '<button type="button" class="dr-btn dr-btn--ghost" data-wizard-close-inline="1">Cancelar</button>';
            wizardFootEl.querySelector('[data-wizard-close-inline]').onclick = closeOfferWizard;
            return;
        }

        if (state.wizard.error) {
            wizardBodyEl.innerHTML =
                '<div class="dr-alert dr-alert--warning">' +
                    '<div class="dr-alert__body">' +
                        '<strong>Não foi possível carregar</strong>' +
                        '<p>' + escapeHtml(state.wizard.error) + '</p>' +
                    '</div>' +
                '</div>';
            wizardFootEl.innerHTML =
                '<button type="button" class="dr-btn dr-btn--ghost" data-wizard-retry="1">Tentar novamente</button>' +
                '<button type="button" class="dr-btn dr-btn--primary" data-wizard-close-inline="1">Fechar</button>';
            wizardFootEl.querySelector('[data-wizard-close-inline]').onclick = closeOfferWizard;
            wizardFootEl.querySelector('[data-wizard-retry]').onclick = function () {
                openOfferWizard(state.wizard.slug, state.wizard.step);
            };
            return;
        }

        if (currentStep === 1 && !state.wizard.slug) {
            wizardBodyEl.innerHTML =
                '<form class="hub-wizard__form" id="hub-wizard-create-form">' +
                    '<label class="hub-login__label" for="hub-wizard-name">Nome da oferta</label>' +
                    '<input class="hub-login__input" id="hub-wizard-name" type="text" required placeholder="Ex: Curso X">' +
                    '<label class="hub-login__label" for="hub-wizard-desc">Descrição (opcional)</label>' +
                    '<input class="hub-login__input" id="hub-wizard-desc" type="text" placeholder="Breve descrição">' +
                    '<label class="hub-login__label" for="hub-wizard-currency">Moeda comercial</label>' +
                    '<select class="hub-login__input" id="hub-wizard-currency">' +
                        '<option value="eur" selected>EUR — Euro</option>' +
                        '<option value="usd">USD — Dólar</option>' +
                        '<option value="brl">BRL — Real</option>' +
                    '</select>' +
                    '<p class="hub-panel__sub">Pixel, GTM, Stape e moeda Meta reporting serão configurados no passo Tracking — cada oferta é independente.</p>' +
                    '<label class="hub-login__label" for="hub-wizard-domain">Domínio funil (opcional)</label>' +
                    '<input class="hub-login__input" id="hub-wizard-domain" type="text" placeholder="minhaoferta.com">' +
                    '<p class="hub-create-form__error" id="hub-wizard-error" hidden></p>' +
                '</form>';
            wizardFootEl.innerHTML =
                '<span></span>' +
                '<button type="submit" form="hub-wizard-create-form" class="dr-btn dr-btn--primary">Continuar →</button>';

            var createForm = document.getElementById('hub-wizard-create-form');

            if (createForm) {
                createForm.onsubmit = handleWizardCreateOffer;
            }

            return;
        }

        if (currentStep === 2 && state.wizard.slug) {
            var offer = state.currentOffer || {};
            var checkout = (offer.checkouts || [])[0] || {};
            var amountEuros = checkout.amount_cents ? (checkout.amount_cents / 100).toFixed(2) : '1.00';
            var currencyCode = (
                (offer.settings && offer.settings.commercial_currency) ||
                checkout.currency ||
                'eur'
            ).toUpperCase();
            var currencySymbol = currencyCode === 'USD' ? '$' : (currencyCode === 'BRL' ? 'R$' : '€');

            wizardBodyEl.innerHTML =
                '<form class="hub-wizard__form" id="hub-wizard-product-form">' +
                    '<p class="hub-panel__sub">Produto principal e checkout serão provisionados automaticamente.</p>' +
                    '<label class="hub-login__label" for="hub-wizard-price">Preço (' + escapeHtml(currencySymbol) + ' · ' +
                        escapeHtml(currencyCode) + ')</label>' +
                    '<input class="hub-login__input" id="hub-wizard-price" type="number" min="0.5" step="0.01" value="' +
                        escapeHtml(amountEuros) + '" required>' +
                    '<p class="hub-create-form__error" id="hub-wizard-error" hidden></p>' +
                '</form>';
            wizardFootEl.innerHTML =
                '<button type="button" class="dr-btn dr-btn--ghost" data-wizard-back="1">← Voltar</button>' +
                '<button type="submit" form="hub-wizard-product-form" class="dr-btn dr-btn--primary">Guardar e continuar →</button>';

            document.getElementById('hub-wizard-product-form').onsubmit = handleWizardProductStep;
            wizardFootEl.querySelector('[data-wizard-back]').onclick = function () {
                state.wizard.step = 1;
                renderOfferWizard();
            };
            return;
        }

        var stepData = steps.find(function (row) {
            return row.index === currentStep;
        });

        if (!stepData) {
            wizardBodyEl.innerHTML = '<p class="hub-panel__sub">Passo concluído.</p>';
            wizardFootEl.innerHTML = '';
            return;
        }

        var stripeHtml = '';

        if (stepData.id === 'stripe' && state.wizard.data && state.wizard.data.stripe) {
            var stripe = state.wizard.data.stripe;
            stripeHtml =
                '<p class="hub-launch__stripe">Stripe · <strong>' + escapeHtml(stripe.label) + '</strong></p>';
        }

        var domainHtml = '';

        if (stepData.id === 'domain' && state.wizard.data && state.wizard.data.domain) {
            var domainInfo = state.wizard.data.domain;
            var domainStatus = domainInfo.configured
                ? (domainInfo.funnel_domain ? '🟢 ' + escapeHtml(domainInfo.funnel_domain) : '🟡 DNS REQUIRED')
                : '🟡 VERCEL_TOKEN / VERCEL_PROJECT_ID em falta';
            domainHtml = '<p class="hub-panel__sub">Domínio: ' + domainStatus + '</p>';
        }

        if (stepData.id === 'tracking') {
            wizardBodyEl.innerHTML = renderWizardTrackingForm(stepData);
            wizardFootEl.innerHTML =
                '<button type="button" class="dr-btn dr-btn--ghost" data-wizard-back="1">← Anterior</button>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                    '<button type="submit" form="hub-wizard-tracking-form" class="dr-btn dr-btn--primary">Guardar tracking →</button>' +
                    '<button type="button" class="dr-btn dr-btn--ghost" data-wizard-next="1">Saltar por agora</button>' +
                '</div>';
            wizardFootEl.querySelector('[data-wizard-back]').onclick = function () {
                state.wizard.step = Math.max(state.wizard.slug ? 2 : 1, currentStep - 1);
                renderOfferWizard();
            };
            wizardFootEl.querySelector('[data-wizard-next]').onclick = function () {
                state.wizard.step = Math.min(9, currentStep + 1);
                renderOfferWizard();
            };
            var trackingForm = document.getElementById('hub-wizard-tracking-form');

            if (trackingForm) {
                trackingForm.onsubmit = handleWizardTrackingStep;
            }

            return;
        }

        wizardBodyEl.innerHTML =
            '<div class="hub-wizard__status-grid">' +
                '<div class="hub-wizard__status-row">' +
                    '<div><strong>' + escapeHtml(stepData.title) + '</strong>' +
                        '<p class="hub-panel__sub">' + escapeHtml(stepData.description) + '</p>' +
                        (stepData.message ? '<p>' + escapeHtml(stepData.message) + '</p>' : '') +
                        stripeHtml + domainHtml +
                    '</div>' +
                    '<span class="dr-status ' + launchStatusClass(stepData.status === 'pass' ? 'ready' : (stepData.status === 'warning' ? 'almost_ready' : 'not_ready')) + '">' +
                        '<span class="dr-status__dot"></span>' +
                        escapeHtml(stepData.status === 'pass' ? 'OK' : (stepData.status === 'warning' ? 'Aviso' : 'Por configurar')) +
                    '</span>' +
                '</div>' +
            '</div>';

        var configureBtn = stepData.action && stepData.action.moduleId
            ? '<button type="button" class="dr-btn dr-btn--ghost" data-wizard-configure="1">' +
                escapeHtml(stepData.action.label || 'Configurar') + '</button>'
            : '';

        var validateBtn = stepData.id === 'check'
            ? '<button type="button" class="dr-btn dr-btn--ghost" data-wizard-validate="1">Executar validação</button>'
            : '';

        var launchBtn = stepData.id === 'ready'
            ? '<button type="button" class="dr-btn dr-btn--primary" data-wizard-launch="1"' +
                ((state.wizard.data && state.wizard.data.launch.readiness === 'ready') ? '' : ' disabled') +
                '>Launch offer</button>'
            : '';

        wizardFootEl.innerHTML =
            '<button type="button" class="dr-btn dr-btn--ghost" data-wizard-back="1">← Anterior</button>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                configureBtn + validateBtn + launchBtn +
                (currentStep < 9
                    ? '<button type="button" class="dr-btn dr-btn--primary" data-wizard-next="1">Seguinte →</button>'
                    : '') +
            '</div>';

        wizardFootEl.querySelector('[data-wizard-back]').onclick = function () {
            state.wizard.step = Math.max(state.wizard.slug ? 2 : 1, currentStep - 1);
            renderOfferWizard();
        };

        var nextBtn = wizardFootEl.querySelector('[data-wizard-next]');

        if (nextBtn) {
            nextBtn.onclick = function () {
                state.wizard.step = Math.min(9, currentStep + 1);
                renderOfferWizard();
            };
        }

        var configBtn = wizardFootEl.querySelector('[data-wizard-configure]');

        if (configBtn && stepData.action) {
            configBtn.onclick = function () {
                closeOfferWizard();
                openModule(stepData.action.moduleId, null, stepData.action.navKey || stepData.action.moduleId);
            };
        }

        var validateStepBtn = wizardFootEl.querySelector('[data-wizard-validate]');

        if (validateStepBtn) {
            validateStepBtn.onclick = async function () {
                await runWizardValidation();
            };
        }

        var launchStepBtn = wizardFootEl.querySelector('[data-wizard-launch]');

        if (launchStepBtn) {
            launchStepBtn.onclick = async function () {
                await runWizardLaunch();
            };
        }
    }

    async function handleWizardCreateOffer(event) {
        event.preventDefault();

        if (state.wizard.busy) {
            return;
        }

        var nameInput = document.getElementById('hub-wizard-name');
        var domainInput = document.getElementById('hub-wizard-domain');
        var currencyInput = document.getElementById('hub-wizard-currency');
        var errorEl = document.getElementById('hub-wizard-error');
        var name = nameInput.value.trim();
        var funnelDomain = domainInput.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        var currency = currencyInput ? currencyInput.value : 'eur';

        errorEl.hidden = true;
        state.wizard.busy = true;

        try {
            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_create_offer',
                {
                    method: 'POST',
                    body: {
                        name: name,
                        funnel_domain: funnelDomain,
                        currency: currency,
                        meta_reporting_currency: currency,
                    },
                }
            );

            state.wizard.slug = payload.offer.slug;
            state.wizard.step = 2;
            await loadOffers();
            await refreshWizardData(payload.offer.slug);
            renderOfferWizard();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.hidden = false;
        } finally {
            state.wizard.busy = false;
        }
    }

    async function handleWizardProductStep(event) {
        event.preventDefault();

        if (state.wizard.busy || !state.wizard.slug) {
            return;
        }

        var priceInput = document.getElementById('hub-wizard-price');
        var errorEl = document.getElementById('hub-wizard-error');
        var euros = parseFloat(priceInput.value);
        errorEl.hidden = true;
        state.wizard.busy = true;

        if (!Number.isFinite(euros) || euros < 0.5) {
            errorEl.textContent = 'Preço inválido (mínimo €0.50).';
            errorEl.hidden = false;
            state.wizard.busy = false;
            return;
        }

        try {
            var offer = state.currentOffer || {};
            var checkout = (offer.checkouts || [])[0] || {};
            var currency = (offer.settings && offer.settings.commercial_currency) || checkout.currency || 'eur';

            await apiFetch(
                '/api/sales-attribution?action=hub_provision_offer&slug=' +
                    encodeURIComponent(state.wizard.slug),
                {
                    method: 'POST',
                    body: {
                        amount_cents: Math.round(euros * 100),
                        currency: currency,
                    },
                }
            );

            state.wizard.step = 3;
            await refreshWizardData(state.wizard.slug);
            renderOfferWizard();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.hidden = false;
        } finally {
            state.wizard.busy = false;
        }
    }

    async function runWizardValidation() {
        if (!state.wizard.slug) {
            return;
        }

        try {
            showStatus('A validar…');
            var result = await apiFetch(
                '/api/sales-attribution?action=hub_validate_offer&slug=' +
                    encodeURIComponent(state.wizard.slug),
                { method: 'POST', body: {} }
            );
            state.wizard.data = result.wizard;
            state.wizard.step = 8;
            renderOfferWizard();
            showStatus(result.ready ? '🟢 Ready' : '🔴 Not ready');
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    async function runWizardLaunch() {
        if (!state.wizard.slug) {
            return;
        }

        try {
            showStatus('A lançar…');
            await apiFetch(
                '/api/sales-attribution?action=hub_launch_offer&slug=' +
                    encodeURIComponent(state.wizard.slug),
                { method: 'POST', body: {} }
            );
            await loadOffers();
            closeOfferWizard();
            await openOffer(state.wizard.slug);
            showStatus('🟢 Oferta live.');
        } catch (error) {
            showStatus(error.message, true);
            await refreshWizardData(state.wizard.slug);
            renderOfferWizard();
        }
    }

    function renderWizardTrackingForm(stepData) {
        var offer = state.currentOffer || {};
        var commercialCurrency = (
            (offer.settings && offer.settings.commercial_currency) ||
            'eur'
        ).toUpperCase();

        return '<form class="hub-wizard__form" id="hub-wizard-tracking-form">' +
            '<p class="hub-panel__sub">' + escapeHtml(stepData.description || '') + '</p>' +
            '<div class="dr-alert dr-alert--warning">' +
                '<div class="dr-alert__body">' +
                    '<strong>Cada oferta = tracking próprio</strong>' +
                    '<p>Pixel Meta, GTM Web, GTM Server (Stape) e moeda reporting são exclusivos desta oferta. ' +
                        'Nada é partilhado com a Onda Prodígio ou outras ofertas.</p>' +
                '</div>' +
            '</div>' +
            '<div class="hub-form-grid">' +
                '<label class="hub-int-field"><span>Meta Pixel ID *</span>' +
                    '<input class="hub-login__input" name="meta_pixel_id" required placeholder="1234567890"></label>' +
                '<label class="hub-int-field"><span>Meta Access Token (CAPI) *</span>' +
                    '<input class="hub-login__input" name="meta_access_token" type="password" required placeholder="EAA…"></label>' +
                '<label class="hub-int-field"><span>Moeda reporting Meta</span>' +
                    '<select class="hub-login__input" name="meta_reporting_currency">' +
                        '<option value="EUR"' + (commercialCurrency === 'EUR' ? ' selected' : '') + '>EUR</option>' +
                        '<option value="USD"' + (commercialCurrency === 'USD' ? ' selected' : '') + '>USD</option>' +
                        '<option value="BRL"' + (commercialCurrency === 'BRL' ? ' selected' : '') + '>BRL</option>' +
                    '</select></label>' +
                '<label class="hub-int-field"><span>GTM Container ID (Web)</span>' +
                    '<input class="hub-login__input" name="gtm_container_id" placeholder="GTM-XXXXXXX"></label>' +
                '<label class="hub-int-field"><span>GTM Server Container</span>' +
                    '<input class="hub-login__input" name="gtm_server_container" placeholder="GTM-XXXXXXX"></label>' +
                '<label class="hub-int-field"><span>Stape / Server URL</span>' +
                    '<input class="hub-login__input" name="server_container_url" placeholder="https://xxxxx.eu.stape.io"></label>' +
                '<label class="hub-int-field"><span>GA4 Measurement ID</span>' +
                    '<input class="hub-login__input" name="ga4_measurement_id" placeholder="G-XXXXXXXX"></label>' +
                '<label class="hub-int-field"><span>GA4 API Secret</span>' +
                    '<input class="hub-login__input" name="ga4_api_secret" type="password" placeholder="Secret"></label>' +
            '</div>' +
            '<p class="hub-create-form__error" id="hub-wizard-error" hidden></p>' +
        '</form>';
    }

    async function handleWizardTrackingStep(event) {
        event.preventDefault();

        if (state.wizard.busy || !state.wizard.slug) {
            return;
        }

        var form = document.getElementById('hub-wizard-tracking-form');
        var errorEl = document.getElementById('hub-wizard-error');
        var integrations = {};
        var fields = [
            'meta_pixel_id',
            'meta_access_token',
            'meta_reporting_currency',
            'gtm_container_id',
            'gtm_server_container',
            'server_container_url',
            'ga4_measurement_id',
            'ga4_api_secret',
        ];

        fields.forEach(function (key) {
            var input = form.querySelector('[name="' + key + '"]');

            if (input && input.value.trim()) {
                integrations[key] = input.value.trim();
            }
        });

        if (!integrations.meta_pixel_id || !integrations.meta_access_token) {
            errorEl.textContent = 'Pixel Meta e Access Token (CAPI) são obrigatórios.';
            errorEl.hidden = false;
            return;
        }

        errorEl.hidden = true;
        state.wizard.busy = true;

        try {
            await apiFetch('/api/sales-attribution?action=hub_save_integrations', {
                method: 'POST',
                body: {
                    slug: state.wizard.slug,
                    integrations: integrations,
                },
            });

            await refreshWizardData(state.wizard.slug);
            state.wizard.step = Math.min(9, (state.wizard.step || 5) + 1);
            renderOfferWizard();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.hidden = false;
        } finally {
            state.wizard.busy = false;
        }
    }

    function renderHealthItems(health) {
        var labels = {
            pixel: 'Pixel Meta',
            capi: 'CAPI',
            ga4: 'GA4',
            stape: 'Stape',
            gtm_server: 'GTM Server',
        };

        return Object.keys(labels).map(function (key) {
            var ok = Boolean(health[key]);
            return '<span class="hub-health__item' + (ok ? ' hub-health__item--ok' : '') + '">' +
                labels[key] + ' · ' + (ok ? 'OK' : 'Falta') +
            '</span>';
        }).join('');
    }

    function renderKvRows(values) {
        return Object.keys(values).map(function (key) {
            return '<div class="hub-kv__row">' +
                '<div class="hub-kv__key">' + escapeHtml(key.replace(/_/g, ' ')) + '</div>' +
                '<div class="hub-kv__value">' + escapeHtml(values[key]) + '</div>' +
            '</div>';
        }).join('');
    }

    function renderFlowList(flows) {
        return flows.map(function (flow) {
            var statusClass = flow.status === 'live' ? 'hub-tag--live' : 'hub-tag--soon';
            var statusLabel = flow.status === 'live' ? 'Activo' : 'Em breve';

            return '<div class="hub-flow">' +
                '<div class="hub-flow__title">' + escapeHtml(flow.label) + '</div>' +
                '<div class="hub-flow__meta">' +
                    '<span>' + escapeHtml((flow.channels || []).join(' · ')) + '</span>' +
                    '<span class="hub-tag ' + statusClass + '">' + statusLabel + '</span>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    function renderCheckoutModule(data) {
        var checkout = data.checkout || {};
        var amountEuros = checkout.amount_cents
            ? (checkout.amount_cents / 100).toFixed(2).replace('.', ',')
            : '—';
        var currency = String(checkout.currency || 'eur').toUpperCase();
        var previewUrl = data.preview_url || checkout.path || '';
        var liveUrl = data.live_url || previewUrl.replace('mode=test', 'mode=live');
        var template = data.template || {};
        var bumps = data.order_bumps || [];

        modulePanel.innerHTML =
            '<article class="hub-panel">' +
                '<h3>Checkout universal</h3>' +
                '<p class="hub-panel__sub">Layout, preço e order bumps — o pagamento Stripe mantém-se no core.</p>' +
                '<div class="hub-stats">' +
                    '<div class="hub-stat">' +
                        '<div class="hub-stat__value">' + escapeHtml(amountEuros + (currency === 'EUR' ? ' €' : ' ' + currency)) + '</div>' +
                        '<div class="hub-stat__label">Preço principal</div>' +
                    '</div>' +
                    '<div class="hub-stat">' +
                        '<div class="hub-stat__value">' + bumps.length + '</div>' +
                        '<div class="hub-stat__label">Order bumps</div>' +
                    '</div>' +
                    '<div class="hub-stat">' +
                        '<div class="hub-stat__value">' + (template.has_custom ? 'Sim' : 'Por criar') + '</div>' +
                        '<div class="hub-stat__label">Layout Gemini</div>' +
                    '</div>' +
                '</div>' +
                '<div class="hub-actions">' +
                    (previewUrl
                        ? '<a class="hub-button hub-button--ghost" href="' + escapeHtml(previewUrl) + '" target="_blank" rel="noopener">Preview teste</a>'
                        : '') +
                    (liveUrl && liveUrl !== previewUrl
                        ? '<a class="hub-button hub-button--ghost" href="' + escapeHtml(liveUrl) + '" target="_blank" rel="noopener">Abrir live</a>'
                        : '') +
                    '<button type="button" class="hub-button hub-button--ghost" data-open-integrations="1">Stripe &amp; integrações</button>' +
                '</div>' +
            '</article>' +
            (bumps.length
                ? '<article class="hub-panel"><h3>Order bumps</h3><div class="hub-kv">' +
                    bumps.map(function (bump) {
                        var bumpPrice = ((bump.amount_cents || 0) / 100).toFixed(2).replace('.', ',');
                        return '<div class="hub-kv__row"><span>' + escapeHtml(bump.label || bump.bump_id) +
                            '</span><strong>+' + escapeHtml(bumpPrice) + ' €</strong></div>';
                    }).join('') +
                '</div></article>'
                : '') +
            '<article class="hub-panel hub-gemini-mount">' +
                '<h3>Construir checkout com Gemini</h3>' +
                '<p class="hub-panel__sub">Descreve o layout (dark, scarcity, MB WAY, testemunhos). A IA gera HTML/CSS e configura preço/bumps.</p>' +
                '<div data-gemini-checkout="1"></div>' +
            '</article>';

        var openIntegrationsBtn = modulePanel.querySelector('[data-open-integrations]');

        if (openIntegrationsBtn) {
            openIntegrationsBtn.addEventListener('click', function () {
                openModule('integracoes');
            });
        }

        var geminiMount = modulePanel.querySelector('[data-gemini-checkout]');

        if (geminiMount) {
            mountGeminiPanel(geminiMount, { mode: 'checkout', moduleData: data });
        }
    }

    function renderTrackingModule(data) {
        var scriptUrl = (data.funnel_url || '') + (data.script_path || '/assets/tracking.js');
        var isolationBanner = '';

        if (data.isolated) {
            isolationBanner =
                '<div class="dr-alert dr-alert--warning">' +
                    '<div class="dr-alert__body">' +
                        '<strong>Tracking isolado por oferta</strong>' +
                        '<p>Cada oferta tem o seu pixel, GTM, Stape e moeda. ' +
                            'Nada é partilhado com outras ofertas — configura abaixo ou em Integrações.</p>' +
                    '</div>' +
                '</div>';
        } else if (data.uses_env_fallback) {
            isolationBanner =
                '<div class="dr-alert">' +
                    '<div class="dr-alert__body">' +
                        '<strong>Oferta legacy</strong>' +
                        '<p>Valores em falta podem ser preenchidos a partir das variáveis de ambiente (Onda Prodígio).</p>' +
                    '</div>' +
                '</div>';
        }

        modulePanel.innerHTML =
            isolationBanner +
            '<article class="hub-panel">' +
                '<h3>Estado do tracking</h3>' +
                '<p class="hub-panel__sub">Pixel, CAPI, GA4 e Stape configurados para esta oferta.</p>' +
                '<div class="hub-health">' + renderHealthItems(data.health || {}) + '</div>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>Valores activos</h3>' +
                '<div class="hub-kv">' + renderKvRows(data.values || {}) + '</div>' +
                '<div class="hub-actions">' +
                    '<button type="button" class="hub-button hub-button--ghost" data-open-integrations="1">Abrir Integrações</button>' +
                '</div>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>UTM para anúncios Meta</h3>' +
                '<p class="hub-panel__sub">Coloca no campo Parâmetros de URL de cada anúncio.</p>' +
                '<div class="hub-copy-row">' +
                    '<code>' + escapeHtml(data.utm_template) + '</code>' +
                    '<button class="hub-button hub-button--ghost hub-copy-button" type="button" data-copy="' + escapeHtml(data.utm_template) + '">Copiar</button>' +
                '</div>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>Script do funil</h3>' +
                '<p class="hub-panel__sub">Incluído no site público desta oferta.</p>' +
                '<div class="hub-copy-row">' +
                    '<code>' + escapeHtml(scriptUrl) + '</code>' +
                    '<button class="hub-button hub-button--ghost hub-copy-button" type="button" data-copy="' + escapeHtml(scriptUrl) + '">Copiar URL</button>' +
                '</div>' +
            '</article>' +
            '<article class="hub-panel hub-gemini-mount">' +
                '<h3>Configurar com Gemini</h3>' +
                '<p class="hub-panel__sub">Cola pixel, GTM, Stape — a IA regista na oferta.</p>' +
                '<div data-gemini-tracking="1"></div>' +
            '</article>';

        modulePanel.querySelectorAll('.hub-copy-button').forEach(function (button) {
            button.addEventListener('click', function () {
                copyText(button.getAttribute('data-copy'), button);
            });
        });

        var openIntegrationsBtn = modulePanel.querySelector('[data-open-integrations]');

        if (openIntegrationsBtn) {
            openIntegrationsBtn.addEventListener('click', function () {
                openModule('integracoes');
            });
        }

        var geminiMount = modulePanel.querySelector('[data-gemini-tracking]');

        if (geminiMount) {
            mountGeminiPanel(geminiMount, { mode: 'tracking', moduleData: data });
        }
    }

    function renderRecuperaModule(data, offer) {
        var dashboardHref = '/metricas/?offer=' + encodeURIComponent(offer.slug);

        modulePanel.innerHTML =
            '<article class="hub-panel">' +
                '<h3>Filas activas</h3>' +
                '<div class="hub-stats">' +
                    '<div class="hub-stat">' +
                        '<div class="hub-stat__value">' + (data.queues.failed_payments_pending || 0) + '</div>' +
                        '<div class="hub-stat__label">Pagamentos falhados pendentes</div>' +
                    '</div>' +
                    '<div class="hub-stat">' +
                        '<div class="hub-stat__value">' + (data.queues.never_logged_in_pending || 0) + '</div>' +
                        '<div class="hub-stat__label">Nunca entrou pendentes</div>' +
                    '</div>' +
                '</div>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>Fluxos de recuperação</h3>' +
                '<p class="hub-panel__sub">Fluxos editáveis por oferta — a IA cria, tu vês e editas.</p>' +
                '<div class="hub-flow-list">' + renderFlowList(data.flows || []) + '</div>' +
                '<div class="hub-actions">' +
                    '<a class="hub-button" href="' + dashboardHref + '">Abrir falhados no Dashboard</a>' +
                '</div>' +
            '</article>' +
            '<article class="hub-panel hub-gemini-mount">' +
                '<h3>Configurar recovery com Gemini</h3>' +
                '<p class="hub-panel__sub">Ex.: "Cria recuperação de checkout abandonado com email + WhatsApp".</p>' +
                '<div data-gemini-recovery="1"></div>' +
            '</article>';

        var geminiMount = modulePanel.querySelector('[data-gemini-recovery]');

        if (geminiMount) {
            mountGeminiPanel(geminiMount, { mode: 'recovery', moduleData: data });
        }
    }

    function renderImpulsionaModule(data) {
        modulePanel.innerHTML =
            '<article class="hub-panel">' +
                '<h3>Envios pós-venda</h3>' +
                '<div class="hub-stats">' +
                    '<div class="hub-stat">' +
                        '<div class="hub-stat__value">' + ((data.stats && data.stats.purchase_emails_sent) || 0) + '</div>' +
                        '<div class="hub-stat__label">Emails de compra enviados</div>' +
                    '</div>' +
                '</div>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>Fluxos Impulsiona</h3>' +
                '<p class="hub-panel__sub">Automações pós-venda por oferta — geradas por IA e editáveis.</p>' +
                '<div class="hub-flow-list">' + renderFlowList(data.flows || []) + '</div>' +
            '</article>' +
            '<article class="hub-panel hub-gemini-mount">' +
                '<h3>Configurar automações com Gemini</h3>' +
                '<p class="hub-panel__sub">Ex.: "Cria sequência de upsell após compra".</p>' +
                '<div data-gemini-automation="1"></div>' +
            '</article>';

        var geminiMount = modulePanel.querySelector('[data-gemini-automation]');

        if (geminiMount) {
            mountGeminiPanel(geminiMount, { mode: 'automation', moduleData: data });
        }
    }

    function integrationItemMap(data) {
        var map = {};

        Object.keys(data.groups || {}).forEach(function (groupId) {
            (data.groups[groupId].items || []).forEach(function (item) {
                map[item.key] = item;
            });
        });

        return map;
    }

    function integrationServiceStatus(items) {
        var configured = items.filter(function (item) {
            return item && item.configured;
        }).length;

        if (configured === items.length && items.length) {
            return { label: 'Configurado', className: 'dr-status--connected' };
        }

        if (configured > 0) {
            return { label: 'Parcial', className: 'dr-status--draft' };
        }

        return { label: 'Não configurado', className: 'dr-status--missing' };
    }

    function renderIntegrationService(name, fieldDefs, itemMap) {
        var items = fieldDefs.map(function (field) {
            return itemMap[field.key] || {
                key: field.key,
                label: field.label,
                secret: field.secret,
                value: '',
                configured: false,
            };
        });
        var status = integrationServiceStatus(items);
        var fieldsHtml = fieldDefs.map(function (field) {
            var item = itemMap[field.key] || {
                key: field.key,
                secret: field.secret,
                value: '',
            };
            var inputType = item.secret ? 'password' : 'text';
            var placeholder = item.secret ? '••••••••' : 'Valor';

            return '<label class="hub-int-field">' +
                '<span>' + escapeHtml(field.label) + '</span>' +
                '<input data-integration-key="' + escapeHtml(item.key) + '" type="' + inputType + '" ' +
                    'value="' + escapeHtml(item.value || '') + '" placeholder="' + placeholder + '" autocomplete="off">' +
            '</label>';
        }).join('');

        return '<article class="hub-int-service">' +
            '<div class="hub-int-service__head">' +
                '<h4>' + escapeHtml(name) + '</h4>' +
                '<span class="dr-status ' + status.className + '">' +
                    '<span class="dr-status__dot"></span>' + escapeHtml(status.label) +
                '</span>' +
            '</div>' +
            '<div class="hub-int-fields">' + fieldsHtml + '</div>' +
        '</article>';
    }

    function renderMetaAccountRow(account, index) {
        return '<div class="hub-meta-account-row" data-meta-index="' + index + '">' +
            '<label class="hub-int-field">' +
                '<span>ID da conta</span>' +
                '<input type="text" data-meta-account-id placeholder="123456789 ou act_123…" ' +
                    'value="' + escapeHtml((account && account.account_id) || '') + '" autocomplete="off">' +
            '</label>' +
            '<label class="hub-int-field">' +
                '<span>Nome (opcional)</span>' +
                '<input type="text" data-meta-account-label placeholder="Conta principal" ' +
                    'value="' + escapeHtml((account && account.label) || '') + '" autocomplete="off">' +
            '</label>' +
            '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm hub-meta-account-row__remove" ' +
                'data-meta-account-remove title="Remover conta">Remover</button>' +
        '</div>';
    }

    function readMetaAccountsFromDom(listRoot) {
        if (!listRoot) {
            return [];
        }

        return Array.prototype.slice.call(listRoot.querySelectorAll('.hub-meta-account-row')).map(function (row) {
            var idInput = row.querySelector('[data-meta-account-id]');
            var labelInput = row.querySelector('[data-meta-account-label]');

            return {
                account_id: idInput ? idInput.value.trim() : '',
                label: labelInput ? labelInput.value.trim() : '',
            };
        }).filter(function (entry) {
            return entry.account_id;
        });
    }

    function bindMetaAccountsEditor(root, messageEl) {
        if (!root) {
            return;
        }

        var listRoot = root.querySelector('#hub-meta-accounts-list');
        var addButton = root.querySelector('#hub-meta-account-add');
        var saveButton = root.querySelector('#hub-meta-accounts-save');

        if (!listRoot || !addButton || !saveButton) {
            return;
        }

        addButton.addEventListener('click', function () {
            var index = listRoot.querySelectorAll('.hub-meta-account-row').length;
            listRoot.insertAdjacentHTML('beforeend', renderMetaAccountRow({}, index));
        });

        listRoot.addEventListener('click', function (event) {
            var removeButton = event.target.closest('[data-meta-account-remove]');

            if (!removeButton) {
                return;
            }

            var row = removeButton.closest('.hub-meta-account-row');

            if (row) {
                row.remove();
            }
        });

        saveButton.addEventListener('click', async function () {
            if (!state.currentOffer) {
                return;
            }

            if (messageEl) {
                messageEl.hidden = true;
            }

            try {
                showStatus('A guardar contas Meta…');
                var payload = await apiFetch('/api/sales-attribution?action=hub_save_meta_accounts', {
                    method: 'POST',
                    body: {
                        slug: state.currentOffer.slug,
                        accounts: readMetaAccountsFromDom(listRoot),
                    },
                });

                if (payload.offer) {
                    state.currentOffer = payload.offer;
                    var offerIndex = state.offers.findIndex(function (entry) {
                        return entry.slug === payload.offer.slug;
                    });

                    if (offerIndex >= 0) {
                        state.offers[offerIndex] = payload.offer;
                    }
                }

                if (messageEl) {
                    messageEl.textContent = (payload.result && payload.result.count === 1)
                        ? '1 conta Meta guardada.'
                        : ((payload.result && payload.result.count) || 0) + ' contas Meta guardadas.';
                    messageEl.hidden = false;
                }

                showStatus('');
            } catch (error) {
                if (messageEl) {
                    messageEl.textContent = error.message;
                    messageEl.hidden = false;
                }

                showStatus('');
            }
        });
    }

    function renderMetaAccountsSection(offer) {
        var accounts = (offer && offer.meta_accounts) || [];
        var rowsHtml = accounts.length
            ? accounts.map(function (account, index) {
                return renderMetaAccountRow(account, index);
            }).join('')
            : renderMetaAccountRow({}, 0);

        return '<article class="hub-panel hub-meta-accounts">' +
            '<div class="hub-section-mark"><h2>Contas de anúncios Meta</h2></div>' +
            '<p class="hub-panel__sub">Liga uma ou mais contas Meta a esta oferta. ' +
                'O gasto, ROAS e EPC aparecem no Início e no Dashboard.</p>' +
            '<div class="hub-meta-accounts-list" id="hub-meta-accounts-list">' + rowsHtml + '</div>' +
            '<div class="hub-meta-accounts-actions">' +
                '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" id="hub-meta-account-add">+ Adicionar conta</button>' +
                '<button type="button" class="hub-button" id="hub-meta-accounts-save">Guardar contas Meta</button>' +
            '</div>' +
            '<p class="hub-form-message" id="hub-meta-accounts-message" hidden></p>' +
        '</article>';
    }

    function renderIntegracoesModule(data) {
        var itemMap = integrationItemMap(data);
        var servicesHtml =
            '<div class="hub-section-mark"><h2>Tracking</h2></div>' +
            renderIntegrationService('Meta', [
                { key: 'meta_pixel_id', label: 'Pixel ID' },
                { key: 'meta_access_token', label: 'Access Token', secret: true },
                { key: 'meta_test_event_code', label: 'Test Event Code', secret: true },
                { key: 'meta_reporting_currency', label: 'Moeda reporting' },
            ], itemMap) +
            renderIntegrationService('Google Analytics', [
                { key: 'ga4_measurement_id', label: 'Measurement ID' },
                { key: 'ga4_api_secret', label: 'API Secret', secret: true },
            ], itemMap) +
            renderIntegrationService('Google Tag Manager', [
                { key: 'gtm_container_id', label: 'Container ID' },
                { key: 'gtm_server_container', label: 'Server Container' },
                { key: 'server_container_url', label: 'Server URL' },
            ], itemMap) +
            '<div class="hub-section-mark"><h2>Pagamentos</h2></div>' +
            renderIntegrationService('Stripe', [
                { key: 'stripe_publishable_key', label: 'Publishable Key' },
                { key: 'stripe_secret_key', label: 'Secret Key', secret: true },
                { key: 'stripe_test_publishable_key', label: 'Test Publishable Key' },
                { key: 'stripe_test_secret_key', label: 'Test Secret Key', secret: true },
                { key: 'stripe_webhook_secret', label: 'Webhook Secret', secret: true },
            ], itemMap) +
            '<div class="hub-section-mark"><h2>Comunicação</h2></div>' +
            renderIntegrationService('Gmail', [
                { key: 'gmail_user', label: 'Conta Gmail' },
                { key: 'gmail_app_password', label: 'App Password', secret: true },
                { key: 'gmail_from_name', label: 'Nome remetente' },
            ], itemMap) +
            renderIntegrationService('WhatsApp', [
                { key: 'whatsapp_enabled', label: 'Activado (true/false)' },
                { key: 'evolution_api_url', label: 'Evolution API URL' },
                { key: 'evolution_api_key', label: 'API Key', secret: true },
                { key: 'evolution_instance_name', label: 'Instância' },
            ], itemMap) +
            '<div class="hub-section-mark"><h2>Outros</h2></div>' +
            renderIntegrationService('VTurb', [
                { key: 'vturb_player_id', label: 'Player ID' },
                { key: 'vturb_analytics_api_token', label: 'Analytics Token', secret: true },
            ], itemMap) +
            '<div class="hub-section-mark"><h2>Base de dados</h2></div>' +
            renderIntegrationService('Supabase', [
                { key: 'supabase_url', label: 'Project URL' },
                { key: 'supabase_anon_key', label: 'Anon Key' },
                { key: 'supabase_service_role_key', label: 'Service Role Key', secret: true },
            ], itemMap);

        var canImportEnv = data.can_import_env !== false;

        modulePanel.innerHTML =
            '<article class="hub-panel">' +
                '<div class="hub-panel__head"><h2>Integrações</h2></div>' +
                '<p class="hub-panel__sub">Liga serviços por oferta. Valores secretos ficam mascarados — deixa vazio para manter o actual.</p>' +
                (canImportEnv
                    ? ''
                    : '<div class="dr-alert dr-alert--warning"><div class="dr-alert__body">' +
                        '<strong>Isolamento por oferta</strong>' +
                        '<p>Cada oferta tem credenciais próprias. Nada é herdado de outras ofertas.</p>' +
                    '</div></div>') +
                '<form class="hub-integrations-form hub-int-services" id="hub-integrations-form">' +
                    servicesHtml +
                    '<div class="hub-actions">' +
                        '<button class="hub-button" type="submit">Guardar integrações</button>' +
                        (canImportEnv
                            ? '<button class="hub-button hub-button--ghost" type="button" id="hub-import-integrations">Importar do env actual</button>'
                            : '') +
                    '</div>' +
                    '<p class="hub-form-message" id="hub-integrations-message" hidden></p>' +
                '</form>' +
            '</article>' +
            renderMetaAccountsSection(state.currentOffer);

        var form = modulePanel.querySelector('#hub-integrations-form');
        var messageEl = modulePanel.querySelector('#hub-integrations-message');
        var importButton = modulePanel.querySelector('#hub-import-integrations');
        var metaMessageEl = modulePanel.querySelector('#hub-meta-accounts-message');

        bindMetaAccountsEditor(modulePanel, metaMessageEl);

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            messageEl.hidden = true;

            var integrations = {};
            form.querySelectorAll('[data-integration-key]').forEach(function (input) {
                integrations[input.getAttribute('data-integration-key')] = input.value;
            });

            try {
                showStatus('A guardar integrações…');
                var payload = await apiFetch('/api/sales-attribution?action=hub_save_integrations', {
                    method: 'POST',
                    body: {
                        slug: state.currentOffer.slug,
                        integrations: integrations,
                    },
                });
                renderIntegracoesModule(payload.module);
                messageEl.textContent = payload.result.message || 'Integrações guardadas.';
                messageEl.hidden = false;
                showStatus('');
            } catch (error) {
                messageEl.textContent = error.message;
                messageEl.hidden = false;
                showStatus('');
            }
        });

        if (importButton) {
            importButton.addEventListener('click', async function () {
                messageEl.hidden = true;

                try {
                    showStatus('A importar credenciais…');
                    var payload = await apiFetch(
                        '/api/sales-attribution?action=hub_import_integrations&slug=' +
                            encodeURIComponent(state.currentOffer.slug),
                        { method: 'POST', body: {} }
                    );
                    renderIntegracoesModule(payload.module);
                    messageEl.textContent = payload.result.message || 'Importação concluída.';
                    messageEl.hidden = false;
                    showStatus('');
                } catch (error) {
                    messageEl.textContent = error.message;
                    messageEl.hidden = false;
                    showStatus('');
                }
            });
        }
    }

    function bindCommunityEmbedAuth(iframe, module) {
        if (!iframe || !module || module.id !== 'comunidade') {
            return;
        }

        var targetOrigin = '*';

        try {
            targetOrigin = new URL(module.href, window.location.href).origin;
        } catch (error) {
            targetOrigin = '*';
        }

        function sendToken() {
            var token = getToken();

            if (!token || !iframe.contentWindow) {
                return;
            }

            iframe.contentWindow.postMessage({
                type: 'onda-hub-adm-token',
                token: token,
            }, targetOrigin);
        }

        iframe.addEventListener('load', sendToken);

        function onAdmReady(event) {
            if (event.source !== iframe.contentWindow) {
                return;
            }

            if (!event.data || event.data.type !== 'onda-adm-ready') {
                return;
            }

            sendToken();
        }

        window.addEventListener('message', onAdmReady);
    }

    function openEmbedModule(module, tokenOverride) {
        if (!state.currentOffer) {
            return;
        }

        state.currentModule = module.id;
        state.moduleNavKey = module.id;
        state.currentEmbed = module;
        setNavIntent(state.currentOffer.slug, module.id, module.id);
        moduleView.classList.add('hub-view--embed');
        modulePanel.innerHTML =
            '<iframe class="hub-embed" src="' + escapeHtml(module.href) + '" title="' + escapeHtml(module.label) + '"></iframe>';
        bindCommunityEmbedAuth(modulePanel.querySelector('.hub-embed'), module);
        setView('module');
        updateUrl(state.currentOffer.slug, module.id);
        renderSidebar();
        showStatus('');
    }

    function renderModulePanel(moduleId, data) {
        if (moduleId === 'ai-agent') {
            modulePanel.innerHTML =
                '<article class="hub-panel hub-gemini-mount">' +
                    '<h3>Gemini — assistente rápido</h3>' +
                    '<p class="hub-panel__sub">Funis, tracking, domínios e pages. Resposta imediata com execução de tools.</p>' +
                    '<div id="hub-gemini-agent-panel"></div>' +
                '</article>' +
                '<div id="hub-ai-agent-mount"></div>';
            mountGeminiPanel(modulePanel.querySelector('#hub-gemini-agent-panel'), {
                mode: 'general',
                moduleData: data,
            });
            if (window.HubAI) {
                window.HubAI.render(modulePanel.querySelector('#hub-ai-agent-mount'), data, {
                    offer: state.currentOffer,
                    apiFetch: apiFetch,
                });
            } else {
                modulePanel.querySelector('#hub-ai-agent-mount').innerHTML =
                    '<article class="hub-panel"><p>Cursor Agent indisponível.</p></article>';
            }
            return;
        }

        if (moduleId === 'tracking') {
            renderTrackingModule(data);
            return;
        }

        if (moduleId === 'recupera') {
            renderRecuperaModule(data, state.currentOffer);
            return;
        }

        if (moduleId === 'impulsiona') {
            renderImpulsionaModule(data);
            return;
        }

        if (moduleId === 'integracoes') {
            renderIntegracoesModule(data);
            return;
        }

        if (moduleId === 'funil') {
            renderFunilModule(data);
            return;
        }

        if (moduleId === 'checkout') {
            renderCheckoutModule(data);
            return;
        }

        if (moduleId === 'dominios') {
            renderDominiosModule(data);
            return;
        }

        if (moduleId === 'definicoes') {
            renderDefinicoesModule(data);
            return;
        }

        modulePanel.innerHTML = '<article class="hub-panel"><p>Módulo indisponível.</p></article>';
    }

    function bindOfferSettingsForm(form, fields) {
        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            var messageEl = form.querySelector('.hub-form-message');
            var patch = {};

            fields.forEach(function (field) {
                var input = form.querySelector('[name="' + field.name + '"]');

                if (!input) {
                    return;
                }

                if (field.brandingKey) {
                    if (!patch.branding) {
                        patch.branding = {};
                    }

                    patch.branding[field.brandingKey] = input.value;
                    return;
                }

                patch[field.name] = input.value;
            });

            if (messageEl) {
                messageEl.hidden = true;
            }

            try {
                showStatus('A guardar…');
                var payload = await apiFetch('/api/sales-attribution?action=hub_save_offer_settings', {
                    method: 'POST',
                    body: {
                        slug: state.currentOffer.slug,
                        settings: patch,
                    },
                });

                if (payload.offer) {
                    state.currentOffer = payload.offer;
                    renderOfferHead(payload.offer);
                }

                if (messageEl) {
                    messageEl.textContent = 'Guardado.';
                    messageEl.hidden = false;
                }

                showStatus('');
            } catch (error) {
                if (messageEl) {
                    messageEl.textContent = error.message;
                    messageEl.hidden = false;
                }

                showStatus('');
            }
        });
    }

    function renderDominiosModule(data) {
        var offer = data.offer || {};
        var urls = data.urls || {};
        var domainsHtml = (data.domains || []).map(function (entry) {
            return '<div class="hub-platform-sale">' +
                '<div class="hub-platform-sale__main">' +
                    '<strong>' + escapeHtml(entry.domain) + '</strong>' +
                    '<span>' + escapeHtml(entry.domain_type) + (entry.is_primary ? ' · principal' : '') + '</span>' +
                '</div>' +
            '</div>';
        }).join('') || '<p class="hub-panel__sub">Sem domínios extra registados.</p>';

        modulePanel.innerHTML =
            '<article class="hub-panel">' +
                '<div class="hub-panel__head"><h2>Domínios</h2></div>' +
                '<p class="hub-panel__sub">Geres tudo no HUB (<strong>hub-dr-ecoom</strong>). ' +
                    'O domínio funil serve checkout, páginas e comunidade desta oferta.</p>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>URLs públicas</h3>' +
                '<div class="hub-kv">' +
                    renderKvRows({
                        'Funil': urls.funnel || '—',
                        'Comunidade': urls.community || '—',
                        'Plataforma HUB': urls.hub || '—',
                    }) +
                '</div>' +
                '<div class="hub-actions-row" style="margin-top:16px">' +
                    (urls.community
                        ? '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" data-open-community="1">Abrir comunidade ↗</button>'
                        : '') +
                    (urls.funnel
                        ? '<a class="dr-btn dr-btn--ghost dr-btn--sm" href="' + escapeHtml(urls.funnel) +
                            '" target="_blank" rel="noopener">Abrir funil ↗</a>'
                        : '') +
                '</div>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>Domínio funil</h3>' +
                '<form class="hub-offer-settings-form" id="hub-domains-form">' +
                    '<label class="hub-int-field">' +
                        '<span>Domínio público da oferta</span>' +
                        '<input name="funnel_domain" type="text" value="' + escapeHtml(offer.funnel_domain || '') +
                            '" placeholder="ex.: onda-prodigio.vercel.app" autocomplete="off">' +
                    '</label>' +
                    '<p class="hub-panel__sub">Domínio HUB (fixo): ' + escapeHtml(offer.hub_domain || 'hub-dr-ecoom.vercel.app') + '</p>' +
                    '<div class="hub-actions">' +
                        '<button class="hub-button" type="submit">Guardar domínio</button>' +
                        '<button class="hub-button hub-button--ghost" type="button" id="hub-domain-vercel">Registar na Vercel</button>' +
                    '</div>' +
                    '<p class="hub-form-message" hidden></p>' +
                '</form>' +
            '</article>' +
            '<article class="hub-panel hub-gemini-mount">' +
                '<h3>Registar com Gemini</h3>' +
                '<p class="hub-panel__sub">Escreve o domínio — a IA regista na Vercel e associa à oferta.</p>' +
                '<div data-gemini-domain="1"></div>' +
            '</article>' +
            '<article class="hub-panel">' +
                '<h3>Domínios registados</h3>' +
                '<div class="hub-platform-recent">' + domainsHtml + '</div>' +
            '</article>';

        var form = modulePanel.querySelector('#hub-domains-form');

        if (form) {
            bindOfferSettingsForm(form, [{ name: 'funnel_domain' }]);
        }

        var vercelBtn = modulePanel.querySelector('#hub-domain-vercel');

        if (vercelBtn) {
            vercelBtn.addEventListener('click', async function () {
                var domainInput = form && form.querySelector('[name="funnel_domain"]');
                var domain = domainInput ? domainInput.value.trim() : '';

                if (!domain) {
                    return;
                }

                try {
                    showStatus('A registar na Vercel…');
                    await apiFetch(
                        '/api/sales-attribution?action=hub_launch_health&slug=' +
                            encodeURIComponent(state.currentOffer.slug) + '&launch_action=verify_domain',
                        {
                            method: 'POST',
                            body: { domain: domain, save: true },
                        }
                    );
                    showStatus('Domínio registado.');
                    await openModule('dominios');
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        }

        var geminiDomainMount = modulePanel.querySelector('[data-gemini-domain]');

        if (geminiDomainMount) {
            mountGeminiPanel(geminiDomainMount, {
                mode: 'domain',
                moduleData: data,
                onComplete: function () {
                    openModule('dominios');
                },
            });
        }

        bindOpenCommunityButtons(modulePanel);
    }

    function renderDefinicoesModule(data) {
        var offer = data.offer || {};
        var branding = offer.branding || {};
        var commercialCurrency = (offer.commercial_currency || 'eur').toLowerCase();

        modulePanel.innerHTML =
            '<article class="hub-panel">' +
                '<div class="hub-panel__head"><h2>Definições da oferta</h2></div>' +
                '<p class="hub-panel__sub">Nome, estado, moeda e branding usados no funil, emails e checkout.</p>' +
                '<form class="hub-offer-settings-form" id="hub-definicoes-form">' +
                    '<div class="hub-form-grid">' +
                        '<label class="hub-int-field"><span>Nome</span>' +
                            '<input name="name" type="text" value="' + escapeHtml(offer.name || '') + '" required></label>' +
                        '<label class="hub-int-field"><span>Slug</span>' +
                            '<input type="text" value="' + escapeHtml(offer.slug || '') + '" disabled></label>' +
                        '<label class="hub-int-field"><span>Moeda comercial</span>' +
                            '<select name="commercial_currency" class="hub-login__input">' +
                                '<option value="eur"' + (commercialCurrency === 'eur' ? ' selected' : '') + '>EUR — Euro</option>' +
                                '<option value="usd"' + (commercialCurrency === 'usd' ? ' selected' : '') + '>USD — Dólar</option>' +
                                '<option value="brl"' + (commercialCurrency === 'brl' ? ' selected' : '') + '>BRL — Real</option>' +
                            '</select></label>' +
                        '<label class="hub-int-field"><span>Estado</span>' +
                            '<select name="status" class="hub-login__input">' +
                                '<option value="active"' + (offer.status === 'active' ? ' selected' : '') + '>Live</option>' +
                                '<option value="draft"' + (offer.status === 'draft' ? ' selected' : '') + '>Rascunho</option>' +
                            '</select></label>' +
                        '<label class="hub-int-field"><span>Modo</span>' +
                            '<select name="mode" class="hub-login__input">' +
                                '<option value="live"' + (offer.mode === 'live' ? ' selected' : '') + '>Live</option>' +
                                '<option value="test"' + (offer.mode === 'test' ? ' selected' : '') + '>Teste</option>' +
                            '</select></label>' +
                        '<label class="hub-int-field"><span>Produto principal</span>' +
                            '<input name="primary_product_id" type="text" value="' +
                                escapeHtml(offer.primary_product_id || '') + '" placeholder="onda-prodigio"></label>' +
                        '<label class="hub-int-field"><span>Nome remetente (branding)</span>' +
                            '<input name="branding_from_name" type="text" value="' +
                                escapeHtml(branding.from_name || '') + '"></label>' +
                        '<label class="hub-int-field"><span>Cor accent</span>' +
                            '<input name="branding_accent" type="text" value="' +
                                escapeHtml(branding.accent || '#7c6cff') + '"></label>' +
                    '</div>' +
                    '<div class="hub-actions">' +
                        '<button class="hub-button" type="submit">Guardar definições</button>' +
                    '</div>' +
                    '<p class="hub-form-message" hidden></p>' +
                '</form>' +
            '</article>';

        var form = modulePanel.querySelector('#hub-definicoes-form');

        if (form) {
            bindOfferSettingsForm(form, [
                { name: 'name' },
                { name: 'commercial_currency' },
                { name: 'status' },
                { name: 'mode' },
                { name: 'primary_product_id' },
                { name: 'branding_from_name', brandingKey: 'from_name' },
                { name: 'branding_accent', brandingKey: 'accent' },
            ]);
        }
    }

    function renderFunilModule(data) {
        var offer = data.offer || state.currentOffer || {};
        var funnels = data.funnels || [];
        var publicSite = data.public_site_url || '';

        var funnelsHtml = funnels.length
            ? funnels.map(function (funnel) {
                var isQuiz = funnel.type === 'quiz';
                var isActive = funnel.status === 'active';
                var stepsBlock = isQuiz ? '' :
                    '<details class="hub-collapsible hub-collapsible--nested" open>' +
                        '<summary>Funil visual</summary>' +
                        '<div class="hub-funnel-steps" data-funnel-steps="' + escapeHtml(funnel.slug) + '">' +
                        '<p class="hub-panel__sub">A carregar…</p></div>' +
                    '</details>';
                var quizBlock = isQuiz
                    ? '<details class="hub-collapsible hub-collapsible--nested">' +
                        '<summary>Quiz — toca para expandir</summary>' +
                        '<div data-quiz-stub="' + escapeHtml(funnel.slug) + '"></div>' +
                    '</details>'
                    : '';
                var pagesBlock = isQuiz ? '' :
                    '<details class="hub-collapsible hub-collapsible--nested">' +
                        '<summary>Pages deste funil</summary>' +
                        '<div class="hub-funnel-pages" data-funnel-pages="' + escapeHtml(funnel.slug) + '">' +
                        '<p class="hub-panel__sub">A carregar…</p></div>' +
                    '</details>';

                return '<details class="hub-collapsible hub-funnel-card" data-funnel-slug="' + escapeHtml(funnel.slug) + '">' +
                    '<summary class="hub-funnel-card__summary">' +
                        '<span class="hub-funnel-card__title">' + escapeHtml(funnel.name) + '</span>' +
                        '<span class="dr-badge dr-badge--' + (isActive ? 'live' : 'draft') + '">' +
                            escapeHtml(funnel.status || 'draft') + (funnel.type ? ' · ' + escapeHtml(funnel.type) : '') +
                        '</span>' +
                        '<span class="hub-funnel-card__actions" data-funnel-actions="' + escapeHtml(funnel.slug) + '">' +
                            '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm hub-funnel-rename" ' +
                                'data-funnel="' + escapeHtml(funnel.slug) + '" data-funnel-name="' +
                                escapeHtml(funnel.name) + '">Renomear</button>' +
                            '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm hub-funnel-activate" ' +
                                'data-funnel="' + escapeHtml(funnel.slug) + '"' + (isActive ? ' disabled' : '') + '>Activar</button>' +
                            '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm hub-funnel-duplicate" ' +
                                'data-funnel="' + escapeHtml(funnel.slug) + '">Duplicar</button>' +
                            '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm hub-funnel-delete" ' +
                                'data-funnel="' + escapeHtml(funnel.slug) + '">Eliminar</button>' +
                        '</span>' +
                    '</summary>' +
                    '<div class="hub-funnel-card__body">' +
                        '<p class="hub-panel__sub">' + escapeHtml(funnel.slug) + '</p>' +
                        stepsBlock +
                        quizBlock +
                        pagesBlock +
                    '</div>' +
                '</details>';
            }).join('')
            : '<div class="dr-empty">' +
                '<p class="dr-empty__title">Ainda não tens funis</p>' +
                '<p class="dr-empty__text">Cria o primeiro funil — pages e steps no mesmo sítio.</p></div>';

        var createFunnelBlock =
            '<details class="hub-collapsible hub-collapsible--create">' +
                '<summary>+ Novo funnel</summary>' +
                '<form class="hub-funnel-create" id="hub-funnel-create-form">' +
                    '<div class="hub-form-grid">' +
                        '<label class="hub-field"><span class="hub-field__label">Nome</span>' +
                        '<input class="hub-login__input" name="funnel_name" required placeholder="Ex.: Funil Principal" minlength="2"></label>' +
                        '<label class="hub-field"><span class="hub-field__label">Slug (opcional)</span>' +
                        '<input class="hub-login__input" name="funnel_slug" placeholder="funil-principal"></label>' +
                        '<label class="hub-field"><span class="hub-field__label">Tipo</span>' +
                        '<select class="hub-login__input" name="funnel_type">' +
                            '<option value="custom">Custom</option>' +
                            '<option value="presell">Pre Sell</option>' +
                            '<option value="vsl">VSL</option>' +
                            '<option value="lead">Lead</option>' +
                            '<option value="webinar">Webinar</option>' +
                            '<option value="quiz">Quiz</option>' +
                        '</select></label>' +
                    '</div>' +
                    '<div class="hub-actions">' +
                        '<button class="hub-button" type="submit">Criar funnel</button>' +
                    '</div>' +
                    '<p class="hub-form-message" id="hub-funnel-create-message" hidden></p>' +
                '</form>' +
            '</details>';

        modulePanel.innerHTML =
            '<article class="hub-panel">' +
                '<div class="hub-panel__head"><h2>Funis</h2></div>' +
                '<p class="hub-panel__sub">Constrói funil e pages aqui — steps, criar page, editor e preview.</p>' +
                (publicSite
                    ? '<p><a class="hub-link" href="' + escapeHtml(publicSite) + '" target="_blank" rel="noopener">Ver site público ↗</a></p>'
                    : '') +
            '</article>' +
            createFunnelBlock +
            funnelsHtml;

        bindFunilModuleEvents(offer);

        funnels.forEach(function (funnel) {
            if (funnel.type === 'quiz') {
                mountQuizStub(offer, funnel);
            } else {
                loadFunnelPages(offer.slug, funnel.slug);
            }
        });
    }

    function mountQuizStub(offer, funnel) {
        var container = modulePanel.querySelector('[data-quiz-stub="' + funnel.slug + '"]');

        if (!container || !window.HubFunnelUI) {
            return;
        }

        container.innerHTML = window.HubFunnelUI.renderQuizStub(funnel, offer.slug);

        var button = container.querySelector('[data-quiz-open-funnel]');

        if (button) {
            button.addEventListener('click', function () {
                var card = modulePanel.querySelector('[data-funnel-slug="' + funnel.slug + '"]');
                var visual = card && card.querySelector('[data-funnel-steps="' + funnel.slug + '"]');

                if (visual) {
                    var details = visual.closest('details');

                    if (details) {
                        details.open = true;
                    }

                    visual.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    }

    function bindFunilModuleEvents(offer) {
        offer = offer || state.currentOffer || {};
        var funnelForm = modulePanel.querySelector('#hub-funnel-create-form');
        var funnelMessage = modulePanel.querySelector('#hub-funnel-create-message');

        if (funnelForm) {
            funnelForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                funnelMessage.hidden = true;

                var nameInput = funnelForm.querySelector('[name="funnel_name"]');
                var slugInput = funnelForm.querySelector('[name="funnel_slug"]');
                var typeInput = funnelForm.querySelector('[name="funnel_type"]');
                var body = {
                    offer: offer.slug,
                    name: nameInput.value.trim(),
                    type: typeInput.value,
                    status: 'draft',
                };

                if (slugInput.value.trim()) {
                    body.slug = slugInput.value.trim();
                }

                try {
                    showStatus('A criar funnel…');
                    await apiFetch('/api/sales-attribution?action=hub_funnel_create', {
                        method: 'POST',
                        body: body,
                    });
                    showStatus('');
                    await openModule('funil');
                } catch (error) {
                    funnelMessage.textContent = error.message;
                    funnelMessage.hidden = false;
                    showStatus('');
                }
            });
        }

        modulePanel.querySelectorAll('.hub-funnel-activate').forEach(function (button) {
            button.addEventListener('click', async function (event) {
                event.preventDefault();
                event.stopPropagation();

                var funnelSlug = button.getAttribute('data-funnel');

                if (!window.confirm('Activar este funil para produção?')) {
                    return;
                }

                try {
                    await apiFetch('/api/sales-attribution?action=hub_funnel_activate', {
                        method: 'POST',
                        body: { offer: offer.slug, funnel: funnelSlug },
                    });
                    await openModule('funil');
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        });

        modulePanel.querySelectorAll('.hub-funnel-rename').forEach(function (button) {
            button.addEventListener('click', async function (event) {
                event.preventDefault();
                event.stopPropagation();

                var funnelSlug = button.getAttribute('data-funnel');
                var currentName = button.getAttribute('data-funnel-name') || funnelSlug;
                var nextName = window.prompt('Novo nome do funil:', currentName);

                if (!nextName || !String(nextName).trim() || String(nextName).trim() === currentName) {
                    return;
                }

                try {
                    showStatus('A renomear funil…');
                    var offerSlugForRename = (offer && offer.slug) || (state.currentOffer && state.currentOffer.slug) || '';
                    if (!offerSlugForRename) {
                        showStatus('Oferta não identificada.', true);
                        return;
                    }
                    await apiFetch('/api/sales-attribution?action=hub_funnel_rename', {
                        method: 'POST',
                        body: {
                            offer: offerSlugForRename,
                            funnel: funnelSlug,
                            name: String(nextName).trim(),
                        },
                    });
                    showStatus('');
                    await openModule('funil');
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        });

        modulePanel.querySelectorAll('.hub-funnel-duplicate').forEach(function (button) {
            button.addEventListener('click', async function (event) {
                event.preventDefault();
                event.stopPropagation();

                var funnelSlug = button.getAttribute('data-funnel');

                try {
                    showStatus('A duplicar funil…');
                    await apiFetch('/api/sales-attribution?action=hub_funnel_duplicate', {
                        method: 'POST',
                        body: { offer: offer.slug, funnel: funnelSlug },
                    });
                    showStatus('');
                    await openModule('funil');
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        });

        modulePanel.querySelectorAll('.hub-funnel-delete').forEach(function (button) {
            button.addEventListener('click', async function (event) {
                event.preventDefault();
                event.stopPropagation();

                var funnelSlug = button.getAttribute('data-funnel');

                if (!window.confirm('Eliminar este funil e todas as pages associadas?')) {
                    return;
                }

                try {
                    await apiFetch('/api/sales-attribution?action=hub_funnel_delete', {
                        method: 'POST',
                        body: { offer: offer.slug, funnel: funnelSlug },
                    });
                    await openModule('funil');
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        });

    }

    function cloneFlowStep(step) {
        return {
            id: step.id,
            kind: step.kind,
            page_type: step.page_type,
            label: step.label,
            sort_order: step.sort_order,
            active_page_id: step.active_page_id,
            variant_page_ids: step.variant_page_ids || [],
            checkout_id: step.checkout_id || 'main',
            lane: step.lane || 'main',
            parent_step_id: step.parent_step_id || null,
            is_step_active: step.is_step_active !== false,
        };
    }

    function getMainStepsInStateOrder(state) {
        return state.filter(function (row) {
            return row.lane !== 'reject';
        });
    }

    function getMainStepsOrdered(state) {
        return getMainStepsInStateOrder(state).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });
    }

    function reindexMainSteps(state) {
        getMainStepsInStateOrder(state).forEach(function (step, index) {
            step.sort_order = (index + 1) * 100;
        });
    }

    function insertStepAfter(state, afterStepId, stepDef) {
        var main = getMainStepsOrdered(state);
        var index = main.findIndex(function (row) {
            return row.id === afterStepId;
        });
        var newStep = Object.assign({
            id: 'step-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            active_page_id: null,
            variant_page_ids: [],
            checkout_id: 'main',
            lane: 'main',
            parent_step_id: null,
            is_step_active: true,
        }, stepDef);

        if (index === -1) {
            state.push(newStep);
        } else {
            var insertAt = 0;

            for (var i = 0; i < state.length; i += 1) {
                if (state[i].id === main[index].id) {
                    insertAt = i + 1;
                    break;
                }
            }

            state.splice(insertAt, 0, newStep);
        }

        reindexMainSteps(state);
        return newStep;
    }

    function reorderMainSteps(state, sourceId, targetId) {
        var main = getMainStepsOrdered(state);
        var fromIndex = main.findIndex(function (row) { return row.id === sourceId; });
        var toIndex = main.findIndex(function (row) { return row.id === targetId; });

        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
            return false;
        }

        var moved = main.splice(fromIndex, 1)[0];
        main.splice(toIndex, 0, moved);

        var rejectSteps = state.filter(function (row) {
            return row.lane === 'reject';
        });

        state.length = 0;
        main.forEach(function (step) {
            state.push(step);
        });
        rejectSteps.forEach(function (step) {
            state.push(step);
        });
        reindexMainSteps(state);

        return true;
    }

    function readAddKindFromBuilder(container, funnelSlug) {
        var select = container.querySelector('#hub-funnel-add-kind-' + funnelSlug);

        if (!select) {
            return { kind: 'page', page_type: 'sales', label: 'Página' };
        }

        var option = select.options[select.selectedIndex];

        return {
            kind: option.getAttribute('data-kind') || 'page',
            page_type: option.getAttribute('data-page-type') || 'sales',
            label: option.getAttribute('data-label') || option.textContent.trim(),
        };
    }

    function bindFunnelFlowBuilder(container, ctx, offerSlug, funnelSlug) {
        if (!container || !window.HubFunnelUI) {
            return;
        }

        var flowState = (ctx.flow || []).map(cloneFlowStep);
        var offerPages = ctx.offer_pages || ctx.all_pages || ctx.pages || [];
        var pageTemplates = ctx.page_templates || [];
        var checkoutTemplates = ctx.checkout_templates || [];
        var navMode = ctx.nav_mode || 'select';
        var panX = parseInt(ctx.pan_x, 10) || 0;

        function buildRenderCtx() {
            return {
                flow: flowState,
                offer_pages: offerPages,
                all_pages: offerPages,
                offer_slug: offerSlug,
                funnel_slug: funnelSlug,
                checkout_url: ctx.checkout_url,
                page_templates: pageTemplates,
                checkout_templates: checkoutTemplates,
                nav_mode: navMode,
                pan_x: panX,
            };
        }

        async function autoSaveFlow() {
            try {
                await apiFetch('/api/sales-attribution?action=hub_funnel_flow_save', {
                    method: 'POST',
                    body: {
                        offer: offerSlug,
                        funnel: funnelSlug,
                        flow: flowState,
                    },
                });
            } catch (_) {
                // non-fatal — user can still save manually
            }
        }

        function rerender() {
            var mount = container.parentElement;

            if (!mount) {
                return;
            }

            panX = parseInt(container.getAttribute('data-pan-x') || String(panX), 10) || 0;

            if (container._navAbort) {
                container._navAbort.abort();
            }

            mount.innerHTML = window.HubFunnelUI.renderFunnelBuilder(buildRenderCtx());
            var nextContainer = mount.querySelector('.hub-funnel-builder');

            if (!nextContainer) {
                return;
            }

            bindFunnelFlowBuilder(nextContainer, Object.assign({}, ctx, {
                flow: flowState,
                offer_pages: offerPages,
                nav_mode: navMode,
                pan_x: panX,
            }), offerSlug, funnelSlug);
        }

        container.querySelectorAll('.hub-funnel-insert-step').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                var afterStepId = button.getAttribute('data-after-step');
                var kind = readAddKindFromBuilder(container, funnelSlug);

                insertStepAfter(flowState, afterStepId, {
                    kind: kind.kind,
                    page_type: kind.page_type,
                    label: kind.label,
                });
                rerender();
            });
        });

        container.querySelectorAll('.hub-funnel-flow-add').forEach(function (button) {
            button.addEventListener('click', function () {
                var select = container.querySelector('#hub-funnel-add-kind-' + funnelSlug);

                if (!select) {
                    return;
                }

                var option = select.options[select.selectedIndex];
                var kind = option.getAttribute('data-kind') || option.value;
                var pageType = option.getAttribute('data-page-type') || kind;
                var label = option.getAttribute('data-label') || option.textContent.trim();

                flowState.push({
                    id: 'step-' + Date.now(),
                    kind: kind,
                    page_type: pageType,
                    label: label,
                    sort_order: (getMainStepsOrdered(flowState).length + 1) * 100,
                    active_page_id: null,
                    variant_page_ids: [],
                    checkout_id: 'main',
                    lane: 'main',
                    parent_step_id: null,
                    is_step_active: true,
                });
                reindexMainSteps(flowState);
                rerender();
            });
        });

        container.querySelectorAll('.hub-funnel-add-branch').forEach(function (button) {
            button.addEventListener('click', function () {
                var parentId = button.getAttribute('data-parent-step');
                var hasBranch = flowState.some(function (row) {
                    return row.lane === 'reject' && row.parent_step_id === parentId;
                });

                if (hasBranch) {
                    return;
                }

                flowState.push({
                    id: 'step-' + Date.now() + '-reject',
                    kind: 'page',
                    page_type: 'downsell',
                    label: 'Não aceita',
                    sort_order: (flowState.length + 1) * 100,
                    active_page_id: null,
                    variant_page_ids: [],
                    checkout_id: 'main',
                    lane: 'reject',
                    parent_step_id: parentId,
                    is_step_active: true,
                });
                rerender();
            });
        });

        container.querySelectorAll('.hub-step-btn--remove').forEach(function (button) {
            button.addEventListener('click', function () {
                var stepId = button.getAttribute('data-step-id');
                flowState = flowState.filter(function (row) {
                    return row.id !== stepId && row.parent_step_id !== stepId;
                });
                rerender();
            });
        });

        container.querySelectorAll('[data-step-move]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                var stepId = button.getAttribute('data-step-id');
                var direction = button.getAttribute('data-step-move');
                var main = getMainStepsInStateOrder(flowState);
                var index = main.findIndex(function (row) {
                    return row.id === stepId;
                });

                if (index === -1) {
                    return;
                }

                var targetIndex = direction === 'left' ? index - 1 : index + 1;

                if (targetIndex < 0 || targetIndex >= main.length) {
                    return;
                }

                if (reorderMainSteps(flowState, stepId, main[targetIndex].id)) {
                    rerender();
                }
            });
        });

        container.querySelectorAll('.hub-step-btn--activate').forEach(function (button) {
            button.addEventListener('click', function () {
                var stepId = button.getAttribute('data-step-id');
                var step = flowState.find(function (row) { return row.id === stepId; });

                if (step) {
                    step.is_step_active = step.is_step_active === false;
                }

                rerender();
            });
        });

        container.querySelectorAll('.hub-step-btn--duplicate').forEach(function (button) {
            button.addEventListener('click', async function () {
                var stepId = button.getAttribute('data-step-id');
                var step = flowState.find(function (row) { return row.id === stepId; });

                if (!step || !step.active_page_id) {
                    return;
                }

                try {
                    showStatus('A duplicar page…');
                    var payload = await apiFetch('/api/sales-attribution?action=hub_page_duplicate', {
                        method: 'POST',
                        body: {
                            offer: offerSlug,
                            page_id: step.active_page_id,
                        },
                    });
                    step.active_page_id = payload.page.id;
                    offerPages.push(payload.page);
                    showStatus('');
                    rerender();
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        });

        container.querySelectorAll('.hub-funnel-flow-page').forEach(function (select) {
            select.addEventListener('change', async function () {
                var stepId = select.getAttribute('data-step-id');
                var pageType = select.getAttribute('data-page-type') || 'sales';
                var step = flowState.find(function (row) { return row.id === stepId; });
                var inline = container.querySelector('[data-step-create="' + stepId + '"]');

                if (!step) {
                    return;
                }

                if (select.value === '__create__') {
                    if (inline) {
                        inline.hidden = false;
                    }

                    select.value = step.active_page_id || '';
                    return;
                }

                if (inline) {
                    inline.hidden = true;
                }

                step.active_page_id = select.value || null;
                autoSaveFlow();
            });
        });

        container.querySelectorAll('.hub-step-create-submit').forEach(function (button) {
            button.addEventListener('click', async function () {
                var inline = button.closest('[data-step-create]');
                var stepId = inline.getAttribute('data-step-create');
                var step = flowState.find(function (row) { return row.id === stepId; });
                var nameInput = inline.querySelector('.hub-step-create-name');
                var name = nameInput.value.trim();
                var pageType = step ? step.page_type : 'sales';

                if (!name || !step) {
                    return;
                }

                try {
                    showStatus('A criar page…');
                    var templateSelect = inline.querySelector('.hub-step-create-template');
                    var savedBlockId = templateSelect ? String(templateSelect.value || '').trim() : '';
                    var createBody = {
                        offer: offerSlug,
                        funnel: funnelSlug,
                        name: name,
                        type: pageType,
                        status: 'draft',
                    };

                    if (savedBlockId) {
                        createBody.saved_block_id = savedBlockId;
                    }

                    var payload = await apiFetch('/api/sales-attribution?action=hub_page_create', {
                        method: 'POST',
                        body: createBody,
                    });
                    step.active_page_id = payload.page.id;
                    offerPages.push(payload.page);
                    nameInput.value = '';
                    inline.hidden = true;
                    showStatus(savedBlockId ? 'Page criada a partir do template.' : '');
                    autoSaveFlow();

                    var studioUrl = '/studio/' + encodeURIComponent(offerSlug) + '/' +
                        encodeURIComponent(funnelSlug) + '/' +
                        encodeURIComponent(payload.page.slug) +
                        '?type=' + encodeURIComponent(pageType) +
                        '&name=' + encodeURIComponent(name);

                    window.open(studioUrl, '_blank', 'noopener');
                    rerender();
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        });

        container.querySelectorAll('[data-step-save-page]').forEach(function (button) {
            button.addEventListener('click', async function () {
                var pageId = button.getAttribute('data-step-save-page');
                var defaultName = button.getAttribute('data-page-name') || 'Página';
                var name = window.prompt('Nome para gravar esta página na biblioteca:', defaultName);

                if (!name || !String(name).trim()) {
                    return;
                }

                try {
                    showStatus('A gravar página…');
                    await apiFetch('/api/sales-attribution?action=hub_saved_blocks_save', {
                        method: 'POST',
                        body: {
                            offer: offerSlug,
                            page_id: pageId,
                            name: String(name).trim(),
                            kind: 'page',
                        },
                    });
                    var refreshedPages = await apiFetch(
                        '/api/sales-attribution?action=hub_saved_blocks_list&offer=' +
                            encodeURIComponent(offerSlug) + '&kind=page'
                    );
                    pageTemplates = refreshedPages.blocks || pageTemplates;
                    showStatus('Página gravada na biblioteca.');
                    window.setTimeout(function () { showStatus(''); }, 2200);
                    rerender();
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        });

        container.querySelectorAll('[data-step-save-checkout]').forEach(function (button) {
            button.addEventListener('click', async function () {
                var name = window.prompt('Nome para gravar este checkout na biblioteca:', 'Checkout');

                if (!name || !String(name).trim()) {
                    return;
                }

                try {
                    showStatus('A gravar checkout…');
                    await apiFetch('/api/sales-attribution?action=hub_saved_blocks_save', {
                        method: 'POST',
                        body: {
                            offer: offerSlug,
                            source: 'checkout',
                            kind: 'checkout',
                            name: String(name).trim(),
                        },
                    });
                    var refreshedCheckout = await apiFetch(
                        '/api/sales-attribution?action=hub_saved_blocks_list&offer=' +
                            encodeURIComponent(offerSlug) + '&kind=checkout'
                    );
                    checkoutTemplates = refreshedCheckout.blocks || checkoutTemplates;
                    showStatus('Checkout gravado na biblioteca.');
                    window.setTimeout(function () { showStatus(''); }, 2200);
                    rerender();
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        });

        container.querySelectorAll('.hub-step-checkout-apply-btn').forEach(function (button) {
            button.addEventListener('click', async function () {
                var stepId = button.getAttribute('data-step-id');
                var select = container.querySelector(
                    '.hub-step-checkout-template[data-step-id="' + stepId + '"]'
                );
                var blockId = select ? String(select.value || '').trim() : '';

                if (!blockId) {
                    showStatus('Escolhe um checkout gravado.', true);
                    return;
                }

                if (!window.confirm('Substituir o layout/bumps/preço do checkout desta oferta pelo template gravado?')) {
                    return;
                }

                try {
                    showStatus('A aplicar checkout…');
                    await apiFetch('/api/sales-attribution?action=hub_saved_blocks_apply', {
                        method: 'POST',
                        body: {
                            offer: offerSlug,
                            block_id: blockId,
                            target: 'checkout',
                        },
                    });
                    showStatus('Checkout aplicado. Abre o separador Checkout para afinar preço/cores.');
                    window.setTimeout(function () { showStatus(''); }, 2800);
                } catch (error) {
                    showStatus(error.message, true);
                }
            });
        });

        container.querySelectorAll('[data-open-checkout-editor]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                openModule('checkout');
            });
        });

        container.querySelectorAll('.hub-funnel-flow-save').forEach(function (button) {
            button.addEventListener('click', async function () {
                var messageEl = container.querySelector('[data-funnel-flow-message]');

                try {
                    showStatus('A guardar funil…');
                    await apiFetch('/api/sales-attribution?action=hub_funnel_flow_save', {
                        method: 'POST',
                        body: {
                            offer: offerSlug,
                            funnel: funnelSlug,
                            flow: flowState,
                        },
                    });

                    if (messageEl) {
                        messageEl.textContent = 'Funil guardado.';
                        messageEl.hidden = false;
                    }

                    showStatus('');
                    loadFunnelPages(offerSlug, funnelSlug);
                } catch (error) {
                    if (messageEl) {
                        messageEl.textContent = error.message;
                        messageEl.hidden = false;
                    }

                    showStatus('');
                }
            });
        });

        var navApi = null;

        if (window.HubFunnelUI.bindCanvasNavigation) {
            navApi = window.HubFunnelUI.bindCanvasNavigation(container, {
                mode: navMode,
                pan_x: panX,
                onModeChange: function (mode) {
                    navMode = mode;
                },
                onPanChange: function (nextPanX) {
                    panX = nextPanX;
                },
            });
        }

        if (window.HubFunnelUI.bindDragReorder) {
            window.HubFunnelUI.bindDragReorder(container, {
                signal: container._navAbort ? container._navAbort.signal : undefined,
                setSelectMode: function () {
                    if (navApi && typeof navApi.setMode === 'function') {
                        navApi.setMode('select');
                    }
                },
                onReorder: function (sourceId, targetId) {
                    if (reorderMainSteps(flowState, sourceId, targetId)) {
                        rerender();
                    }
                },
            });
        }
    }

    async function loadFunnelPages(offerSlug, funnelSlug) {
        var container = modulePanel.querySelector('[data-funnel-pages="' + funnelSlug + '"]');
        var stepsContainer = modulePanel.querySelector('[data-funnel-steps="' + funnelSlug + '"]');

        if (!container && !stepsContainer) {
            return;
        }

        try {
            var flowPayload = await apiFetch(
                '/api/sales-attribution?action=hub_funnel_flow&offer=' +
                    encodeURIComponent(offerSlug) + '&funnel=' + encodeURIComponent(funnelSlug)
            );
            var pages = flowPayload.pages || [];
            var templatesPayload = await Promise.all([
                apiFetch(
                    '/api/sales-attribution?action=hub_saved_blocks_list&offer=' +
                        encodeURIComponent(offerSlug) + '&kind=page'
                ).catch(function () { return { blocks: [] }; }),
                apiFetch(
                    '/api/sales-attribution?action=hub_saved_blocks_list&offer=' +
                        encodeURIComponent(offerSlug) + '&kind=checkout'
                ).catch(function () { return { blocks: [] }; }),
            ]);
            var pageTemplates = templatesPayload[0].blocks || [];
            var checkoutTemplates = templatesPayload[1].blocks || [];

            if (stepsContainer && window.HubFunnelUI) {
                var existingBuilder = stepsContainer.querySelector('.hub-funnel-builder');
                var preservedNavMode = 'select';
                var preservedPanX = 0;

                if (existingBuilder) {
                    preservedNavMode = existingBuilder.getAttribute('data-nav-mode') || 'select';
                    preservedPanX = parseInt(existingBuilder.getAttribute('data-pan-x') || '0', 10) || 0;
                }

                stepsContainer.innerHTML = window.HubFunnelUI.renderFunnelBuilder({
                    flow: flowPayload.flow,
                    offer_pages: flowPayload.offer_pages || flowPayload.all_pages,
                    all_pages: flowPayload.offer_pages || flowPayload.all_pages,
                    offer_slug: offerSlug,
                    funnel_slug: funnelSlug,
                    checkout_url: flowPayload.checkout_url,
                    page_templates: pageTemplates,
                    checkout_templates: checkoutTemplates,
                    nav_mode: preservedNavMode,
                    pan_x: preservedPanX,
                });
                var builderEl = stepsContainer.querySelector('.hub-funnel-builder');

                if (builderEl) {
                    bindFunnelFlowBuilder(builderEl, Object.assign({}, flowPayload, {
                        page_templates: pageTemplates,
                        checkout_templates: checkoutTemplates,
                        nav_mode: preservedNavMode,
                        pan_x: preservedPanX,
                    }), offerSlug, funnelSlug);
                }
            }

            if (!container) {
                return;
            }

            if (!pages.length) {
                container.innerHTML = '<p class="hub-panel__sub">Sem pages neste funil — usa o funil visual acima (+ ou criar page).</p>';
                return;
            }

            container.innerHTML = pages.map(function (page) {
                var studioUrl = '/studio/' + encodeURIComponent(offerSlug) + '/' +
                    encodeURIComponent(funnelSlug) + '/' + encodeURIComponent(page.slug);
                var previewUrl = page.preview_url || (
                    '/preview/' + encodeURIComponent(offerSlug) + '/' +
                    encodeURIComponent(funnelSlug) + '/' + encodeURIComponent(page.slug) + '?preview=1'
                );
                var liveUrl = page.public_url || (
                    '/p/' + encodeURIComponent(offerSlug) + '/' +
                    encodeURIComponent(funnelSlug) + '/' + encodeURIComponent(page.slug)
                );
                var isPublished = page.status === 'published';

                return '<div class="hub-funnel-page">' +
                    '<div><strong>' + escapeHtml(page.name) + '</strong>' +
                    '<span class="hub-panel__sub">' + escapeHtml(page.slug) + ' · ' + escapeHtml(page.status || 'draft') + '</span></div>' +
                    '<div class="hub-funnel-page__actions">' +
                    '<a class="hub-button hub-button--ghost" href="' + studioUrl + '">Editar</a>' +
                    '<a class="hub-link" href="' + previewUrl + '" target="_blank" rel="noopener">Preview</a>' +
                    (isPublished
                        ? '<a class="hub-link" href="' + liveUrl + '" target="_blank" rel="noopener">Live</a>'
                        : '') +
                    '</div></div>';
            }).join('');
        } catch (error) {
            container.innerHTML = '<p class="hub-panel__sub">' + escapeHtml(error.message) + '</p>';
        }
    }

    async function openModule(moduleId, tokenOverride, navKey) {
        if (!state.currentOffer) {
            showStatus('Oferta não seleccionada.', true);
            return;
        }

        if (moduleId === 'funil' && navKey === 'pages') {
            navKey = 'funil';
        }

        try {
            showStatus('A carregar módulo…');

            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_module&slug=' +
                    encodeURIComponent(state.currentOffer.slug) +
                    '&module=' + encodeURIComponent(moduleId),
                null,
                tokenOverride
            );

            state.currentModule = moduleId;
            state.moduleNavKey = navKey || moduleId;
            state.currentEmbed = null;
            moduleView.classList.remove('hub-view--embed');
            setNavIntent(state.currentOffer.slug, moduleId, state.moduleNavKey);
            renderModulePanel(moduleId, payload.module);
            setView('module');
            updateUrl(state.currentOffer.slug, moduleId);
            showStatus('');
        } catch (error) {
            showStatus((error && error.message) || 'Não foi possível abrir o módulo.', true);
            throw error;
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

    function renderCreateCard() {
        var card = document.createElement('article');
        card.className = 'hub-offer hub-offer--create';

        card.innerHTML =
            '<h3 class="hub-offer__name">Nova oferta</h3>' +
            '<p class="hub-panel__sub">Infraestrutura vazia — funis, pages e tracking só quando pedires.</p>' +
            '<div class="hub-create-form__actions">' +
                '<button type="button" class="hub-login__button" id="hub-open-wizard">Assistente completo</button>' +
                '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" id="hub-open-quick-create">Criação rápida</button>' +
            '</div>' +
            '<form class="hub-create-form hub-create-inline" id="hub-create-form" hidden>' +
                '<div class="hub-form-grid">' +
                    '<label class="hub-field"><span class="hub-field__label">Nome</span>' +
                    '<input class="hub-login__input" id="hub-create-name" type="text" required minlength="2"></label>' +
                    '<label class="hub-field"><span class="hub-field__label">Slug</span>' +
                    '<input class="hub-login__input" id="hub-create-slug" type="text" placeholder="auto"></label>' +
                    '<label class="hub-field"><span class="hub-field__label">Moeda</span>' +
                    '<select class="hub-login__input" id="hub-create-currency">' +
                        '<option value="eur">EUR</option><option value="usd">USD</option><option value="brl">BRL</option>' +
                    '</select></label>' +
                    '<label class="hub-field"><span class="hub-field__label">Preço inicial (opcional)</span>' +
                    '<input class="hub-login__input" id="hub-create-price" type="number" min="0.5" step="0.01" placeholder="10.00"></label>' +
                    '<label class="hub-field"><span class="hub-field__label">Domínio funil</span>' +
                    '<input class="hub-login__input" id="hub-create-domain" type="text" placeholder="fruta.vercel.app">' +
                    '<span class="hub-field__hint" id="hub-create-domain-status"></span></label>' +
                '</div>' +
                '<button class="hub-login__button" type="submit">Criar oferta</button>' +
                '<p class="hub-form-message" id="hub-create-error" hidden></p>' +
            '</form>';

        card.querySelector('#hub-open-wizard').addEventListener('click', function () {
            openOfferWizard(null, 1).catch(function (error) {
                showStatus(error.message, true);
            });
        });

        card.querySelector('#hub-open-quick-create').addEventListener('click', function () {
            var form = card.querySelector('#hub-create-form');
            form.hidden = !form.hidden;
        });

        var domainInput = card.querySelector('#hub-create-domain');
        var domainStatus = card.querySelector('#hub-create-domain-status');
        var domainTimer = null;

        if (domainInput && domainStatus) {
            domainInput.addEventListener('input', function () {
                clearTimeout(domainTimer);
                domainTimer = setTimeout(async function () {
                    var domain = domainInput.value.trim();

                    if (!domain) {
                        domainStatus.textContent = '';
                        return;
                    }

                    try {
                        var check = await apiFetch(
                            '/api/sales-attribution?action=hub_check_domain&domain=' +
                                encodeURIComponent(domain)
                        );
                        var result = check.check || {};

                        domainStatus.textContent = result.available ? '✓ Disponível' : '✗ ' + (result.reason || 'Indisponível');
                        domainStatus.className = 'hub-field__hint ' + (result.available ? 'is-ok' : 'is-error');
                    } catch (error) {
                        domainStatus.textContent = error.message;
                        domainStatus.className = 'hub-field__hint is-error';
                    }
                }, 400);
            });
        }

        var form = card.querySelector('#hub-create-form');
        form.addEventListener('submit', handleCreateOffer);

        return card;
    }

    function renderOffersList() {
        offersRoot.innerHTML = '';
        var metricsMap = getOfferMetricsMap(state.platformMetrics);

        state.offers.forEach(function (offer) {
            var card = document.createElement('article');
            card.className = 'hub-offer';
            card.dataset.slug = offer.slug;

            var checkoutSummary = formatCheckouts(offer);
            var offerMetrics = metricsMap[offer.slug] || {};
            var canDelete = offer.slug !== 'onda-prodigio';

            card.innerHTML =
                '<button type="button" class="hub-offer__open" data-offer-open="' + escapeHtml(offer.slug) + '">' +
                    '<div class="hub-offer__avatar">' + escapeHtml(offerInitial(offer.name)) + '</div>' +
                    '<div class="hub-offer__body">' +
                        '<h3 class="hub-offer__name">' + escapeHtml(offer.name) + '</h3>' +
                        '<div class="hub-offer__row-meta">' +
                            '<span>' + escapeHtml(offerStatusLabel(offer.status)) + '</span>' +
                            '<span>' + formatMoneyEur(offerMetrics.revenue_eur) + '</span>' +
                            '<span>' + formatMetricNumber(offerMetrics.sales) + ' vendas</span>' +
                            '<span>' + formatMoneyEur(offerMetrics.meta_spend_eur) + ' Meta</span>' +
                            '<span>ROAS ' + formatRoas(offerMetrics.roas) + '</span>' +
                            '<span>' + formatMetricNumber(offerMetrics.meta_accounts_count || (offer.meta_accounts || []).length) + ' contas</span>' +
                        '</div>' +
                    '</div>' +
                '</button>' +
                '<div class="hub-offer__row-right">' +
                    '<span class="dr-badge dr-badge--' + (offer.status === 'active' ? 'live' : 'draft') + '">' +
                        escapeHtml(checkoutSummary) + '</span>' +
                    (canDelete
                        ? '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm hub-offer__delete" ' +
                            'data-offer-delete="' + escapeHtml(offer.slug) + '" title="Apagar oferta">Apagar</button>'
                        : '') +
                    '<span class="hub-offer__cta" aria-hidden="true">→</span>' +
                '</div>';

            card.querySelector('[data-offer-open]').addEventListener('click', function () {
                openOffer(offer.slug);
            });

            var deleteButton = card.querySelector('[data-offer-delete]');

            if (deleteButton) {
                deleteButton.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteOffer(offer.slug, offer.name);
                });
            }

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
        sidebarContext.textContent = offer.name;
    }

    function renderModules() {
        /* modules moved to sidebar + home quick grid */
    }

    async function loadPlatformMetrics(tokenOverride, refresh) {
        try {
            var query = 'action=hub_metrics_overview&days=30' + (refresh ? '&refresh=1' : '');
            state.platformMetrics = await apiFetch('/api/sales-attribution?' + query, null, tokenOverride);
        } catch (error) {
            state.platformMetrics = null;
        }

        renderPlatformContent();
    }

    async function loadLaunchReadiness(slug, refresh) {
        try {
            var query = 'action=hub_launch_health&slug=' + encodeURIComponent(slug) +
                (refresh ? '&refresh=1' : '');
            state.launchReadiness = await apiFetch('/api/sales-attribution?' + query);
        } catch (error) {
            state.launchReadiness = null;
        }

        return state.launchReadiness;
    }

    async function loadOfferMetrics(slug, tokenOverride, refresh) {
        try {
            var query = 'action=hub_metrics&slug=' + encodeURIComponent(slug) +
                '&days=30' + (refresh ? '&refresh=1' : '');
            return await apiFetch('/api/sales-attribution?' + query, null, tokenOverride);
        } catch (error) {
            return null;
        }
    }

    async function loadOffers(tokenOverride, refresh) {
        var offersPayload = await apiFetch('/api/sales-attribution?action=hub_offers', null, tokenOverride);
        state.offers = offersPayload.offers || [];
        await loadPlatformMetrics(tokenOverride, refresh);
        renderOffersList();
        if (state.view === 'list') {
            renderSidebar();
            renderPlatformContent();
        }
    }

    async function openOffer(slug, tokenOverride, moduleId, navKey, refresh) {
        showStatus('A carregar oferta…');

        var payload = await apiFetch(
            '/api/sales-attribution?action=hub_offer&slug=' + encodeURIComponent(slug) + '&integrations=1',
            null,
            tokenOverride
        );

        state.currentOffer = payload.offer;
        state.currentModules = payload.offer.modules || [];
        state.currentModule = null;
        state.moduleNavKey = null;
        state.currentEmbed = null;
        setNavIntent(payload.offer.slug, moduleId || null, navKey || null);
        renderOfferHead(payload.offer);

        state.offerMetrics = await loadOfferMetrics(payload.offer.slug, tokenOverride, refresh);
        await loadLaunchReadiness(payload.offer.slug, refresh);
        renderOfferHome(payload.offer, state.currentModules, state.offerMetrics);

        if (moduleId) {
            var moduleEntry = state.currentModules.find(function (entry) {
                return entry.id === moduleId;
            });

            if (moduleEntry && moduleEntry.embed) {
                openEmbedModule(moduleEntry, tokenOverride);
                return;
            }

            await openModule(moduleId, tokenOverride, navKey || moduleId);
            return;
        }

        setView('home');
        updateUrl(payload.offer.slug);
        showStatus('');
    }

    async function bootstrapShell(tokenOverride, refresh) {
        await loadOffers(tokenOverride, refresh);
        await refreshGeminiStatus();

        var target = readBootstrapTarget();

        if (target && target.slug) {
            await openOffer(target.slug, tokenOverride, target.module || null, target.navKey || null);
            return;
        }

        state.currentOffer = null;
        state.currentModule = null;
        clearNavIntent();
        setView('list');
        renderPlatformContent();
        updateUrl('');
    }

    async function deleteOffer(slug, offerName) {
        var label = offerName || slug;
        var confirmed = window.confirm(
            'Apagar a oferta "' + label + '"?\n\nDesaparece da plataforma mas os dados ficam arquivados.'
        );

        if (!confirmed) {
            return;
        }

        try {
            showStatus('A apagar oferta…');
            var payload = await apiFetch('/api/sales-attribution?action=hub_delete_offer', {
                method: 'POST',
                body: { slug: slug },
            });

            state.offers = payload.offers || [];

            if (state.currentOffer && state.currentOffer.slug === slug) {
                setPlatformSection('offers');
            } else {
                renderOffersList();
                renderPlatformContent();
            }

            await loadPlatformMetrics(null, true);
            showStatus('Oferta apagada.');

            if (window.PlatformUI) {
                window.PlatformUI.toast('Oferta apagada.', 'success');
            }
        } catch (error) {
            showStatus(error.message, true);

            if (window.PlatformUI) {
                window.PlatformUI.toast(error.message, 'error');
            }
        }
    }

    async function handleCreateOffer(event) {
        event.preventDefault();

        var form = event.currentTarget;
        var nameInput = form.querySelector('#hub-create-name');
        var slugInput = form.querySelector('#hub-create-slug');
        var domainInput = form.querySelector('#hub-create-domain');
        var currencyInput = form.querySelector('#hub-create-currency');
        var priceInput = form.querySelector('#hub-create-price');
        var errorEl = form.querySelector('#hub-create-error');
        var name = nameInput.value.trim();
        var funnelDomain = domainInput.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        var slug = slugInput.value.trim();
        var priceRaw = priceInput.value.trim();
        var amountCents = null;

        if (priceRaw) {
            var euros = parseFloat(priceRaw.replace(',', '.'));

            if (Number.isFinite(euros) && euros >= 0.5) {
                amountCents = Math.round(euros * 100);
            }
        }

        errorEl.hidden = true;

        if (!name) {
            errorEl.textContent = 'Introduz o nome da oferta.';
            errorEl.hidden = false;
            return;
        }

        try {
            showStatus('A criar oferta…');
            var body = {
                name: name,
                funnel_domain: funnelDomain,
                currency: currencyInput.value,
            };

            if (slug) {
                body.slug = slug;
            }

            if (amountCents) {
                body.amount_cents = amountCents;
            }

            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_create_offer',
                {
                    method: 'POST',
                    body: body,
                }
            );

            nameInput.value = '';
            slugInput.value = '';
            domainInput.value = '';
            priceInput.value = '';
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
            await bootstrapShell(password);
            passwordInput.value = '';

            try {
                var studioReturn = sessionStorage.getItem('onda-studio-return');
                if (studioReturn && studioReturn.indexOf('/studio/') === 0) {
                    sessionStorage.removeItem('onda-studio-return');
                    window.location.assign(studioReturn);
                    return;
                }
            } catch (returnError) {
                /* ignore */
            }
        } catch (error) {
            clearToken();
            showShell(false);
            loginError.textContent = error.message || 'Não foi possível entrar.';
            loginError.hidden = false;
        }
    });

    sidebarOffersBtn.addEventListener('click', function () {
        if (window.HubAI) {
            window.HubAI.stopPolling();
        }

        setPlatformSection(state.platformSection || 'home');
    });

    refreshButton.addEventListener('click', async function () {
        try {
            showStatus('A actualizar…');

            if (state.view === 'module' && state.currentOffer && state.currentModule) {
                if (state.currentEmbed) {
                    openEmbedModule(state.currentEmbed);
                } else {
                    await openModule(state.currentModule);
                }
            } else if ((state.view === 'home' || state.view === 'offer') && state.currentOffer) {
                await openOffer(state.currentOffer.slug, null, state.currentModule, state.moduleNavKey, true);
            } else {
                await bootstrapShell(true);
            }
        } catch (error) {
            showStatus(error.message, true);
        }
    });

    logoutButton.addEventListener('click', function () {
        clearToken();
        clearNavIntent();
        showShell(false);
        setView('list');
        showStatus('');
    });

    if (window.HubChat) {
        window.HubChat.init({
            apiFetch: apiFetch,
            getContext: chatContext,
        });
    }

    if (wizardCloseBtn) {
        wizardCloseBtn.addEventListener('click', closeOfferWizard);
    }

    if (wizardOverlay) {
        wizardOverlay.hidden = true;
        wizardOverlay.addEventListener('click', function (event) {
            if (event.target === wizardOverlay) {
                closeOfferWizard();
            }
        });
    }

    initPlatformUi();

    if (getToken()) {
        showShell(true);
        bootstrapShell(null).catch(function () {
            clearToken();
            clearNavIntent();
            showShell(false);
        });
    } else {
        showShell(false);
    }
})();
