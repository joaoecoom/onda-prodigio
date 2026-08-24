(function () {
    'use strict';

    var TOKEN_KEY = 'onda-metrics-token';
    var SORT_GAP = 100;

    var loginSection = document.getElementById('peb-login');
    var appSection = document.getElementById('peb-app');
    var loginForm = document.getElementById('peb-login-form');
    var loginError = document.getElementById('peb-login-error');
    var passwordInput = document.getElementById('peb-password');

    var state = {
        slugs: { offer: '', funnel: '', page: '' },
        meta: null,
        baseline: null,
        tree: null,
        selected: { type: null, id: null },
        saveStatus: 'saved',
        device: 'desktop',
        undoStack: [],
        redoStack: [],
        previewUrl: '',
        publicUrl: '',
        templates: null,
        revisions: [],
    };

    var renderTimer = null;
    var autoSaveTimer = null;
    var autoSavedFlashTimer = null;
    var editHistoryCaptured = false;
    var AUTO_SAVE_DELAY_MS = 2500;

    function ensureEditHistory() {
        if (!editHistoryCaptured) {
            pushHistory();
            editHistoryCaptured = true;
        }
    }

    function getToken() {
        return sessionStorage.getItem(TOKEN_KEY) || '';
    }

    function setToken(token) {
        sessionStorage.setItem(TOKEN_KEY, token);
    }

    function parseRoute() {
        var parts = window.location.pathname.split('/').filter(Boolean);

        if (parts[0] !== 'editor' || parts.length < 4) {
            return null;
        }

        return {
            offer: decodeURIComponent(parts[1]),
            funnel: decodeURIComponent(parts[2]),
            page: decodeURIComponent(parts[3]),
        };
    }

    function cloneTree(tree) {
        return JSON.parse(JSON.stringify(tree));
    }

    function tempId() {
        return 'tmp-' + crypto.randomUUID();
    }

    function authHeaders() {
        return {
            Authorization: 'Bearer ' + getToken(),
            'Content-Type': 'application/json',
        };
    }

    async function apiFetch(path, options) {
        var config = options || {};
        var response = await fetch(path, {
            method: config.method || 'GET',
            headers: authHeaders(),
            body: config.body ? JSON.stringify(config.body) : undefined,
        });

        var payload = await response.json().catch(function () {
            return {};
        });

        if (response.status === 401) {
            sessionStorage.removeItem(TOKEN_KEY);
            showLogin(true);
            throw new Error('Palavra-passe incorrecta.');
        }

        if (!response.ok) {
            var message = payload.error || 'Pedido falhou.';

            if (response.status === 404 || payload.code === 'NOT_FOUND') {
                message = 'Oferta, funil ou page não encontrados. Verifica o URL ou cria a page no HUB.';
            }

            throw new Error(message);
        }

        return payload;
    }

    function showLogin(show) {
        loginSection.hidden = !show;
        appSection.hidden = show;
    }

    function pushHistory() {
        state.undoStack.push(cloneTree(state.tree));
        state.redoStack = [];

        if (state.undoStack.length > 50) {
            state.undoStack.shift();
        }

        setSaveStatus('unsaved');
    }

    function cancelAutoSave() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }

    function scheduleAutoSave() {
        if (state.saveStatus !== 'unsaved') {
            return;
        }

        cancelAutoSave();
        autoSaveTimer = setTimeout(function () {
            autoSaveTimer = null;

            if (state.saveStatus === 'unsaved') {
                saveChanges({ auto: true });
            }
        }, AUTO_SAVE_DELAY_MS);
    }

    function flashAutoSaved() {
        clearTimeout(autoSavedFlashTimer);
        var el = document.getElementById('peb-save-status');
        el.textContent = 'Auto-saved';
        el.className = 'peb-save-status is-auto-saved';

        autoSavedFlashTimer = setTimeout(function () {
            autoSavedFlashTimer = null;

            if (state.saveStatus === 'saved') {
                setSaveStatus('saved');
            }
        }, 2000);
    }

    function markDirty() {
        if (state.saveStatus === 'saving') {
            return;
        }

        if (state.saveStatus !== 'unsaved') {
            setSaveStatus('unsaved');
        } else {
            scheduleAutoSave();
        }
    }

    function setSaveStatus(status) {
        state.saveStatus = status;
        var el = document.getElementById('peb-save-status');
        el.textContent = status === 'saved' ? 'Saved' :
            status === 'unsaved' ? 'Unsaved changes' :
                status === 'saving' ? 'Saving…' :
                    status === 'error' ? 'Save failed' : status;
        el.className = 'peb-save-status' +
            (status === 'unsaved' ? ' is-unsaved' : '') +
            (status === 'saving' ? ' is-saving' : '') +
            (status === 'error' ? ' is-error' : '');

        if (status === 'unsaved') {
            scheduleAutoSave();
        } else if (status === 'saving' || status === 'saved') {
            cancelAutoSave();
        }
    }

    function findSection(sectionId) {
        return (state.tree.sections || []).find(function (row) {
            return row.id === sectionId;
        }) || null;
    }

    function findBlock(blockId) {
        var sections = state.tree.sections || [];

        for (var i = 0; i < sections.length; i += 1) {
            var blocks = sections[i].blocks || [];

            for (var j = 0; j < blocks.length; j += 1) {
                if (blocks[j].id === blockId) {
                    return { section: sections[i], block: blocks[j] };
                }
            }
        }

        return null;
    }

    function nextSortOrder(items) {
        if (!items || !items.length) {
            return SORT_GAP;
        }

        return items.reduce(function (max, item) {
            return Math.max(max, item.sort_order || 0);
        }, 0) + SORT_GAP;
    }

    function select(type, id) {
        editHistoryCaptured = false;
        state.selected = { type: type || null, id: id || null };
        renderTree();
        renderInspector();
        highlightSelection();
    }

    function defaultBlock(type) {
        var map = {
            heading: { content: { text: 'Nova headline' }, settings: { level: 1, alignment: 'center' } },
            text: { content: { text: 'Novo parágrafo.' }, settings: { alignment: 'left' } },
            button: { content: { label: 'Quero saber mais', href: '#' }, settings: { variant: 'primary', alignment: 'center', target: '_self' } },
            image: { content: { src: '', alt: '' }, settings: { alignment: 'center', width: '100%' } },
            video: { content: { url: '' }, settings: { controls: true, autoplay: false, muted: false, aspectRatio: '16 / 9' } },
            spacer: { content: {}, settings: { height: '48px' } },
        };

        return Object.assign({
            type: type,
            sort_order: SORT_GAP,
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
        }, map[type] || map.heading);
    }

    function addSection(type) {
        pushHistory();
        var section = {
            id: tempId(),
            type: type || 'hero',
            sort_order: nextSortOrder(state.tree.sections),
            settings: { label: type || 'hero' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
            blocks: [],
        };
        state.tree.sections = state.tree.sections || [];
        state.tree.sections.push(section);
        select('section', section.id);
        scheduleRender();
    }

    function addBlock(sectionId, type) {
        var section = findSection(sectionId);

        if (!section) {
            return;
        }

        pushHistory();
        var block = defaultBlock(type);
        block.id = tempId();
        block.sort_order = nextSortOrder(section.blocks);
        section.blocks = section.blocks || [];
        section.blocks.push(block);
        select('block', block.id);
        scheduleRender();
    }

    function updateSelected(patch) {
        ensureEditHistory();

        if (state.selected.type === 'block') {
            var found = findBlock(state.selected.id);

            if (!found) {
                return;
            }

            if (patch.content) {
                found.block.content = Object.assign({}, found.block.content || {}, patch.content);
            }

            if (patch.settings) {
                found.block.settings = Object.assign({}, found.block.settings || {}, patch.settings);
            }

            if (patch.styles) {
                found.block.styles = Object.assign({}, found.block.styles || {}, patch.styles);
            }
        }

        if (state.selected.type === 'section') {
            var section = findSection(state.selected.id);

            if (!section) {
                return;
            }

            if (patch.settings) {
                section.settings = Object.assign({}, section.settings || {}, patch.settings);
            }

            if (patch.styles) {
                section.styles = Object.assign({}, section.styles || {}, patch.styles);
            }

            if (patch.visibility) {
                section.visibility = Object.assign({}, section.visibility || {}, patch.visibility);
            }
        }

        scheduleRender();
        renderInspector();
        markDirty();
    }

    function deleteSelected() {
        if (state.selected.type === 'block') {
            pushHistory();
            var found = findBlock(state.selected.id);

            if (!found) {
                return;
            }

            found.section.blocks = found.section.blocks.filter(function (row) {
                return row.id !== state.selected.id;
            });
            select(null, null);
            scheduleRender();
            return;
        }

        if (state.selected.type === 'section') {
            var section = findSection(state.selected.id);

            if (!section) {
                return;
            }

            if ((section.blocks || []).length > 0 &&
                !window.confirm('Esta section contém blocks. Apagar tudo?')) {
                return;
            }

            pushHistory();
            state.tree.sections = state.tree.sections.filter(function (row) {
                return row.id !== state.selected.id;
            });
            select(null, null);
            scheduleRender();
        }
    }

    function duplicateSelected() {
        if (state.selected.type === 'block') {
            var found = findBlock(state.selected.id);

            if (!found) {
                return;
            }

            pushHistory();
            var copy = cloneTree(found.block);
            copy.id = tempId();
            copy.sort_order = nextSortOrder(found.section.blocks);
            found.section.blocks.push(copy);
            select('block', copy.id);
            scheduleRender();
            return;
        }

        if (state.selected.type === 'section') {
            var section = findSection(state.selected.id);

            if (!section) {
                return;
            }

            pushHistory();
            var sectionCopy = cloneTree(section);
            sectionCopy.id = tempId();
            sectionCopy.sort_order = nextSortOrder(state.tree.sections);
            sectionCopy.blocks = (section.blocks || []).map(function (block) {
                var blockCopy = cloneTree(block);
                blockCopy.id = tempId();
                return blockCopy;
            });
            state.tree.sections.push(sectionCopy);
            select('section', sectionCopy.id);
            scheduleRender();
        }
    }

    function moveSelected(direction) {
        if (state.selected.type === 'section') {
            var sections = state.tree.sections.slice().sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
            });
            var index = sections.findIndex(function (row) { return row.id === state.selected.id; });
            var target = direction === 'up' ? index - 1 : index + 1;

            if (target < 0 || target >= sections.length) {
                return;
            }

            pushHistory();
            var tmp = sections[index].sort_order;
            sections[index].sort_order = sections[target].sort_order;
            sections[target].sort_order = tmp;
            scheduleRender();
            renderTree();
            return;
        }

        if (state.selected.type === 'block') {
            var found = findBlock(state.selected.id);

            if (!found) {
                return;
            }

            var blocks = found.section.blocks.slice().sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
            });
            var blockIndex = blocks.findIndex(function (row) { return row.id === state.selected.id; });
            var blockTarget = direction === 'up' ? blockIndex - 1 : blockIndex + 1;

            if (blockTarget < 0 || blockTarget >= blocks.length) {
                return;
            }

            pushHistory();
            var blockTmp = blocks[blockIndex].sort_order;
            blocks[blockIndex].sort_order = blocks[blockTarget].sort_order;
            blocks[blockTarget].sort_order = blockTmp;
            scheduleRender();
            renderTree();
        }
    }

    function undo() {
        if (!state.undoStack.length) {
            return;
        }

        state.redoStack.push(cloneTree(state.tree));
        state.tree = state.undoStack.pop();
        setSaveStatus('unsaved');
        renderAll();
    }

    function redo() {
        if (!state.redoStack.length) {
            return;
        }

        state.undoStack.push(cloneTree(state.tree));
        state.tree = state.redoStack.pop();
        setSaveStatus('unsaved');
        renderAll();
    }

    function reorderSectionsByIds(draggedId, targetId) {
        var sections = (state.tree.sections || []).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });
        var ids = sections.map(function (row) { return row.id; });
        var order = ids.filter(function (id) { return id !== draggedId; });
        var targetIndex = order.indexOf(targetId);

        if (targetIndex === -1) {
            return;
        }

        order.splice(targetIndex, 0, draggedId);
        pushHistory();

        var map = {};
        sections.forEach(function (section) { map[section.id] = section; });
        state.tree.sections = order.map(function (id, index) {
            map[id].sort_order = (index + 1) * SORT_GAP;
            return map[id];
        });
        setSaveStatus('unsaved');
        renderAll();
    }

    function reorderBlocksByIds(draggedId, sectionId, targetId) {
        var section = findSection(sectionId);

        if (!section) {
            return;
        }

        var blocks = (section.blocks || []).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });
        var ids = blocks.map(function (row) { return row.id; });
        var order = ids.filter(function (id) { return id !== draggedId; });
        var targetIndex = order.indexOf(targetId);

        if (targetIndex === -1) {
            return;
        }

        order.splice(targetIndex, 0, draggedId);
        pushHistory();

        var map = {};
        blocks.forEach(function (block) { map[block.id] = block; });
        section.blocks = order.map(function (id, index) {
            map[id].sort_order = (index + 1) * SORT_GAP;
            return map[id];
        });
        setSaveStatus('unsaved');
        renderAll();
    }

    function moveBlockToSection(draggedId, targetSectionId) {
        var found = findBlock(draggedId);
        var targetSection = findSection(targetSectionId);

        if (!found || !targetSection) {
            return;
        }

        pushHistory();
        var block = found.block;
        found.section.blocks = found.section.blocks.filter(function (row) {
            return row.id !== draggedId;
        });

        targetSection.blocks = targetSection.blocks || [];
        block.sort_order = nextSortOrder(targetSection.blocks.filter(function (row) {
            return row.id !== draggedId;
        }));
        targetSection.blocks.push(block);
        setSaveStatus('unsaved');
        renderAll();
    }

    function bindDragAndDrop() {
        if (!window.PebDnD) {
            return;
        }

        window.PebDnD.bindTree(document.getElementById('peb-tree'), {
            onReorderSection: reorderSectionsByIds,
            onReorderBlock: reorderBlocksByIds,
            onMoveBlockToSection: moveBlockToSection,
            onDropComponent: function (type, sectionId) {
                addBlock(sectionId, type);
            },
        });

        window.PebDnD.bindComponents(document.getElementById('peb-components'), {});
    }

    function renderTree() {
        var root = document.getElementById('peb-tree');
        var sections = (state.tree.sections || []).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });

        if (!sections.length) {
            root.innerHTML = '<p class="peb-empty">Sem sections.</p>';
            return;
        }

        root.innerHTML = sections.map(function (section) {
            var sectionSelected = state.selected.type === 'section' && state.selected.id === section.id;
            var blocks = (section.blocks || []).slice().sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
            });

            return '<div class="peb-tree-group">' +
                '<button type="button" class="peb-tree-item peb-tree-item--section' +
                (sectionSelected ? ' is-selected' : '') +
                '" data-select-type="section" data-select-id="' + section.id +
                '" data-draggable="true" data-drag-kind="section" data-drag-id="' + section.id +
                '" data-drop-target="true" data-drop-kind="section" data-drop-id="' + section.id + '">' +
                '<span class="peb-drag-handle">⋮⋮</span>' +
                (section.settings && section.settings.label || section.type) + '</button>' +
                blocks.map(function (block) {
                    var blockSelected = state.selected.type === 'block' && state.selected.id === block.id;
                    return '<button type="button" class="peb-tree-item peb-tree-item--block' +
                        (blockSelected ? ' is-selected' : '') +
                        '" data-select-type="block" data-select-id="' + block.id +
                        '" data-draggable="true" data-drag-kind="block" data-drag-id="' + block.id +
                        '" data-drag-section-id="' + section.id +
                        '" data-drop-target="true" data-drop-kind="block" data-drop-id="' + block.id +
                        '" data-drop-section-id="' + section.id + '">' +
                        '<span class="peb-drag-handle">⋮⋮</span>' + block.type + '</button>';
                }).join('') +
                '</div>';
        }).join('');

        root.querySelectorAll('[data-select-id]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                if (event.defaultPrevented) {
                    return;
                }
                select(button.getAttribute('data-select-type'), button.getAttribute('data-select-id'));
            });
        });

        bindDragAndDrop();
    }

    function renderComponents(components) {
        var root = document.getElementById('peb-components');
        root.innerHTML = (components || []).map(function (component) {
            return '<button type="button" class="peb-component" data-component-type="' + component.type + '">' +
                '<span class="peb-component__icon">' + component.icon + '</span>' +
                '<span><strong>' + component.label + '</strong><span>' + component.description + '</span></span>' +
                '</button>';
        }).join('');

        root.querySelectorAll('[data-component-type]').forEach(function (button) {
            button.addEventListener('click', function () {
                var sectionId = state.selected.type === 'section' ? state.selected.id :
                    (state.selected.type === 'block' ? findBlock(state.selected.id).section.id : null);

                if (!sectionId) {
                    var first = (state.tree.sections || [])[0];

                    if (!first) {
                        addSection('hero');
                        sectionId = state.tree.sections[0].id;
                    } else {
                        sectionId = first.id;
                    }
                }

                addBlock(sectionId, button.getAttribute('data-component-type'));
            });
        });
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderTemplates(templates) {
        var root = document.getElementById('peb-templates');
        var catalog = templates || state.templates;

        if (!catalog) {
            root.innerHTML = '<p class="peb-empty">Sem templates.</p>';
            return;
        }

        var pageHtml = (catalog.page_templates || []).map(function (template) {
            return '<button type="button" class="peb-template" data-template-id="' + template.id + '">' +
                '<strong>' + escapeHtml(template.label) + '</strong>' +
                '<span>' + escapeHtml(template.description) + '</span>' +
                '<span class="peb-template__meta">' + template.section_count + ' sections</span>' +
                '</button>';
        }).join('');

        var sectionHtml = (catalog.section_templates || []).map(function (template) {
            return '<button type="button" class="peb-template" data-template-id="' + template.id + '">' +
                '<strong>' + escapeHtml(template.label) + '</strong>' +
                '<span>' + escapeHtml(template.description) + '</span>' +
                '<span class="peb-template__meta">' + template.block_count + ' blocks</span>' +
                '</button>';
        }).join('');

        root.innerHTML =
            '<div class="peb-template-group"><h3>Page templates</h3>' +
            (pageHtml || '<p class="peb-empty">Sem page templates.</p>') +
            '</div>' +
            '<div class="peb-template-group"><h3>Section templates</h3>' +
            (sectionHtml || '<p class="peb-empty">Sem section templates.</p>') +
            '</div>';

        root.querySelectorAll('[data-template-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                applyTemplate(button.getAttribute('data-template-id'));
            });
        });
    }

    async function applyTemplate(templateId) {
        if (!templateId) {
            return;
        }

        try {
            var payload = await apiFetch('/api/sales-attribution?action=hub_page_template_materialize', {
                method: 'POST',
                body: { template_id: templateId },
            });

            var sections = payload.sections || [];

            if (!sections.length) {
                window.alert('Template vazio.');
                return;
            }

            pushHistory();
            state.tree.sections = state.tree.sections || [];

            sections.forEach(function (section) {
                section.sort_order = nextSortOrder(state.tree.sections);
                state.tree.sections.push(section);
            });

            var lastSection = sections[sections.length - 1];
            select('section', lastSection.id);
            renderAll();
        } catch (error) {
            window.alert('Não foi possível aplicar o template: ' + error.message);
        }
    }

    function formatRevisionDate(value) {
        if (!value) {
            return '';
        }

        try {
            return new Date(value).toLocaleString('pt-PT', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (error) {
            return String(value);
        }
    }

    function renderRevisions(rows) {
        var root = document.getElementById('peb-revisions');

        if (!root) {
            return;
        }

        var list = rows || [];

        if (!list.length) {
            root.innerHTML = '<p class="peb-empty">Sem versões guardadas ainda.</p>';
            return;
        }

        root.innerHTML = list.map(function (row) {
            var label = row.label || ('Revision #' + row.revision_number);
            var meta = formatRevisionDate(row.created_at) + ' · ' + row.source;

            return '<button type="button" class="peb-revision" data-revision-id="' + row.id + '">' +
                '<strong>#' + row.revision_number + ' ' + label + '</strong>' +
                '<span>' + meta + '</span>' +
                '</button>';
        }).join('');

        root.querySelectorAll('[data-revision-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                restoreRevision(button.getAttribute('data-revision-id'));
            });
        });
    }

    async function loadRevisions() {
        var root = document.getElementById('peb-revisions');

        if (!root || !state.slugs.offer) {
            return;
        }

        root.innerHTML = '<p class="peb-empty">A carregar histórico…</p>';

        try {
            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_page_revisions&offer=' +
                    encodeURIComponent(state.slugs.offer) + '&funnel=' +
                    encodeURIComponent(state.slugs.funnel) + '&page=' +
                    encodeURIComponent(state.slugs.page)
            );

            state.revisions = payload.revisions || [];
            renderRevisions(state.revisions);
        } catch (error) {
            root.innerHTML = '<p class="peb-empty">Não foi possível carregar histórico.</p>';
        }
    }

    async function restoreRevision(revisionId) {
        if (!revisionId) {
            return;
        }

        if (!window.confirm('Restaurar esta versão? O estado actual será guardado como snapshot antes do restore.')) {
            return;
        }

        try {
            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_page_revision_restore&offer=' +
                    encodeURIComponent(state.slugs.offer) + '&funnel=' +
                    encodeURIComponent(state.slugs.funnel) + '&page=' +
                    encodeURIComponent(state.slugs.page),
                {
                    method: 'POST',
                    body: {
                        revision_id: revisionId,
                        tree: state.tree,
                    },
                }
            );

            state.tree = payload.tree;
            state.baseline = cloneTree(payload.tree);
            state.undoStack = [];
            state.redoStack = [];
            state.selected = { type: null, id: null };
            setSaveStatus('saved');
            updatePublishUi();
            renderAll();
            loadRevisions();
        } catch (error) {
            window.alert('Restore failed: ' + error.message);
        }
    }

    function field(label, id, value, type) {
        var inputType = type || 'text';
        var safeValue = value == null ? '' : String(value);

        if (safeValue === 'undefined' || safeValue === 'null') {
            safeValue = '';
        }

        if (inputType === 'textarea') {
            return '<label for="' + id + '">' + label + '</label><textarea id="' + id + '" rows="4">' +
                safeValue + '</textarea>';
        }

        return '<label for="' + id + '">' + label + '</label><input id="' + id + '" type="' +
            inputType + '" value="' + safeValue.replace(/"/g, '&quot;') + '">';
    }

    function renderInspector() {
        var body = document.getElementById('peb-inspector-body');

        if (!state.selected.type) {
            body.innerHTML = '<p class="peb-empty">Selecciona uma section ou block.</p>';
            return;
        }

        if (state.selected.type === 'block') {
            var found = findBlock(state.selected.id);

            if (!found) {
                body.innerHTML = '<p class="peb-empty">Block não encontrado.</p>';
                return;
            }

            var block = found.block;
            var html = '<div class="peb-inspector__group"><h3>Content</h3>';

            if (block.type === 'heading') {
                html += field('Headline', 'peb-field-text', block.content && block.content.text, 'text');
                html += field('Level', 'peb-field-level', block.settings && block.settings.level || 1, 'number');
            } else if (block.type === 'text') {
                html += field('Text', 'peb-field-text', block.content && block.content.text, 'textarea');
            } else if (block.type === 'button') {
                html += field('Label', 'peb-field-label', block.content && block.content.label, 'text');
                html += field('Href', 'peb-field-href', block.content && block.content.href, 'text');
                html += field('Variant', 'peb-field-variant', block.settings && block.settings.variant || 'primary', 'text');
            } else if (block.type === 'image') {
                html += field('URL', 'peb-field-src', block.content && block.content.src, 'text');
                html += field('Alt', 'peb-field-alt', block.content && block.content.alt, 'text');
                html += field('Width', 'peb-field-width', block.settings && block.settings.width || '100%', 'text');
            } else if (block.type === 'video') {
                html += field('URL', 'peb-field-url', block.content && block.content.url, 'text');
                html += field('Aspect ratio', 'peb-field-aspect', block.settings && block.settings.aspectRatio || '16 / 9', 'text');
            } else if (block.type === 'spacer') {
                html += field('Height', 'peb-field-height', block.settings && block.settings.height || '48px', 'text');
            }

            html += '</div><div class="peb-inspector__group"><h3>Typography / layout</h3>';
            html += field('Alignment', 'peb-field-alignment', block.settings && block.settings.alignment || 'left', 'text');
            html += '</div><div class="peb-inspector__actions">' +
                '<button type="button" class="peb-button peb-button--ghost" id="peb-move-up">↑</button>' +
                '<button type="button" class="peb-button peb-button--ghost" id="peb-move-down">↓</button>' +
                '<button type="button" class="peb-button peb-button--ghost" id="peb-duplicate">Duplicate</button>' +
                '<button type="button" class="peb-button peb-button--ghost" id="peb-delete">Delete</button>' +
                '</div>';
            body.innerHTML = html;
            bindInspectorFields(block);
            return;
        }

        var section = findSection(state.selected.id);

        if (!section) {
            body.innerHTML = '<p class="peb-empty">Section não encontrada.</p>';
            return;
        }

        body.innerHTML =
            '<div class="peb-inspector__group"><h3>Section</h3>' +
            field('Label', 'peb-field-label', section.settings && section.settings.label || section.type, 'text') +
            field('Background', 'peb-field-bg', section.styles && section.styles.background || '', 'text') +
            field('Padding', 'peb-field-padding', section.styles && section.styles.padding || '', 'text') +
            field('Max width', 'peb-field-maxwidth', section.settings && section.settings.maxWidth || '', 'text') +
            '</div><div class="peb-inspector__actions">' +
            '<button type="button" class="peb-button peb-button--ghost" id="peb-add-block">+ Block</button>' +
            '<button type="button" class="peb-button peb-button--ghost" id="peb-move-up">↑</button>' +
            '<button type="button" class="peb-button peb-button--ghost" id="peb-move-down">↓</button>' +
            '<button type="button" class="peb-button peb-button--ghost" id="peb-duplicate">Duplicate</button>' +
            '<button type="button" class="peb-button peb-button--ghost" id="peb-delete">Delete</button>' +
            '</div>';

        bindSectionInspector(section);
    }

    function bindInspectorFields(block) {
        function onInput() {
            var patch = { content: {}, settings: {} };

            if (block.type === 'heading') {
                patch.content.text = document.getElementById('peb-field-text').value;
                patch.settings.level = parseInt(document.getElementById('peb-field-level').value, 10) || 1;
                patch.settings.alignment = document.getElementById('peb-field-alignment').value;
            } else if (block.type === 'text') {
                patch.content.text = document.getElementById('peb-field-text').value;
                patch.settings.alignment = document.getElementById('peb-field-alignment').value;
            } else if (block.type === 'button') {
                patch.content.label = document.getElementById('peb-field-label').value;
                patch.content.href = document.getElementById('peb-field-href').value;
                patch.settings.variant = document.getElementById('peb-field-variant').value;
                patch.settings.alignment = document.getElementById('peb-field-alignment').value;
            } else if (block.type === 'image') {
                patch.content.src = document.getElementById('peb-field-src').value;
                patch.content.alt = document.getElementById('peb-field-alt').value;
                patch.settings.width = document.getElementById('peb-field-width').value;
                patch.settings.alignment = document.getElementById('peb-field-alignment').value;
            } else if (block.type === 'video') {
                patch.content.url = document.getElementById('peb-field-url').value;
                patch.settings.aspectRatio = document.getElementById('peb-field-aspect').value;
            } else if (block.type === 'spacer') {
                patch.settings.height = document.getElementById('peb-field-height').value;
            }

            updateSelected(patch);
        }

        bodyInputs().forEach(function (input) {
            input.addEventListener('input', onInput);
        });

        bindInspectorActions();
    }

    function bindSectionInspector(section) {
        function onInput() {
            updateSelected({
                settings: {
                    label: document.getElementById('peb-field-label').value,
                    maxWidth: document.getElementById('peb-field-maxwidth').value,
                },
                styles: {
                    background: document.getElementById('peb-field-bg').value,
                    padding: document.getElementById('peb-field-padding').value,
                },
            });
        }

        bodyInputs().forEach(function (input) {
            input.addEventListener('input', onInput);
        });

        var addBlockBtn = document.getElementById('peb-add-block');

        if (addBlockBtn) {
            addBlockBtn.addEventListener('click', function () {
                addBlock(section.id, 'heading');
            });
        }

        bindInspectorActions();
    }

    function bodyInputs() {
        return Array.prototype.slice.call(
            document.getElementById('peb-inspector-body').querySelectorAll('input, textarea, select')
        );
    }

    function bindInspectorActions() {
        var up = document.getElementById('peb-move-up');
        var down = document.getElementById('peb-move-down');
        var dup = document.getElementById('peb-duplicate');
        var del = document.getElementById('peb-delete');

        if (up) {
            up.addEventListener('click', function () { moveSelected('up'); });
        }

        if (down) {
            down.addEventListener('click', function () { moveSelected('down'); });
        }

        if (dup) {
            dup.addEventListener('click', duplicateSelected);
        }

        if (del) {
            del.addEventListener('click', deleteSelected);
        }
    }

    function highlightSelection() {
        var canvas = document.getElementById('peb-canvas');
        canvas.querySelectorAll('.pe-builder-selected').forEach(function (node) {
            node.classList.remove('pe-builder-selected');
        });

        if (!state.selected.id) {
            return;
        }

        var selector = state.selected.type === 'section'
            ? '[data-section-id="' + state.selected.id + '"]'
            : '[data-block-id="' + state.selected.id + '"]';
        var target = canvas.querySelector(selector);

        if (target) {
            target.classList.add('pe-builder-selected');
        }
    }

    function bindCanvasSelection() {
        var canvas = document.getElementById('peb-canvas');

        canvas.addEventListener('click', function (event) {
            var blockNode = event.target.closest('[data-block-id]');

            if (blockNode) {
                select('block', blockNode.getAttribute('data-block-id'));
                event.preventDefault();
                return;
            }

            var sectionNode = event.target.closest('[data-section-id]');

            if (sectionNode) {
                select('section', sectionNode.getAttribute('data-section-id'));
            }
        });
    }

    async function renderCanvas() {
        var canvas = document.getElementById('peb-canvas');
        var errorEl = document.getElementById('peb-canvas-error');

        try {
            var payload = await apiFetch('/api/sales-attribution?action=hub_page_render', {
                method: 'POST',
                body: { tree: state.tree },
            });

            canvas.innerHTML = payload.html || '';
            errorEl.hidden = true;
            highlightSelection();
        } catch (error) {
            errorEl.hidden = false;
            errorEl.textContent = error.message;
        }
    }

    function scheduleRender() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(renderCanvas, 250);
    }

    function renderAll() {
        renderTree();
        renderInspector();
        scheduleRender();
        updateUndoButtons();
    }

    function updateUndoButtons() {
        document.getElementById('peb-undo').disabled = !state.undoStack.length;
        document.getElementById('peb-redo').disabled = !state.redoStack.length;
    }

    function updatePublishUi() {
        var status = (state.tree && state.tree.page && state.tree.page.status) || 'draft';
        var meta = document.getElementById('peb-page-meta');
        var publishBtn = document.getElementById('peb-publish');
        var liveBtn = document.getElementById('peb-live');

        meta.textContent = status;
        meta.className = status === 'published' ? 'peb-page-meta is-published' : 'peb-page-meta';

        if (publishBtn) {
            publishBtn.textContent = status === 'published' ? 'Unpublish' : 'Publish';
            publishBtn.classList.toggle('peb-button--published', status === 'published');
        }

        if (liveBtn) {
            liveBtn.hidden = status !== 'published' || !state.publicUrl;
        }
    }

    async function publishPage() {
        var currentStatus = (state.tree && state.tree.page && state.tree.page.status) || 'draft';
        var nextStatus = currentStatus === 'published' ? 'draft' : 'published';

        try {
            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_page_builder_publish&offer=' +
                    encodeURIComponent(state.slugs.offer) + '&funnel=' +
                    encodeURIComponent(state.slugs.funnel) + '&page=' +
                    encodeURIComponent(state.slugs.page),
                {
                    method: 'POST',
                    body: {
                        status: nextStatus,
                        baseline: state.baseline,
                        tree: state.tree,
                    },
                }
            );

            state.tree = payload.tree;
            state.baseline = cloneTree(payload.tree);
            state.previewUrl = payload.preview_url || state.previewUrl;
            state.publicUrl = payload.public_url || state.publicUrl;
            state.undoStack = [];
            state.redoStack = [];
            setSaveStatus('saved');
            updatePublishUi();
            renderAll();
            loadRevisions();
        } catch (error) {
            window.alert('Publish failed: ' + error.message);
        }
    }

    async function saveChanges(options) {
        var opts = options || {};

        if (state.saveStatus === 'saving') {
            if (opts.auto) {
                scheduleAutoSave();
            }

            return;
        }

        cancelAutoSave();
        setSaveStatus('saving');

        try {
            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_page_builder_save&offer=' +
                    encodeURIComponent(state.slugs.offer) + '&funnel=' +
                    encodeURIComponent(state.slugs.funnel) + '&page=' +
                    encodeURIComponent(state.slugs.page),
                {
                    method: 'POST',
                    body: {
                        baseline: state.baseline,
                        tree: state.tree,
                        create_revision: !opts.auto,
                    },
                }
            );

            state.tree = payload.tree;
            state.baseline = cloneTree(payload.tree);

            if (!opts.auto) {
                state.undoStack = [];
                state.redoStack = [];
                loadRevisions();
            }

            setSaveStatus('saved');

            if (opts.auto) {
                flashAutoSaved();
            }

            renderAll();
        } catch (error) {
            setSaveStatus('error');

            if (opts.auto) {
                scheduleAutoSave();
            } else {
                window.alert('Save failed: ' + error.message);
            }
        }
    }

    async function loadEditor() {
        var slugs = parseRoute();

        if (!slugs) {
            throw new Error('Rota inválida.');
        }

        state.slugs = slugs;

        var payload = await apiFetch(
            '/api/sales-attribution?action=hub_page_tree&offer=' +
                encodeURIComponent(slugs.offer) + '&funnel=' +
                encodeURIComponent(slugs.funnel) + '&page=' +
                encodeURIComponent(slugs.page)
        );

        state.meta = payload;
        state.tree = cloneTree(payload.tree);
        state.baseline = cloneTree(payload.tree);
        state.previewUrl = payload.preview_url || '';
        state.publicUrl = payload.public_url || '';

        document.getElementById('peb-page-name').textContent = payload.tree.page.name || slugs.page;
        updatePublishUi();
        document.getElementById('peb-back-hub').href = '/?offer=' + encodeURIComponent(slugs.offer) + '&module=funil';

        renderComponents(payload.components || []);
        state.templates = payload.templates || null;
        renderTemplates(state.templates);
        bindCanvasSelection();
        bindDragAndDrop();
        renderAll();
        loadRevisions();
        showLogin(false);
    }

    function setDevice(device) {
        state.device = device;
        var shell = document.getElementById('peb-canvas-shell');
        shell.className = 'peb-canvas-shell peb-canvas-shell--' + device;

        document.querySelectorAll('#peb-device-toggle button').forEach(function (button) {
            button.classList.toggle('is-active', button.getAttribute('data-device') === device);
        });
    }

    function applyAiTree(payload) {
        pushHistory();
        state.tree = cloneTree(payload.tree);

        if (payload.selected) {
            state.selected = {
                type: payload.selected.type || null,
                id: payload.selected.id || null,
            };
        }

        renderAll();
    }

    function applyScreenshotSections(sections, meta) {
        var rows = sections || [];

        if (!rows.length) {
            return;
        }

        pushHistory();
        state.tree.sections = state.tree.sections || [];

        rows.forEach(function (section) {
            section.sort_order = nextSortOrder(state.tree.sections);
            state.tree.sections.push(section);
        });

        var lastSection = rows[rows.length - 1];
        select('section', lastSection.id);
        renderAll();
        setSaveStatus('unsaved');
    }

    function bindChrome() {
        document.getElementById('peb-add-section').addEventListener('click', function () {
            addSection('hero');
        });

        document.getElementById('peb-save').addEventListener('click', saveChanges);
        document.getElementById('peb-publish').addEventListener('click', publishPage);
        document.getElementById('peb-preview').addEventListener('click', function () {
            if (state.previewUrl) {
                window.open(state.previewUrl, '_blank', 'noopener');
            }
        });
        document.getElementById('peb-live').addEventListener('click', function () {
            if (state.publicUrl) {
                window.open(state.publicUrl, '_blank', 'noopener');
            }
        });

        document.getElementById('peb-undo').addEventListener('click', undo);
        document.getElementById('peb-redo').addEventListener('click', redo);

        document.querySelectorAll('#peb-device-toggle button').forEach(function (button) {
            button.addEventListener('click', function () {
                setDevice(button.getAttribute('data-device'));
            });
        });

        document.getElementById('peb-ai').addEventListener('click', function () {
            if (window.PebAI) {
                window.PebAI.open();
            }
        });
    }

    if (window.PebAI) {
        window.PebAI.init({
            getState: function () {
                return {
                    tree: state.tree,
                    selected: state.selected,
                    slugs: state.slugs,
                    saveStatus: state.saveStatus,
                };
            },
            apiFetch: apiFetch,
            onApplyTree: applyAiTree,
            onReload: loadEditor,
            saveChanges: saveChanges,
        });
    }

    if (window.PebScreenshot) {
        window.PebScreenshot.init({
            getState: function () {
                return {
                    slugs: state.slugs,
                };
            },
            apiFetch: apiFetch,
            onApplySections: applyScreenshotSections,
        });
    }

    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        loginError.hidden = true;

        try {
            setToken(passwordInput.value.trim());
            await apiFetch('/api/sales-attribution?action=hub_health');
            await loadEditor();
        } catch (error) {
            loginError.hidden = false;
            loginError.textContent = error.message;
        }
    });

    bindChrome();

    window.addEventListener('beforeunload', function (event) {
        if (state.saveStatus === 'unsaved' || state.saveStatus === 'saving') {
            event.preventDefault();
            event.returnValue = '';
        }
    });

    if (getToken()) {
        loadEditor().catch(function (error) {
            showLogin(true);

            if (error && error.message && error.message !== 'Palavra-passe incorrecta.') {
                loginError.hidden = false;
                loginError.textContent = error.message;
            }
        });
    } else {
        showLogin(true);
    }
})();
