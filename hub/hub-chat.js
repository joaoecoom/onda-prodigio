(function () {
    'use strict';

    var POLL_MS = 2500;
    var INTRO_SEEN_KEY = 'hub-chat-intro-seen';
    var pollTimer = null;
    var contextApi = null;
    var messages = [];
    var barOpen = false;
    var panelOpen = false;
    var bound = false;

    var INTEGRATION_ALIASES = {
        supabase_url: ['supabase url', 'supabase_url', 'url supabase'],
        supabase_anon_key: ['supabase anon', 'anon key', 'supabase_anon_key', 'anon key supabase'],
        supabase_service_role_key: ['service role', 'service_role', 'supabase service', 'supabase_service_role_key'],
        meta_pixel_id: ['meta pixel', 'pixel id', 'meta_pixel_id', 'facebook pixel'],
        meta_access_token: ['meta token', 'meta access', 'meta_access_token', 'capi token'],
        ga4_measurement_id: ['ga4', 'ga4 id', 'ga4_measurement_id', 'measurement id'],
        ga4_api_secret: ['ga4 secret', 'ga4_api_secret'],
        stripe_secret_key: ['stripe secret', 'stripe_secret_key', 'sk_live'],
        stripe_publishable_key: ['stripe publishable', 'stripe_publishable_key', 'pk_live'],
        stripe_webhook_secret: ['webhook secret', 'stripe_webhook_secret', 'whsec'],
        gmail_user: ['gmail', 'gmail_user', 'email gmail'],
        gmail_app_password: ['gmail password', 'gmail_app_password', 'app password'],
        vturb_player_id: ['vturb', 'vturb player', 'vturb_player_id', 'player id'],
        vturb_analytics_api_token: ['vturb token', 'vturb analytics', 'vturb_analytics_api_token'],
        evolution_api_url: ['evolution url', 'evolution_api_url', 'whatsapp url'],
        evolution_api_key: ['evolution key', 'evolution_api_key', 'whatsapp key'],
        evolution_instance_name: ['evolution instance', 'instance name', 'evolution_instance_name', 'whatsapp instance'],
        gtm_container_id: ['gtm', 'gtm_container_id', 'container id'],
        server_container_url: ['stape', 'server_container_url', 'serving url'],
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeKey(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    function resolveIntegrationKey(rawKey) {
        var normalized = normalizeKey(rawKey);

        if (INTEGRATION_ALIASES[normalized]) {
            return normalized;
        }

        var aliasMatch = Object.keys(INTEGRATION_ALIASES).find(function (key) {
            return INTEGRATION_ALIASES[key].some(function (alias) {
                var aliasNorm = normalizeKey(alias);
                return aliasNorm === normalized || normalized.indexOf(aliasNorm) !== -1;
            });
        });

        return aliasMatch || normalized;
    }

    function parseIntegrationPaste(text) {
        var trimmed = String(text || '').trim();
        var updates = {};

        if (!trimmed) {
            return updates;
        }

        if (trimmed.charAt(0) === '{') {
            try {
                var json = JSON.parse(trimmed);
                Object.keys(json).forEach(function (key) {
                    updates[resolveIntegrationKey(key)] = String(json[key] || '').trim();
                });
                return updates;
            } catch (error) {
                /* line parser */
            }
        }

        trimmed.split(/\r?\n/).forEach(function (line) {
            var row = line.trim();

            if (!row || row.charAt(0) === '#') {
                return;
            }

            var match = row.match(/^([A-Za-z0-9_.\s-]+?)\s*(?:=|:)\s*(.+)$/);

            if (match) {
                updates[resolveIntegrationKey(match[1])] = match[2].trim().replace(/^["']|["']$/g, '');
            }
        });

        return updates;
    }

    function parseNaturalLanguageFill(text) {
        var updates = {};
        var lower = text.toLowerCase();

        Object.keys(INTEGRATION_ALIASES).forEach(function (key) {
            INTEGRATION_ALIASES[key].forEach(function (alias) {
                var patterns = [
                    new RegExp('(?:preenche|mete|coloca|define|põe|put|set)\\s+(?:o\\s+)?' + alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(?:com|para|to|=)\\s+(.+)$', 'i'),
                    new RegExp('(?:preenche|mete|coloca|define|põe|put|set)\\s+(?:o\\s+)?' + alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(.+)$', 'i'),
                ];

                patterns.forEach(function (pattern) {
                    var match = text.match(pattern);

                    if (match && match[1]) {
                        updates[key] = match[1].trim().replace(/^["']|["']$/g, '');
                    }
                });
            });
        });

        if (!Object.keys(updates).length && /preenche|mete|coloca/i.test(lower)) {
            Object.assign(updates, parseIntegrationPaste(text));
        }

        return updates;
    }

    function applyIntegrationUpdates(updates) {
        var filled = [];

        Object.keys(updates).forEach(function (key) {
            var input = document.querySelector('[data-integration-key="' + key + '"]');

            if (!input || !updates[key]) {
                return;
            }

            input.value = updates[key];
            input.classList.add('hub-chat__filled');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            filled.push(key.replace(/_/g, ' '));
        });

        return filled;
    }

    function getPlaceholder(ctx) {
        if (ctx.module === 'integracoes') {
            return 'Cola credenciais ou escreve: mete vturb player id com 6a7927038a043cc51fb71392';
        }

        if (ctx.module === 'funil') {
            return 'Ex.: cria funnel principal com page sales-basic';
        }

        return 'Pede para preencher campos, colar dados, ou descreve o que queres fazer…';
    }

    function getSuggestions(ctx) {
        if (ctx.module === 'integracoes') {
            return [
                'Cola bloco Supabase (url + keys)',
                'mete vturb player id com …',
                'Preenche meta pixel e token CAPI',
            ];
        }

        if (ctx.module === 'funil') {
            return ['Cria funnel principal com page sales-basic', 'Lista pages desta oferta'];
        }

        return ['Resume o estado desta oferta', 'O que falta configurar?'];
    }

    function buildAgentPrompt(userText, ctx) {
        var parts = ['[Contexto HUB DR Ecoom]', 'Vista: ' + (ctx.view || 'hub')];

        if (ctx.offer) {
            parts.push('Oferta: ' + ctx.offer.name + ' (' + ctx.offer.slug + ')');
        }

        if (ctx.module) {
            parts.push('Módulo activo: ' + ctx.module);
        }

        parts.push('', 'Pedido:', userText);
        return parts.join('\n');
    }

    function addMessage(role, text, meta) {
        messages.push({ role: role, text: text, meta: meta || null });

        if (messages.length > 40) {
            messages = messages.slice(-40);
        }

        renderMessages();
    }

    function renderMessages() {
        var list = document.getElementById('hub-chat-messages');

        if (!list) {
            return;
        }

        list.innerHTML = messages.map(function (msg) {
            return (
                '<div class="hub-chat__message hub-chat__message--' + escapeHtml(msg.role) + '">' +
                    '<p>' + escapeHtml(msg.text) + '</p>' +
                    (msg.meta ? '<span class="hub-chat__message-meta">' + escapeHtml(msg.meta) + '</span>' : '') +
                '</div>'
            );
        }).join('');

        list.scrollTop = list.scrollHeight;
    }

    function hasIntroSeen() {
        try {
            return localStorage.getItem(INTRO_SEEN_KEY) === '1';
        } catch (error) {
            return true;
        }
    }

    function markIntroSeen() {
        try {
            localStorage.setItem(INTRO_SEEN_KEY, '1');
        } catch (error) {
            /* ignore */
        }
    }

    function ensureIntroMessage() {
        if (hasIntroSeen() || messages.length) {
            return;
        }

        addMessage(
            'assistant',
            'Estou aqui em baixo em todas as abas. Cola credenciais ou escreve o que queres preencher — trato dos campos visíveis. Para tarefas maiores, mando ao Cursor Agent.',
            'Cursor'
        );
    }

    function syncChatClasses() {
        var root = document.getElementById('hub-chat');
        var panel = document.getElementById('hub-chat-panel');
        var toggle = document.getElementById('hub-chat-toggle');

        if (root) {
            root.classList.toggle('is-minimized', !barOpen);
            root.classList.toggle('is-bar-open', barOpen);
            root.classList.toggle('is-expanded', panelOpen);
        }

        if (panel) {
            panel.hidden = !panelOpen;
        }

        if (toggle) {
            toggle.setAttribute('aria-label', barOpen ? 'Minimizar assistente' : 'Abrir assistente');
            toggle.setAttribute('aria-expanded', barOpen ? 'true' : 'false');
        }
    }

    function setBarOpen(value) {
        barOpen = Boolean(value);

        if (!barOpen) {
            panelOpen = false;
        }

        syncChatClasses();

        if (barOpen && contextApi) {
            renderSuggestions(contextApi.getContext());
            var input = document.getElementById('hub-chat-input');

            if (input) {
                setTimeout(function () {
                    input.focus();
                }, 80);
            }
        }
    }

    function setPanelOpen(value) {
        panelOpen = Boolean(value);
        syncChatClasses();
    }

    function setExpanded(value) {
        if (value) {
            setBarOpen(true);
            setPanelOpen(true);
            return;
        }

        setPanelOpen(false);
    }

    function openChat() {
        setBarOpen(true);

        if (!hasIntroSeen()) {
            ensureIntroMessage();
            setPanelOpen(true);
            markIntroSeen();
            return;
        }

        if (messages.length) {
            setPanelOpen(true);
        }
    }

    function minimizeChat() {
        setBarOpen(false);
    }

    function setStatus(text, kind) {
        var el = document.getElementById('hub-chat-status');

        if (!el) {
            return;
        }

        el.textContent = text || '';
        el.className = 'hub-chat__status' + (kind ? ' is-' + kind : '');
        el.hidden = !text;
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    async function pollTask(taskId) {
        stopPolling();

        pollTimer = setInterval(async function () {
            try {
                var payload = await contextApi.apiFetch(
                    '/api/sales-attribution?action=hub_ai_task&id=' + encodeURIComponent(taskId)
                );
                var task = payload.task;

                if (task.status === 'running' || task.status === 'pending') {
                    setStatus('Cursor Agent a trabalhar…', 'running');
                    return;
                }

                stopPolling();

                if (task.status === 'completed') {
                    var summary = (task.result && (task.result.summary || task.result.stdout_preview)) || 'Tarefa concluída.';
                    addMessage('assistant', summary.slice(0, 1200), 'Cursor Agent');
                    setStatus('Concluído', 'ok');
                } else {
                    addMessage('assistant', task.error || 'A tarefa falhou.', 'Cursor Agent');
                    setStatus('Falhou', 'error');
                }
            } catch (error) {
                stopPolling();
                setStatus(error.message, 'error');
            }
        }, POLL_MS);
    }

    async function sendToAgent(prompt, ctx) {
        return contextApi.apiFetch('/api/sales-attribution?action=hub_ai_task_create', {
            method: 'POST',
            body: {
                prompt: buildAgentPrompt(prompt, ctx),
                offer_id: ctx.offer && ctx.offer.id ? ctx.offer.id : null,
                task_type: 'general',
                source: 'hub_chat_dock',
            },
        }).then(function (payload) {
            return payload.task;
        });
    }

    function tryLocalFill(text, ctx) {
        if (ctx.module !== 'integracoes') {
            return null;
        }

        var updates = Object.assign({}, parseIntegrationPaste(text), parseNaturalLanguageFill(text));
        var keys = Object.keys(updates).filter(function (key) {
            return updates[key];
        });

        if (!keys.length) {
            return null;
        }

        var filled = applyIntegrationUpdates(updates);

        if (!filled.length) {
            return {
                handled: true,
                message: 'Reconheci os dados mas não encontrei campos visíveis nesta página.',
            };
        }

        return {
            handled: true,
            message: 'Preenchi ' + filled.length + ' campo(s): ' + filled.join(', ') + '. Revê e clica Guardar integrações.',
        };
    }

    function shouldUseAgent(text) {
        var lower = text.toLowerCase();

        if (lower.indexOf('/agent') === 0 || lower.indexOf('cursor:') === 0) {
            return true;
        }

        return /^(cria|create|analisa|analyze|implementa|fix|corrige|publica|deploy)/i.test(lower);
    }

    async function handleSubmit(event) {
        if (event) {
            event.preventDefault();
        }

        var input = document.getElementById('hub-chat-input');
        var sendBtn = document.getElementById('hub-chat-send');
        var text = input.value.trim();
        var ctx = contextApi.getContext();

        if (!text) {
            return;
        }

        setBarOpen(true);
        setPanelOpen(true);
        addMessage('user', text);
        input.value = '';
        sendBtn.disabled = true;

        try {
            var local = tryLocalFill(text, ctx);

            if (local && local.handled && !shouldUseAgent(text)) {
                addMessage('assistant', local.message, 'Preenchimento automático');
                setStatus('Campos actualizados', 'ok');
                return;
            }

            if (text.length < 8 && !local) {
                addMessage('assistant', 'Escreve o que queres preencher ou pede com mais detalhe. Ex.: mete supabase url com https://…');
                return;
            }

            setStatus('A enviar para o Cursor Agent…', 'running');
            var task = await sendToAgent(text, ctx);
            addMessage('assistant', 'Enviado ao Cursor Agent na VPS. Aguarda o resultado…', 'Task #' + String(task.id).slice(0, 8));
            pollTask(task.id);
        } catch (error) {
            addMessage('assistant', error.message || 'Não foi possível enviar.');
            setStatus('Erro', 'error');
        } finally {
            sendBtn.disabled = false;
        }
    }

    function renderSuggestions(ctx) {
        var root = document.getElementById('hub-chat-suggestions');
        var input = document.getElementById('hub-chat-input');

        if (!root) {
            return;
        }

        if (input) {
            input.placeholder = getPlaceholder(ctx);
        }

        root.innerHTML = getSuggestions(ctx).map(function (item) {
            return '<button type="button" class="hub-chat__suggestion" data-suggestion="' + escapeHtml(item) + '">' +
                escapeHtml(item) + '</button>';
        }).join('');

        root.querySelectorAll('[data-suggestion]').forEach(function (button) {
            button.addEventListener('click', function () {
                document.getElementById('hub-chat-input').value = button.getAttribute('data-suggestion');
                openChat();
                document.getElementById('hub-chat-input').focus();
            });
        });
    }

    function bind() {
        if (bound) {
            return;
        }

        var root = document.getElementById('hub-chat');

        if (!root) {
            return;
        }

        var form = document.getElementById('hub-chat-form');

        if (form) {
            form.addEventListener('submit', handleSubmit);
        }

        var toggle = document.getElementById('hub-chat-toggle');
        var collapse = document.getElementById('hub-chat-collapse');

        if (toggle) {
            if (window.PlatformIcons) {
                toggle.innerHTML = window.PlatformIcons.svg('sparkles')
                    .replace(/^<span[^>]*>|<\/span>$/g, '');
            }

            toggle.addEventListener('click', function () {
                if (!barOpen) {
                    openChat();
                    return;
                }

                minimizeChat();
            });
        }

        if (collapse) {
            collapse.addEventListener('click', function () {
                setPanelOpen(false);
            });
        }

        minimizeChat();
        bound = true;
    }

    function show() {
        bind();
        var dock = document.getElementById('hub-chat');

        if (dock) {
            dock.hidden = false;
        }

        minimizeChat();
    }

    function hide() {
        var dock = document.getElementById('hub-chat');

        if (dock) {
            dock.hidden = true;
        }

        stopPolling();
    }

    function refresh() {
        if (!contextApi) {
            return;
        }

        renderSuggestions(contextApi.getContext());
    }

    function init(options) {
        contextApi = options;
        bind();
    }

    window.HubChat = {
        init: init,
        show: show,
        hide: hide,
        refresh: refresh,
        setExpanded: setExpanded,
        open: openChat,
        minimize: minimizeChat,
    };
})();
