(function () {
    var root = document.getElementById('adm-content-root');
    var productLabel = document.getElementById('adm-content-product');
    var refreshButton = document.getElementById('adm-content-refresh');
    var addModuleButton = document.getElementById('adm-content-add-module');
    var treeRoot = document.getElementById('adm-content-tree');
    var editorPanel = document.getElementById('adm-content-editor');
    var editorTitle = document.getElementById('adm-content-editor-title');
    var editorForm = document.getElementById('adm-content-editor-form');
    var editorClose = document.getElementById('adm-content-editor-close');
    var editorDelete = document.getElementById('adm-content-editor-delete');
    var editorIdInput = document.getElementById('adm-editor-id');
    var statusHook = window.AdmPanel || {};

    var currentTree = null;
    var dragState = null;
    var editorItemId = null;

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function setStatus(message, isError) {
        if (statusHook.setStatus) {
            statusHook.setStatus(message, isError);
        }
    }

    function fetchJson(path, options) {
        if (!statusHook.fetchJson) {
            return Promise.reject(new Error('Painel não inicializado.'));
        }

        return statusHook.fetchJson(path, options);
    }

    function getOfferSlug() {
        if (statusHook.getOfferSlug) {
            return statusHook.getOfferSlug();
        }

        return new URLSearchParams(window.location.search).get('offer') || 'onda-prodigio';
    }

    function contentApiQuery() {
        return '/api/comunidade/content-admin?offer=' + encodeURIComponent(getOfferSlug());
    }

    function findItemById(itemId) {
        if (!currentTree || !itemId) {
            return null;
        }

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
        var parts = [];

        parts.push(item.type === 'ebook' ? 'PDF' : 'Vídeo');

        if (item.youtube_id) {
            parts.push('YouTube');
        }

        if (item.video_path) {
            parts.push('MP4');
        }

        if (item.pdf_path) {
            parts.push('PDF');
        }

        if (item.audio_path) {
            parts.push('Áudio');
        }

        if (item.image_url) {
            parts.push('Capa');
        }

        if (item.unlock_after_days) {
            parts.push('Drip ' + item.unlock_after_days + 'd');
        }

        return parts.join(' · ');
    }

    function renderItemActions(item, parentId) {
        return (
            '<div class="adm-content-item__toolbar">' +
                '<button type="button" class="metrics-button metrics-button--ghost adm-content-edit"' +
                    ' data-item-id="' + escapeHtml(item.id) + '">Editar</button>' +
                (parentId
                    ? '<button type="button" class="metrics-button metrics-button--ghost adm-content-add-lesson"' +
                        ' data-parent-id="' + escapeHtml(parentId) + '">+ Aula</button>'
                    : '') +
                '<button type="button" class="metrics-button metrics-button--ghost adm-content-delete"' +
                    ' data-item-id="' + escapeHtml(item.id) + '">Apagar</button>' +
            '</div>'
        );
    }

    function renderLessonRow(lesson, moduleId) {
        return (
            '<li class="adm-content-item adm-content-item--lesson"' +
                ' draggable="true"' +
                ' data-item-id="' + escapeHtml(lesson.id) + '"' +
                ' data-parent-id="' + escapeHtml(moduleId) + '">' +
                '<span class="adm-content-item__handle" aria-hidden="true">⋮⋮</span>' +
                '<div class="adm-content-item__body">' +
                    '<input class="adm-content-item__title adm-inline-input"' +
                        ' data-field="title"' +
                        ' data-item-id="' + escapeHtml(lesson.id) + '"' +
                        ' value="' + escapeHtml(lesson.title) + '">' +
                    '<textarea class="adm-content-item__desc adm-inline-input"' +
                        ' data-field="description"' +
                        ' data-item-id="' + escapeHtml(lesson.id) + '"' +
                        ' rows="2"' +
                        ' placeholder="Descrição (opcional)">' + escapeHtml(lesson.description || '') + '</textarea>' +
                    '<p class="adm-content-item__meta">' + escapeHtml(renderItemMeta(lesson)) + '</p>' +
                '</div>' +
                renderItemActions(lesson, null) +
            '</li>'
        );
    }

    function renderModule(moduleItem) {
        var lessons = moduleItem.aulas || [];

        return (
            '<article class="adm-content-module" data-module-id="' + escapeHtml(moduleItem.id) + '">' +
                '<div class="adm-content-module__head">' +
                    '<div class="adm-content-item adm-content-item--module"' +
                        ' draggable="true"' +
                        ' data-item-id="' + escapeHtml(moduleItem.id) + '"' +
                        ' data-parent-id="">' +
                        '<span class="adm-content-item__handle" aria-hidden="true">⋮⋮</span>' +
                        '<div class="adm-content-item__body">' +
                            '<input class="adm-content-item__title adm-inline-input"' +
                                ' data-field="title"' +
                                ' data-item-id="' + escapeHtml(moduleItem.id) + '"' +
                                ' value="' + escapeHtml(moduleItem.title) + '">' +
                            '<textarea class="adm-content-item__desc adm-inline-input"' +
                                ' data-field="description"' +
                                ' data-item-id="' + escapeHtml(moduleItem.id) + '"' +
                                ' rows="2"' +
                                ' placeholder="Descrição do módulo">' + escapeHtml(moduleItem.description || '') + '</textarea>' +
                            '<p class="adm-content-item__meta">' +
                                escapeHtml(lessons.length + ' aula' + (lessons.length === 1 ? '' : 's')) +
                                (renderItemMeta(moduleItem) ? ' · ' + escapeHtml(renderItemMeta(moduleItem)) : '') +
                            '</p>' +
                        '</div>' +
                        renderItemActions(moduleItem, moduleItem.id) +
                    '</div>' +
                '</div>' +
                '<ul class="adm-content-lessons" data-parent-id="' + escapeHtml(moduleItem.id) + '">' +
                    lessons.map(function (lesson) {
                        return renderLessonRow(lesson, moduleItem.id);
                    }).join('') +
                '</ul>' +
            '</article>'
        );
    }

    function renderTree(tree) {
        currentTree = tree;

        if (productLabel && tree && tree.product) {
            productLabel.textContent = tree.product.name + ' · ' + (tree.flat_count || 0) + ' itens';
        }

        if (!tree || !tree.modules || !tree.modules.length) {
            treeRoot.innerHTML = '<p class="adm-muted">Sem módulos. Cria o primeiro com «Novo módulo».</p>';
            return;
        }

        treeRoot.innerHTML = (
            '<div class="adm-content-modules" data-parent-id="">' +
                tree.modules.map(renderModule).join('') +
            '</div>'
        );

        if (editorItemId && !findItemById(editorItemId)) {
            closeEditor();
        }
    }

    async function loadTree() {
        setStatus('A carregar conteúdo…', false);

        try {
            var data = await fetchJson(contentApiQuery());
            renderTree(data);
            setStatus('', false);
        } catch (error) {
            setStatus(error.message || 'Não foi possível carregar conteúdo.', true);
        }
    }

    async function saveOrder(parentId, orderedIds) {
        setStatus('A guardar ordem…', false);

        try {
            var data = await fetchJson('/api/comunidade/content-admin', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'reorder',
                    offer: getOfferSlug(),
                    parent_id: parentId || null,
                    ordered_ids: orderedIds,
                }),
            });

            renderTree(data.tree || data);
            setStatus('Ordem guardada.', false);
        } catch (error) {
            setStatus(error.message || 'Não foi possível guardar ordem.', true);
            await loadTree();
        }
    }

    async function saveField(itemId, field, value) {
        setStatus('A guardar…', false);

        try {
            await fetchJson('/api/comunidade/content-admin', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update',
                    id: itemId,
                    patch: (function () {
                        var patch = {};
                        patch[field] = value;
                        return patch;
                    })(),
                }),
            });

            setStatus('Guardado.', false);
        } catch (error) {
            setStatus(error.message || 'Não foi possível guardar.', true);
        }
    }

    async function createModule() {
        var title = window.prompt('Nome do novo módulo:');

        if (!title || !title.trim()) {
            return;
        }

        setStatus('A criar módulo…', false);

        try {
            var data = await fetchJson('/api/comunidade/content-admin', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'create_module',
                    offer: getOfferSlug(),
                    title: title.trim(),
                }),
            });

            renderTree(data.tree || data);
            setStatus('Módulo criado.', false);
        } catch (error) {
            setStatus(error.message || 'Não foi possível criar módulo.', true);
        }
    }

    async function createLesson(parentId) {
        var title = window.prompt('Nome da nova aula:');

        if (!title || !title.trim()) {
            return;
        }

        setStatus('A criar aula…', false);

        try {
            var data = await fetchJson('/api/comunidade/content-admin', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'create_lesson',
                    offer: getOfferSlug(),
                    parent_id: parentId,
                    title: title.trim(),
                }),
            });

            renderTree(data.tree || data);
            setStatus('Aula criada.', false);

            if (data.item && data.item.id) {
                openEditor(data.item.id);
            }
        } catch (error) {
            setStatus(error.message || 'Não foi possível criar aula.', true);
        }
    }

    async function deleteItem(itemId) {
        var item = findItemById(itemId);
        var label = item && item.title ? item.title : 'este item';
        var isModule = item && !item.parent_id;

        if (!window.confirm(
            'Apagar "' + label + '"?' +
            (isModule ? ' Todas as aulas dentro deste módulo também serão apagadas.' : '')
        )) {
            return;
        }

        setStatus('A apagar…', false);

        try {
            var data = await fetchJson('/api/comunidade/content-admin', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'delete',
                    id: itemId,
                }),
            });

            closeEditor();
            renderTree(data.tree || data);
            setStatus('Apagado.', false);
        } catch (error) {
            setStatus(error.message || 'Não foi possível apagar.', true);
        }
    }

    function extractYoutubeId(value) {
        var raw = String(value || '').trim();

        if (!raw) {
            return '';
        }

        if (/^[a-zA-Z0-9_-]{6,}$/.test(raw) && raw.indexOf('/') === -1) {
            return raw;
        }

        var match = raw.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/);

        return match ? match[1] : raw;
    }

    function openEditor(itemId) {
        var item = findItemById(itemId);

        if (!item || !editorPanel || !editorForm) {
            return;
        }

        editorItemId = itemId;
        editorPanel.hidden = false;
        editorTitle.textContent = item.parent_id ? 'Editar aula' : 'Editar módulo';
        editorIdInput.value = item.id;
        document.getElementById('adm-editor-type').value = item.type === 'ebook' ? 'ebook' : 'video';
        document.getElementById('adm-editor-youtube').value = item.youtube_id || '';
        document.getElementById('adm-editor-video').value = item.video_path || '';
        document.getElementById('adm-editor-pdf').value = item.pdf_path || '';
        document.getElementById('adm-editor-audio').value = item.audio_path || '';
        document.getElementById('adm-editor-image').value = item.image_url || '';
        document.getElementById('adm-editor-unlock').value = String(item.unlock_after_days || 0);

        Array.prototype.forEach.call(editorForm.querySelectorAll('input[type="file"]'), function (input) {
            input.value = '';
        });
    }

    function closeEditor() {
        editorItemId = null;

        if (editorPanel) {
            editorPanel.hidden = true;
        }
    }

    async function uploadFileForField(itemId, field, file) {
        if (!file) {
            return null;
        }

        if (file.size <= 3 * 1024 * 1024) {
            var base64 = await new Promise(function (resolve, reject) {
                var reader = new FileReader();

                reader.onload = function () {
                    var result = String(reader.result || '');
                    var comma = result.indexOf(',');

                    resolve(comma >= 0 ? result.slice(comma + 1) : result);
                };

                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            var small = await fetchJson('/api/comunidade/content-admin', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'upload',
                    id: itemId,
                    field: field,
                    filename: file.name,
                    content_type: file.type || 'application/octet-stream',
                    content_base64: base64,
                }),
            });

            return small.upload && small.upload.public_url;
        }

        var prepared = await fetchJson('/api/comunidade/content-admin', {
            method: 'POST',
            body: JSON.stringify({
                action: 'prepare_upload',
                id: itemId,
                field: field,
                filename: file.name,
                content_type: file.type || 'application/octet-stream',
            }),
        });

        var uploadInfo = prepared.upload;

        if (!uploadInfo || !uploadInfo.signed_url) {
            throw new Error('Upload indisponível.');
        }

        var putResponse = await fetch(uploadInfo.signed_url, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type || 'application/octet-stream',
            },
            body: file,
        });

        if (!putResponse.ok) {
            throw new Error('Falha ao enviar ficheiro (' + putResponse.status + ').');
        }

        return uploadInfo.public_url;
    }

    async function saveEditor(event) {
        event.preventDefault();

        var itemId = editorIdInput.value;

        if (!itemId) {
            return;
        }

        setStatus('A guardar…', false);

        try {
            var patch = {
                type: document.getElementById('adm-editor-type').value,
                youtube_id: extractYoutubeId(document.getElementById('adm-editor-youtube').value),
                video_path: document.getElementById('adm-editor-video').value.trim(),
                pdf_path: document.getElementById('adm-editor-pdf').value.trim(),
                audio_path: document.getElementById('adm-editor-audio').value.trim(),
                image_url: document.getElementById('adm-editor-image').value.trim(),
                unlock_after_days: parseInt(document.getElementById('adm-editor-unlock').value, 10) || 0,
            };

            var uploads = [
                { field: 'video_path', input: document.getElementById('adm-editor-video-file') },
                { field: 'pdf_path', input: document.getElementById('adm-editor-pdf-file') },
                { field: 'audio_path', input: document.getElementById('adm-editor-audio-file') },
                { field: 'image_url', input: document.getElementById('adm-editor-image-file') },
            ];

            for (var i = 0; i < uploads.length; i += 1) {
                var entry = uploads[i];
                var file = entry.input && entry.input.files && entry.input.files[0];

                if (file) {
                    patch[entry.field] = await uploadFileForField(itemId, entry.field, file);
                }
            }

            await fetchJson('/api/comunidade/content-admin', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update',
                    id: itemId,
                    patch: patch,
                }),
            });

            await loadTree();
            openEditor(itemId);
            setStatus('Conteúdo guardado.', false);
        } catch (error) {
            setStatus(error.message || 'Não foi possível guardar.', true);
        }
    }

    function getOrderedIds(container) {
        return Array.prototype.slice.call(container.querySelectorAll('[data-item-id]')).map(function (node) {
            return node.getAttribute('data-item-id');
        });
    }

    function bindDragDrop() {
        if (!treeRoot) {
            return;
        }

        treeRoot.addEventListener('dragstart', function (event) {
            var item = event.target.closest('[data-item-id]');

            if (!item || !item.draggable) {
                return;
            }

            dragState = {
                id: item.getAttribute('data-item-id'),
                parentId: item.getAttribute('data-parent-id') || null,
            };

            item.classList.add('adm-content-item--dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', dragState.id);
        });

        treeRoot.addEventListener('dragend', function (event) {
            var item = event.target.closest('[data-item-id]');

            if (item) {
                item.classList.remove('adm-content-item--dragging');
            }

            Array.prototype.slice.call(treeRoot.querySelectorAll('.adm-content-item--over')).forEach(function (node) {
                node.classList.remove('adm-content-item--over');
            });

            dragState = null;
        });

        treeRoot.addEventListener('dragover', function (event) {
            if (!dragState) {
                return;
            }

            var target = event.target.closest('[data-item-id]');

            if (!target) {
                return;
            }

            var targetParent = target.getAttribute('data-parent-id') || null;

            if (targetParent !== dragState.parentId) {
                return;
            }

            event.preventDefault();
            target.classList.add('adm-content-item--over');
        });

        treeRoot.addEventListener('dragleave', function (event) {
            var target = event.target.closest('[data-item-id]');

            if (target) {
                target.classList.remove('adm-content-item--over');
            }
        });

        treeRoot.addEventListener('drop', function (event) {
            event.preventDefault();

            if (!dragState) {
                return;
            }

            var target = event.target.closest('[data-item-id]');

            if (!target) {
                return;
            }

            var targetParent = target.getAttribute('data-parent-id') || null;

            if (targetParent !== dragState.parentId) {
                return;
            }

            target.classList.remove('adm-content-item--over');

            var container = targetParent
                ? treeRoot.querySelector('.adm-content-lessons[data-parent-id="' + targetParent + '"]')
                : treeRoot.querySelector('.adm-content-modules');

            if (!container) {
                return;
            }

            var orderedIds = getOrderedIds(container).filter(function (id) {
                return id !== dragState.id;
            });
            var targetId = target.getAttribute('data-item-id');
            var insertAt = orderedIds.indexOf(targetId);

            if (insertAt === -1) {
                orderedIds.push(dragState.id);
            } else {
                orderedIds.splice(insertAt, 0, dragState.id);
            }

            saveOrder(dragState.parentId, orderedIds);
        });
    }

    function bindInlineEdit() {
        if (!treeRoot) {
            return;
        }

        treeRoot.addEventListener('blur', function (event) {
            var input = event.target.closest('.adm-inline-input[data-item-id]');

            if (!input) {
                return;
            }

            var itemId = input.getAttribute('data-item-id');
            var field = input.getAttribute('data-field');
            var value = input.value.trim();

            saveField(itemId, field, value);
        }, true);

        treeRoot.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            var input = event.target.closest('.adm-inline-input[data-item-id]');

            if (!input) {
                return;
            }

            event.preventDefault();
            input.blur();
        });
    }

    function bindActions() {
        if (refreshButton) {
            refreshButton.addEventListener('click', function () {
                loadTree();
            });
        }

        if (addModuleButton) {
            addModuleButton.addEventListener('click', function () {
                createModule();
            });
        }

        if (editorForm) {
            editorForm.addEventListener('submit', function (event) {
                saveEditor(event);
            });
        }

        if (editorClose) {
            editorClose.addEventListener('click', closeEditor);
        }

        if (editorDelete) {
            editorDelete.addEventListener('click', function () {
                if (editorItemId) {
                    deleteItem(editorItemId);
                }
            });
        }

        if (treeRoot) {
            treeRoot.addEventListener('click', function (event) {
                var addLessonBtn = event.target.closest('.adm-content-add-lesson');
                var editBtn = event.target.closest('.adm-content-edit');
                var deleteBtn = event.target.closest('.adm-content-delete');

                if (addLessonBtn) {
                    createLesson(addLessonBtn.getAttribute('data-parent-id'));
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
        }
    }

    function init() {
        if (!root) {
            return;
        }

        bindDragDrop();
        bindInlineEdit();
        bindActions();
    }

    window.AdmContent = {
        init: init,
        load: loadTree,
    };

    init();
})();
