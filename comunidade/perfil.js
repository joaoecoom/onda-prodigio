(function () {
    var PRODUCT_LABELS = {
        'onda-prodigio': 'Onda Prodígio',
        'tardes-sem-brigas': 'A Fábrica das Tardes Tranquilas',
        'caixa-super-truques': 'A Caixa dos Super Truques do Génio',
        'grandes-mentes': 'Grandes Mentes',
        'clube-super-cerebros': 'Clube dos Super Cérebros',
        'codigo-autoridade': 'Código da Autoridade',
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getInitial(name, email) {
        return String(name || email || '?').trim().charAt(0).toUpperCase();
    }

    function renderProducts(productIds) {
        var root = document.getElementById('profile-products');

        if (!productIds.length) {
            root.innerHTML = '<li class="comunidade-profile-products__empty">Nenhum programa desbloqueado ainda.</li>';
            return;
        }

        root.innerHTML = productIds.map(function (productId) {
            return (
                '<li class="comunidade-profile-products__item">' +
                    '<span class="comunidade-profile-products__dot" aria-hidden="true"></span>' +
                    escapeHtml(PRODUCT_LABELS[productId] || productId) +
                '</li>'
            );
        }).join('');
    }

    function syncThemePicker() {
        var theme = window.ComunidadeTheme.getTheme();

        document.querySelectorAll('[data-theme-set]').forEach(function (button) {
            var isActive = button.getAttribute('data-theme-set') === theme;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    async function boot() {
        var session = await window.ComunidadeAuth.requireAuth();

        if (!session) {
            return;
        }

        var meResponse = await window.ComunidadeAuth.apiFetch('/api/comunidade/me');
        var meData = await meResponse.json();

        if (!meResponse.ok) {
            return;
        }

        var displayName = meData.name || meData.email.split('@')[0];

        document.getElementById('profile-avatar').textContent = getInitial(meData.name, meData.email);
        document.getElementById('profile-name').textContent = displayName;
        document.getElementById('profile-role').textContent = meData.role === 'admin'
            ? 'Administrador'
            : 'Membro Onda Prodígio';
        document.getElementById('profile-display-name').textContent = meData.name || '—';
        document.getElementById('profile-email').textContent = meData.email || '—';

        renderProducts(meData.product_ids || []);
        syncThemePicker();

        if (window.ComunidadeTheme && window.ComunidadeTheme.syncTopbarHeight) {
            window.ComunidadeTheme.syncTopbarHeight();
        }
    }

    document.getElementById('btn-logout').addEventListener('click', function () {
        window.ComunidadeAuth.signOut();
    });

    document.querySelectorAll('[data-theme-set]').forEach(function (button) {
        button.addEventListener('click', function () {
            window.ComunidadeTheme.applyTheme(button.getAttribute('data-theme-set'));
            syncThemePicker();
        });
    });

    boot();
})();
