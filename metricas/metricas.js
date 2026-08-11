(function () {
    var TOKEN_KEY = 'onda-metrics-token';

    var loginSection = document.getElementById('metrics-login');
    var dashboardSection = document.getElementById('metrics-dashboard');
    var loginForm = document.getElementById('metrics-login-form');
    var passwordInput = document.getElementById('metrics-password');
    var loginError = document.getElementById('metrics-login-error');
    var statusBox = document.getElementById('metrics-status');
    var summaryRoot = document.getElementById('metrics-summary');
    var funnelRoot = document.getElementById('metrics-funnel');
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
    var metaHead = document.getElementById('metrics-meta-head');
    var metaBody = document.getElementById('metrics-meta-body');
    var metaGeneratedAt = document.getElementById('metrics-meta-generated-at');
    var vturbPanel = document.getElementById('metrics-vturb-panel');
    var vturbContext = document.getElementById('metrics-vturb-context');
    var vturbSummary = document.getElementById('metrics-vturb-summary');
    var vturbGeneratedAt = document.getElementById('metrics-vturb-generated-at');
    var ACCOUNT_KEY = 'onda-metrics-account';
    var latestPayload = null;
    var datePickerRoot = document.getElementById('metrics-date-picker-root');
    var datePicker = window.MetricsDateRangePicker.create({
        root: datePickerRoot,
        defaultPreset: 'today',
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

        if (/request limit|rate limit|too many calls/i.test(metaConnection.error || '')) {
            metaBanner.textContent = 'Limite de pedidos da Meta API atingido. Aguarda 1–2 minutos e clica Actualizar (sem mudar de data). Os dados Stripe e VTurb continuam disponíveis.';
        }
    }

    function renderStatusBadge(status) {
        var normalized = String(status || '').toUpperCase();
        var className = normalized === 'ACTIVE'
            ? 'metrics-badge metrics-badge--ok'
            : 'metrics-badge metrics-badge--warn';
        return '<span class="' + className + '">' + escapeHtml(normalized || '—') + '</span>';
    }

    function formatPercent(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        return Number(value).toFixed(2).replace('.', ',') + '%';
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('pt-PT');
    }

    function formatOptionalMoney(value, currency) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        return formatMoney(value, currency);
    }

    function formatOptionalNumber(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        return formatNumber(value);
    }

    function renderSpendLabel(node, currency) {
        if (currency === 'EUR') {
            return formatMoneyEur(node.spend_eur);
        }

        return formatMoney(node.spend_original, currency) + ' (' + formatMoneyEur(node.spend_eur) + ')';
    }

    var META_TABLE_COLUMNS = [
        { key: 'name', label: 'Campanha', type: 'name' },
        { key: 'spend_original', label: 'Gasto', type: 'money' },
        { key: 'impressions', label: 'Impressões', type: 'number' },
        { key: 'cpm', label: 'CPM', type: 'money' },
        { key: 'reach', label: 'Alcance', type: 'number' },
        { key: 'frequency', label: 'Freq.', type: 'decimal' },
        { key: 'cpc_all', label: 'CPC (tudo)', type: 'money' },
        { key: 'cpc_link', label: 'CPC (lig.)', type: 'money' },
        { key: 'ctr_all', label: 'CTR (tudo)', type: 'percent' },
        { key: 'ctr_link', label: 'CTR (lig.)', type: 'percent' },
        { key: 'inline_link_clicks', label: 'Cliques lig.', type: 'number' },
        { key: 'landing_page_views', label: 'LPV', type: 'number' },
        { key: 'cost_per_landing_page_view', label: 'Custo/LPV', type: 'money' },
        { key: 'initiate_checkout', label: 'IC', type: 'number' },
        { key: 'meta_purchases', label: 'Compras Meta', type: 'number' },
        { key: 'meta_purchase_value_original', label: 'Valor Meta', type: 'money' },
        { key: 'stripe_sales', label: 'Stripe', type: 'number' },
        { key: 'stripe_revenue_eur', label: 'Receita Stripe', type: 'money_eur' },
        { key: 'roas_real', label: 'ROAS', type: 'decimal' },
    ];

    function renderMetaCell(node, column, currency) {
        var value = node[column.key];

        if (column.type === 'name') {
            return (
                '<div class="metrics-table__name">' + escapeHtml(node.name) + '</div>' +
                renderStatusBadge(node.effective_status || node.status) +
                '<div class="metrics-table__meta">ID ' + escapeHtml(node.id) + '</div>'
            );
        }

        if (column.type === 'money') {
            return escapeHtml(formatOptionalMoney(value, currency));
        }

        if (column.type === 'money_eur') {
            return escapeHtml(formatMoneyEur(value || 0));
        }

        if (column.type === 'percent') {
            return escapeHtml(formatPercent(value));
        }

        if (column.type === 'decimal') {
            return escapeHtml(formatOptionalNumber(value));
        }

        return escapeHtml(formatNumber(value));
    }

    function renderMetaTableHead(currency) {
        var actionHeader = '<th class="metrics-table__actions-head">Acções</th>';

        metaHead.innerHTML = '<tr>' + META_TABLE_COLUMNS.map(function (column) {
            return '<th>' + escapeHtml(column.label) + '</th>';
        }).join('') + actionHeader + '</tr>';
    }

    function renderMetaTableRow(node, currency, level) {
        var levelClass = level ? ' metrics-table__row--' + level : '';
        var cells = META_TABLE_COLUMNS.map(function (column, index) {
            var cellClass = index === 0 ? ' metrics-table__name-cell' : '';
            return '<td class="' + cellClass.trim() + '">' + renderMetaCell(node, column, currency) + '</td>';
        }).join('');

        var toggle = node.object_type ? renderMetaToggle(node) : '';

        return (
            '<tr class="metrics-table__row' + levelClass + '">' +
            cells +
            '<td class="metrics-table__actions-cell">' + toggle + '</td>' +
            '</tr>'
        );
    }

    function renderMetaNestedRows(nodes, currency, level) {
        return (nodes || []).map(function (node) {
            var childRows = '';

            if (level === 'campaign' && node.adsets && node.adsets.length) {
                childRows += node.adsets.map(function (adset) {
                    return renderMetaTableRow(adset, currency, 'adset') +
                        renderMetaNestedRows(adset.ads || [], currency, 'ad');
                }).join('');
            }

            return renderMetaTableRow(node, currency, level) + childRows;
        }).join('');
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

    function renderMetaPanel(payload, metaLoading) {
        var merged = payload && payload.merged;
        var metaConnection = payload && payload.meta_connection;

        renderMetaBanner(metaConnection);

        if (metaLoading) {
            metaPanel.hidden = false;
            metaContext.textContent = 'A carregar gastos e ROAS do Meta Ads…';
            metaGeneratedAt.textContent = '';
            metaBody.innerHTML = '<tr><td colspan="20">A carregar Meta Ads…</td></tr>';
            return;
        }

        if (!merged || !merged.campaigns || !merged.campaigns.length) {
            metaPanel.hidden = !metaConnection || metaConnection.ok === false;
            metaBody.innerHTML = metaConnection && !metaConnection.ok
                ? '<tr><td colspan="20">Meta Ads indisponível neste momento.</td></tr>'
                : '';
            metaContext.textContent = '';
            return;
        }

        metaPanel.hidden = false;

        var account = merged.account || {};
        var currency = merged.summary && merged.summary.meta_currency ? merged.summary.meta_currency : (account.currency || 'EUR');

        metaContext.textContent = [
            account.name || account.label || ('Conta ' + account.id),
            'Preset J.Ecoom · Vendas Stripe: fuso Portugal',
            account.timezone_name && account.timezone_name !== 'Europe/Lisbon'
                ? 'Gastos Meta: fuso ' + account.timezone_name
                : '',
        ].filter(Boolean).join(' · ');

        metaGeneratedAt.textContent = payload.stripe && payload.stripe.summary && payload.stripe.summary.generated_at
            ? 'Actualizado ' + formatDate(payload.stripe.summary.generated_at)
            : '';

        renderMetaTableHead(currency);
        metaBody.innerHTML = renderMetaNestedRows(merged.campaigns, currency, 'campaign');
    }

    function renderVturbPanel(payload) {
        var vturb = payload && payload.vturb;
        var summary = vturb && vturb.summary;

        if (!vturb || !vturb.configured) {
            vturbPanel.hidden = true;
            return;
        }

        vturbPanel.hidden = false;

        if (!vturb.ok || !summary) {
            vturbContext.textContent = vturb.error || 'VTurb indisponível.';
            vturbSummary.innerHTML = '';
            vturbGeneratedAt.textContent = '';
            return;
        }

        vturbContext.textContent = [
            'Player ' + (vturb.player_id || ''),
            vturb.date_range && vturb.date_range.timezone ? 'Fuso ' + vturb.date_range.timezone : '',
        ].filter(Boolean).join(' · ');

        vturbGeneratedAt.textContent = vturb.generated_at
            ? 'Actualizado ' + formatDate(vturb.generated_at)
            : '';

        var cards = [
            { label: 'Visualizações', value: formatNumber(summary.views) },
            { label: 'Visualizações Únicas', value: formatNumber(summary.views_unique_sessions) },
            { label: 'Plays', value: formatNumber(summary.plays) },
            { label: 'Plays Únicos', value: formatNumber(summary.plays_unique_sessions) },
            { label: 'Play Rate', value: summary.play_rate !== null ? formatPercent(summary.play_rate) : '—' },
            { label: 'Retenção ao Pitch', value: summary.over_pitch_rate !== null ? formatPercent(summary.over_pitch_rate) : '—' },
            { label: 'Audiência do Pitch', value: formatNumber(summary.over_pitch) },
            { label: 'Engajamento', value: summary.engagement_rate !== null ? formatPercent(summary.engagement_rate) : '—' },
            { label: 'Cliques no Botão', value: formatNumber(summary.cta_clicks) },
            { label: 'Conversões', value: formatNumber(summary.conversions) },
            { label: 'Taxa de Conversão', value: summary.conversion_rate !== null ? formatPercent(summary.conversion_rate) : '—' },
            { label: 'Receita', value: formatMoneyEur(summary.revenue_eur) },
        ];

        vturbSummary.innerHTML = cards.map(function (card) {
            return (
                '<article class="metrics-card metrics-card--vturb">' +
                '<div class="metrics-card__label">' + escapeHtml(card.label) + '</div>' +
                '<div class="metrics-card__value">' + escapeHtml(String(card.value)) + '</div>' +
                '</article>'
            );
        }).join('');
    }

    function renderFunnelCards(stripeSummary, mergedSummary, vturbSummary) {
        if (!mergedSummary) {
            funnelRoot.innerHTML = '';
            return;
        }

        var cards = [
            {
                label: 'Impressões',
                value: formatNumber(mergedSummary.impressions),
                hint: 'Meta Ads',
            },
            {
                label: 'Landing views',
                value: formatNumber(mergedSummary.landing_page_views),
                hint: mergedSummary.reach ? formatNumber(mergedSummary.reach) + ' alcance' : 'Meta pixel',
            },
            {
                label: 'Views VSL',
                value: vturbSummary ? formatNumber(vturbSummary.views) : '—',
                hint: vturbSummary ? formatNumber(vturbSummary.plays) + ' plays' : 'VTurb',
            },
            {
                label: 'Initiate checkout',
                value: formatNumber(mergedSummary.initiate_checkout),
                hint: 'Meta pixel/CAPI',
            },
        ];

        funnelRoot.innerHTML = cards.map(function (card) {
            return (
                '<article class="metrics-card metrics-card--funnel">' +
                '<div class="metrics-card__label">' + escapeHtml(card.label) + '</div>' +
                '<div class="metrics-card__value">' + escapeHtml(String(card.value)) + '</div>' +
                '<div class="metrics-card__hint">' + escapeHtml(card.hint) + '</div>' +
                '</article>'
            );
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

    function renderDashboard(data, loading) {
        var stripe = data.stripe || data;
        var mergedSummary = data.merged && data.merged.summary ? data.merged.summary : null;
        var vturbSummary = data.vturb && data.vturb.summary ? data.vturb.summary : null;

        renderAccountOptions(data.accounts || [], data.active_account_id || getSelectedAccountId());
        renderSummaryCards(stripe.summary || {}, mergedSummary);
        renderFunnelCards(stripe.summary || {}, mergedSummary, vturbSummary);
        renderVturbPanel(data);
        renderMetaPanel(data, loading);
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

        setStatus('A carregar métricas…', false);

        try {
            var data = await fetchJson(
                '/api/sales-attribution?' + buildQuery(range, 'combined', { refresh: refresh }),
                token
            );

            if (!data) {
                return;
            }

            latestPayload = data;
            renderDashboard(data, false);
            setStatus('', false);
        } catch (error) {
            setStatus(error.message || 'Erro ao carregar métricas.', true);
        }
    }

    function renderSummaryCards(stripeSummary, mergedSummary) {
        var revenueEur = Number(stripeSummary.total_revenue_eur || 0);
        var spendEur = mergedSummary ? Number(mergedSummary.meta_spend_eur || 0) : 0;
        var profitEur = Number((revenueEur - spendEur).toFixed(2));
        var profitClass = profitEur >= 0 ? ' metrics-card__value--positive' : ' metrics-card__value--negative';

        var cards = [
            {
                label: 'Vendas',
                value: stripeSummary.total_sales || 0,
                hint: 'Stripe · checkout live',
            },
            {
                label: 'Receitas',
                value: formatMoneyEur(revenueEur),
                hint: 'EUR cobrado',
            },
            {
                label: 'Gasto',
                value: mergedSummary ? formatMoneyEur(spendEur) : '—',
                hint: mergedSummary && mergedSummary.meta_currency !== 'EUR'
                    ? 'Meta · ' + mergedSummary.meta_currency + ' convertido'
                    : 'Meta Ads',
            },
            {
                label: 'Lucro',
                value: mergedSummary ? formatMoneyEur(profitEur) : '—',
                hint: 'Receita Stripe − gasto Meta',
                valueClass: mergedSummary ? profitClass : '',
            },
            {
                label: 'ROAS',
                value: mergedSummary && mergedSummary.roas_real !== null ? mergedSummary.roas_real : '—',
                hint: 'Receita ÷ gasto Meta',
            },
        ];

        summaryRoot.innerHTML = cards.map(function (card) {
            return (
                '<article class="metrics-card metrics-card--primary">' +
                '<div class="metrics-card__label">' + escapeHtml(card.label) + '</div>' +
                '<div class="metrics-card__value' + (card.valueClass || '') + '">' + escapeHtml(String(card.value)) + '</div>' +
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

    metaBody.addEventListener('click', function (event) {
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
