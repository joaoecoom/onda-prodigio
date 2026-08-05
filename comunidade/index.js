(function () {
    var productGrid = document.getElementById('product-grid');
    var topbarUser = document.getElementById('topbar-user');
    var welcomeTitle = document.getElementById('welcome-title');
    var welcomeSubtitle = document.getElementById('welcome-subtitle');

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
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
            var image = product.image_url ? '/' + product.image_url.replace(/^\//, '') : '';
            var moduleCount = (product.modules || []).length;

            return (
                '<a class="comunidade-card" href="/comunidade/produto?id=' + encodeURIComponent(product.id) + '">' +
                    '<div class="comunidade-card__image-wrap">' +
                        (image ? '<img class="comunidade-card__image" src="' + image + '" alt="">' : '') +
                    '</div>' +
                    '<div class="comunidade-card__body">' +
                        '<div class="comunidade-card__title">' + escapeHtml(product.name) + '</div>' +
                        '<div class="comunidade-card__text">' + escapeHtml(product.description || '') + '</div>' +
                        '<div class="comunidade-card__footer">' +
                            '<span class="comunidade-card__meta">' + moduleCount + ' módulo(s)</span>' +
                            '<span class="comunidade-card__cta">Aceder →</span>' +
                        '</div>' +
                    '</div>' +
                '</a>'
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
            var displayName = meData.name || meData.email.split('@')[0];
            topbarUser.textContent = meData.role === 'admin'
                ? (meData.name || 'Admin') + ' · Admin'
                : meData.email;
            topbarUser.title = meData.role === 'admin' ? (meData.email || '') : '';

            if (meData.role === 'admin') {
                var adminSurveyLink = document.getElementById('admin-survey-link');
                if (adminSurveyLink) {
                    adminSurveyLink.hidden = false;
                }
            }

            welcomeTitle.textContent = 'Olá, ' + displayName.split(' ')[0] + '!';
            welcomeSubtitle.textContent = 'Acede aos programas incluídos na tua compra.';

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

        renderProducts(productsData.products || []);
    }

    document.getElementById('btn-logout').addEventListener('click', function () {
        window.ComunidadeAuth.signOut();
    });

    boot();
})();
