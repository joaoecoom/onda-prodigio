(function () {
    'use strict';

    var POLL_MS = 2500;
    var pollTimer = null;
    var context = null;
    var isOpen = false;

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getPanel() {
        return document.getElementById('peb-ai-panel');
    }

    function renderShell() {
        var panel = getPanel();

        if (!panel) {
            return;
        }

        panel.innerHTML =
            '<div class="peb-ai-panel__backdrop" data-ai-close="true"></div>' +
            '<aside class="peb-ai-panel__drawer" role="dialog" aria-label="AI Assistant">' +
                '<div class="peb-ai-panel__head">' +
                    '<div><p class="peb-ai-panel__eyebrow">Page Builder AI</p><h2>Edita com linguagem natural</h2></div>' +
                    '<button type="button" class="peb-ai-panel__close" data-ai-close="true" aria-label="Fechar">×</button>' +
                '</div>' +
                '<div class="peb-ai-panel__modes">' +
                    '<button type="button" class="peb-ai-mode is-active" data-ai-mode="local">Rápido</button>' +
                    '<button type="button" class="peb-ai-mode" data-ai-mode="agent">Agent</button>' +
                '</div>' +
                '<p class="peb-ai-panel__hint" id="peb-ai-hint">' +
                    'Modo rápido: alterações instantâneas na página actual. Guarda depois com Save.' +
                '</p>' +
                '<form class="peb-ai-panel__form" id="peb-ai-form">' +
                    '<label for="peb-ai-prompt">O que queres alterar?</label>' +
                    '<textarea id="peb-ai-prompt" rows="5" placeholder="Ex.: Muda a headline para Oferta especial de verão" required minlength="3"></textarea>' +
                    '<div class="peb-ai-suggestions" id="peb-ai-suggestions"></div>' +
                    '<button type="submit" class="peb-button peb-button--primary" id="peb-ai-submit">Aplicar</button>' +
                    '<p class="peb-ai-panel__error" id="peb-ai-error" hidden></p>' +
                '</form>' +
                '<div class="peb-ai-panel__status" id="peb-ai-status" hidden></div>' +
            '</aside>';
    }

    function renderSuggestions(items) {
        var root = document.getElementById('peb-ai-suggestions');

        if (!root) {
            return;
        }

        var suggestions = items || [
            'Muda a headline para A tua nova oferta',
            'Adiciona secção CTA',
            'Adiciona block heading',
            'Aplica template sales-basic',
        ];

        root.innerHTML = suggestions.map(function (item) {
            return '<button type="button" class="peb-ai-suggestion" data-ai-suggestion="' +
                escapeHtml(item) + '">' + escapeHtml(item) + '</button>';
        }).join('');
    }

    function setMode(mode) {
        var hint = document.getElementById('peb-ai-hint');
        var submit = document.getElementById('peb-ai-submit');

        document.querySelectorAll('.peb-ai-mode').forEach(function (button) {
            button.classList.toggle('is-active', button.getAttribute('data-ai-mode') === mode);
        });

        if (mode === 'agent') {
            hint.textContent = 'Modo Agent: envia para o Cursor Agent na VPS. A página é guardada antes da task e recarregada quando concluir.';
            submit.textContent = 'Enviar para Agent';
        } else {
            hint.textContent = 'Modo rápido: alterações instantâneas na página actual. Guarda depois com Save.';
            submit.textContent = 'Aplicar';
        }

        getPanel().setAttribute('data-ai-mode', mode);
    }

    function getMode() {
        return getPanel().getAttribute('data-ai-mode') || 'local';
    }

    function setStatus(message, kind) {
        var el = document.getElementById('peb-ai-status');
        el.hidden = !message;
        el.className = 'peb-ai-panel__status' + (kind ? ' is-' + kind : '');
        el.textContent = message || '';
    }

    function setError(message) {
        var el = document.getElementById('peb-ai-error');
        el.hidden = !message;
        el.textContent = message || '';
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function buildScopeQuery(slugs) {
        return 'offer=' + encodeURIComponent(slugs.offer) +
            '&funnel=' + encodeURIComponent(slugs.funnel) +
            '&page=' + encodeURIComponent(slugs.page);
    }

    async function runLocal(prompt) {
        var editorState = context.getState();
        var payload = await context.apiFetch(
            '/api/sales-attribution?action=hub_page_builder_ai&' + buildScopeQuery(editorState.slugs),
            {
                method: 'POST',
                body: {
                    prompt: prompt,
                    tree: editorState.tree,
                    selected: editorState.selected,
                },
            }
        );

        if (payload.applied) {
            context.onApplyTree(payload);
            setStatus(payload.summary, 'success');
        } else {
            setStatus(payload.summary, 'info');
            renderSuggestions(payload.suggestions);
        }
    }

    async function pollTask(taskId) {
        var payload = await context.apiFetch(
            '/api/sales-attribution?action=hub_ai_task&id=' + encodeURIComponent(taskId)
        );
        return payload.task;
    }

    function startPolling(taskId) {
        stopPolling();

        pollTimer = setInterval(async function () {
            try {
                var task = await pollTask(taskId);

                if (task.status === 'running' || task.status === 'pending') {
                    setStatus('Agent a trabalhar… (' + task.status + ')', 'running');
                    return;
                }

                stopPolling();

                if (task.status === 'completed') {
                    await context.onReload();
                    setStatus('Agent concluiu. Página recarregada.', 'success');
                    return;
                }

                setStatus('Agent falhou: ' + (task.error || task.status), 'error');
            } catch (error) {
                stopPolling();
                setError(error.message);
            }
        }, POLL_MS);
    }

    async function runAgent(prompt) {
        var editorState = context.getState();

        if (editorState.saveStatus === 'unsaved') {
            setStatus('A guardar alterações antes do Agent…', 'running');
            await context.saveChanges();
        }

        var payload = await context.apiFetch(
            '/api/sales-attribution?action=hub_page_builder_ai_agent&' + buildScopeQuery(editorState.slugs),
            {
                method: 'POST',
                body: { prompt: prompt },
            }
        );

        setStatus('Task #' + String(payload.task.id).slice(0, 8) + ' criada. A aguardar Agent…', 'running');
        startPolling(payload.task.id);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        var promptEl = document.getElementById('peb-ai-prompt');
        var submitBtn = document.getElementById('peb-ai-submit');
        var prompt = promptEl.value.trim();

        setError('');
        setStatus('');

        if (prompt.length < 3) {
            setError('Prompt demasiado curto.');
            return;
        }

        if (getMode() === 'agent' && prompt.length < 8) {
            setError('Modo Agent: o prompt deve ter pelo menos 8 caracteres.');
            return;
        }

        submitBtn.disabled = true;

        try {
            if (getMode() === 'agent') {
                await runAgent(prompt);
            } else {
                await runLocal(prompt);
            }

            if (getMode() === 'local') {
                promptEl.value = '';
            }
        } catch (error) {
            setError(error.message || 'Pedido falhou.');
        } finally {
            submitBtn.disabled = false;
        }
    }

    function bindEvents() {
        var panel = getPanel();

        panel.querySelectorAll('[data-ai-close]').forEach(function (node) {
            node.addEventListener('click', function () {
                close();
            });
        });

        panel.querySelectorAll('.peb-ai-mode').forEach(function (button) {
            button.addEventListener('click', function () {
                setMode(button.getAttribute('data-ai-mode'));
            });
        });

        var form = document.getElementById('peb-ai-form');
        form.addEventListener('submit', handleSubmit);

        panel.addEventListener('click', function (event) {
            var suggestion = event.target.closest('[data-ai-suggestion]');

            if (!suggestion) {
                return;
            }

            document.getElementById('peb-ai-prompt').value = suggestion.getAttribute('data-ai-suggestion');
        });
    }

    function open() {
        if (!context) {
            return;
        }

        renderShell();
        renderSuggestions();
        setMode('local');
        bindEvents();
        getPanel().hidden = false;
        isOpen = true;
        document.getElementById('peb-ai-prompt').focus();
    }

    function close() {
        stopPolling();
        var panel = getPanel();

        if (panel) {
            panel.hidden = true;
        }

        isOpen = false;
    }

    function init(options) {
        context = options;
    }

    window.PebAI = {
        init: init,
        open: open,
        close: close,
        isOpen: function () { return isOpen; },
    };
})();
