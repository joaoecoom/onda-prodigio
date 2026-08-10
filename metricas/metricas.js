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
    var metaTree = document.getElementById('metrics-meta-tree');
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

    function buildQuery(range, action, options) {
        var params = ['action=' + encodeURIComponent(action || 'stripe')];

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

        if (options && options.refresh) {
            params.push('refresh=1');
        }

        return params.join('&');
    }

    async function fetchJson(path, token) {
        var response = await fetch(path, {
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
            return null;
        }

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível carregar as métricas.');
        }

        return data;
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

    function renderSpendLabel(node, currency) {
        if (currency === 'EUR') {
            return formatMoneyEur(node.spend_eur);
        }

        return formatMoney(node.spend_original, currency) + ' (' + formatMoneyEur(node.spend_eur) + ')';
    }

    function renderMetaStats(node, currency) {
        var roasLabel = node.roas_real === null ? '—' : String(node.roas_real);

        return (
            '<div class="metrics-node__stat">' + escapeHtml(renderSpendLabel(node, currency)) + '</div>' +
            '<div class="metrics-node__stat">' + Number(node.meta_purchases || 0) + ' meta</div>' +
            '<div class="metrics-node__stat"><strong>' + Number(node.stripe_sales || 0) + '</strong> stripe · ' + escapeHtml(formatMoneyEur(node.stripe_revenue_eur)) + '</div>' +
            '<div class="metrics-node__stat">ROAS ' + escapeHtml(roasLabel) + '</div>'
        );
    }

    function renderMetaToggle(node) {
        var isActive = String(node.effective_status || node.status).toUpperCase() === 'ACTIVE';
        var actionLabel = isActive ? 'Pausar' : 'Activar';
        var nextStatus = isActive ? 'PAUSED' : 'ACTIVE';

        return (
            '<button type="button" class="metrics-button metrics-button--ghost metrics-toggle" ' +
            'data-object-id="' + escapeHtml(node.id) + '" ' +
            'data-object-type="' + escapeHtml(node.object_type || 'campaign') + '" ' +
            'data-next-status="' + nextStatus + '">' + actionLabel + '</button>'
        );
    }

    function renderMetaAdNode(ad, currency) {
        return (
            '<div class="metrics-node metrics-node--level-ad">' +
            '<div class="metrics-node__row metrics-node__row--static metrics-node__row--meta">' +
            '<div><span class="metrics-node__name">' + escapeHtml(ad.name) + '</span>' +
            renderStatusBadge(ad.effective_status || ad.status) +
            '<span class="metrics-node__meta">ID ' + escapeHtml(ad.id) + '</span></div>' +
            renderMetaStats(ad, currency) +
            '<div class="metrics-node__actions">' + renderMetaToggle(ad) + '</div>' +
            '</div></div>'
        );
    }

    function renderMetaAdsetNode(adset, currency) {
        var adsHtml = (adset.ads || []).map(function (ad) {
            return renderMetaAdNode(ad, currency);
        }).join('');

        return (
            '<details class="metrics-node metrics-node--level-adset" open>' +
            '<summary class="metrics-node__row metrics-node__row--meta">' +
            '<div><span class="metrics-node__name">' + escapeHtml(adset.name) + '</span>' +
            renderStatusBadge(adset.effective_status || adset.status) +
            '<span class="metrics-node__meta">ID ' + escapeHtml(adset.id) + '</span></div>' +
            renderMetaStats(adset, currency) +
            '<div class="metrics-node__actions">' + renderMetaToggle(adset) + '</div>' +
            '</summary>' +
            '<div class="metrics-node__children">' + (adsHtml || '<p class="metrics-tree__empty">Sem anúncios.</p>') + '</div>' +
            '</details>'
        );
    }

    function renderMetaCampaignNode(campaign, currency) {
        var adsetsHtml = (campaign.adsets || []).map(function (adset) {
            return renderMetaAdsetNode(adset, currency);
        }).join('');

        return (
            '<details class="metrics-node metrics-node--level-campaign" open>' +
            '<summary class="metrics-node__row metrics-node__row--meta">' +
            '<div><span class="metrics-node__name">' + escapeHtml(campaign.name) + '</span>' +
            renderStatusBadge(campaign.effective_status || campaign.status) +
            '<span class="metrics-node__meta">ID ' + escapeHtml(campaign.id) + '</span></div>' +
            renderMetaStats(campaign, currency) +
            '<div class="metrics-node__actions">' + renderMetaToggle(campaign) + '</div>' +
            '</summary>' +
            '<div class="metrics-node__children">' + (adsetsHtml || '<p class="metrics-tree__empty">Sem conjuntos.</p>') + '</div>' +
            '</details>'
        );
    }

    function renderMetaPanel(payload, metaLoading) {
        var merged = payload && payload.merged;
        var metaConnection = payload && payload.meta_connection;

        renderMetaBanner(metaConnection);

        if (metaLoading) {
            metaPanel.hidden = false;
            metaContext.textContent = 'A carregar gastos e ROAS do Meta Ads…';
            metaGeneratedAt.textContent = '';
            metaTree.innerHTML = '<p class="metrics-tree__empty">A carregar Meta Ads…</p>';
            return;
        }

        if (!merged || !merged.campaigns || !merged.campaigns.length) {
            metaPanel.hidden = !metaConnection || metaConnection.ok === false;
            metaTree.innerHTML = metaConnection && !metaConnection.ok
                ? '<p class="metrics-tree__empty">Meta Ads indisponível neste momento.</p>'
                : '';
            metaContext.textContent = '';
            return;
        }

        metaPanel.hidden = false;

        var account = merged.account || {};
        var summary = merged.summary || {};
        var currency = summary.meta_currency || account.currency || 'EUR';

        metaContext.textContent = [
            account.name || account.label || ('Conta ' + account.id),
            'Vendas Stripe: fuso Portugal',
            account.timezone_name && account.timezone_name !== 'Europe/Lisbon'
                ? 'Gastos Meta: fuso ' + account.timezone_name
                : '',
        ].filter(Boolean).join(' · ');

        metaGeneratedAt.textContent = payload.stripe && payload.stripe.summary && payload.stripe.summary.generated_at
            ? 'Actualizado ' + formatDate(payload.stripe.summary.generated_at)
            : '';

        metaTree.innerHTML = merged.campaigns.map(function (campaign) {
            return renderMetaCampaignNode(campaign, currency);
        }).join('');
    }

    async function toggleMetaStatus(button) {
        var objectId = button.getAttribute('data-object-id');
        var objectType = button.getAttribute('data-object-type') || 'campaign';
        var nextStatus = button.getAttribute('data-next-status');
        var accountId = getSelectedAccountId();
        var token = getToken();

        if (!objectId || !accountId || !token) {
            return;
        }

        var label = objectType === 'adset' ? 'conjunto' : (objectType === 'ad' ? 'anúncio' : 'campanha');
        var confirmMessage = nextStatus === 'PAUSED'
            ? 'Pausar este ' + label + ' no Meta?'
            : 'Activar este ' + label + ' no Meta?';

        if (!window.confirm(confirmMessage)) {
            return;
        }

        button.disabled = true;
        setStatus('A actualizar no Meta…', false);

        try {
            var response = await fetch('/api/sales-attribution?action=meta_status', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    account_id: accountId,
                    object_id: objectId,
                    object_type: objectType,
                    status: nextStatus,
                }),
            });
            var data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Não foi possível actualizar.');
            }

            setStatus('Actualizado no Meta.', false);
            await fetchMetrics({ refresh: true });
        } catch (error) {
            setStatus(error.message || 'Erro ao actualizar.', true);
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

    function renderDashboard(data, metaLoading) {
        var stripe = data.stripe || data;

        renderAccountOptions(data.accounts || [], data.active_account_id || getSelectedAccountId());
        renderSummaryCards(stripe.summary || {}, data.merged && data.merged.summary ? data.merged.summary : null);
        renderMetaPanel(data, metaLoading);
        renderTree(stripe.campaigns || []);
        renderRecentSales(stripe.recent_sales || stripe.sales || []);
        generatedAt.textContent = stripe.summary && stripe.summary.generated_at
            ? 'Actualizado ' + formatDate(stripe.summary.generated_at) +
                (stripe.date_range && stripe.date_range.timezone === 'Europe/Lisbon' ? ' · Fuso vendas: Portugal' : '')
            : '';
        noteBox.textContent = stripe.note || '';
    }

    async function fetchMetrics(options) {
        var token = getToken();
        var range = datePicker.getAppliedRange();
        var refresh = Boolean(options && options.refresh);

        if (!token) {
            showLogin();
            return;
        }

        setStatus('A carregar vendas Stripe…', false);

        var stripeData = await fetchJson(
            '/api/sales-attribution?' + buildQuery(range, 'stripe', { refresh: refresh }),
            token
        );

        if (!stripeData) {
            return;
        }

        latestPayload = {
            stripe: stripeData,
            merged: null,
            meta_connection: { ok: false, has_token: true },
            accounts: stripeData.accounts || [],
            active_account_id: stripeData.active_account_id || getSelectedAccountId(),
        };
        renderDashboard(latestPayload, true);
        setStatus('', false);

        setStatus('A carregar Meta Ads…', false);

        try {
            var metaData = await fetchJson(
                '/api/sales-attribution?' + buildQuery(range, 'meta', { refresh: refresh }),
                token
            );

            if (!metaData) {
                return;
            }

            latestPayload = metaData;
            renderDashboard(metaData, false);
            setStatus('', false);
        } catch (error) {
            renderMetaPanel(latestPayload, false);
            setStatus(error.message || 'Stripe carregou, mas Meta falhou.', true);
        }
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

    metaTree.addEventListener('click', function (event) {
        var button = event.target.closest('.metrics-toggle');

        if (!button) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        toggleMetaStatus(button);
    });

    refreshButton.addEventListener('click', function () {
        fetchMetrics({ refresh: true }).catch(function () {
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
