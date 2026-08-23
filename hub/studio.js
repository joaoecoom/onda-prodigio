(function () {
    'use strict';

    var TOKEN_KEY = 'onda-metrics-token';

    var appSection = document.getElementById('studio-app');
    var statusEl = document.getElementById('studio-status');

    var state = {
        offer: '',
        funnel: '',
        page: '',
        offerId: '',
        pageId: '',
        pageName: '',
        pageType: 'sales',
        previewUrl: '',
        tree: { sections: [] },
        baselineTree: null,
        undoStack: [],
        redoStack: [],
        requestVersion: 0,
        selected: { type: null, id: null },
        savedBlocks: [],
        device: 'desktop',
        previewPollTimer: null,
        previewFingerprint: '',
    };

    function getToken() {
        var local = localStorage.getItem(TOKEN_KEY);

        if (local) {
            return local;
        }

        var session = sessionStorage.getItem(TOKEN_KEY);

        if (session) {
            localStorage.setItem(TOKEN_KEY, session);
            return session;
        }

        return '';
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
    }

    function redirectToHub(reason) {
        var params = new URLSearchParams();

        if (state.offer) {
            params.set('offer', state.offer);
            params.set('module', 'funil');
        }

        if (reason) {
            params.set('studio_error', String(reason).slice(0, 120));
        }

        var query = params.toString();
        window.location.replace('/hub/' + (query ? '?' + query : ''));
    }

    function parseRoute() {
        var parts = window.location.pathname.split('/').filter(Boolean);

        if (parts[0] !== 'studio' || parts.length < 4) {
            return null;
        }

        return {
            offer: decodeURIComponent(parts[1]),
            funnel: decodeURIComponent(parts[2]),
            page: decodeURIComponent(parts[3]),
        };
    }

    function parseQuery() {
        var params = new URLSearchParams(window.location.search);

        return {
            name: params.get('name') || '',
            type: params.get('type') || 'sales',
            prompt: params.get('prompt') || '',
        };
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
            clearToken();
            redirectToHub('sessao');
            throw new Error('Sessão expirada — volta a entrar no HUB.');
        }

        if (!response.ok) {
            throw new Error(payload.error || 'Pedido falhou.');
        }

        return payload;
    }

    function showStatus(message, isError) {
        if (!statusEl) {
            return;
        }

        if (!message) {
            statusEl.hidden = true;
            statusEl.textContent = '';
            statusEl.classList.remove('is-error');
            return;
        }

        statusEl.hidden = false;
        statusEl.textContent = message;
        statusEl.classList.toggle('is-error', Boolean(isError));
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveOpenPreviewUrl(url) {
        var base = String(url || state.previewUrl || '').trim();

        if (!base) {
            return '';
        }

        try {
            return new URL(base, window.location.origin).href;
        } catch (error) {
            return base;
        }
    }

    function syncOpenPreviewLinks(url) {
        var href = resolveOpenPreviewUrl(url || state.previewUrl);
        var openPreviewBtn = document.getElementById('studio-open-preview');
        var openPreviewInline = document.getElementById('studio-open-preview-inline');

        [openPreviewBtn, openPreviewInline].forEach(function (el) {
            if (!el) {
                return;
            }
            if (href) {
                el.href = href;
                el.removeAttribute('aria-disabled');
            } else {
                el.href = '#';
                el.setAttribute('aria-disabled', 'true');
            }
        });
    }

    function openPreviewWindow(event) {
        var url = resolveOpenPreviewUrl(state.previewUrl);

        if (!url) {
            if (event) {
                event.preventDefault();
            }
            showStatus('Preview ainda não disponível.', true);
            return;
        }

        // Native <a target=_blank> click is not blocked. Only intercept if href missing.
        syncOpenPreviewLinks(url);
    }

    function treeFingerprint(tree) {
        var sections = (tree && tree.sections) || [];
        return sections.map(function (section) {
            var blocks = section.blocks || [];
            return [
                section.id,
                section.sort_order,
                section.updated_at || '',
                (section.styles && JSON.stringify(section.styles)) || '',
                blocks.map(function (block) {
                    return block.id + ':' + (block.updated_at || '') + ':' +
                        String((block.content && block.content.html) || '').length;
                }).join(','),
            ].join('|');
        }).join('::');
    }

    function refreshPreview(url, options) {
        var opts = options || {};
        var iframe = document.getElementById('studio-preview-iframe');
        var empty = document.getElementById('studio-preview-empty');
        var frame = document.getElementById('studio-preview-frame');
        var label = document.getElementById('studio-preview-label');

        if (!url) {
            if (frame) {
                frame.classList.remove('has-preview');
            }
            iframe.removeAttribute('src');
            if (empty) {
                empty.hidden = false;
            }
            if (label) {
                label.textContent = '';
                label.removeAttribute('href');
            }
            syncOpenPreviewLinks('');
            return;
        }

        if (frame) {
            frame.classList.add('has-preview');
        }
        if (empty) {
            empty.hidden = true;
        }

        var nextSrc = url + (url.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();
        var currentBase = String(iframe.getAttribute('data-preview-base') || '');

        // Soft refresh (AI poll): skip full iframe reload when URL unchanged.
        if (opts.soft && currentBase === url && iframe.getAttribute('src')) {
            syncOpenPreviewLinks(url);
            if (label) {
                label.textContent = url;
                label.href = resolveOpenPreviewUrl(url);
            }
            return;
        }

        iframe.onload = function () {
            if (empty) {
                empty.hidden = true;
            }
        };

        iframe.setAttribute('data-preview-base', url);
        iframe.src = nextSrc;

        if (label) {
            label.textContent = url;
            label.href = resolveOpenPreviewUrl(url);
        }
        syncOpenPreviewLinks(url);
    }

    async function pollPreviewForChanges() {
        if (!state.offer || !state.funnel || !state.page) {
            return;
        }

        try {
            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_page_tree&offer=' +
                    encodeURIComponent(state.offer) + '&funnel=' + encodeURIComponent(state.funnel) +
                    '&page=' + encodeURIComponent(state.page)
            );
            var nextTree = payload.tree || { sections: [] };
            var nextFp = treeFingerprint(nextTree);

            if (nextFp !== state.previewFingerprint) {
                state.previewFingerprint = nextFp;
                state.tree = nextTree;
                state.baselineTree = cloneTree(nextTree);
                renderBlocks();
                if (payload.preview_url) {
                    state.previewUrl = payload.preview_url;
                }
                refreshPreview(state.previewUrl, { force: true });
            }
        } catch (error) {
            // Keep polling quietly — AI may still be writing.
        }
    }

    function startPreviewPoll() {
        stopPreviewPoll();
        state.previewFingerprint = treeFingerprint(state.tree);
        // Poll tree (cheap) instead of reloading the iframe every 4s (2–5s each).
        state.previewPollTimer = window.setInterval(function () {
            pollPreviewForChanges();
        }, 2500);
    }

    function stopPreviewPoll() {
        if (state.previewPollTimer) {
            window.clearInterval(state.previewPollTimer);
            state.previewPollTimer = null;
        }
    }

    async function saveEmptyPage() {
        var baseline = JSON.parse(JSON.stringify(state.tree));
        var working = JSON.parse(JSON.stringify(state.tree));
        working.sections = [];

        await apiFetch(
            '/api/sales-attribution?action=hub_page_builder_save&offer=' +
                encodeURIComponent(state.offer) + '&funnel=' + encodeURIComponent(state.funnel) +
                '&page=' + encodeURIComponent(state.page),
            {
                method: 'POST',
                body: {
                    offer: state.offer,
                    funnel: state.funnel,
                    page: state.page,
                    baseline: baseline,
                    tree: working,
                },
            }
        );

        state.tree = working;
        state.baselineTree = cloneTree(working);
        state.selected = { type: null, id: null };
        renderBlocks();
        updateSaveButton();
        refreshPreview(state.previewUrl);
    }

    function updateChrome(meta) {
        if (meta && meta.name) {
            state.pageName = meta.name;
        }

        document.getElementById('studio-page-name').textContent = state.pageName || state.page || 'Page';
        document.getElementById('studio-page-meta').textContent =
            (meta && meta.status ? meta.status : 'draft') + ' · Construtor inteligente';
    }

    function cloneTree(tree) {
        return JSON.parse(JSON.stringify(tree));
    }

    function pushUndo() {
        state.undoStack.push(cloneTree(state.tree));

        if (state.undoStack.length > 50) {
            state.undoStack.shift();
        }

        state.redoStack = [];
        updateUndoButtons();
    }

    function applyTree(nextTree, options) {
        var opts = options || {};

        if (!opts.skipUndo) {
            pushUndo();
        }

        state.tree = nextTree;
        state.baselineTree = cloneTree(nextTree);
        renderBlocks();
        updateSaveButton();
    }

    async function persistTree(tree) {
        if (!state.pageId) {
            await loadTree();
        }

        if (!state.pageId) {
            throw new Error('Page ainda não carregada — actualiza o preview e tenta outra vez.');
        }

        if (!state.baselineTree) {
            state.baselineTree = cloneTree({ sections: [] });
        }

        var payload = await apiFetch(
            '/api/sales-attribution?action=hub_page_builder_save&offer=' +
                encodeURIComponent(state.offer) + '&funnel=' + encodeURIComponent(state.funnel) +
                '&page=' + encodeURIComponent(state.page),
            {
                method: 'POST',
                body: {
                    offer: state.offer,
                    funnel: state.funnel,
                    page: state.page,
                    baseline: state.baselineTree,
                    tree: tree,
                },
            }
        );

        var savedTree = payload.tree || tree;
        state.tree = savedTree;
        state.baselineTree = cloneTree(savedTree);
        return savedTree;
    }

    async function syncAfterMutationError(error) {
        showStatus(error.message || 'Falha ao guardar — a sincronizar…', true);
        try {
            await loadTree();
            refreshPreview(state.previewUrl);
        } catch (reloadError) {
            showStatus(reloadError.message, true);
        }
    }

    function nextTempId() {
        return 'tmp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    }

    function nextSortOrder(items) {
        var max = 0;
        (items || []).forEach(function (item) {
            max = Math.max(max, Number(item.sort_order) || 0);
        });
        return max + 100;
    }

    async function addStudioBlock() {
        pushUndo();

        var sections = (state.tree.sections || []).slice();
        var sectionId = nextTempId();
        var blockId = nextTempId();
        var index = sections.length;
        var section = {
            id: sectionId,
            type: 'custom',
            sort_order: nextSortOrder(sections),
            settings: { label: 'Bloco ' + (index + 1) },
            styles: {
                backgroundColor: '#000000',
                padding: '40px 20px',
            },
            visibility: { desktop: true, tablet: true, mobile: true },
            blocks: [{
                id: blockId,
                type: 'heading',
                sort_order: 100,
                content: { text: 'Novo bloco — descreve o conteúdo no chat' },
                settings: { level: 1, alignment: 'center' },
                styles: {},
                visibility: { desktop: true, tablet: true, mobile: true },
            }],
        };

        var previousTree = cloneTree(state.tree);
        state.tree = Object.assign({}, state.tree, {
            sections: sections.concat([section]),
        });
        state.selected = { type: 'section', id: sectionId };
        renderBlocks();
        updateSaveButton();

        try {
            showStatus('A acrescentar bloco…');
            await persistTree(state.tree);
            var sorted = (state.tree.sections || []).slice().sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
            });
            var created = sorted[sorted.length - 1];
            if (created) {
                state.selected = { type: 'section', id: created.id };
            }
            renderBlocks();
            updateUndoButtons();
            updateSaveButton();
            refreshPreview(state.previewUrl);
            showStatus('Bloco acrescentado.');
            window.setTimeout(function () { showStatus(''); }, 2000);
        } catch (error) {
            state.tree = previousTree;
            state.selected = { type: null, id: null };
            await syncAfterMutationError(error);
        }
    }

    async function deleteStudioBlock(sectionId) {
        var section = findSection(sectionId);

        if (!section) {
            return;
        }

        var sections = state.tree.sections || [];
        var index = sections.findIndex(function (row) { return row.id === sectionId; });
        var name = blockDisplayName(section, index >= 0 ? index : 0);

        if (!window.confirm('Eliminar «' + name + '»?')) {
            return;
        }

        var previousTree = cloneTree(state.tree);
        pushUndo();
        state.tree = Object.assign({}, state.tree, {
            sections: sections.filter(function (row) {
                return row.id !== sectionId;
            }),
        });

        if (state.selected.id === sectionId) {
            state.selected = { type: null, id: null };
        }

        renderBlocks();
        updateSaveButton();

        try {
            showStatus('A eliminar bloco…');
            await persistTree(state.tree);
            renderBlocks();
            updateUndoButtons();
            updateSaveButton();
            refreshPreview(state.previewUrl);
            showStatus('Bloco eliminado.');
            window.setTimeout(function () { showStatus(''); }, 2000);
        } catch (error) {
            state.tree = previousTree;
            await syncAfterMutationError(error);
        }
    }

    async function reorderStudioBlocks(orderedIds) {
        if (!orderedIds || !orderedIds.length) {
            return;
        }

        var map = {};
        (state.tree.sections || []).forEach(function (section) {
            map[section.id] = section;
        });

        var reordered = [];
        for (var i = 0; i < orderedIds.length; i += 1) {
            var section = map[orderedIds[i]];
            if (!section) {
                return;
            }
            reordered.push(Object.assign({}, section, {
                sort_order: (i + 1) * 100,
            }));
        }

        var previousTree = cloneTree(state.tree);
        pushUndo();
        state.tree = Object.assign({}, state.tree, { sections: reordered });
        renderBlocks();

        try {
            showStatus('A reordenar…');
            await persistTree(state.tree);
            renderBlocks();
            updateUndoButtons();
            refreshPreview(state.previewUrl);
            showStatus('Ordem actualizada.');
            window.setTimeout(function () { showStatus(''); }, 1500);
        } catch (error) {
            state.tree = previousTree;
            await syncAfterMutationError(error);
        }
    }

    async function undo() {
        if (!state.undoStack.length) {
            return;
        }

        state.redoStack.push(cloneTree(state.tree));
        state.tree = state.undoStack.pop();

        try {
            showStatus('A desfazer…');
            await persistTree(state.tree);
            renderBlocks();
            updateUndoButtons();
            refreshPreview(state.previewUrl);
            showStatus('Alteração desfeita.');
            window.setTimeout(function () { showStatus(''); }, 2000);
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    async function redo() {
        if (!state.redoStack.length) {
            return;
        }

        state.undoStack.push(cloneTree(state.tree));
        state.tree = state.redoStack.pop();

        try {
            showStatus('A refazer…');
            await persistTree(state.tree);
            renderBlocks();
            updateUndoButtons();
            refreshPreview(state.previewUrl);
            showStatus('Alteração refeita.');
            window.setTimeout(function () { showStatus(''); }, 2000);
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    function updateUndoButtons() {
        var undoBtn = document.getElementById('studio-undo');
        var redoBtn = document.getElementById('studio-redo');

        if (undoBtn) {
            undoBtn.disabled = !state.undoStack.length;
        }

        if (redoBtn) {
            redoBtn.disabled = !state.redoStack.length;
        }
    }

    function buildPageSummary() {
        var sections = (state.tree.sections || []).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });

        return sections.map(function (section, index) {
            return {
                alias: 'block_' + String(index + 1).padStart(2, '0'),
                id: section.id,
                label: section.settings && section.settings.label,
                type: section.type,
            };
        });
    }

    function findSection(sectionId) {
        return (state.tree.sections || []).find(function (row) {
            return row.id === sectionId;
        });
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

    function blockDisplayName(section, index) {
        var label = section.settings && section.settings.label;
        var fallback = 'Bloco ' + (index + 1);

        if (!label) {
            return fallback;
        }

        var trimmed = String(label).trim();

        if (/^(hero|benefits|cta|faq|social_proof|custom)$/i.test(trimmed)) {
            return fallback;
        }

        if (/^bloco\s*\d+$/i.test(trimmed)) {
            return fallback;
        }

        return trimmed;
    }

    function updateSaveButton() {
        var saveBtn = document.getElementById('studio-save-block');

        if (saveBtn) {
            saveBtn.disabled = state.selected.type !== 'section';
        }
    }

    function selectBlock(sectionId) {
        state.selected = { type: 'section', id: sectionId };
        renderBlocks();
        updateSaveButton();
    }

    async function renameStudioBlock(sectionId, nextName) {
        var section = findSection(sectionId);

        if (!section) {
            return;
        }

        var sections = state.tree.sections || [];
        var index = sections.findIndex(function (row) { return row.id === sectionId; });
        var fallback = 'Bloco ' + (index >= 0 ? index + 1 : 1);
        var trimmed = String(nextName || '').trim().slice(0, 80);

        if (!trimmed) {
            trimmed = fallback;
        }

        var current = blockDisplayName(section, index >= 0 ? index : 0);

        if (trimmed === current && (section.settings && section.settings.label) === trimmed) {
            return;
        }

        var previousTree = cloneTree(state.tree);
        pushUndo();
        state.tree = Object.assign({}, state.tree, {
            sections: sections.map(function (row) {
                if (row.id !== sectionId) {
                    return row;
                }

                return Object.assign({}, row, {
                    settings: Object.assign({}, row.settings || {}, { label: trimmed }),
                });
            }),
        });
        state.selected = { type: 'section', id: sectionId };
        renderBlocks();
        updateSaveButton();

        try {
            showStatus('A renomear…');
            await persistTree(state.tree);
            renderBlocks();
            updateUndoButtons();
            updateSaveButton();
            showStatus('Bloco renomeado.');
            window.setTimeout(function () { showStatus(''); }, 1500);
        } catch (error) {
            state.tree = previousTree;
            await syncAfterMutationError(error);
        }
    }

    function startRenameBlock(sectionId, labelEl) {
        var section = findSection(sectionId);

        if (!section || !labelEl || labelEl.getAttribute('data-editing') === '1') {
            return;
        }

        var sections = state.tree.sections || [];
        var index = sections.findIndex(function (row) { return row.id === sectionId; });
        var current = blockDisplayName(section, index >= 0 ? index : 0);
        var input = document.createElement('input');

        labelEl.setAttribute('data-editing', '1');
        input.className = 'studio-block-card__name-input';
        input.type = 'text';
        input.value = current;
        input.maxLength = 80;
        input.setAttribute('aria-label', 'Nome do bloco');
        labelEl.replaceWith(input);
        input.focus();
        input.select();

        var finished = false;

        function finish(save) {
            if (finished) {
                return;
            }

            finished = true;
            var value = input.value;

            if (save) {
                renameStudioBlock(sectionId, value);
            } else {
                renderBlocks();
            }
        }

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                finish(true);
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
            }
        });

        input.addEventListener('blur', function () {
            finish(true);
        });
    }

    function renderBlocks() {
        var root = document.getElementById('studio-blocks');
        var sections = (state.tree.sections || []).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });

        if (!root) {
            return;
        }

        if (!sections.length) {
            root.innerHTML = '<p class="studio-empty">Ainda sem blocos.<br>Clica <strong>＋ Acrescentar bloco</strong> ou descreve no chat.</p>';
            return;
        }

        root.innerHTML = sections.map(function (section, index) {
            var selected = state.selected.type === 'section' && state.selected.id === section.id;
            var blockCount = (section.blocks || []).length;

            return '<div class="studio-block-card' + (selected ? ' is-selected' : '') +
                '" data-section-id="' + escapeHtml(section.id) + '" draggable="false">' +
                '<button type="button" class="studio-block-card__handle" data-drag-handle title="Arrastar para reordenar" aria-label="Arrastar">⠿</button>' +
                '<span class="studio-block-card__index">' + (index + 1) + '</span>' +
                '<button type="button" class="studio-block-card__body" data-select-block title="Clica para seleccionar · Duplo-clique no nome para renomear">' +
                    '<strong data-rename-label>' + escapeHtml(blockDisplayName(section, index)) + '</strong>' +
                    '<span>' + blockCount + ' elemento' + (blockCount === 1 ? '' : 's') + '</span>' +
                '</button>' +
                '<button type="button" class="studio-block-card__rename" data-rename-block title="Renomear bloco" aria-label="Renomear">✎</button>' +
                '<button type="button" class="studio-block-card__delete" data-delete-block title="Eliminar bloco" aria-label="Eliminar">✕</button>' +
                '</div>';
        }).join('');

        bindBlockListInteractions(root);
    }

    function bindBlockListInteractions(root) {
        var dragSectionId = null;

        root.querySelectorAll('[data-select-block]').forEach(function (button) {
            button.addEventListener('click', function () {
                var card = button.closest('[data-section-id]');
                selectBlock(card.getAttribute('data-section-id'));
            });
        });

        root.querySelectorAll('[data-rename-label]').forEach(function (label) {
            label.addEventListener('dblclick', function (event) {
                event.preventDefault();
                event.stopPropagation();
                var card = label.closest('[data-section-id]');
                startRenameBlock(card.getAttribute('data-section-id'), label);
            });
        });

        root.querySelectorAll('[data-rename-block]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.stopPropagation();
                var card = button.closest('[data-section-id]');
                var label = card.querySelector('[data-rename-label]');
                startRenameBlock(card.getAttribute('data-section-id'), label);
            });
        });

        root.querySelectorAll('[data-delete-block]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.stopPropagation();
                var card = button.closest('[data-section-id]');
                deleteStudioBlock(card.getAttribute('data-section-id'));
            });
        });

        root.querySelectorAll('[data-drag-handle]').forEach(function (handle) {
            handle.addEventListener('mousedown', function () {
                var card = handle.closest('[data-section-id]');
                if (card) {
                    card.setAttribute('draggable', 'true');
                }
            });

            handle.addEventListener('mouseup', function () {
                var card = handle.closest('[data-section-id]');
                if (card) {
                    card.setAttribute('draggable', 'false');
                }
            });
        });

        root.querySelectorAll('.studio-block-card').forEach(function (card) {
            card.addEventListener('dragstart', function (event) {
                dragSectionId = card.getAttribute('data-section-id');
                card.classList.add('is-dragging');
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', dragSectionId);
            });

            card.addEventListener('dragend', function () {
                card.classList.remove('is-dragging');
                card.setAttribute('draggable', 'false');
                root.querySelectorAll('.is-drag-over').forEach(function (row) {
                    row.classList.remove('is-drag-over');
                });
                dragSectionId = null;
            });

            card.addEventListener('dragover', function (event) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (card.getAttribute('data-section-id') !== dragSectionId) {
                    card.classList.add('is-drag-over');
                }
            });

            card.addEventListener('dragleave', function () {
                card.classList.remove('is-drag-over');
            });

            card.addEventListener('drop', function (event) {
                event.preventDefault();
                card.classList.remove('is-drag-over');

                var fromId = dragSectionId || event.dataTransfer.getData('text/plain');
                var toId = card.getAttribute('data-section-id');

                if (!fromId || !toId || fromId === toId) {
                    return;
                }

                var ids = (state.tree.sections || []).slice()
                    .sort(function (a, b) {
                        return (a.sort_order || 0) - (b.sort_order || 0);
                    })
                    .map(function (row) { return row.id; });

                var fromIndex = ids.indexOf(fromId);
                var toIndex = ids.indexOf(toId);

                if (fromIndex < 0 || toIndex < 0) {
                    return;
                }

                ids.splice(fromIndex, 1);
                ids.splice(toIndex, 0, fromId);
                reorderStudioBlocks(ids);
            });
        });
    }

    function renderLibrary() {
        var root = document.getElementById('studio-library');
        var blocks = state.savedBlocks || [];

        if (!blocks.length) {
            root.innerHTML = '<p class="studio-empty">Guarda secções, popups ou scripts com 💾 Guardar bloco.</p>';
            return;
        }

        root.innerHTML = blocks.map(function (block) {
            var scopeLabel = block.offer_id ? 'Esta oferta' : 'Global';
            return '<article class="studio-library-item" data-block-id="' + escapeHtml(block.id) + '">' +
                '<div class="studio-library-item__head">' +
                    '<strong>' + escapeHtml(block.name) + '</strong>' +
                    '<span class="studio-library-item__kind">' + escapeHtml(block.kind) + '</span>' +
                '</div>' +
                '<span class="studio-library-item__meta">' + escapeHtml(scopeLabel) + '</span>' +
                '<div class="studio-library-item__actions">' +
                    '<button type="button" data-action="apply">Inserir</button>' +
                    '<button type="button" data-action="delete" class="studio-library-item__delete">Eliminar</button>' +
                '</div>' +
            '</article>';
        }).join('');

        root.querySelectorAll('[data-action="apply"]').forEach(function (button) {
            button.addEventListener('click', function () {
                var item = button.closest('[data-block-id]');
                applySavedBlock(item.getAttribute('data-block-id'));
            });
        });

        root.querySelectorAll('[data-action="delete"]').forEach(function (button) {
            button.addEventListener('click', function () {
                var item = button.closest('[data-block-id]');
                deleteSavedBlock(item.getAttribute('data-block-id'));
            });
        });
    }

    async function loadTree() {
        var payload = await apiFetch(
            '/api/sales-attribution?action=hub_page_tree&offer=' +
                encodeURIComponent(state.offer) + '&funnel=' + encodeURIComponent(state.funnel) +
                '&page=' + encodeURIComponent(state.page)
        );

        state.offerId = payload.offer && payload.offer.id;
        state.tree = payload.tree || { sections: [] };
        state.baselineTree = cloneTree(state.tree);
        state.pageId = payload.tree && payload.tree.page && payload.tree.page.id;

        if (payload.preview_url) {
            state.previewUrl = payload.preview_url;
        }

        // Soft: avoid restarting iframe if boot already kicked off the same URL.
        refreshPreview(state.previewUrl, { soft: true });

        renderBlocks();
        updateUndoButtons();
    }

    async function clearPage() {
        var sections = state.tree.sections || [];

        if (!sections.length) {
            showStatus('Page já está vazia.');
            window.setTimeout(function () { showStatus(''); }, 2000);
            return;
        }

        if (!window.confirm('Apagar todos os blocos desta page e começar do zero?')) {
            return;
        }

        try {
            showStatus('A limpar page…');
            await saveEmptyPage();
            showStatus('Page limpa — constrói bloco a bloco.');
            window.setTimeout(function () { showStatus(''); }, 2500);
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    async function loadSavedBlocks() {
        var payload = await apiFetch(
            '/api/sales-attribution?action=hub_saved_blocks_list&offer=' +
                encodeURIComponent(state.offer)
        );

        state.savedBlocks = payload.blocks || [];
        renderLibrary();
    }

    async function loadPageMeta() {
        var payload = await apiFetch(
            '/api/sales-attribution?action=hub_page_list&offer=' +
                encodeURIComponent(state.offer) + '&funnel=' + encodeURIComponent(state.funnel)
        );

        var pages = payload.pages || [];
        var page = pages.find(function (row) {
            return row.slug === state.page;
        });

        if (!page) {
            throw new Error('Page não encontrada.');
        }

        state.pageName = page.name;
        state.previewUrl = page.preview_url || (
            '/preview/' + encodeURIComponent(state.offer) + '/' +
            encodeURIComponent(state.funnel) + '/' + encodeURIComponent(state.page) + '?preview=1'
        );

        updateChrome(page);
    }

    async function applySavedBlock(blockId) {
        try {
            showStatus('A inserir bloco…');

            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_saved_blocks_apply&offer=' +
                    encodeURIComponent(state.offer) + '&funnel=' + encodeURIComponent(state.funnel) +
                    '&page=' + encodeURIComponent(state.page),
                {
                    method: 'POST',
                    body: {
                        offer: state.offer,
                        funnel: state.funnel,
                        page: state.page,
                        block_id: blockId,
                    },
                }
            );

            state.tree = payload.tree || state.tree;
            renderBlocks();
            refreshPreview(state.previewUrl);
            showStatus('Bloco inserido.');
            setTimeout(function () { showStatus(''); }, 2000);
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    async function deleteSavedBlock(blockId) {
        var saved = state.savedBlocks.find(function (row) {
            return row.id === blockId;
        });
        var confirmMsg = saved && !saved.offer_id
            ? 'Eliminar bloco global da biblioteca?'
            : 'Eliminar este bloco da biblioteca?';

        if (!window.confirm(confirmMsg)) {
            return;
        }

        try {
            showStatus('A eliminar…');

            await apiFetch('/api/sales-attribution?action=hub_saved_blocks_delete', {
                method: 'POST',
                body: {
                    offer: state.offer,
                    block_id: blockId,
                },
            });

            await loadSavedBlocks();
            showStatus('Bloco eliminado.');
            setTimeout(function () { showStatus(''); }, 2000);
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    function openSaveDialog() {
        var section = findSection(state.selected.id);

        if (!section || state.selected.type !== 'section') {
            return;
        }

        var sections = (state.tree.sections || []).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });
        var index = sections.findIndex(function (row) {
            return row.id === section.id;
        });
        var kindSelect = document.getElementById('studio-save-kind');
        var nameInput = document.getElementById('studio-save-name');
        var dialog = document.getElementById('studio-save-dialog');

        nameInput.value = blockDisplayName(section, index >= 0 ? index : 0);
        kindSelect.value = 'section';
        dialog.showModal();
        nameInput.focus();
        nameInput.select();
    }

    async function submitSaveBlock(event) {
        event.preventDefault();

        var section = findSection(state.selected.id);

        if (!section || state.selected.type !== 'section') {
            return;
        }

        var name = document.getElementById('studio-save-name').value.trim();
        var kind = document.getElementById('studio-save-kind').value;
        var isGlobal = document.getElementById('studio-save-global').checked;

        try {
            showStatus('A guardar bloco…');

            await apiFetch('/api/sales-attribution?action=hub_saved_blocks_save', {
                method: 'POST',
                body: {
                    offer: state.offer,
                    name: name,
                    kind: kind,
                    global: isGlobal,
                    section: section,
                },
            });

            document.getElementById('studio-save-dialog').close();
            await loadSavedBlocks();
            showStatus('Bloco guardado na biblioteca.');
            setTimeout(function () { showStatus(''); }, 2500);
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    function bindSidebar() {
        document.querySelectorAll('.studio-sidebar__tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                var target = tab.getAttribute('data-tab');

                document.querySelectorAll('.studio-sidebar__tab').forEach(function (row) {
                    row.classList.toggle('is-active', row === tab);
                    row.setAttribute('aria-selected', row === tab ? 'true' : 'false');
                });

                document.querySelectorAll('.studio-sidebar__panel').forEach(function (panel) {
                    var active = panel.getAttribute('data-panel') === target;
                    panel.classList.toggle('is-active', active);
                    panel.hidden = !active;
                });
            });
        });

        document.getElementById('studio-add-block').addEventListener('click', addStudioBlock);
        document.getElementById('studio-save-block').addEventListener('click', openSaveDialog);
        document.getElementById('studio-clear-page').addEventListener('click', clearPage);
        document.getElementById('studio-save-form').addEventListener('submit', submitSaveBlock);
        document.getElementById('studio-save-cancel').addEventListener('click', function () {
            document.getElementById('studio-save-dialog').close();
        });
    }

    function bindDevices() {
        document.querySelectorAll('.studio-device').forEach(function (button) {
            button.addEventListener('click', function () {
                var device = button.getAttribute('data-device');
                state.device = device;

                document.querySelectorAll('.studio-device').forEach(function (row) {
                    row.classList.toggle('is-active', row === button);
                });

                document.getElementById('studio-preview-frame').setAttribute('data-device', device);
            });
        });
    }

    function mountAiPanel(query) {
        var mount = document.getElementById('studio-ai-mount');

        if (!window.HubAIPanel) {
            mount.innerHTML = '<p class="hub-panel__sub">AI Panel indisponível.</p>';
            return null;
        }

        var controller = window.HubAIPanel.mount(mount, {
            mode: 'page_builder',
            offer: { slug: state.offer },
            apiFetch: apiFetch,
            placeholder: 'Ex: vamos construir um bloco novo com headline… Cola imagens ou links.',
            endpoint: '/api/sales-attribution?action=hub_page_builder_ai_gemini',
            onStatus: function (message) {
                showStatus(message);
                if (message && /AI|executar|analisar/i.test(message)) {
                    startPreviewPoll();
                }
                if (!message) {
                    stopPreviewPoll();
                }
            },
            buildBody: function (body) {
                body.offer = state.offer;
                body.funnel = state.funnel;
                body.page = state.page;
                body.funnel_slug = state.funnel;
                body.page_slug = state.page;
                body.page_id = state.pageId;
                body.tree = state.tree;
                body.baseline = state.baselineTree || state.tree;
                body.page_summary = buildPageSummary();
                body.selection = state.selected;

                if (state.selected.type === 'section') {
                    var section = findSection(state.selected.id);
                    body.selected_section = section || null;

                    if (section) {
                        var sections = (state.tree.sections || []).slice().sort(function (a, b) {
                            return (a.sort_order || 0) - (b.sort_order || 0);
                        });
                        var idx = sections.findIndex(function (row) {
                            return row.id === section.id;
                        });
                        var blocks = (section.blocks || []).slice().sort(function (a, b) {
                            return (a.sort_order || 0) - (b.sort_order || 0);
                        });
                        var primaryBlock = blocks[0];
                        var blockHint = primaryBlock
                            ? ' block_id=' + primaryBlock.id + ' block_type=' + primaryBlock.type
                            : ' block_id=(criar html block)';

                        body.message = String(body.message || '') +
                            '\n\n[Bloco seleccionado: «' + blockDisplayName(section, idx >= 0 ? idx : 0) +
                            '» section_id=' + section.id + blockHint + ']';
                    }
                }

                state.requestVersion += 1;
                body.client_request_version = state.requestVersion;
                return body;
            },
            onComplete: function (payload) {
                stopPreviewPoll();

                if (payload.page && payload.page.slug) {
                    state.page = payload.page.slug;
                    state.pageName = payload.page.name || state.pageName;
                    updateChrome(payload.page);
                }

                if (payload.tree) {
                    applyTree(payload.tree);
                } else {
                    loadTree().catch(function () {});
                }

                if (payload.preview_url) {
                    state.previewUrl = payload.preview_url;
                }

                refreshPreview(state.previewUrl);

                var summary = payload.changes_summary || payload.reply || '';

                if (summary) {
                    showStatus(summary);
                    window.setTimeout(function () { showStatus(''); }, 2500);
                } else {
                    showStatus('');
                }
            },
        });

        return controller;
    }

    function bindChrome() {
        document.getElementById('studio-refresh-preview').addEventListener('click', async function () {
            try {
                await loadTree();
                refreshPreview(state.previewUrl);
            } catch (error) {
                showStatus(error.message, true);
            }
        });

        var openPreviewBtn = document.getElementById('studio-open-preview');
        var openPreviewInline = document.getElementById('studio-open-preview-inline');

        if (openPreviewBtn) {
            openPreviewBtn.addEventListener('click', openPreviewWindow);
        }

        if (openPreviewInline) {
            openPreviewInline.addEventListener('click', openPreviewWindow);
        }

        var undoBtn = document.getElementById('studio-undo');
        var redoBtn = document.getElementById('studio-redo');

        if (undoBtn) {
            undoBtn.addEventListener('click', undo);
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', redo);
        }

        document.addEventListener('keydown', function (event) {
            if (!(event.metaKey || event.ctrlKey)) {
                return;
            }

            if (event.key === 'z' && !event.shiftKey) {
                event.preventDefault();
                undo();
            }

            if (event.key === 'z' && event.shiftKey) {
                event.preventDefault();
                redo();
            }
        });
    }

    async function bootApp() {
        var route = parseRoute();
        var query = parseQuery();

        if (!route) {
            redirectToHub();
            return;
        }

        state.offer = route.offer;
        state.funnel = route.funnel;
        state.page = route.page;
        state.pageType = query.type;
        state.pageName = query.name;

        bindChrome();
        bindSidebar();
        bindDevices();
        updateSaveButton();

        try {
            showStatus('A carregar…');

            // Start iframe ASAP with known URL while APIs load in parallel.
            state.previewUrl =
                '/preview/' + encodeURIComponent(state.offer) + '/' +
                encodeURIComponent(state.funnel) + '/' + encodeURIComponent(state.page) + '?preview=1';
            refreshPreview(state.previewUrl);
            syncOpenPreviewLinks(state.previewUrl);

            await Promise.all([
                loadPageMeta(),
                loadTree(),
                loadSavedBlocks(),
            ]);
            showStatus('');
        } catch (error) {
            showStatus(error.message || 'Não foi possível carregar a page.', true);
        }

        try {
            mountAiPanel(query);
        } catch (panelError) {
            showStatus((panelError && panelError.message) || 'Painel de IA indisponível.', true);
        }

        // Keep user in Studio even on partial failures — never bounce to Hub here.
        document.getElementById('studio-back-hub').href =
            '/hub/?offer=' + encodeURIComponent(state.offer) + '&module=funil';
    }

    if (!getToken()) {
        // Remember intended studio URL so Hub can send the user back after login.
        try {
            sessionStorage.setItem('onda-studio-return', window.location.pathname + window.location.search);
        } catch (error) {
            /* ignore */
        }
        redirectToHub('login');
    } else {
        bootApp().catch(function (error) {
            showStatus((error && error.message) || 'Falha ao abrir o Studio.', true);
        });
    }
})();
