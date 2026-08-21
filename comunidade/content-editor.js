(function () {
    var activeMount = null;

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function templateHtml() {
        return (
            '<div class="cce-shell">' +
                '<div class="cce-head">' +
                    '<div>' +
                        '<p class="cce-eyebrow">Editor de conteúdo</p>' +
                        '<h2 class="cce-title" data-cce-product-label>A carregar…</h2>' +
                        '<p class="cce-hint">Arrasta ⋮⋮ para reordenar. Cria módulos e aulas directamente aqui.</p>' +
                    '</div>' +
                    '<div class="cce-head__actions">' +
                        '<label class="cce-product-picker" data-cce-product-picker hidden>' +
                            '<span class="cce-product-picker__label">Programa</span>' +
                            '<select class="cce-product-picker__select" data-cce-product-select aria-label="Seleccionar programa"></select>' +
                        '</label>' +
                        '<button type="button" class="comunidade-btn comunidade-btn--ghost" data-cce-refresh>Actualizar</button>' +
                        '<button type="button" class="comunidade-btn comunidade-btn--primary" data-cce-add-module>Novo módulo</button>' +
                    '</div>' +
                '</div>' +
                '<div class="cce-status" data-cce-status hidden></div>' +
                '<div class="cce-layout">' +
                    '<div class="cce-tree" data-cce-tree></div>' +
                    '<aside class="cce-editor" data-cce-editor hidden>' +
                        '<div class="cce-editor__head">' +
                            '<h3 data-cce-editor-title>Editar</h3>' +
                            '<button type="button" class="comunidade-btn comunidade-btn--ghost" data-cce-editor-close aria-label="Fechar">✕</button>' +
                        '</div>' +
                        '<form class="cce-editor__form" data-cce-editor-form>' +
                            '<input type="hidden" data-cce-editor-id>' +
                            '<label class="cce-field">Tipo' +
                                '<select data-cce-type name="type">' +
                                    '<option value="video">Vídeo</option>' +
                                    '<option value="ebook">PDF / Ebook</option>' +
                                '</select>' +
                            '</label>' +
                            '<label class="cce-field">YouTube (ID ou URL)' +
                                '<input data-cce-youtube type="text" placeholder="URL ou ID">' +
                            '</label>' +
                            '<label class="cce-field">Vídeo (URL)' +
                                '<input data-cce-video type="text" placeholder="https://…">' +
                            '</label>' +
                            '<label class="cce-field">Upload vídeo' +
                                '<input data-cce-video-file type="file" accept="video/mp4,video/webm">' +
                            '</label>' +
                            '<label class="cce-field">PDF (URL)' +
                                '<input data-cce-pdf type="text" placeholder="https://…">' +
                            '</label>' +
                            '<label class="cce-field">Upload PDF' +
                                '<input data-cce-pdf-file type="file" accept="application/pdf">' +
                            '</label>' +
                            '<label class="cce-field">Áudio (URL)' +
                                '<input data-cce-audio type="text" placeholder="https://…">' +
                            '</label>' +
                            '<label class="cce-field">Upload áudio' +
                                '<input data-cce-audio-file type="file" accept="audio/mpeg,audio/mp3,audio/wav">' +
                            '</label>' +
                            '<label class="cce-field">Capa (URL)' +
                                '<input data-cce-image type="text" placeholder="https://…">' +
                            '</label>' +
                            '<label class="cce-field">Upload imagem' +
                                '<input data-cce-image-file type="file" accept="image/png,image/jpeg,image/webp,image/gif">' +
                            '</label>' +
                            '<label class="cce-field">Desbloquear após (dias)' +
                                '<input data-cce-unlock type="number" min="0" step="1" value="0">' +
                            '</label>' +
                            '<div class="cce-editor__actions">' +
                                '<button type="submit" class="comunidade-btn comunidade-btn--primary">Guardar</button>' +
                                '<button type="button" class="comunidade-btn comunidade-btn--ghost cce-delete" data-cce-editor-delete>Apagar</button>' +
                            '</div>' +
                        '</form>' +
                    '</aside>' +
                '</div>' +
            '</div>'
        );
    }

    function createEditor(container, options) {
        var productId = options.productId;
        var offerSlug = options.offerSlug || '';
        var onReload = options.onReload || null;
        var onProductChange = options.onProductChange || null;
        var products = Array.isArray(options.products) ? options.products.slice() : [];
        var fetchProducts = options.fetchProducts !== false;
        var currentTree = null;
        var dragState = null;
        var editorItemId = null;

        container.innerHTML = templateHtml();

        var productLabel = container.querySelector('[data-cce-product-label]');
        var productPicker = container.querySelector('[data-cce-product-picker]');
        var productSelect = container.querySelector('[data-cce-product-select]');
        var statusBox = container.querySelector('[data-cce-status]');
        var treeRoot = container.querySelector('[data-cce-tree]');
        var editorPanel = container.querySelector('[data-cce-editor]');
        var editorTitle = container.querySelector('[data-cce-editor-title]');
        var editorForm = container.querySelector('[data-cce-editor-form]');
        var editorIdInput = container.querySelector('[data-cce-editor-id]');

        function setStatus(message, isError) {
            if (!message) {
                statusBox.hidden = true;
                statusBox.textContent = '';
                statusBox.classList.remove('cce-status--error');
                return;
            }

            statusBox.hidden = false;
            statusBox.textContent = message;
            statusBox.classList.toggle('cce-status--error', Boolean(isError));
        }

        async function fetchJson(path, fetchOptions) {
            var config = Object.assign({ headers: {} }, fetchOptions || {});

            if (config.body && !config.headers['Content-Type']) {
                config.headers['Content-Type'] = 'application/json';
            }

            var response = await window.ComunidadeAuth.apiFetch(path, config);
            var data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Pedido falhou.');
            }

            return data;
        }

        function contentApiQuery() {
            var query = '/api/comunidade/content-admin?product_id=' + encodeURIComponent(productId);

            if (offerSlug) {
                query += '&offer=' + encodeURIComponent(offerSlug);
            }

            return query;
        }

        function normalizeProducts(list) {
            return (list || [])
                .map(function (item) {
                    return {
                        id: String(item.id || '').trim(),
                        name: String(item.name || item.id || '').trim(),
                    };
                })
                .filter(function (item) {
                    return Boolean(item.id);
                });
        }

        function renderProductPicker() {
            products = normalizeProducts(products);

            if (products.length <= 1) {
                productPicker.hidden = true;
                productSelect.innerHTML = '';
                return;
            }

            productPicker.hidden = false;
            productSelect.innerHTML = products.map(function (item) {
                return (
                    '<option value="' + escapeHtml(item.id) + '"' +
                        (item.id === productId ? ' selected' : '') +
                    '>' + escapeHtml(item.name) + '</option>'
                );
            }).join('');
        }

        async function ensureProducts() {
            if (products.length || !fetchProducts) {
                return;
            }

            try {
                var response = await window.ComunidadeAuth.apiFetch('/api/comunidade/products');
                var data = await response.json();

                if (response.ok) {
                    products = normalizeProducts(data.products || []);
                }
            } catch (error) {
                /* ignore — editor works with single product */
            }
        }

        function switchProduct(nextProductId) {
            var nextId = String(nextProductId || '').trim();

            if (!nextId || nextId === productId) {
                return;
            }

            productId = nextId;
            closeEditor();
            renderProductPicker();

            if (onProductChange) {
                onProductChange(productId);
            }

            return loadTree();
        }

        function findItemById(itemId) {
            var found = null;

            (currentTree.modules || []).some(function (moduleItem) {
                if (moduleItem.id === itemId) {
                    found = moduleItem;
                    return true;
                }

                return (moduleItem.aulas || []).some(function (lesson) {
                    if (lesson.id === itemId) {
                        found = lesson;
                        return true;
                    }

                    return false;
                });
            });

            return found;
        }

        function renderItemMeta(item) {
            var parts = [item.type === 'ebook' ? 'PDF' : 'Vídeo'];

            if (item.youtube_id) parts.push('YouTube');
            if (item.video_path) parts.push('MP4');
            if (item.pdf_path) parts.push('PDF file');
            if (item.audio_path) parts.push('Áudio');
            if (item.image_url) parts.push('Capa');
            if (item.unlock_after_days) parts.push('Drip ' + item.unlock_after_days + 'd');

            return parts.join(' · ');
        }

        function renderToolbar(item, parentId) {
            return (
                '<div class="cce-item__toolbar">' +
                    '<button type="button" class="comunidade-btn comunidade-btn--ghost cce-edit" data-item-id="' + escapeHtml(item.id) + '">Editar</button>' +
                    (parentId
                        ? '<button type="button" class="comunidade-btn comunidade-btn--ghost cce-add-lesson" data-parent-id="' + escapeHtml(parentId) + '">+ Aula</button>'
                        : '') +
                    '<button type="button" class="comunidade-btn comunidade-btn--ghost cce-delete-item" data-item-id="' + escapeHtml(item.id) + '">Apagar</button>' +
                '</div>'
            );
        }

        function renderLesson(lesson, moduleId) {
            return (
                '<li class="cce-item cce-item--lesson" draggable="true" data-item-id="' + escapeHtml(lesson.id) + '" data-parent-id="' + escapeHtml(moduleId) + '">' +
                    '<span class="cce-item__handle">⋮⋮</span>' +
                    '<div class="cce-item__body">' +
                        '<input class="cce-inline" data-field="title" data-item-id="' + escapeHtml(lesson.id) + '" value="' + escapeHtml(lesson.title) + '">' +
                        '<textarea class="cce-inline" data-field="description" data-item-id="' + escapeHtml(lesson.id) + '" rows="2" placeholder="Descrição">' + escapeHtml(lesson.description || '') + '</textarea>' +
                        '<p class="cce-item__meta">' + escapeHtml(renderItemMeta(lesson)) + '</p>' +
                    '</div>' +
                    renderToolbar(lesson, null) +
                '</li>'
            );
        }

        function renderModule(moduleItem) {
            return (
                '<article class="cce-module">' +
                    '<div class="cce-item cce-item--module" draggable="true" data-item-id="' + escapeHtml(moduleItem.id) + '" data-parent-id="">' +
                        '<span class="cce-item__handle">⋮⋮</span>' +
                        '<div class="cce-item__body">' +
                            '<input class="cce-inline" data-field="title" data-item-id="' + escapeHtml(moduleItem.id) + '" value="' + escapeHtml(moduleItem.title) + '">' +
                            '<textarea class="cce-inline" data-field="description" data-item-id="' + escapeHtml(moduleItem.id) + '" rows="2">' + escapeHtml(moduleItem.description || '') + '</textarea>' +
                            '<p class="cce-item__meta">' + escapeHtml((moduleItem.aulas || []).length + ' aulas') + (renderItemMeta(moduleItem) ? ' · ' + escapeHtml(renderItemMeta(moduleItem)) : '') + '</p>' +
                        '</div>' +
                        renderToolbar(moduleItem, moduleItem.id) +
                    '</div>' +
                    '<ul class="cce-lessons" data-parent-id="' + escapeHtml(moduleItem.id) + '">' +
                        (moduleItem.aulas || []).map(function (lesson) { return renderLesson(lesson, moduleItem.id); }).join('') +
                    '</ul>' +
                '</article>'
            );
        }

        function renderTree(tree) {
            currentTree = tree;
            productLabel.textContent = tree.product.name + ' · ' + (tree.flat_count || 0) + ' itens';

            if (!tree.modules || !tree.modules.length) {
                treeRoot.innerHTML = '<p class="cce-empty">Sem módulos. Clica «Novo módulo» para começar.</p>';
                return;
            }

            treeRoot.innerHTML = '<div class="cce-modules" data-parent-id="">' + tree.modules.map(renderModule).join('') + '</div>';

            if (editorItemId && !findItemById(editorItemId)) {
                closeEditor();
            }
        }

        async function loadTree() {
            setStatus('A carregar…', false);

            try {
                await ensureProducts();
                renderProductPicker();

                var data = await fetchJson(contentApiQuery());
                renderTree(data);
                setStatus('', false);

                if (onReload) {
                    onReload(data);
                }
            } catch (error) {
                setStatus(error.message, true);
            }
        }

        async function postAction(body) {
            return fetchJson('/api/comunidade/content-admin', {
                method: 'POST',
                body: JSON.stringify(Object.assign({ product_id: productId, offer: offerSlug || undefined }, body)),
            });
        }

        function getOrderedIds(container) {
            return Array.prototype.slice.call(container.querySelectorAll('[data-item-id]')).map(function (node) {
                return node.getAttribute('data-item-id');
            });
        }

        async function saveOrder(parentId, orderedIds) {
            var data = await postAction({
                action: 'reorder',
                parent_id: parentId || null,
                ordered_ids: orderedIds,
            });

            renderTree(data.tree || data);
            setStatus('Ordem guardada.', false);
        }

        async function saveField(itemId, field, value) {
            await postAction({ action: 'update', id: itemId, patch: (function () { var p = {}; p[field] = value; return p; })() });
            setStatus('Guardado.', false);
        }

        function extractYoutubeId(value) {
            var raw = String(value || '').trim();
            if (!raw) return '';
            if (/^[a-zA-Z0-9_-]{6,}$/.test(raw) && raw.indexOf('/') === -1) return raw;
            var match = raw.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/);
            return match ? match[1] : raw;
        }

        function openEditor(itemId) {
            var item = findItemById(itemId);
            if (!item) return;

            editorItemId = itemId;
            editorPanel.hidden = false;
            editorTitle.textContent = item.parent_id ? 'Editar aula' : 'Editar módulo';
            editorIdInput.value = item.id;
            container.querySelector('[data-cce-type]').value = item.type === 'ebook' ? 'ebook' : 'video';
            container.querySelector('[data-cce-youtube]').value = item.youtube_id || '';
            container.querySelector('[data-cce-video]').value = item.video_path || '';
            container.querySelector('[data-cce-pdf]').value = item.pdf_path || '';
            container.querySelector('[data-cce-audio]').value = item.audio_path || '';
            container.querySelector('[data-cce-image]').value = item.image_url || '';
            container.querySelector('[data-cce-unlock]').value = String(item.unlock_after_days || 0);
            Array.prototype.forEach.call(container.querySelectorAll('input[type="file"]'), function (input) { input.value = ''; });
        }

        function closeEditor() {
            editorItemId = null;
            editorPanel.hidden = true;
        }

        async function uploadFile(itemId, field, file) {
            if (file.size <= 3 * 1024 * 1024) {
                var base64 = await new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function () {
                        var result = String(reader.result || '');
                        resolve(result.slice(result.indexOf(',') + 1));
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                var small = await postAction({
                    action: 'upload',
                    id: itemId,
                    field: field,
                    filename: file.name,
                    content_type: file.type || 'application/octet-stream',
                    content_base64: base64,
                });

                return small.upload.public_url;
            }

            var prepared = await postAction({
                action: 'prepare_upload',
                id: itemId,
                field: field,
                filename: file.name,
                content_type: file.type || 'application/octet-stream',
            });

            var put = await fetch(prepared.upload.signed_url, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                body: file,
            });

            if (!put.ok) {
                throw new Error('Falha no upload (' + put.status + ').');
            }

            return prepared.upload.public_url;
        }

        async function saveEditor(event) {
            event.preventDefault();
            var itemId = editorIdInput.value;
            if (!itemId) return;

            setStatus('A guardar…', false);

            try {
                var patch = {
                    type: container.querySelector('[data-cce-type]').value,
                    youtube_id: extractYoutubeId(container.querySelector('[data-cce-youtube]').value),
                    video_path: container.querySelector('[data-cce-video]').value.trim(),
                    pdf_path: container.querySelector('[data-cce-pdf]').value.trim(),
                    audio_path: container.querySelector('[data-cce-audio]').value.trim(),
                    image_url: container.querySelector('[data-cce-image]').value.trim(),
                    unlock_after_days: parseInt(container.querySelector('[data-cce-unlock]').value, 10) || 0,
                };

                var uploads = [
                    ['video_path', container.querySelector('[data-cce-video-file]')],
                    ['pdf_path', container.querySelector('[data-cce-pdf-file]')],
                    ['audio_path', container.querySelector('[data-cce-audio-file]')],
                    ['image_url', container.querySelector('[data-cce-image-file]')],
                ];

                for (var i = 0; i < uploads.length; i += 1) {
                    var file = uploads[i][1].files[0];
                    if (file) {
                        patch[uploads[i][0]] = await uploadFile(itemId, uploads[i][0], file);
                    }
                }

                await postAction({ action: 'update', id: itemId, patch: patch });
                await loadTree();
                openEditor(itemId);
                setStatus('Conteúdo guardado.', false);
            } catch (error) {
                setStatus(error.message, true);
            }
        }

        async function deleteItem(itemId) {
            var item = findItemById(itemId);
            var label = item && item.title ? item.title : 'este item';

            if (!window.confirm('Apagar "' + label + '"?' + ((!item || !item.parent_id) ? ' Apaga também as aulas dentro.' : ''))) {
                return;
            }

            var data = await postAction({ action: 'delete', id: itemId });
            closeEditor();
            renderTree(data.tree || data);
            setStatus('Apagado.', false);
        }

        function bindEvents() {
            container.querySelector('[data-cce-refresh]').addEventListener('click', loadTree);
            productSelect.addEventListener('change', function () {
                switchProduct(productSelect.value).catch(function (error) {
                    setStatus(error.message, true);
                });
            });
            container.querySelector('[data-cce-add-module]').addEventListener('click', async function () {
                var title = window.prompt('Nome do módulo:');
                if (!title || !title.trim()) return;
                var data = await postAction({ action: 'create_module', title: title.trim() });
                renderTree(data.tree || data);
            });

            container.querySelector('[data-cce-editor-close]').addEventListener('click', closeEditor);
            container.querySelector('[data-cce-editor-delete]').addEventListener('click', function () {
                if (editorItemId) deleteItem(editorItemId);
            });
            editorForm.addEventListener('submit', saveEditor);

            treeRoot.addEventListener('click', function (event) {
                var addBtn = event.target.closest('.cce-add-lesson');
                var editBtn = event.target.closest('.cce-edit');
                var deleteBtn = event.target.closest('.cce-delete-item');

                if (addBtn) {
                    var parentId = addBtn.getAttribute('data-parent-id');
                    var title = window.prompt('Nome da aula:');
                    if (!title || !title.trim()) return;
                    postAction({ action: 'create_lesson', parent_id: parentId, title: title.trim() }).then(function (data) {
                        renderTree(data.tree || data);
                        if (data.item) openEditor(data.item.id);
                    }).catch(function (error) { setStatus(error.message, true); });
                    return;
                }

                if (editBtn) {
                    openEditor(editBtn.getAttribute('data-item-id'));
                    return;
                }

                if (deleteBtn) {
                    deleteItem(deleteBtn.getAttribute('data-item-id'));
                }
            });

            treeRoot.addEventListener('blur', function (event) {
                var input = event.target.closest('.cce-inline[data-item-id]');
                if (!input) return;
                saveField(input.getAttribute('data-item-id'), input.getAttribute('data-field'), input.value.trim())
                    .catch(function (error) { setStatus(error.message, true); });
            }, true);

            treeRoot.addEventListener('dragstart', function (event) {
                var item = event.target.closest('[data-item-id]');
                if (!item || !item.draggable) return;
                dragState = { id: item.getAttribute('data-item-id'), parentId: item.getAttribute('data-parent-id') || null };
                item.classList.add('cce-item--dragging');
                event.dataTransfer.effectAllowed = 'move';
            });

            treeRoot.addEventListener('dragend', function () {
                dragState = null;
                Array.prototype.forEach.call(treeRoot.querySelectorAll('.cce-item--dragging'), function (node) {
                    node.classList.remove('cce-item--dragging');
                });
            });

            treeRoot.addEventListener('dragover', function (event) {
                if (!dragState) return;
                var target = event.target.closest('[data-item-id]');
                if (!target || (target.getAttribute('data-parent-id') || null) !== dragState.parentId) return;
                event.preventDefault();
            });

            treeRoot.addEventListener('drop', function (event) {
                event.preventDefault();
                if (!dragState) return;
                var target = event.target.closest('[data-item-id]');
                if (!target) return;
                var parentId = target.getAttribute('data-parent-id') || null;
                if (parentId !== dragState.parentId) return;
                var containerEl = parentId
                    ? treeRoot.querySelector('.cce-lessons[data-parent-id="' + parentId + '"]')
                    : treeRoot.querySelector('.cce-modules');
                var ordered = getOrderedIds(containerEl).filter(function (id) { return id !== dragState.id; });
                var at = ordered.indexOf(target.getAttribute('data-item-id'));
                if (at === -1) ordered.push(dragState.id); else ordered.splice(at, 0, dragState.id);
                saveOrder(dragState.parentId, ordered).catch(function (error) { setStatus(error.message, true); });
            });
        }

        bindEvents();

        return {
            load: loadTree,
            setProduct: function (nextProductId) {
                return switchProduct(nextProductId);
            },
            getProductId: function () {
                return productId;
            },
            destroy: function () {
                container.innerHTML = '';
            },
        };
    }

    window.ComunidadeContentEditor = {
        mount: function (container, options) {
            if (!container || !options || !options.productId) {
                return null;
            }

            if (activeMount && activeMount.destroy) {
                activeMount.destroy();
            }

            activeMount = createEditor(container, options);
            return activeMount;
        },
    };
})();
