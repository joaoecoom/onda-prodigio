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
    var refreshButton = document.getElementById('metrics-refresh');
    var logoutButton = document.getElementById('metrics-logout');
    var accountWrap = document.getElementById('metrics-account-wrap');
    var accountSelect = document.getElementById('metrics-account');
    var metaBanner = document.getElementById('metrics-meta-banner');
    var metaPanel = document.getElementById('metrics-meta-panel');
    var metaContext = document.getElementById('metrics-meta-context');
    var metaBody = document.getElementById('metrics-meta-body');
    var metaGeneratedAt = document.getElementById('metrics-meta-generated-at');
    var ACCOUNT_KEY = 'onda-metrics-account';
    var latestPayload = null;
    var datePickerRoot = document.getElementById('metrics-date-picker-root');
    var datePicker = window.MetricsDateRangePicker.create({
        root: datePickerRoot,
        defaultPreset: 'last_30',
        onApply: function () {
            fetchMetrics().catch(function () {
                setStatus('Erro de ligação. Tenta outra vez.', true);
            });
        },
    });

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

    function formatMoney(value, currency) {
        var prefix = currency === 'USD' ? '$' : '€';
        return prefix + Number(value || 0).toFixed(2);
    }

    function formatMoneyEur(value) {
        return formatMoney(value, 'EUR');
    }

    function getSelectedAccountId() {
        return accountSelect.value || window.sessionStorage.getItem(ACCOUNT_KEY) || '';
    }

    function setSelectedAccountId(accountId) {
        if (accountId) {
            accountSelect.value = accountId;
            window.sessionStorage.setItem(ACCOUNT_KEY, accountId);
        }
    }

    function buildQuery(range) {
        var params = ['action=combined'];

        if (range.from && range.to) {
            params.push('from=' + encodeURIComponent(range.from));
            params.push('to=' + encodeURIComponent(range.to));
        } else {
            params.push('days=0');
        }

        var accountId = getSelectedAccountId();

        if (accountId) {
            params.push('account_id=' + encodeURIComponent(accountId));
        }

        return params.join('&');
    }

    function renderAccountOptions(accounts, activeAccountId) {
        if (!accounts || !accounts.length) {
            accountWrap.hidden = true;
            return;
        }

        accountWrap.hidden = false;
        accountSelect.innerHTML = accounts.map(function (account) {
            var label = account.label || account.name || ('Conta ' + account.id);
            var suffix = account.currency ? ' · ' + account.currency : '';
            var selected = account.id === activeAccountId ? ' selected' : '';
            return '<option value="' + escapeHtml(account.id) + '"' + selected + '>' + escapeHtml(label + suffix) + '</option>';
        }).join('');

        if (activeAccountId) {
            setSelectedAccountId(activeAccountId);
        }
    }

    function renderMetaBanner(metaConnection) {
        if (!metaConnection) {
            metaBanner.hidden = true;
            metaBanner.textContent = '';
            return;
        }

        if (metaConnection.ok) {
            metaBanner.hidden = true;
            metaBanner.textContent = '';
            return;
        }

        metaBanner.hidden = false;
        metaBanner.className = 'metrics-meta-banner metrics-meta-banner--warn';

        if (!metaConnection.has_token) {
            metaBanner.textContent = 'Meta Ads ainda não ligado: falta META_ACCESS_TOKEN na Vercel com ads_read e ads_management.';
            return;
        }

        if (metaConnection.missing_scopes && metaConnection.missing_scopes.length) {
            metaBanner.textContent = 'Token Meta incompleto. Faltam permissões: ' + metaConnection.missing_scopes.join(', ') + '.';
            return;
        }

        metaBanner.textContent = metaConnection.error || 'Não foi possível ligar ao Meta Ads.';
    }

    function renderStatusBadge(status) {
        var normalized = String(status || '').toUpperCase();
        var className = normalized === 'ACTIVE'
            ? 'metrics-badge metrics-badge--ok'
            : 'metrics-badge metrics-badge--warn';
        return '<span class="' + className + '">' + escapeHtml(normalized || '—') + '</span>';
    }

    function renderMetaPanel(payload) {
        var merged = payload && payload.merged;
        var metaConnection = payload && payload.meta_connection;

        renderMetaBanner(metaConnection);

        if (!merged || !merged.campaigns || !merged.campaigns.length) {
            metaPanel.hidden = true;
            metaBody.innerHTML = '';
            metaContext.textContent = '';
            return;
        }

        metaPanel.hidden = false;

        var account = merged.account || {};
        var summary = merged.summary || {};
        var currency = summary.meta_currency || account.currency || 'EUR';

        metaContext.textContent = [
            account.name || account.label || ('Conta ' + account.id),
            account.timezone_name ? 'Fuso: ' + account.timezone_name : '',
            currency !== 'EUR'
                ? 'Gasto original em ' + currency + ' · convertido para EUR'
                : 'Moeda: EUR',
        ].filter(Boolean).join(' · ');

        metaGeneratedAt.textContent = payload.stripe && payload.stripe.summary && payload.stripe.summary.generated_at
            ? 'Actualizado ' + formatDate(payload.stripe.summary.generated_at)
            : '';

        metaBody.innerHTML = merged.campaigns.map(function (campaign) {
            var spendLabel = currency === 'EUR'
                ? formatMoneyEur(campaign.spend_eur)
                : formatMoney(campaign.spend_original, currency) + ' (' + formatMoneyEur(campaign.spend_eur) + ')';
            var roasLabel = campaign.roas_real === null ? '—' : String(campaign.roas_real);
            var isActive = String(campaign.effective_status || campaign.status).toUpperCase() === 'ACTIVE';
            var actionLabel = isActive ? 'Pausar' : 'Activar';
            var nextStatus = isActive ? 'PAUSED' : 'ACTIVE';

            return (
                '<tr>' +
                '<td><strong>' + escapeHtml(campaign.name) + '</strong><br><span class="metrics-node__meta">ID ' + escapeHtml(campaign.id) + '</span></td>' +
                '<td>' + renderStatusBadge(campaign.effective_status || campaign.status) + '</td>' +
                '<td>' + escapeHtml(spendLabel) + '</td>' +
                '<td>' + Number(campaign.meta_purchases || 0) + ' compras</td>' +
                '<td><strong>' + Number(campaign.stripe_sales || 0) + '</strong> vendas · ' + escapeHtml(formatMoneyEur(campaign.stripe_revenue_eur)) + '</td>' +
                '<td>' + escapeHtml(roasLabel) + '</td>' +
                '<td><button type="button" class="metrics-button metrics-button--ghost metrics-toggle" data-campaign-id="' + escapeHtml(campaign.id) + '" data-next-status="' + nextStatus + '">' + actionLabel + '</button></td>' +
                '</tr>'
            );
        }).join('');
    }

    async function toggleCampaignStatus(button) {
        var campaignId = button.getAttribute('data-campaign-id');
        var nextStatus = button.getAttribute('data-next-status');
        var accountId = getSelectedAccountId();
        var token = getToken();

        if (!campaignId || !accountId || !token) {
            return;
        }

        var confirmMessage = nextStatus === 'PAUSED'
            ? 'Pausar esta campanha no Meta?'
            : 'Activar esta campanha no Meta?';

        if (!window.confirm(confirmMessage)) {
            return;
        }

        button.disabled = true;
        setStatus('A actualizar campanha no Meta…', false);

        try {
            var response = await fetch('/api/sales-attribution?action=meta_status', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    account_id: accountId,
                    object_id: campaignId,
                    object_type: 'campaign',
                    status: nextStatus,
                }),
            });
            var data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Não foi possível actualizar a campanha.');
            }

            setStatus('Campanha actualizada no Meta.', false);
            await fetchMetrics();
        } catch (error) {
            setStatus(error.message || 'Erro ao actualizar campanha.', true);
            button.disabled = false;
        }
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
        var range = datePicker.getAppliedRange();

        if (!token) {
            showLogin();
            return;
        }

        setStatus('A carregar Stripe + Meta…', false);

        var response = await fetch('/api/sales-attribution?' + buildQuery(range), {
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

        latestPayload = data;
        renderDashboard(data);
    }

    function renderSummaryCards(stripeSummary, mergedSummary) {
        var attributedPct = stripeSummary.total_sales
            ? Math.round((stripeSummary.attributed_sales / stripeSummary.total_sales) * 100)
            : 0;
        var cards = [
            {
                label: 'Vendas Stripe',
                value: stripeSummary.total_sales,
                hint: 'Checkout live',
            },
            {
                label: 'Receita Stripe',
                value: formatMoneyEur(stripeSummary.total_revenue_eur),
                hint: 'EUR cobrado',
            },
            {
                label: 'Gasto Meta',
                value: mergedSummary ? formatMoneyEur(mergedSummary.meta_spend_eur) : '—',
                hint: mergedSummary && mergedSummary.meta_currency !== 'EUR'
                    ? 'Original ' + mergedSummary.meta_currency + ' convertido'
                    : 'Período seleccionado',
            },
            {
                label: 'ROAS real',
                value: mergedSummary && mergedSummary.roas_real !== null ? mergedSummary.roas_real : '—',
                hint: 'Receita Stripe ÷ gasto Meta',
            },
            {
                label: 'Atribuídas',
                value: stripeSummary.attributed_sales,
                hint: attributedPct + '% com campanha/anúncio',
            },
            {
                label: 'Com fbc',
                value: stripeSummary.with_fbc,
                hint: 'Cookie de clique no anúncio',
            },
        ];

        summaryRoot.innerHTML = cards.map(function (card) {
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
            '<div class="metrics-node__stat">' + escapeHtml(formatMoneyEur(ad.revenue_eur)) + '</div>' +
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
            '<div class="metrics-node__stat">' + escapeHtml(formatMoneyEur(adset.revenue_eur)) + '</div>' +
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
            '<div class="metrics-node__stat">' + escapeHtml(formatMoneyEur(campaign.revenue_eur)) + '</div>' +
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
                '<td>' + escapeHtml(formatMoneyEur(sale.amount_eur)) + '</td>' +
                '<td>' + bumps + '</td>' +
                '<td>' + fbcBadge + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function renderDashboard(data) {
        var stripe = data.stripe || data;

        renderAccountOptions(data.accounts || [], data.active_account_id || getSelectedAccountId());
        renderSummaryCards(stripe.summary || {}, data.merged && data.merged.summary ? data.merged.summary : null);
        renderMetaPanel(data);
        renderTree(stripe.campaigns || []);
        renderRecentSales(stripe.recent_sales || []);
        generatedAt.textContent = stripe.summary && stripe.summary.generated_at
            ? 'Actualizado ' + formatDate(stripe.summary.generated_at)
            : '';
        noteBox.textContent = stripe.note || '';
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

    accountSelect.addEventListener('change', function () {
        setSelectedAccountId(accountSelect.value);
        fetchMetrics().catch(function () {
            setStatus('Erro de ligação. Tenta outra vez.', true);
        });
    });

    metaBody.addEventListener('click', function (event) {
        var button = event.target.closest('.metrics-toggle');

        if (!button) {
            return;
        }

        toggleCampaignStatus(button);
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
