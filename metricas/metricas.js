(function () {
    var TOKEN_KEY = 'onda-metrics-token';
    var METRICS_PAGE = document.documentElement.getAttribute('data-metrics-page') || 'dashboard';

    var loginSection = document.getElementById('metrics-login');
    var dashboardSection = document.getElementById('metrics-dashboard');
    var loginForm = document.getElementById('metrics-login-form');
    var passwordInput = document.getElementById('metrics-password');
    var loginError = document.getElementById('metrics-login-error');
    var statusBox = document.getElementById('metrics-status');
    var summaryTotalRoot = document.getElementById('metrics-summary-total');
    var summaryTrafficRoot = document.getElementById('metrics-summary-traffic');
    var profitsRoot = document.getElementById('metrics-profits');
    var funnelRoot = document.getElementById('metrics-funnel');
    var treeRoot = document.getElementById('metrics-tree');
    var recentBody = document.getElementById('metrics-recent-body');
    var generatedAt = document.getElementById('metrics-generated-at');
    var noteBox = document.getElementById('metrics-note');
    var refreshButton = document.getElementById('metrics-refresh');
    var pushBanner = document.getElementById('metrics-push-banner');
    var pushBannerText = document.getElementById('metrics-push-banner-text');
    var logoutButton = document.getElementById('metrics-logout');
    var accountWrap = document.getElementById('metrics-account-wrap');
    var accountSelect = document.getElementById('metrics-account');
    var checkoutVariantSelect = document.getElementById('metrics-checkout-variant');
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
    var CHECKOUT_VARIANT_KEY = 'onda-metrics-checkout-variant';
    var latestPayload = null;
    var salesPulseTimer = null;
    var SALES_PULSE_MS = 15 * 1000;
    var salesPulseSeeded = false;
    var SEEN_SALES_KEY = 'onda-metrics-seen-sales';
    var toastsRoot = document.getElementById('metrics-toasts');
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
        stopSalesPulse();
        loginSection.hidden = false;
        dashboardSection.hidden = true;
    }

    function showDashboard() {
        loginSection.hidden = true;
        dashboardSection.hidden = false;
        updatePushBannerState();
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

    function getSelectedCheckoutVariant() {
        if (!checkoutVariantSelect) {
            return 'all';
        }

        return checkoutVariantSelect.value || window.sessionStorage.getItem(CHECKOUT_VARIANT_KEY) || 'all';
    }

    function setSelectedCheckoutVariant(value) {
        if (!checkoutVariantSelect) {
            return;
        }

        checkoutVariantSelect.value = value || 'all';
        window.sessionStorage.setItem(CHECKOUT_VARIANT_KEY, checkoutVariantSelect.value);
    }

    function getCheckoutFilterLabel(variant) {
        if (variant === 'checkout9') {
            return 'Onda Prodígio · €9';
        }

        if (variant === 'checkout19') {
            return 'Onda Prodígio · €19';
        }

        return 'Onda Prodígio · €9 + €19';
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

    function getTodayIsoLocal() {
        var today = new Date();
        var month = String(today.getMonth() + 1).padStart(2, '0');
        var day = String(today.getDate()).padStart(2, '0');
        return today.getFullYear() + '-' + month + '-' + day;
    }

    function isLiveRange(range) {
        if (!range || !range.from || !range.to) {
            return false;
        }

        return range.to >= getTodayIsoLocal();
    }

    function stopAutoRefresh() {
        stopSalesPulse();
    }

    function getSeenSalesStorageKey(range) {
        var day = range && range.from ? range.from : getTodayIsoLocal();
        return SEEN_SALES_KEY + ':' + day;
    }

    function loadSeenSaleIds(range) {
        try {
            var raw = window.sessionStorage.getItem(getSeenSalesStorageKey(range));

            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            return [];
        }
    }

    function saveSeenSaleIds(range, ids) {
        try {
            window.sessionStorage.setItem(getSeenSalesStorageKey(range), JSON.stringify(ids.slice(0, 100)));
        } catch (error) {
            // Ignorar quota.
        }
    }

    function stopSalesPulse() {
        if (salesPulseTimer) {
            window.clearInterval(salesPulseTimer);
            salesPulseTimer = null;
        }

        salesPulseSeeded = false;
    }

    function startSalesPulse() {
        stopSalesPulse();

        if (dashboardSection.hidden || !getToken()) {
            return;
        }

        var range = datePicker.getAppliedRange();

        if (!isLiveRange(range)) {
            return;
        }

        pollSalesPulse(true);

        salesPulseTimer = window.setInterval(function () {
            if (document.hidden || dashboardSection.hidden || !getToken()) {
                return;
            }

            pollSalesPulse(false);
        }, SALES_PULSE_MS);
    }

    function maybeRequestNotificationPermission() {
        initMetricsPush();
    }

    function isStandalonePwa() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    }

    function updatePushBannerState() {
        if (!pushBanner) {
            return;
        }

        if (dashboardSection.hidden || !getToken()) {
            pushBanner.hidden = true;
            return;
        }

        if (!window.MetricsPush) {
            pushBanner.hidden = false;
            if (pushBannerText) {
                pushBannerText.textContent = 'A carregar alertas…';
            }
            return;
        }

        if (!window.MetricsPush.isSupported()) {
            pushBanner.hidden = false;
            if (pushBannerText) {
                pushBannerText.textContent = isStandalonePwa()
                    ? 'Este browser não suporta push. Actualiza o iOS (16.4+) ou abre noutro dispositivo.'
                    : 'No iPhone: Safari → Partilhar → «Adicionar ao Ecrã Principal». Abre a app «Métricas» e volta aqui.';
            }
            return;
        }

        var permission = window.MetricsPush.getPermission();

        if (permission === 'granted') {
            pushBanner.hidden = true;
            return;
        }

        pushBanner.hidden = false;

        if (permission === 'denied') {
            if (pushBannerText) {
                pushBannerText.textContent = 'Notificações bloqueadas. Activa nas Definições do iPhone → Notificações → Métricas.';
            }
        } else if (pushBannerText) {
            pushBannerText.textContent = 'A pedir permissão para alertas de vendas…';
        }
    }

    async function initMetricsPush() {
        if (!window.MetricsPush || !window.MetricsPush.isSupported()) {
            updatePushBannerState();
            return;
        }

        var token = getToken();

        if (!token || dashboardSection.hidden) {
            return;
        }

        var permission = window.MetricsPush.getPermission();

        try {
            if (permission === 'granted') {
                await window.MetricsPush.subscribe(token, { force: false });
            } else if (permission === 'default') {
                if (window.MetricsSaleSound) {
                    window.MetricsSaleSound.prime();
                }
                await window.MetricsPush.subscribe(token, { force: true });
            }
        } catch (error) {
            // Permissão recusada ou push indisponível — banner mostra estado.
        }

        updatePushBannerState();
    }

    function showSaleToast(sale) {
        if (!toastsRoot || !sale) {
            return;
        }

        var toast = document.createElement('div');
        toast.className = 'metrics-toast';
        toast.innerHTML =
            '<div class="metrics-toast__icon" aria-hidden="true">€</div>' +
            '<div class="metrics-toast__body">' +
            '<div class="metrics-toast__title">Nova venda</div>' +
            '<div class="metrics-toast__amount">' + escapeHtml(formatMoneyEur(sale.amount_eur)) + '</div>' +
            '<div class="metrics-toast__meta">' +
            escapeHtml(sale.source_label || 'Stripe') +
            ' · ' + escapeHtml(sale.campaign_name || 'Desconhecido') +
            '</div>' +
            '</div>';

        toastsRoot.appendChild(toast);

        if (window.MetricsSaleSound) {
            window.MetricsSaleSound.play();
        }

        window.requestAnimationFrame(function () {
            toast.classList.add('metrics-toast--visible');
        });

        window.setTimeout(function () {
            toast.classList.remove('metrics-toast--visible');

            window.setTimeout(function () {
                toast.remove();
            }, 320);
        }, 8000);

        if (window.Notification && Notification.permission === 'granted') {
            try {
                new Notification('Nova venda · ' + formatMoneyEur(sale.amount_eur), {
                    body: (sale.source_label || 'Stripe') + ' · ' + (sale.campaign_name || 'Desconhecido'),
                    tag: sale.payment_intent,
                });
            } catch (error) {
                // Notificações indisponíveis neste browser.
            }
        }
    }

    async function pollSalesPulse(seedOnly) {
        var token = getToken();
        var range = datePicker.getAppliedRange();

        if (!token || !isLiveRange(range)) {
            return;
        }

        try {
            var data = await fetchJson(
                '/api/sales-attribution?' + buildQuery(range, 'sales_pulse', {}),
                token
            );

            if (!data || !Array.isArray(data.sales)) {
                return;
            }

            var seenIds = loadSeenSaleIds(range);
            var seenSet = {};

            seenIds.forEach(function (id) {
                seenSet[id] = true;
            });

            if (seedOnly || !salesPulseSeeded) {
                data.sales.forEach(function (sale) {
                    if (sale.payment_intent) {
                        seenSet[sale.payment_intent] = true;
                    }
                });
                salesPulseSeeded = true;
                saveSeenSaleIds(range, Object.keys(seenSet));
                return;
            }

            var newSales = data.sales.filter(function (sale) {
                return sale.payment_intent && !seenSet[sale.payment_intent];
            }).sort(function (a, b) {
                return new Date(a.created).getTime() - new Date(b.created).getTime();
            });

            if (!newSales.length) {
                return;
            }

            newSales.forEach(function (sale) {
                showSaleToast(sale);
                seenSet[sale.payment_intent] = true;
            });

            saveSeenSaleIds(range, Object.keys(seenSet));
        } catch (error) {
            // Poll silencioso — não bloquear o dashboard.
        }
    }

    function updateLiveIndicator(range) {
        if (isLiveRange(range) && !dashboardSection.hidden) {
            startSalesPulse();
        } else {
            stopSalesPulse();
        }
    }

    function buildQuery(range, action, options) {
        var params = ['action=' + encodeURIComponent(action || 'stripe')];

        if (range.from && range.to) {
            params.push('from=' + encodeURIComponent(range.from));
            params.push('to=' + encodeURIComponent(range.to));
        }

        var accountId = getSelectedAccountId();

        if (accountId) {
            params.push('account_id=' + encodeURIComponent(accountId));
        }

        if (options && options.refresh) {
            params.push('refresh=1');
        }

        if (options && options.skipVturb) {
            params.push('skip_vturb=1');
        }

        if (options && options.metaMode) {
            params.push('meta_mode=' + encodeURIComponent(options.metaMode));
        }

        var checkoutVariant = getSelectedCheckoutVariant();

        if (checkoutVariant && checkoutVariant !== 'all') {
            params.push('checkout_variant=' + encodeURIComponent(checkoutVariant));
        }

        return params.join('&');
    }

    async function fetchJson(path, token) {
        var response = await fetch(path, {
            headers: {
                Authorization: 'Bearer ' + token,
            },
        });
        var data;
        var contentType = response.headers.get('content-type') || '';

        if (contentType.indexOf('application/json') !== -1) {
            data = await response.json();
        } else {
            var text = await response.text();
            throw new Error(text.trim().slice(0, 120) || 'Resposta inválida do servidor.');
        }

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

    function formatOptionalMoneyEur(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        return formatMoneyEur(value);
    }

    function formatOptionalNumber(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        return formatNumber(value);
    }

    function formatMetaExchangeHint(mergedSummary) {
        var parts = [];

        if (mergedSummary && (mergedSummary.meta_timezone || mergedSummary.timezone_name)) {
            var tz = mergedSummary.meta_timezone || mergedSummary.timezone_name;
            if (tz && tz !== 'Europe/Lisbon') {
                parts.push('Fuso conta Meta: ' + tz);
            }
        }

        if (!mergedSummary || mergedSummary.meta_currency === 'EUR') {
            return parts.length ? parts.join(' · ') : 'Meta Ads';
        }

        var rate = Number(mergedSummary.meta_eur_per_unit || 0);

        if (!rate) {
            parts.push('Meta · ' + mergedSummary.meta_currency + ' → EUR');
            return parts.join(' · ');
        }

        parts.push('Meta ' + mergedSummary.meta_currency + ' → EUR (1 ' + mergedSummary.meta_currency + ' = ' +
            rate.toFixed(4).replace('.', ',') + ' €)');

        return parts.join(' · ');
    }

    function buildMetaExchangeContext(mergedSummary) {
        if (!mergedSummary || mergedSummary.meta_currency === 'EUR') {
            return '';
        }

        var rate = Number(mergedSummary.meta_eur_per_unit || 0);

        if (!rate) {
            return 'Valores Meta convertidos para EUR';
        }

        return 'Valores Meta convertidos para EUR (1 ' + mergedSummary.meta_currency + ' = ' +
            rate.toFixed(4).replace('.', ',') + ' €)';
    }

    var META_TABLE_COLUMNS = [
        { key: 'name', label: 'Campanha', type: 'name' },
        { key: 'spend_eur', label: 'Gasto', type: 'money_eur' },
        { key: 'impressions', label: 'Impressões', type: 'number' },
        { key: 'cpm_eur', label: 'CPM', type: 'money_eur' },
        { key: 'reach', label: 'Alcance', type: 'number' },
        { key: 'frequency', label: 'Freq.', type: 'decimal' },
        { key: 'cpc_all_eur', label: 'CPC (tudo)', type: 'money_eur' },
        { key: 'cpc_link_eur', label: 'CPC (lig.)', type: 'money_eur' },
        { key: 'ctr_all', label: 'CTR (tudo)', type: 'percent' },
        { key: 'ctr_link', label: 'CTR (lig.)', type: 'percent' },
        { key: 'inline_link_clicks', label: 'Cliques lig.', type: 'number' },
        { key: 'landing_page_views', label: 'LPV', type: 'number' },
        { key: 'cost_per_landing_page_view_eur', label: 'Custo/LPV', type: 'money_eur' },
        { key: 'initiate_checkout', label: 'IC', type: 'number' },
        { key: 'meta_purchases', label: 'Compras Meta', type: 'number' },
        { key: 'meta_purchase_value_eur', label: 'Valor Meta', type: 'money_eur' },
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
            return escapeHtml(formatOptionalMoneyEur(value));
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

    function buildMetaDateContext(dateRange, account) {
        if (!dateRange) {
            if (account.timezone_name && account.timezone_name !== 'Europe/Lisbon') {
                return 'Gastos Meta: fuso ' + account.timezone_name;
            }

            return '';
        }

        if (!dateRange.adjusted) {
            return account.timezone_name && account.timezone_name !== 'Europe/Lisbon'
                ? 'Gastos Meta: fuso ' + account.timezone_name
                : 'Gastos Meta: fuso Portugal';
        }

        if (dateRange.use_hourly_filter) {
            return 'Gastos Meta: hora a hora · Portugal ' + dateRange.requested_from +
                (dateRange.requested_to !== dateRange.requested_from ? ' → ' + dateRange.requested_to : '') +
                ' (' + (dateRange.account_timezone || account.timezone_name || 'conta') + ')';
        }

        if (dateRange.alignment === 'account_calendar') {
            return 'Gastos Meta: ' + dateRange.since + ' → ' + dateRange.until +
                ' (calendário ' + (dateRange.account_timezone || account.timezone_name || 'conta') + ')' +
                ' · vendas Stripe: Portugal ' + dateRange.requested_from +
                (dateRange.requested_to !== dateRange.requested_from ? ' → ' + dateRange.requested_to : '');
        }

        return 'Gastos Meta: ' + dateRange.since + ' → ' + dateRange.until +
            ' (' + (dateRange.account_timezone || account.timezone_name || 'conta') +
            ') · alinhado a Portugal ' + dateRange.requested_from +
            (dateRange.requested_to !== dateRange.requested_from ? ' → ' + dateRange.requested_to : '');
    }

    function renderMetaPanel(payload, metaLoading) {
        if (!metaPanel) {
            return;
        }

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
            'Vendas Stripe: fuso Portugal',
            buildMetaExchangeContext(merged.summary),
            buildMetaDateContext(merged.date_range, account),
        ].filter(Boolean).join(' · ');

        metaGeneratedAt.textContent = payload.stripe && payload.stripe.summary && payload.stripe.summary.generated_at
            ? 'Actualizado ' + formatDate(payload.stripe.summary.generated_at)
            : '';

        renderMetaTableHead(currency);
        metaBody.innerHTML = renderMetaNestedRows(merged.campaigns, currency, 'campaign');
    }

    function renderVturbPanel(payload) {
        if (!vturbPanel) {
            return;
        }

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
            vturb.player_meta && vturb.player_meta.pitch_time ? 'Pitch ' + vturb.player_meta.pitch_time + 's' : '',
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
        if (!funnelRoot) {
            return;
        }

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
                hint: 'Meta pixel/CAPI',
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

    function renderDashboard(data, loading, options) {
        var stripeOnly = Boolean(options && options.stripeOnly);
        var stripe = data.stripe || data;
        var mergedSummary = data.merged && data.merged.summary ? data.merged.summary : null;
        var vturbSummary = data.vturb && data.vturb.summary ? data.vturb.summary : null;

        renderAccountOptions(data.accounts || [], data.active_account_id || getSelectedAccountId());

        if (METRICS_PAGE === 'analise') {
            renderTree(stripe.campaigns || []);
            renderRecentSales(stripe.recent_sales || stripe.sales || []);

            if (generatedAt) {
                generatedAt.textContent = stripe.summary && stripe.summary.generated_at
                    ? 'Actualizado ' + formatDate(stripe.summary.generated_at) +
                        (stripe.date_range && stripe.date_range.timezone === 'Europe/Lisbon' ? ' · Fuso vendas: Portugal' : '')
                    : '';
            }

            if (stripeOnly) {
                if (metaPanel) {
                    metaPanel.hidden = false;
                    if (metaContext) {
                        metaContext.textContent = 'A carregar gastos e ROAS do Meta Ads…';
                    }
                    if (metaBody) {
                        metaBody.innerHTML = '<tr><td colspan="20">A carregar Meta Ads…</td></tr>';
                    }
                }
            } else {
                renderMetaPanel(data, loading);
            }
        } else if (stripeOnly) {
            renderTotalSummaryCards(stripe.summary || {}, null);
            renderTrafficSummaryCards(stripe.summary || {}, null);
            if (profitsRoot) {
                profitsRoot.innerHTML = '<p class="metrics-tree__empty">A carregar lucros…</p>';
            }
        } else {
            renderProfitCards(stripe.summary || {}, mergedSummary, data.date_range || stripe.date_range);
            renderTotalSummaryCards(stripe.summary || {}, mergedSummary);
            renderTrafficSummaryCards(stripe.summary || {}, mergedSummary);
            renderFunnelCards(stripe.summary || {}, mergedSummary, vturbSummary);
            renderVturbPanel(data);
        }

        if (noteBox) {
            noteBox.textContent = stripe.note || '';
        }
    }

    async function fetchMetrics(options) {
        var token = getToken();
        var range = datePicker.getAppliedRange();
        var refresh = Boolean(options && options.refresh);
        var silent = Boolean(options && options.silent);
        var shouldRefresh = refresh;

        if (!token) {
            showLogin();
            return;
        }

        if (!silent) {
            setStatus('A carregar métricas…', false);

            if (profitsRoot && METRICS_PAGE !== 'analise') {
                profitsRoot.innerHTML = '<p class="metrics-tree__empty">A carregar lucros…</p>';
            }
        }

        try {
            var combinedOptions = { refresh: shouldRefresh };

            if (METRICS_PAGE === 'analise') {
                combinedOptions.skipVturb = true;
                combinedOptions.metaMode = 'full';
            } else {
                combinedOptions.metaMode = 'summary';
            }

            var data = await fetchJson(
                '/api/sales-attribution?' + buildQuery(range, 'combined', combinedOptions),
                token
            );

            if (!data) {
                return;
            }

            latestPayload = data;
            renderDashboard(data, false);
            updateLiveIndicator(range);

            if (!silent) {
                setStatus('', false);
            }

            maybeRequestNotificationPermission();
        } catch (error) {
            if (!silent) {
                setStatus(error.message || 'Erro ao carregar métricas.', true);
            }
        }
    }

    function formatRoas(revenueEur, spendEur, fallbackRoas) {
        if (spendEur > 0) {
            if (fallbackRoas !== null && fallbackRoas !== undefined) {
                return fallbackRoas;
            }

            return Number((revenueEur / spendEur).toFixed(2));
        }

        if (revenueEur > 0) {
            return '∞';
        }

        return '0';
    }

    function formatDateRangeHint(dateRange) {
        if (!dateRange || !dateRange.from || !dateRange.to) {
            return '';
        }

        if (dateRange.from === dateRange.to) {
            return ' · ' + dateRange.from;
        }

        return ' · ' + dateRange.from + ' → ' + dateRange.to;
    }

    function renderProfitCard(options) {
        var valueClass = options.valueClass || '';
        var modifier = options.modifier ? ' metrics-profit-card--' + options.modifier : '';

        return (
            '<article class="metrics-profit-card' + modifier + '">' +
            '<div class="metrics-profit-card__label">' + escapeHtml(options.label) + '</div>' +
            '<div class="metrics-profit-card__value' + valueClass + '">' + escapeHtml(String(options.value)) + '</div>' +
            (options.hint ? '<div class="metrics-profit-card__hint">' + options.hint + '</div>' : '') +
            '</article>'
        );
    }

    function renderProfitCards(stripeSummary, mergedSummary, dateRange) {
        if (!profitsRoot) {
            return;
        }

        if (!mergedSummary) {
            profitsRoot.innerHTML = '';
            return;
        }

        var spendEur = Number(mergedSummary.meta_spend_eur || 0);
        var totalRevenue = Number(stripeSummary.total_revenue_eur || 0);
        var trafficRevenue = Number(stripeSummary.traffic_revenue_eur || 0);
        var otherRevenue = Number(stripeSummary.other_revenue_eur || 0);
        var totalSales = Number(stripeSummary.total_sales || 0);
        var trafficProfit = Number((trafficRevenue - spendEur).toFixed(2));
        var totalProfit = Number((totalRevenue - spendEur).toFixed(2));
        var trafficClass = trafficProfit >= 0 ? ' metrics-profit-card__value--positive' : ' metrics-profit-card__value--negative';
        var totalClass = totalProfit >= 0 ? ' metrics-profit-card__value--positive' : ' metrics-profit-card__value--negative';
        var trafficRoas = formatRoas(trafficRevenue, spendEur, null);
        var totalRoas = formatRoas(totalRevenue, spendEur, mergedSummary.roas_real);
        var rangeHint = formatDateRangeHint(dateRange);

        var checkoutLabel = getCheckoutFilterLabel(getSelectedCheckoutVariant());
        var faturadoHint = totalSales + ' venda' + (totalSales === 1 ? '' : 's');
        if (otherRevenue > 0) {
            faturadoHint += ' · funil ' + formatMoneyEur(trafficRevenue) + ' + fora tráfego ' + formatMoneyEur(otherRevenue);
        } else {
            faturadoHint += ' · ' + checkoutLabel;
        }

        var trafficHint = formatMoneyEur(trafficRevenue) + ' − ' + formatMoneyEur(spendEur);
        if (spendEur > 0) {
            trafficHint += ' · ROAS ' + trafficRoas + '×';
        }

        var totalHint = formatMoneyEur(totalRevenue) + ' − ' + formatMoneyEur(spendEur);
        if (spendEur > 0) {
            totalHint += ' · ROAS ' + totalRoas + '×';
        }
        if (otherRevenue > 0) {
            totalHint += ' · inclui fora tráfego ' + formatMoneyEur(otherRevenue);
        }

        profitsRoot.innerHTML =
            renderProfitCard({
                label: 'Gasto tráfego',
                value: formatMoneyEur(spendEur),
                modifier: 'spend',
                valueClass: ' metrics-profit-card__value--spend',
                hint: escapeHtml(formatMetaExchangeHint(mergedSummary)) + escapeHtml(rangeHint),
            }) +
            renderProfitCard({
                label: 'Faturado',
                value: formatMoneyEur(totalRevenue),
                modifier: 'revenue',
                valueClass: ' metrics-profit-card__value--revenue',
                hint: escapeHtml(faturadoHint),
            }) +
            renderProfitCard({
                label: 'ROI c/ tráfego',
                value: formatMoneyEur(trafficProfit),
                modifier: 'traffic',
                valueClass: trafficClass,
                hint: escapeHtml(trafficHint),
            }) +
            renderProfitCard({
                label: 'ROI total',
                value: formatMoneyEur(totalProfit),
                modifier: 'total',
                valueClass: totalClass,
                hint: escapeHtml(totalHint),
            });
    }

    function renderTotalSummaryCards(stripeSummary, mergedSummary) {
        if (!summaryTotalRoot) {
            return;
        }

        var revenueEur = Number(stripeSummary.total_revenue_eur || 0);
        var spendEur = mergedSummary ? Number(mergedSummary.meta_spend_eur || 0) : 0;
        var roas = formatRoas(revenueEur, spendEur, mergedSummary ? mergedSummary.roas_real : null);
        var otherHint = Number(stripeSummary.other_sales || 0) > 0
            ? ('+' + stripeSummary.other_sales + ' fora tráfego · ' + formatMoneyEur(stripeSummary.other_revenue_eur || 0))
            : '';

        var checkoutLabel = getCheckoutFilterLabel(getSelectedCheckoutVariant());
        var cards = [
            {
                label: 'Vendas',
                value: stripeSummary.total_sales || 0,
                hint: checkoutLabel,
            },
            {
                label: 'Receitas',
                value: formatMoneyEur(revenueEur),
                hint: otherHint || 'EUR cobrado',
            },
            {
                label: 'Gasto',
                value: mergedSummary ? formatMoneyEur(spendEur) : '—',
                hint: mergedSummary ? formatMetaExchangeHint(mergedSummary) : 'Meta Ads',
            },
            {
                label: 'ROAS',
                value: mergedSummary ? roas : '—',
                hint: 'Receita total ÷ gasto Meta',
            },
        ];

        summaryTotalRoot.innerHTML = cards.map(renderPrimaryCard).join('');
    }

    function renderTrafficSummaryCards(stripeSummary, mergedSummary) {
        if (!summaryTrafficRoot) {
            return;
        }

        var trafficRevenue = Number(stripeSummary.traffic_revenue_eur || 0);
        var spendEur = mergedSummary ? Number(mergedSummary.meta_spend_eur || 0) : 0;
        var trafficRoas = formatRoas(trafficRevenue, spendEur, null);

        var cards = [
            {
                label: 'Vendas tráfego',
                value: stripeSummary.traffic_sales || 0,
                hint: 'Funil + UTMs Meta',
            },
            {
                label: 'Receita tráfego',
                value: formatMoneyEur(trafficRevenue),
                hint: 'Atribuídas a campanhas',
            },
            {
                label: 'ROAS tráfego',
                value: mergedSummary && spendEur > 0 ? trafficRoas : (mergedSummary ? trafficRoas : '—'),
                hint: 'Receita tráfego ÷ gasto Meta',
            },
        ];

        summaryTrafficRoot.innerHTML = cards.map(function (card) {
            return (
                '<article class="metrics-card metrics-card--traffic">' +
                '<div class="metrics-card__label">' + escapeHtml(card.label) + '</div>' +
                '<div class="metrics-card__value">' + escapeHtml(String(card.value)) + '</div>' +
                '<div class="metrics-card__hint">' + escapeHtml(card.hint) + '</div>' +
                '</article>'
            );
        }).join('');
    }

    function renderPrimaryCard(card) {
        return (
            '<article class="metrics-card metrics-card--primary">' +
            '<div class="metrics-card__label">' + escapeHtml(card.label) + '</div>' +
            '<div class="metrics-card__value' + (card.valueClass || '') + '">' + escapeHtml(String(card.value)) + '</div>' +
            '<div class="metrics-card__hint">' + escapeHtml(card.hint) + '</div>' +
            '</article>'
        );
    }

    function renderSummaryCards(stripeSummary, mergedSummary) {
        renderProfitCards(stripeSummary, mergedSummary);
        renderTotalSummaryCards(stripeSummary, mergedSummary);
        renderTrafficSummaryCards(stripeSummary, mergedSummary);
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
        if (!treeRoot) {
            return;
        }

        if (!campaigns || !campaigns.length) {
            treeRoot.innerHTML = '<p class="metrics-tree__empty">Ainda não há vendas neste período.</p>';
            return;
        }

        treeRoot.innerHTML = campaigns.map(renderCampaignNode).join('');
    }

    function renderSourceBadge(sale) {
        var source = sale.source_label || sale.source || 'Outro';
        var className = 'metrics-badge';

        if (sale.source === 'funil' || sale.is_traffic) {
            className += ' metrics-badge--ok';
        } else if (sale.source === 'comunidade') {
            className += ' metrics-badge--info';
        } else {
            className += ' metrics-badge--warn';
        }

        return '<span class="' + className + '">' + escapeHtml(source) + '</span>';
    }

    function renderRecentSales(sales) {
        if (!recentBody) {
            return;
        }

        if (!sales || !sales.length) {
            recentBody.innerHTML = '<tr><td colspan="8">Sem vendas neste período.</td></tr>';
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
                '<td>' + renderSourceBadge(sale) + '</td>' +
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

        if (window.MetricsSaleSound) {
            window.MetricsSaleSound.prime();
        }

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

    if (checkoutVariantSelect) {
        setSelectedCheckoutVariant(window.sessionStorage.getItem(CHECKOUT_VARIANT_KEY) || 'all');

        checkoutVariantSelect.addEventListener('change', function () {
            setSelectedCheckoutVariant(checkoutVariantSelect.value);
            fetchMetrics().catch(function () {
                setStatus('Erro de ligação. Tenta outra vez.', true);
            });
        });
    }

    if (metaBody) {
        metaBody.addEventListener('click', function (event) {
            var button = event.target.closest('.metrics-toggle');

            if (!button) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            toggleMetaStatus(button);
        });
    }

    refreshButton.addEventListener('click', function () {
        fetchMetrics({ refresh: true }).catch(function () {
            setStatus('Erro de ligação. Tenta outra vez.', true);
        });
    });

    logoutButton.addEventListener('click', function () {
        stopSalesPulse();

        if (window.MetricsPush) {
            window.MetricsPush.unsubscribe(getToken()).catch(function () {});
        }

        setToken('');
        passwordInput.value = '';
        showLogin();
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            stopSalesPulse();
            return;
        }

        if (!dashboardSection.hidden && getToken()) {
            updateLiveIndicator(datePicker.getAppliedRange());
        }
    });

    if (getToken()) {
        showDashboard();
        fetchMetrics().catch(function () {
            setStatus('Erro de ligação. Tenta outra vez.', true);
        });
    } else {
        showLogin();
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function (event) {
            if (event.data && event.data.type === 'play-sale-sound' && window.MetricsSaleSound) {
                window.MetricsSaleSound.play();
            }
        });
    }
})();
