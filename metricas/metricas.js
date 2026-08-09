(function () {
    var TOKEN_KEY = 'onda-metrics-token';

    var loginSection = document.getElementById('metrics-login');
    var dashboardSection = document.getElementById('metrics-dashboard');
    var loginForm = document.getElementById('metrics-login-form');
    var passwordInput = document.getElementById('metrics-password');
    var loginError = document.getElementById('metrics-login-error');
    var statusBox = document.getElementById('metrics-status');
    var summaryRoot = document.getElementById('metrics-summary');
    var treeRoot = document.getElementById('metrics-tree');
    var recentBody = document.getElementById('metrics-recent-body');
    var generatedAt = document.getElementById('metrics-generated-at');
    var noteBox = document.getElementById('metrics-note');
    var daysSelect = document.getElementById('metrics-days');
    var refreshButton = document.getElementById('metrics-refresh');
    var logoutButton = document.getElementById('metrics-logout');

    function getToken() {
        return window.sessionStorage.getItem(TOKEN_KEY) || '';
    }

    function setToken(token) {
        if (token) {
            window.sessionStorage.setItem(TOKEN_KEY, token);
        } else {
            window.sessionStorage.removeItem(TOKEN_KEY);
        }
    }

    function showLogin() {
        loginSection.hidden = false;
        dashboardSection.hidden = true;
    }

    function showDashboard() {
        loginSection.hidden = true;
        dashboardSection.hidden = false;
    }

    function setStatus(message, isError) {
        if (!message) {
            statusBox.hidden = true;
            statusBox.textContent = '';
            statusBox.classList.remove('metrics-status--error');
            return;
        }

        statusBox.hidden = false;
        statusBox.textContent = message;
        statusBox.classList.toggle('metrics-status--error', Boolean(isError));
    }

    function formatMoney(value) {
        return '€' + Number(value || 0).toFixed(2);
    }

    function formatDate(iso) {
        if (!iso) {
            return '—';
        }

        return new Date(iso).toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function fetchMetrics() {
        var token = getToken();
        var days = daysSelect.value;

        if (!token) {
            showLogin();
            return;
        }

        setStatus('A carregar vendas do Stripe…', false);

        var response = await fetch('/api/sales-attribution?days=' + encodeURIComponent(days), {
            headers: {
                Authorization: 'Bearer ' + token,
            },
        });

        var data = await response.json();

        if (response.status === 401) {
            setToken('');
            showLogin();
            loginError.hidden = false;
            loginError.textContent = 'Sessão expirada. Introduz a palavra-passe outra vez.';
            return;
        }

        if (!response.ok) {
            setStatus(data.error || 'Não foi possível carregar as métricas.', true);
            return;
        }

        setStatus('', false);
        renderDashboard(data);
    }

    function renderSummary(summary) {
        var attributedPct = summary.total_sales
            ? Math.round((summary.attributed_sales / summary.total_sales) * 100)
            : 0;

        summaryRoot.innerHTML = [
            {
                label: 'Vendas',
                value: summary.total_sales,
                hint: 'Checkout live (Stripe)',
            },
            {
                label: 'Receita',
                value: formatMoney(summary.total_revenue_eur),
                hint: 'EUR cobrado',
            },
            {
                label: 'Atribuídas',
                value: summary.attributed_sales,
                hint: attributedPct + '% com campanha/anúncio',
            },
            {
                label: 'Desconhecidas',
                value: summary.unknown_sales,
                hint: 'Sem UTM / clique Meta',
            },
            {
                label: 'Com fbc',
                value: summary.with_fbc,
                hint: 'Cookie de clique no anúncio',
            },
        ].map(function (card) {
            return (
                '<article class="metrics-card">' +
                '<div class="metrics-card__label">' + escapeHtml(card.label) + '</div>' +
                '<div class="metrics-card__value">' + escapeHtml(String(card.value)) + '</div>' +
                '<div class="metrics-card__hint">' + escapeHtml(card.hint) + '</div>' +
                '</article>'
            );
        }).join('');
    }

    function renderAdNode(ad) {
        return (
            '<div class="metrics-node metrics-node--level-ad">' +
            '<div class="metrics-node__row metrics-node__row--static">' +
            '<div><span class="metrics-node__name">' + escapeHtml(ad.name) + '</span>' +
            (ad.ad_id ? '<span class="metrics-node__meta">ID ' + escapeHtml(ad.ad_id) + '</span>' : '') +
            '</div>' +
            '<div class="metrics-node__stat"><strong>' + ad.sales + '</strong> vendas</div>' +
            '<div class="metrics-node__stat">' + escapeHtml(formatMoney(ad.revenue_eur)) + '</div>' +
            '</div></div>'
        );
    }

    function renderAdsetNode(adset) {
        var adsHtml = (adset.ads || []).map(renderAdNode).join('');

        return (
            '<details class="metrics-node metrics-node--level-adset" open>' +
            '<summary class="metrics-node__row">' +
            '<div><span class="metrics-node__name">' + escapeHtml(adset.name) + '</span>' +
            (adset.adset_id ? '<span class="metrics-node__meta">ID ' + escapeHtml(adset.adset_id) + '</span>' : '') +
            '</div>' +
            '<div class="metrics-node__stat"><strong>' + adset.sales + '</strong> vendas</div>' +
            '<div class="metrics-node__stat">' + escapeHtml(formatMoney(adset.revenue_eur)) + '</div>' +
            '</summary>' +
            '<div class="metrics-node__children">' + (adsHtml || '<p class="metrics-tree__empty">Sem anúncios.</p>') + '</div>' +
            '</details>'
        );
    }

    function renderCampaignNode(campaign) {
        var adsetsHtml = (campaign.adsets || []).map(renderAdsetNode).join('');
        var unknownBadge = campaign.name === 'Desconhecido'
            ? '<span class="metrics-badge metrics-badge--warn">sem UTM</span>'
            : '';

        return (
            '<details class="metrics-node metrics-node--level-campaign" open>' +
            '<summary class="metrics-node__row">' +
            '<div><span class="metrics-node__name">' + escapeHtml(campaign.name) + unknownBadge + '</span>' +
            (campaign.campaign_id ? '<span class="metrics-node__meta">ID ' + escapeHtml(campaign.campaign_id) + '</span>' : '') +
            '</div>' +
            '<div class="metrics-node__stat"><strong>' + campaign.sales + '</strong> vendas</div>' +
            '<div class="metrics-node__stat">' + escapeHtml(formatMoney(campaign.revenue_eur)) + '</div>' +
            '</summary>' +
            '<div class="metrics-node__children">' + (adsetsHtml || '<p class="metrics-tree__empty">Sem conjuntos.</p>') + '</div>' +
            '</details>'
        );
    }

    function renderTree(campaigns) {
        if (!campaigns || !campaigns.length) {
            treeRoot.innerHTML = '<p class="metrics-tree__empty">Ainda não há vendas neste período.</p>';
            return;
        }

        treeRoot.innerHTML = campaigns.map(renderCampaignNode).join('');
    }

    function renderRecentSales(sales) {
        if (!sales || !sales.length) {
            recentBody.innerHTML = '<tr><td colspan="7">Sem vendas neste período.</td></tr>';
            return;
        }

        recentBody.innerHTML = sales.map(function (sale) {
            var bumps = sale.order_bumps && sale.order_bumps.length
                ? sale.order_bumps.length
                : 0;
            var fbcBadge = sale.has_fbc
                ? '<span class="metrics-badge metrics-badge--ok">sim</span>'
                : '<span class="metrics-badge metrics-badge--warn">não</span>';

            return (
                '<tr>' +
                '<td>' + escapeHtml(formatDate(sale.created)) + '</td>' +
                '<td>' + escapeHtml(sale.campaign_name) + '</td>' +
                '<td>' + escapeHtml(sale.adset_name) + '</td>' +
                '<td>' + escapeHtml(sale.ad_name) + '</td>' +
                '<td>' + escapeHtml(formatMoney(sale.amount_eur)) + '</td>' +
                '<td>' + bumps + '</td>' +
                '<td>' + fbcBadge + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function renderDashboard(data) {
        renderSummary(data.summary || {});
        renderTree(data.campaigns || []);
        renderRecentSales(data.recent_sales || []);
        generatedAt.textContent = data.summary && data.summary.generated_at
            ? 'Actualizado ' + formatDate(data.summary.generated_at)
            : '';
        noteBox.textContent = data.note || '';
    }

    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        var password = passwordInput.value.trim();

        if (!password) {
            return;
        }

        loginError.hidden = true;
        setToken(password);
        showDashboard();

        try {
            await fetchMetrics();
        } catch (error) {
            setStatus('Erro de ligação. Tenta outra vez.', true);
        }
    });

    daysSelect.addEventListener('change', function () {
        fetchMetrics().catch(function () {
            setStatus('Erro de ligação. Tenta outra vez.', true);
        });
    });

    refreshButton.addEventListener('click', function () {
        fetchMetrics().catch(function () {
            setStatus('Erro de ligação. Tenta outra vez.', true);
        });
    });

    logoutButton.addEventListener('click', function () {
        setToken('');
        passwordInput.value = '';
        showLogin();
    });

    if (getToken()) {
        showDashboard();
        fetchMetrics().catch(function () {
            setStatus('Erro de ligação. Tenta outra vez.', true);
        });
    } else {
        showLogin();
    }
})();
