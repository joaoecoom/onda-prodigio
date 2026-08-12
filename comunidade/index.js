(function () {
    var productGrid = document.getElementById('product-grid');
    var topbarProfile = document.getElementById('topbar-profile');
    var topbarAvatar = document.getElementById('topbar-avatar');
    var topbarName = document.getElementById('topbar-name');
    var welcomeTitle = document.getElementById('welcome-title');
    var welcomeSubtitle = document.getElementById('welcome-subtitle');
    var heroUnlockedLabel = document.getElementById('hero-unlocked-label');
    var heroProgressFill = document.getElementById('hero-progress-fill');
    var roadmapRoot = document.getElementById('comunidade-roadmap');

    var PRODUCT_ROADMAP_LABELS = {
        'onda-prodigio': 'Onda Prodígio',
        'tardes-sem-brigas': 'Tardes Tranquilas',
        'caixa-super-truques': 'Super Truques',
        'grandes-mentes': 'Grandes Mentes',
        'clube-super-cerebros': 'Super Cérebros',
        'codigo-autoridade': 'Cód. Autoridade',
    };

    var PRODUCT_CHECKOUT_PATHS = {
        'onda-prodigio': '/checkout9/',
        'tardes-sem-brigas': '/comprar/tardes-sem-brigas',
        'caixa-super-truques': '/comprar/caixa-super-truques',
        'grandes-mentes': '/comprar/grandes-mentes',
        'clube-super-cerebros': '/comprar/clube-super-cerebros',
        'codigo-autoridade': '/comprar/codigo-autoridade',
    };

    function getProductCheckoutPath(productId) {
        return PRODUCT_CHECKOUT_PATHS[productId] || '';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getInitial(name, email) {
        var source = String(name || email || '?').trim();

        return source.charAt(0).toUpperCase();
    }

    function getFirstName(name, email) {
        var source = String(name || email || 'Membro').trim();

        return source.split(/\s+/)[0];
    }

    function resolveProductImage(product) {
        var fallback = {
            'onda-prodigio': '/comunidade/assets/products/onda-prodigio.png',
            'tardes-sem-brigas': '/checkout9/assets/order-bump-tardes.png',
            'caixa-super-truques': '/checkout9/assets/order-bump-truques.png',
            'grandes-mentes': '/checkout9/assets/order-bump-mentes.png',
            'clube-super-cerebros': '/comunidade/assets/products/clube-super-cerebros.png',
            'codigo-autoridade': '/comunidade/assets/products/codigo-autoridade.png',
        };

        if (product.image_url) {
            return '/' + String(product.image_url).replace(/^\//, '');
        }

        return fallback[product.id] || '';
    }

    function countUnlocked(products) {
        return (products || []).filter(function (product) {
            return product.has_access !== false;
        }).length;
    }

    function getProductRoadmapLabel(product) {
        return PRODUCT_ROADMAP_LABELS[product.id] || product.name;
    }

    function getProductRoadmapState(product) {
        return product.has_access !== false ? 'done' : 'locked';
    }

    function renderRoadmap(products) {
        var items = (products || []).slice();

        roadmapRoot.innerHTML = (
            '<div class="comunidade-roadmap__track comunidade-roadmap__track--products">' +
            items.map(function (product) {
                var state = getProductRoadmapState(product);

                return (
                    '<div class="comunidade-roadmap__step comunidade-roadmap__step--' + state + '" title="' + escapeHtml(product.name) + '">' +
                        '<div class="comunidade-roadmap__node comunidade-roadmap__node--' + state + '" aria-hidden="true">' +
                            (state === 'done' ?
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>' :
                                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>') +
                        '</div>' +
                        '<span class="comunidade-roadmap__label">' + escapeHtml(getProductRoadmapLabel(product)) + '</span>' +
                    '</div>'
                );
            }).join('') +
            '</div>'
        );
    }

    function renderHero(products, meData) {
        var total = (products || []).length;
        var unlocked = countUnlocked(products);
        var percent = total ? Math.round((unlocked / total) * 100) : 0;
        var firstName = getFirstName(meData.name, meData.email);

        welcomeTitle.textContent = 'Olá, ' + firstName + '!';
        welcomeSubtitle.textContent = 'Acompanha os módulos, avança nas aulas e desbloqueia o potencial do teu filho — ao teu ritmo.';
        heroUnlockedLabel.textContent = unlocked + ' de ' + total;
        heroProgressFill.style.width = percent + '%';
        renderRoadmap(products);
    }

    function renderProfileChip(meData) {
        topbarAvatar.textContent = getInitial(meData.name, meData.email);
        topbarName.textContent = getFirstName(meData.name, meData.email);
        topbarProfile.hidden = false;
        topbarProfile.title = meData.email || '';
    }

    function renderProducts(products) {
        if (!products.length) {
            productGrid.innerHTML = (
                '<div class="comunidade-panel" style="padding:1.5rem;">' +
                    '<p class="comunidade-panel__subtitle" style="margin:0;">Ainda não tens conteúdos disponíveis. Se acabaste de comprar, espera alguns minutos e actualiza a página.</p>' +
                '</div>'
            );
            return;
        }

        productGrid.innerHTML = products.map(function (product) {
            var image = resolveProductImage(product);
            var moduleCount = (product.modules || []).length;
            var hasAccess = product.has_access !== false;
            var checkoutPath = hasAccess ? '' : getProductCheckoutPath(product.id);
            var isBuyable = !hasAccess && Boolean(checkoutPath);
            var cardClass = 'comunidade-card' + (hasAccess ? '' : ' comunidade-card--locked') + (isBuyable ? ' comunidade-card--buyable' : '');
            var tagName = hasAccess || isBuyable ? 'a' : 'div';
            var hrefAttr = hasAccess
                ? ' href="/comunidade/produto?id=' + encodeURIComponent(product.id) + '"'
                : (isBuyable ? ' href="' + checkoutPath + '"' : '');
            var badgeClass = hasAccess
                ? 'comunidade-card__badge comunidade-card__badge--open'
                : 'comunidade-card__badge comunidade-card__badge--locked';
            var badgeText = hasAccess ? 'Desbloqueado' : (isBuyable ? 'Comprar' : 'Bloqueado');
            var ctaText = hasAccess ? 'Aceder →' : (isBuyable ? 'Comprar →' : 'Indisponível');

            return (
                '<' + tagName + ' class="' + cardClass + '"' + hrefAttr + '>' +
                    '<div class="comunidade-card__image-wrap">' +
                        (image ? '<img class="comunidade-card__image' + (hasAccess ? '' : ' comunidade-card__image--locked') + '" src="' + image + '" alt="">' : '') +
                        '<span class="' + badgeClass + '">' + badgeText + '</span>' +
                        (hasAccess ? '' : '<div class="comunidade-card__lock-overlay"><span>' + (isBuyable ? 'Desbloquear' : 'Bloqueado') + '</span></div>') +
                    '</div>' +
                    '<div class="comunidade-card__body">' +
                        '<div class="comunidade-card__title">' + escapeHtml(product.name) + '</div>' +
                        '<div class="comunidade-card__text">' + escapeHtml(product.description || '') + '</div>' +
                        '<div class="comunidade-card__footer">' +
                            '<span class="comunidade-card__meta">' + moduleCount + ' módulo(s)</span>' +
                            '<span class="comunidade-card__cta">' + ctaText + '</span>' +
                        '</div>' +
                    '</div>' +
                '</' + tagName + '>'
            );
        }).join('');
    }

    async function boot() {
        var session = await window.ComunidadeAuth.requireAuth();

        if (!session) {
            return;
        }

        var meResponse = await window.ComunidadeAuth.apiFetch('/api/comunidade/me');
        var meData = await meResponse.json();

        if (meResponse.ok) {
            renderProfileChip(meData);

            if (meData.role === 'admin') {
                var adminSurveyLink = document.getElementById('admin-survey-link');

                if (adminSurveyLink) {
                    adminSurveyLink.hidden = false;
                }
            }

            if (window.ComunidadeTheme && window.ComunidadeTheme.syncTopbarHeight) {
                window.ComunidadeTheme.syncTopbarHeight();
            }
        }

        var productsResponse = await window.ComunidadeAuth.apiFetch('/api/comunidade/products');
        var productsData = await productsResponse.json();

        if (!productsResponse.ok) {
            productGrid.innerHTML = (
                '<div class="comunidade-panel" style="padding:1.5rem;">' +
                    '<p class="comunidade-panel__subtitle" style="margin:0;">' + escapeHtml(productsData.error || 'Erro ao carregar produtos.') + '</p>' +
                '</div>'
            );
            return;
        }

        var products = productsData.products || [];

        if (meResponse.ok) {
            renderHero(products, meData);
        }

        renderProducts(products);
    }

    document.getElementById('btn-logout').addEventListener('click', function () {
        window.ComunidadeAuth.signOut();
    });

    boot();
})();
