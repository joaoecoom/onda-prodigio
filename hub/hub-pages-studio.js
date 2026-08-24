(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function mount(container, options) {
        if (!container || !options || !options.offer) {
            return;
        }

        var ctx = options;
        var offer = ctx.offer;
        var funnels = ctx.funnels || [];
        var state = {
            funnelSlug: (funnels[0] && funnels[0].slug) || '',
            pageSlug: '',
            previewUrl: '',
            editorUrl: '',
        };
        var aiController = null;

        function renderShell() {
            var funnelOptions = funnels.map(function (funnel) {
                return '<option value="' + escapeHtml(funnel.slug) + '">' + escapeHtml(funnel.name) + '</option>';
            }).join('');

            container.innerHTML =
                '<div class="hub-pages-studio">' +
                    '<div class="hub-pages-studio__bar">' +
                        '<label class="hub-field hub-field--inline">' +
                            '<span class="hub-field__label">Funil</span>' +
                            '<select class="hub-login__input" id="hub-pages-studio-funnel">' +
                                funnelOptions +
                            '</select>' +
                        '</label>' +
                        '<label class="hub-field hub-field--inline">' +
                            '<span class="hub-field__label">Página</span>' +
                            '<select class="hub-login__input" id="hub-pages-studio-page">' +
                                '<option value="">— seleccionar —</option>' +
                            '</select>' +
                        '</label>' +
                        '<button type="button" class="hub-button hub-button--ghost" id="hub-pages-studio-editor" disabled>Editar ↗</button>' +
                    '</div>' +
                    '<div class="hub-pages-studio__create">' +
                        '<input class="hub-login__input" id="hub-pages-studio-name" placeholder="Nome da nova page">' +
                        '<button type="button" class="hub-button" id="hub-pages-studio-create">+ Criar page vazia</button>' +
                    '</div>' +
                    '<div class="hub-pages-studio__split">' +
                        '<div class="hub-pages-studio__preview">' +
                            '<div class="hub-pages-studio__preview-head">Live preview</div>' +
                            '<iframe class="hub-pages-studio__iframe" id="hub-pages-studio-iframe" title="Preview"></iframe>' +
                            '<p class="hub-panel__sub" id="hub-pages-studio-preview-empty">Selecciona ou cria uma page para ver o preview.</p>' +
                        '</div>' +
                        '<div class="hub-pages-studio__ai" id="hub-pages-studio-ai"></div>' +
                    '</div>' +
                '</div>';

            bindEvents();
            mountAiPanel();
        }

        function refreshPreview(url) {
            var iframe = container.querySelector('#hub-pages-studio-iframe');
            var empty = container.querySelector('#hub-pages-studio-preview-empty');

            if (!url) {
                iframe.removeAttribute('src');
                empty.hidden = false;
                return;
            }

            empty.hidden = true;
            iframe.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();
        }

        async function loadPages(funnelSlug) {
            var select = container.querySelector('#hub-pages-studio-page');

            if (!funnelSlug) {
                select.innerHTML = '<option value="">— seleccionar —</option>';
                return;
            }

            var payload = await ctx.apiFetch(
                '/api/sales-attribution?action=hub_page_list&offer=' +
                    encodeURIComponent(offer.slug) + '&funnel=' + encodeURIComponent(funnelSlug)
            );

            var pages = payload.pages || [];
            select.innerHTML = '<option value="">— seleccionar —</option>' +
                pages.map(function (page) {
                    return '<option value="' + escapeHtml(page.slug) + '" data-preview="' +
                        escapeHtml(page.preview_url || '') + '" data-editor="' +
                        escapeHtml('/studio/' + encodeURIComponent(offer.slug) + '/' +
                            encodeURIComponent(funnelSlug) + '/' + encodeURIComponent(page.slug)) + '">' +
                        escapeHtml(page.name) + ' (' + escapeHtml(page.status || 'draft') + ')</option>';
                }).join('');
        }

        function mountAiPanel() {
            var aiMount = container.querySelector('#hub-pages-studio-ai');

            if (!window.HubAIPanel) {
                aiMount.innerHTML = '<p class="hub-panel__sub">AI Panel indisponível.</p>';
                return;
            }

            aiController = window.HubAIPanel.mount(aiMount, {
                mode: 'page_builder',
                offer: offer,
                apiFetch: ctx.apiFetch,
                geminiConfigured: ctx.geminiConfigured,
                placeholder: 'Ex.: Cria sales page com hero, mecanismo, benefícios, FAQ e CTA checkout…',
                endpoint: '/api/sales-attribution?action=hub_page_builder_ai_gemini',
                buildBody: function (body) {
                    body.funnel_slug = state.funnelSlug;
                    body.page_slug = state.pageSlug || undefined;
                    return body;
                },
                onComplete: function (payload) {
                    if (payload.preview_url) {
                        state.previewUrl = payload.preview_url;
                        state.pageSlug = payload.page && payload.page.slug;
                        refreshPreview(payload.preview_url);
                    }

                    if (payload.page && payload.page.slug) {
                        loadPages(state.funnelSlug).then(function () {
                            var select = container.querySelector('#hub-pages-studio-page');
                            select.value = payload.page.slug;
                            updateEditorLink();
                        });
                    }

                    if (ctx.onRefresh) {
                        ctx.onRefresh(payload);
                    }
                },
            });
        }

        function updateEditorLink() {
            var select = container.querySelector('#hub-pages-studio-page');
            var option = select.options[select.selectedIndex];
            var editorBtn = container.querySelector('#hub-pages-studio-editor');

            if (!option || !option.value) {
                editorBtn.disabled = true;
                state.editorUrl = '';
                refreshPreview('');
                return;
            }

            state.pageSlug = option.value;
            state.previewUrl = option.getAttribute('data-preview') || '';
            state.editorUrl = option.getAttribute('data-editor') || '';
            editorBtn.disabled = !state.editorUrl;
            refreshPreview(state.previewUrl);
        }

        function bindEvents() {
            var funnelSelect = container.querySelector('#hub-pages-studio-funnel');
            funnelSelect.value = state.funnelSlug;

            funnelSelect.addEventListener('change', function () {
                state.funnelSlug = funnelSelect.value;
                loadPages(state.funnelSlug);
                updateEditorLink();
            });

            container.querySelector('#hub-pages-studio-page').addEventListener('change', updateEditorLink);

            container.querySelector('#hub-pages-studio-editor').addEventListener('click', function () {
                if (state.editorUrl) {
                    window.open(state.editorUrl, '_blank', 'noopener');
                }
            });

            container.querySelector('#hub-pages-studio-create').addEventListener('click', async function () {
                var nameInput = container.querySelector('#hub-pages-studio-name');
                var name = nameInput.value.trim();

                if (!state.funnelSlug) {
                    if (ctx.onStatus) {
                        ctx.onStatus('Selecciona um funil primeiro.', true);
                    }
                    return;
                }

                if (!name) {
                    if (ctx.onStatus) {
                        ctx.onStatus('Indica o nome da page.', true);
                    }
                    return;
                }

                try {
                    if (ctx.onStatus) {
                        ctx.onStatus('A criar page vazia…');
                    }

                    var payload = await ctx.apiFetch(
                        '/api/sales-attribution?action=hub_page_create',
                        {
                            method: 'POST',
                            body: {
                                offer: offer.slug,
                                funnel: state.funnelSlug,
                                name: name,
                                type: 'sales',
                                status: 'draft',
                            },
                        }
                    );

                    var page = payload.page || payload;
                    await loadPages(state.funnelSlug);

                    if (page && page.slug) {
                        container.querySelector('#hub-pages-studio-page').value = page.slug;
                        updateEditorLink();
                        nameInput.value = '';

                        if (aiController && aiController.setPrompt) {
                            aiController.setPrompt(
                                'Page "' + name + '" criada vazia. Constrói o primeiro bloco.'
                            );
                        }
                    }

                    if (ctx.onRefresh) {
                        ctx.onRefresh(payload);
                    }

                    if (ctx.onStatus) {
                        ctx.onStatus('');
                    }
                } catch (error) {
                    if (ctx.onStatus) {
                        ctx.onStatus(error.message, true);
                    }
                }
            });

            loadPages(state.funnelSlug);
        }

        renderShell();
    }

    window.HubPagesStudio = {
        mount: mount,
    };
})();
