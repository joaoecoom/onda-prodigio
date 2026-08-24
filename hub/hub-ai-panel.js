(function () {
    'use strict';

    var MODE_LABELS = {
        funnel: 'Funil',
        tracking: 'Tracking',
        domain: 'Domínio',
        checkout: 'Checkout',
        page: 'Página',
        page_builder: 'Page Builder',
        general: 'Geral',
    };

    var MAX_ATTACHMENTS = 8;
    var MAX_IMAGE_BYTES = 4 * 1024 * 1024;
    var MAX_VIDEO_BYTES = 12 * 1024 * 1024;
    var IMAGE_COMPRESS_MAX_WIDTH = 1280;
    var IMAGE_COMPRESS_QUALITY = 0.82;
    var URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function uid() {
        return 'ref-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    function isImageMime(mime) {
        return /^image\//i.test(mime || '');
    }

    function isVideoMime(mime) {
        return /^video\//i.test(mime || '');
    }

    function compressImageFile(file) {
        return new Promise(function (resolve, reject) {
            if (!isImageMime(file.type) || typeof document === 'undefined') {
                readFileAsAttachment(file).then(resolve).catch(reject);
                return;
            }

            var objectUrl = URL.createObjectURL(file);
            var img = new Image();

            img.onload = function () {
                URL.revokeObjectURL(objectUrl);

                var scale = Math.min(1, IMAGE_COMPRESS_MAX_WIDTH / Math.max(img.width, 1));
                var width = Math.max(1, Math.round(img.width * scale));
                var height = Math.max(1, Math.round(img.height * scale));
                var canvas = document.createElement('canvas');

                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                var dataUrl = canvas.toDataURL('image/jpeg', IMAGE_COMPRESS_QUALITY);
                var base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;

                resolve({
                    id: uid(),
                    type: 'image',
                    name: file.name || 'imagem',
                    mime_type: 'image/jpeg',
                    data_base64: base64,
                    preview_url: dataUrl,
                });
            };

            img.onerror = function () {
                URL.revokeObjectURL(objectUrl);
                readFileAsAttachment(file).then(resolve).catch(reject);
            };

            img.src = objectUrl;
        });
    }

    function readFileAsAttachment(file) {
        return new Promise(function (resolve, reject) {
            if (!file) {
                reject(new Error('Ficheiro inválido.'));
                return;
            }

            var maxBytes = isVideoMime(file.type) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

            if (file.size > maxBytes) {
                reject(new Error('Ficheiro demasiado grande (máx. ' + Math.round(maxBytes / (1024 * 1024)) + 'MB).'));
                return;
            }

            var reader = new FileReader();

            reader.onload = function () {
                var dataUrl = String(reader.result || '');
                var base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;

                resolve({
                    id: uid(),
                    type: isVideoMime(file.type) ? 'video' : 'image',
                    name: file.name || (isVideoMime(file.type) ? 'video' : 'imagem'),
                    mime_type: file.type || (isVideoMime(file.type) ? 'video/mp4' : 'image/png'),
                    data_base64: base64,
                    preview_url: isImageMime(file.type) ? dataUrl : '',
                });
            };

            reader.onerror = function () {
                reject(new Error('Não foi possível ler o ficheiro.'));
            };

            reader.readAsDataURL(file);
        });
    }

    function extractUrls(text) {
        var matches = String(text || '').match(URL_PATTERN);
        return matches ? matches.map(function (url) { return url.replace(/[.,;:!?)]+$/, ''); }) : [];
    }

    function serializeReferences(attachments) {
        return attachments.map(function (ref) {
            if (ref.type === 'link') {
                return {
                    type: 'link',
                    url: ref.url,
                    name: ref.name || '',
                };
            }

            return {
                type: ref.type,
                mime_type: ref.mime_type,
                data_base64: ref.data_base64,
                name: ref.name || '',
            };
        });
    }

    function renderReferenceSummary(refs) {
        if (!refs || !refs.length) {
            return '';
        }

        return refs.map(function (ref) {
            if (ref.type === 'link') {
                return '<a class="hub-ai-ref-chip hub-ai-ref-chip--link" href="' + escapeHtml(ref.url) +
                    '" target="_blank" rel="noopener">' + escapeHtml(ref.name || ref.url) + '</a>';
            }

            if (ref.type === 'video') {
                return '<span class="hub-ai-ref-chip hub-ai-ref-chip--video">🎬 ' + escapeHtml(ref.name || 'vídeo') + '</span>';
            }

            if (ref.preview_url) {
                return '<img class="hub-ai-ref-thumb" src="' + escapeHtml(ref.preview_url) + '" alt="' +
                    escapeHtml(ref.name || 'referência') + '">';
            }

            return '<span class="hub-ai-ref-chip">🖼 ' + escapeHtml(ref.name || 'imagem') + '</span>';
        }).join('');
    }

    function renderMessages(container, messages) {
        if (!messages.length) {
            container.innerHTML = '<p class="hub-ai-panel__empty">Descreve o que queres construir. Cola imagens, links ou arrasta ficheiros como referência.</p>';
            return;
        }

        container.innerHTML = messages.map(function (msg) {
            var roleClass = msg.role === 'user' ? 'is-user' : 'is-assistant';
            var refsHtml = msg.references && msg.references.length
                ? '<div class="hub-ai-panel__msg-refs">' + renderReferenceSummary(msg.references) + '</div>'
                : '';

            return '<div class="hub-ai-panel__msg ' + roleClass + '">' +
                '<div class="hub-ai-panel__msg-role">' + (msg.role === 'user' ? 'Tu' : 'AI') + '</div>' +
                refsHtml +
                '<div class="hub-ai-panel__msg-body">' + escapeHtml(msg.content).replace(/\n/g, '<br>') + '</div>' +
            '</div>';
        }).join('');

        container.scrollTop = container.scrollHeight;
    }

    function renderSteps(container, steps) {
        if (!container) {
            return;
        }

        if (!steps || !steps.length) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        container.hidden = false;
        container.innerHTML = steps.map(function (step) {
            var icon = step.ok ? '✓' : '✗';
            var cls = step.ok ? 'is-ok' : 'is-error';
            return '<div class="hub-ai-panel__step ' + cls + '">' +
                '<span class="hub-ai-panel__step-icon">' + icon + '</span>' +
                '<span>' + escapeHtml(step.label || step.tool) + '</span>' +
            '</div>';
        }).join('');
    }

    function renderAttachmentTray(trayEl, attachments, onRemove) {
        if (!trayEl) {
            return;
        }

        if (!attachments.length) {
            trayEl.innerHTML = '';
            trayEl.hidden = true;
            return;
        }

        trayEl.hidden = false;
        trayEl.innerHTML = attachments.map(function (ref) {
            var preview = '';

            if (ref.type === 'link') {
                preview = '<span class="hub-ai-attach__icon">🔗</span>';
            } else if (ref.type === 'video') {
                preview = '<span class="hub-ai-attach__icon">🎬</span>';
            } else if (ref.preview_url) {
                preview = '<img class="hub-ai-attach__thumb" src="' + escapeHtml(ref.preview_url) + '" alt="">';
            } else {
                preview = '<span class="hub-ai-attach__icon">🖼</span>';
            }

            var label = ref.type === 'link' ? (ref.name || ref.url) : (ref.name || ref.type);

            return '<div class="hub-ai-attach" data-ref-id="' + escapeHtml(ref.id) + '">' +
                preview +
                '<span class="hub-ai-attach__label" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>' +
                '<button type="button" class="hub-ai-attach__remove" data-ref-remove="' + escapeHtml(ref.id) + '" aria-label="Remover">×</button>' +
            '</div>';
        }).join('');

        trayEl.querySelectorAll('[data-ref-remove]').forEach(function (button) {
            button.addEventListener('click', function () {
                onRemove(button.getAttribute('data-ref-remove'));
            });
        });
    }

    function mount(container, options) {
        if (!container) {
            return null;
        }

        var ctx = options || {};
        var mode = ctx.mode || 'general';
        var messages = ctx.messages || [];
        var busy = false;
        var attachments = [];
        var controller = {};

        function renderUi(geminiConfigured) {
            container.innerHTML =
                '<div class="hub-ai-panel">' +
                    '<div class="hub-ai-panel__head">' +
                        '<div><strong>Construir com IA</strong>' +
                        '<span class="hub-ai-panel__mode">' + escapeHtml(MODE_LABELS[mode] || mode) + '</span></div>' +
                        (geminiConfigured
                            ? '<span class="dr-status dr-status--connected"><span class="dr-status__dot"></span> Gemini</span>'
                            : '<span class="dr-status dr-status--missing"><span class="dr-status__dot"></span> API em falta</span>') +
                    '</div>' +
                    '<div class="hub-ai-panel__steps" id="hub-ai-panel-steps" hidden></div>' +
                    '<div class="hub-ai-panel__messages" id="hub-ai-panel-messages"></div>' +
                    '<form class="hub-ai-panel__form" id="hub-ai-panel-form">' +
                        '<div class="hub-ai-panel__attachments" id="hub-ai-panel-attachments" hidden></div>' +
                        '<div class="hub-ai-panel__composer">' +
                            '<textarea class="hub-login__input hub-ai-panel__input" id="hub-ai-panel-input" rows="4" ' +
                                'placeholder="' + escapeHtml(ctx.placeholder || 'Descreve a alteração… Cola imagens, links ou arrasta referências.') + '"' +
                                (geminiConfigured ? '' : ' disabled') + '></textarea>' +
                            '<div class="hub-ai-panel__toolbar">' +
                                '<label class="hub-ai-panel__attach-btn" title="Anexar imagem ou vídeo">' +
                                    '<input type="file" id="hub-ai-panel-file" accept="image/*,video/*" multiple hidden' +
                                        (geminiConfigured ? '' : ' disabled') + '>📎</label>' +
                                '<span class="hub-ai-panel__hint">Enter executa · Shift+Enter nova linha · ⌘V colar</span>' +
                                '<button type="submit" class="hub-button"' + (geminiConfigured ? '' : ' disabled') + '>Executar</button>' +
                            '</div>' +
                        '</div>' +
                        '<p class="hub-form-message" id="hub-ai-panel-error" hidden></p>' +
                    '</form>' +
                '</div>';

            var messagesEl = container.querySelector('#hub-ai-panel-messages');
            var stepsEl = container.querySelector('#hub-ai-panel-steps');
            var form = container.querySelector('#hub-ai-panel-form');
            var input = container.querySelector('#hub-ai-panel-input');
            var errorEl = container.querySelector('#hub-ai-panel-error');
            var trayEl = container.querySelector('#hub-ai-panel-attachments');
            var fileInput = container.querySelector('#hub-ai-panel-file');

            renderMessages(messagesEl, messages);

            function setError(message) {
                if (!message) {
                    errorEl.hidden = true;
                    errorEl.textContent = '';
                    return;
                }

                errorEl.textContent = message;
                errorEl.hidden = false;
            }

            function refreshTray() {
                renderAttachmentTray(trayEl, attachments, function (refId) {
                    attachments = attachments.filter(function (row) {
                        return row.id !== refId;
                    });
                    refreshTray();
                });
            }

            async function addFiles(fileList) {
                var files = Array.from(fileList || []);

                for (var i = 0; i < files.length; i += 1) {
                    if (attachments.length >= MAX_ATTACHMENTS) {
                        setError('Máximo de ' + MAX_ATTACHMENTS + ' referências por mensagem.');
                        break;
                    }

                    var file = files[i];

                    if (!isImageMime(file.type) && !isVideoMime(file.type)) {
                        setError('Formato não suportado: ' + (file.name || file.type));
                        continue;
                    }

                    try {
                        var attachment = isImageMime(file.type)
                            ? await compressImageFile(file)
                            : await readFileAsAttachment(file);
                        attachments.push(attachment);
                        setError('');
                    } catch (error) {
                        setError(error.message);
                    }
                }

                refreshTray();
            }

            function addLink(url, name) {
                if (attachments.length >= MAX_ATTACHMENTS) {
                    setError('Máximo de ' + MAX_ATTACHMENTS + ' referências por mensagem.');
                    return;
                }

                if (attachments.some(function (row) { return row.type === 'link' && row.url === url; })) {
                    return;
                }

                attachments.push({
                    id: uid(),
                    type: 'link',
                    url: url,
                    name: name || url,
                });
                refreshTray();
            }

            fileInput.addEventListener('change', function () {
                addFiles(fileInput.files);
                fileInput.value = '';
            });

            form.addEventListener('dragover', function (event) {
                event.preventDefault();
                form.classList.add('is-drag-over');
            });

            form.addEventListener('dragleave', function () {
                form.classList.remove('is-drag-over');
            });

            form.addEventListener('drop', function (event) {
                event.preventDefault();
                form.classList.remove('is-drag-over');

                if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
                    addFiles(event.dataTransfer.files);
                    return;
                }

                var text = event.dataTransfer ? event.dataTransfer.getData('text/plain') : '';
                extractUrls(text).forEach(function (url) {
                    addLink(url);
                });
            });

            input.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    form.requestSubmit();
                }
            });

            input.addEventListener('paste', function (event) {
                var clipboard = event.clipboardData;

                if (!clipboard) {
                    return;
                }

                var pastedFiles = [];

                for (var i = 0; i < clipboard.items.length; i += 1) {
                    var item = clipboard.items[i];

                    if (item.kind === 'file') {
                        var file = item.getAsFile();

                        if (file) {
                            pastedFiles.push(file);
                        }
                    }
                }

                if (pastedFiles.length) {
                    event.preventDefault();
                    addFiles(pastedFiles);
                    return;
                }

                var pastedText = clipboard.getData('text/plain') || '';
                var urls = extractUrls(pastedText);

                if (urls.length) {
                    urls.forEach(function (url) {
                        addLink(url);
                    });
                }
            });

            form.addEventListener('submit', async function (event) {
                event.preventDefault();

                if (busy || !geminiConfigured || !ctx.apiFetch || !ctx.offer) {
                    return;
                }

                var text = input.value.trim();
                var refs = attachments.slice();

                if (!text && !refs.length) {
                    return;
                }

                if (!text && refs.length) {
                    text = 'Modela a page com base nestas referências visuais.';
                }

                busy = true;
                setError('');
                renderSteps(stepsEl, [{ label: 'A analisar pedido…', ok: true }]);

                messages.push({
                    role: 'user',
                    content: text,
                    references: refs.map(function (row) {
                        return Object.assign({}, row);
                    }),
                });
                renderMessages(messagesEl, messages);
                input.value = '';
                attachments = [];
                refreshTray();

                if (ctx.onStatus) {
                    ctx.onStatus('AI a executar…');
                }

                try {
                    var body = Object.assign({}, ctx.body || {}, {
                        slug: ctx.offer.slug,
                        mode: mode,
                        message: text,
                        messages: messages.slice(0, -1).map(function (msg) {
                            return {
                                role: msg.role,
                                content: msg.content,
                            };
                        }),
                        references: serializeReferences(refs),
                    });

                    if (typeof ctx.buildBody === 'function') {
                        body = ctx.buildBody(body, text);
                    }

                    var endpoint = ctx.endpoint || '/api/sales-attribution?action=hub_gemini_chat';
                    var payload = await ctx.apiFetch(endpoint, {
                        method: 'POST',
                        body: body,
                    });

                    renderSteps(stepsEl, payload.steps || []);

                    var assistantNote = payload.changes_summary || payload.reply || 'Concluído.';

                    if (payload.metrics && payload.metrics.gemini_fallback) {
                        assistantNote = assistantNote + ' (modelo alternativo)';
                    }

                    messages.push({
                        role: 'assistant',
                        content: assistantNote,
                    });
                    renderMessages(messagesEl, messages);

                    if (ctx.onComplete) {
                        ctx.onComplete(payload);
                    }

                    if (ctx.onStatus) {
                        ctx.onStatus('');
                    }
                } catch (error) {
                    var friendly = error.message || 'Erro desconhecido.';
                    setError(friendly);
                    renderSteps(stepsEl, [{ label: friendly, ok: false }]);

                    if (ctx.onStatus) {
                        ctx.onStatus('');
                    }
                } finally {
                    busy = false;
                }
            });

            controller.focus = function () {
                input.focus();
            };

            controller.setPrompt = function (text) {
                input.value = text || '';
                input.focus();
            };

            controller.addLink = function (url, name) {
                addLink(url, name);
            };
        }

        if (ctx.geminiConfigured === undefined && ctx.apiFetch) {
            container.innerHTML = '<p class="hub-panel__sub">A verificar AI…</p>';
            ctx.apiFetch('/api/sales-attribution?action=hub_gemini_status')
                .then(function (statusPayload) {
                    renderUi(Boolean(statusPayload.gemini && statusPayload.gemini.configured));
                })
                .catch(function () {
                    renderUi(false);
                });
        } else {
            renderUi(ctx.geminiConfigured !== false);
        }

        return controller;
    }

    window.HubAIPanel = {
        mount: mount,
        MODE_LABELS: MODE_LABELS,
    };
})();
