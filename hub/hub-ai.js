(function () {
    var POLL_MS = 2500;
    var THREAD_KEY_PREFIX = 'hub-ai-thread-';
    var pollTimer = null;
    var currentTaskId = null;
    var messages = [];
    var pendingMessageIndex = null;
    var activeContainer = null;
    var activeContext = null;

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function statusLabel(status) {
        if (status === 'pending') {
            return { text: 'A aguardar', dot: 'pending', className: 'hub-ai-status--pending' };
        }
        if (status === 'running') {
            return { text: 'A trabalhar…', dot: 'running', className: 'hub-ai-status--running' };
        }
        if (status === 'completed') {
            return { text: 'Concluído', dot: 'done', className: 'hub-ai-status--completed' };
        }
        if (status === 'failed') {
            return { text: 'Falhou', dot: 'error', className: 'hub-ai-status--failed' };
        }
        if (status === 'cancelled') {
            return { text: 'Cancelada', dot: 'muted', className: 'hub-ai-status--cancelled' };
        }
        return { text: status, dot: 'muted', className: '' };
    }

    function statusDot(kind) {
        var cls = 'dr-status__dot';

        if (kind === 'done') {
            return '<span class="dr-status dr-status--connected"><span class="' + cls + '"></span></span>';
        }

        if (kind === 'error') {
            return '<span class="dr-status dr-status--error"><span class="' + cls + '"></span></span>';
        }

        if (kind === 'running' || kind === 'pending') {
            return '<span class="dr-status dr-status--draft"><span class="' + cls + '"></span></span>';
        }

        return '<span class="dr-status"><span class="' + cls + '"></span></span>';
    }

    function formatDate(value) {
        if (!value) {
            return '—';
        }

        try {
            return new Date(value).toLocaleString('pt-PT');
        } catch (error) {
            return value;
        }
    }

    function formatDuration(task) {
        if (!task.started_at) {
            return '—';
        }

        var end = task.completed_at || task.failed_at || new Date().toISOString();
        var ms = new Date(end).getTime() - new Date(task.started_at).getTime();

        if (ms < 1000) {
            return ms + ' ms';
        }

        var seconds = Math.round(ms / 1000);

        if (seconds < 60) {
            return seconds + ' s';
        }

        var minutes = Math.floor(seconds / 60);
        var rest = seconds % 60;
        return minutes + ' min ' + rest + ' s';
    }

    function taskTypeLabel(value) {
        var map = {
            general: 'General',
            analysis: 'Análise',
            content: 'Conteúdo',
            code: 'Código',
        };

        return map[value] || value || 'General';
    }

    function threadStorageKey(context) {
        var slug = (context.offer && context.offer.slug) || 'global';
        return THREAD_KEY_PREFIX + slug;
    }

    function loadThread(context) {
        try {
            var raw = sessionStorage.getItem(threadStorageKey(context));
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            return [];
        }
    }

    function saveThread(context) {
        try {
            var trimmed = messages.slice(-40).map(function (msg) {
                return {
                    role: msg.role,
                    text: msg.text,
                    taskId: msg.taskId || null,
                    status: msg.status || null,
                    at: msg.at || Date.now(),
                };
            });
            sessionStorage.setItem(threadStorageKey(context), JSON.stringify(trimmed));
        } catch (error) {
            /* ignore */
        }
    }

    function taskSummary(task) {
        if (!task) {
            return 'Sem resposta.';
        }

        if (task.status === 'failed' || task.status === 'cancelled') {
            return task.error || 'A tarefa não foi concluída.';
        }

        var result = task.result || {};
        return (result.summary || result.stdout_preview || 'Tarefa concluída.').slice(0, 2000);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function buildConversationPrompt(newText) {
        var history = messages.filter(function (msg) {
            return !msg.typing && msg.text && (msg.role === 'user' || msg.role === 'assistant');
        }).slice(-8);

        if (!history.length) {
            return newText;
        }

        var lines = history.map(function (msg) {
            return (msg.role === 'user' ? 'Utilizador' : 'Assistente') + ': ' + msg.text;
        });

        lines.push('Utilizador: ' + newText);

        return '[Conversa HUB — continuação]\n\n' + lines.join('\n\n');
    }

    function renderThread() {
        if (!activeContainer) {
            return;
        }

        var threadEl = activeContainer.querySelector('#hub-ai-thread');

        if (!threadEl) {
            return;
        }

        if (!messages.length) {
            threadEl.innerHTML =
                '<div class="hub-ai__empty dr-empty">' +
                    '<p class="dr-empty__title">Conversa com o AI Agent</p>' +
                    '<p class="dr-empty__text">Escreve abaixo — cada mensagem vira uma tarefa no Cursor Agent (VPS). Podes fazer follow-up como num chat.</p>' +
                '</div>';
            return;
        }

        threadEl.innerHTML = messages.map(function (msg, index) {
            var className = 'hub-ai__msg hub-ai__msg--' + msg.role;

            if (msg.typing) {
                className += ' hub-ai__msg--typing';
            }

            var actions = '';

            if (msg.role === 'assistant' && msg.taskId && !msg.typing) {
                actions =
                    '<button type="button" class="hub-ai__msg-detail" data-task-detail="' +
                    escapeHtml(msg.taskId) + '" data-msg-index="' + index + '">Ver detalhes técnicos</button>';
            }

            return (
                '<div class="' + className + '">' +
                    '<div class="hub-ai__msg-bubble">' +
                        '<p>' + escapeHtml(msg.text) + '</p>' +
                        actions +
                    '</div>' +
                '</div>'
            );
        }).join('');

        threadEl.scrollTop = threadEl.scrollHeight;

        threadEl.querySelectorAll('[data-task-detail]').forEach(function (button) {
            button.addEventListener('click', function () {
                openTaskDetail(button.getAttribute('data-task-detail'));
            });
        });
    }

    function setStatus(text, kind) {
        if (!activeContainer) {
            return;
        }

        var el = activeContainer.querySelector('#hub-ai-status');

        if (!el) {
            return;
        }

        el.textContent = text || '';
        el.className = 'hub-ai__status' + (kind ? ' is-' + kind : '');
        el.hidden = !text;
    }

    function setError(text) {
        if (!activeContainer) {
            return;
        }

        var el = activeContainer.querySelector('#hub-ai-error');

        if (!el) {
            return;
        }

        el.textContent = text || '';
        el.hidden = !text;
    }

    function renderShell(moduleData, context) {
        var offer = context.offer || {};

        return (
            '<article class="hub-panel hub-ai hub-ai--chat">' +
                '<div class="hub-ai__head">' +
                    '<p class="hub-panel__sub">AI Agent</p>' +
                    '<h3>Conversa</h3>' +
                    '<p class="hub-ai__hint">Fala com o Cursor Agent — cada mensagem é uma tarefa na VPS. O HUB mostra a resposta aqui quando estiver pronta.</p>' +
                '</div>' +
                '<div class="hub-ai__thread" id="hub-ai-thread"></div>' +
                '<div class="hub-ai__detail" id="hub-ai-detail" hidden></div>' +
                '<form class="hub-ai__composer" id="hub-ai-form">' +
                    '<div class="hub-ai__composer-settings">' +
                        '<label class="hub-ai__setting">' +
                            '<span>Oferta</span>' +
                            '<select class="hub-ai__select" id="hub-ai-offer">' +
                                '<option value="">Nenhuma</option>' +
                                '<option value="' + escapeHtml(offer.id || '') + '" selected>' +
                                    escapeHtml(offer.name || 'Oferta actual') +
                                '</option>' +
                            '</select>' +
                        '</label>' +
                        '<label class="hub-ai__setting">' +
                            '<span>Tipo</span>' +
                            '<select class="hub-ai__select" id="hub-ai-type">' +
                                '<option value="general">General</option>' +
                                '<option value="analysis">Análise</option>' +
                                '<option value="content">Conteúdo</option>' +
                                '<option value="code">Código</option>' +
                            '</select>' +
                        '</label>' +
                        '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm" id="hub-ai-clear">Limpar conversa</button>' +
                    '</div>' +
                    '<div class="hub-ai__composer-row">' +
                        '<textarea class="hub-ai__textarea" id="hub-ai-prompt" rows="2" ' +
                            'placeholder="Escreve a tua mensagem…" required minlength="2"></textarea>' +
                        '<button class="dr-btn dr-btn--primary hub-ai__submit" type="submit">Enviar</button>' +
                    '</div>' +
                    '<p class="hub-ai__status" id="hub-ai-status" hidden></p>' +
                    '<p class="hub-form-message hub-ai__error" id="hub-ai-error" hidden></p>' +
                '</form>' +
            '</article>'
        );
    }

    function hydrateFromRecentTasks(tasks) {
        if (messages.length || !tasks || !tasks.length) {
            return;
        }

        tasks.slice().reverse().forEach(function (task) {
            if (task.prompt) {
                messages.push({
                    role: 'user',
                    text: task.prompt.split('\n\nUtilizador: ').pop().split('\n\n').pop(),
                    at: new Date(task.created_at).getTime() || Date.now(),
                });
            }

            messages.push({
                role: 'assistant',
                text: taskSummary(task),
                taskId: task.id,
                status: task.status,
                at: new Date(task.completed_at || task.failed_at || task.created_at).getTime() || Date.now(),
            });
        });
    }

    function renderTaskDetail(task, offerName) {
        var badge = statusLabel(task.status);
        var result = task.result || {};
        var files = Array.isArray(result.files_changed) ? result.files_changed : [];
        var filesHtml = files.length
            ? '<ul class="hub-ai__files">' + files.map(function (file) {
                return '<li>' + escapeHtml(file) + '</li>';
            }).join('') + '</ul>'
            : '<p class="hub-panel__sub">Nenhum ficheiro alterado detectado.</p>';

        var summary = result.summary || result.stdout_preview || '';

        return (
            '<div class="hub-ai__detail-card">' +
                '<div class="hub-ai__detail-head">' +
                    '<h4>Detalhe da task</h4>' +
                    '<span class="hub-ai__detail-badge ' + badge.className + '">' +
                        statusDot(badge.dot) + ' ' + badge.text +
                    '</span>' +
                '</div>' +
                '<dl class="hub-ai__meta">' +
                    '<div><dt>Task</dt><dd><code>' + escapeHtml(task.id) + '</code></dd></div>' +
                    '<div><dt>Oferta</dt><dd>' + escapeHtml(offerName || 'Nenhuma') + '</dd></div>' +
                    '<div><dt>Tipo</dt><dd>' + escapeHtml(taskTypeLabel(task.task_type)) + '</dd></div>' +
                    '<div><dt>Duração</dt><dd>' + formatDuration(task) + '</dd></div>' +
                '</dl>' +
                (task.error ? '<div class="hub-ai__error-box"><strong>Erro</strong><pre>' + escapeHtml(task.error) + '</pre></div>' : '') +
                (summary ? '<pre class="hub-ai__summary">' + escapeHtml(summary.slice(0, 4000)) + '</pre>' : '') +
                '<h5>Ficheiros modificados</h5>' +
                filesHtml +
                '<button type="button" class="dr-btn dr-btn--ghost dr-btn--sm hub-ai__back-btn" id="hub-ai-back-btn">Fechar detalhes</button>' +
            '</div>'
        );
    }

    async function openTaskDetail(taskId) {
        if (!activeContainer || !activeContext || !taskId) {
            return;
        }

        try {
            var task = await fetchTask(taskId, activeContext);
            var detailEl = activeContainer.querySelector('#hub-ai-detail');
            var offerName = (activeContext.offer && activeContext.offer.name) || 'Nenhuma';

            if (detailEl) {
                detailEl.hidden = false;
                detailEl.innerHTML = renderTaskDetail(task, offerName);

                var backBtn = detailEl.querySelector('#hub-ai-back-btn');

                if (backBtn) {
                    backBtn.addEventListener('click', function () {
                        detailEl.hidden = true;
                    });
                }
            }
        } catch (error) {
            setError(error.message || 'Não foi possível carregar a task.');
        }
    }

    async function fetchTask(taskId, context) {
        var payload = await context.apiFetch(
            '/api/sales-attribution?action=hub_ai_task&id=' + encodeURIComponent(taskId)
        );
        return payload.task;
    }

    function updatePendingMessage(task) {
        if (pendingMessageIndex == null || !messages[pendingMessageIndex]) {
            return;
        }

        var badge = statusLabel(task.status);
        var text = taskSummary(task);

        if (task.status === 'pending') {
            text = 'A aguardar o Cursor Agent…';
        } else if (task.status === 'running') {
            text = 'A trabalhar na tua mensagem…';
        }

        messages[pendingMessageIndex] = {
            role: 'assistant',
            text: text,
            taskId: task.id,
            status: task.status,
            typing: task.status === 'pending' || task.status === 'running',
            at: Date.now(),
        };

        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
            messages[pendingMessageIndex].typing = false;
            messages[pendingMessageIndex].text = taskSummary(task);
            pendingMessageIndex = null;
            setStatus(badge.text, task.status === 'completed' ? 'ok' : 'error');
        } else {
            setStatus(badge.text, 'running');
        }

        renderThread();
        saveThread(activeContext);
    }

    function startPolling(taskId, context) {
        stopPolling();
        currentTaskId = taskId;

        pollTimer = setInterval(async function () {
            try {
                var task = await fetchTask(taskId, context);
                updatePendingMessage(task);

                if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
                    stopPolling();
                }
            } catch (error) {
                stopPolling();
                setError(error.message || 'Erro ao actualizar a conversa.');
            }
        }, POLL_MS);
    }

    async function handleSubmit(event, container, context) {
        event.preventDefault();

        var form = event.currentTarget;
        var promptEl = form.querySelector('#hub-ai-prompt');
        var offerEl = form.querySelector('#hub-ai-offer');
        var typeEl = form.querySelector('#hub-ai-type');
        var submitBtn = form.querySelector('.hub-ai__submit');
        var text = promptEl.value.trim();
        var offerId = offerEl.value.trim() || null;
        var taskType = typeEl.value || 'general';

        setError('');

        if (text.length < 2) {
            setError('Escreve pelo menos 2 caracteres.');
            return;
        }

        messages.push({
            role: 'user',
            text: text,
            at: Date.now(),
        });

        messages.push({
            role: 'assistant',
            text: 'A enviar para o Cursor Agent…',
            typing: true,
            at: Date.now(),
        });

        pendingMessageIndex = messages.length - 1;
        renderThread();
        saveThread(context);

        promptEl.value = '';
        submitBtn.disabled = true;

        try {
            var payload = await context.apiFetch('/api/sales-attribution?action=hub_ai_task_create', {
                method: 'POST',
                body: {
                    prompt: buildConversationPrompt(text),
                    offer_id: offerId,
                    task_type: taskType,
                    source: 'hub_ai_chat',
                },
            });

            var task = payload.task;
            messages[pendingMessageIndex].taskId = task.id;
            updatePendingMessage(task);
            startPolling(task.id, context);
        } catch (error) {
            messages[pendingMessageIndex] = {
                role: 'assistant',
                text: error.message || 'Não foi possível enviar a mensagem.',
                typing: false,
                at: Date.now(),
            };
            pendingMessageIndex = null;
            renderThread();
            setError(error.message || 'Não foi possível enviar a mensagem.');
        } finally {
            submitBtn.disabled = false;
            promptEl.focus();
        }
    }

    function bindComposer(container, context) {
        var form = container.querySelector('#hub-ai-form');
        var clearBtn = container.querySelector('#hub-ai-clear');
        var promptEl = container.querySelector('#hub-ai-prompt');

        if (form) {
            form.addEventListener('submit', function (event) {
                handleSubmit(event, container, context);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                stopPolling();
                messages = [];
                pendingMessageIndex = null;
                sessionStorage.removeItem(threadStorageKey(context));
                renderThread();
                setStatus('');
                setError('');

                var detailEl = container.querySelector('#hub-ai-detail');

                if (detailEl) {
                    detailEl.hidden = true;
                }
            });
        }

        if (promptEl) {
            promptEl.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    form.requestSubmit();
                }
            });
        }
    }

    function render(container, moduleData, context) {
        stopPolling();
        currentTaskId = null;
        pendingMessageIndex = null;
        activeContainer = container;
        activeContext = context;

        messages = loadThread(context);

        if (!messages.length) {
            hydrateFromRecentTasks((moduleData && moduleData.recent_tasks) || []);
            saveThread(context);
        }

        container.innerHTML = renderShell(moduleData, context);
        renderThread();
        bindComposer(container, context);

        var promptEl = container.querySelector('#hub-ai-prompt');

        if (promptEl) {
            promptEl.focus();
        }
    }

    window.HubAI = {
        render: render,
        stopPolling: stopPolling,
    };
})();
