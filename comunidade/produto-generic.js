(function () {
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function boot(options) {
        var productId = options.productId;
        var offerSlug = options.offerSlug || '';
        var params = new URLSearchParams(window.location.search);
        var moduleParam = params.get('module') || '';
        var aulaParam = params.get('aula') || '';

        var state = {
            product: null,
            modules: [],
            activeModuleId: null,
            activeAulaId: null,
            isAdmin: false,
            progress: {},
            editMode: false,
            contentEditorMount: null,
            searchQuery: '',
        };

        var viewModules = document.getElementById('view-modules');
        var viewModuleAulas = document.getElementById('view-module-aulas');
        var viewLesson = document.getElementById('view-lesson');
        var viewContentEditor = document.getElementById('view-content-editor');
        var btnEditMode = document.getElementById('btn-edit-mode');
        var moduleGrid = document.getElementById('module-grid');
        var moduleSearch = document.getElementById('module-search');
        var aulaList = document.getElementById('aula-list');
        var moduleHeaderNum = document.getElementById('module-header-num');
        var moduleHeaderTitle = document.getElementById('module-header-title');
        var moduleHeaderProgress = document.getElementById('module-header-progress');
        var moduleHeaderProgressText = document.getElementById('module-header-progress-text');
        var sidebar = document.getElementById('sidebar');
        var sidebarOverlay = document.getElementById('sidebar-overlay');
        var sidebarSearch = document.getElementById('sidebar-search');
        var moduleList = document.getElementById('module-list');
        var contentPlayer = document.getElementById('content-player');
        var lessonMaterials = document.getElementById('lesson-materials');
        var materialsList = document.getElementById('materials-list');
        var materialsCount = document.getElementById('materials-count');
        var materialsHint = document.getElementById('materials-hint');
        var lessonTitle = document.getElementById('lesson-title');
        var lessonDescription = document.getElementById('lesson-description');
        var lessonInstructions = document.getElementById('lesson-instructions');
        var btnCompleteLesson = document.getElementById('btn-complete-lesson');
        var topbarUser = document.getElementById('topbar-user');
        var btnPrev = document.getElementById('btn-prev');
        var btnNext = document.getElementById('btn-next');
        var btnList = document.getElementById('btn-list');
        var btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
        var btnBackModules = document.getElementById('btn-back-from-aulas');
        var btnLogout = document.getElementById('btn-logout');

        function apiProductQuery() {
            var query = '/api/comunidade/product?id=' + encodeURIComponent(productId);

            if (offerSlug) {
                query += '&offer=' + encodeURIComponent(offerSlug);
            }

            return query;
        }

        function resolveAssetUrl(path) {
            if (!path) return '';
            if (/^https?:\/\//i.test(path)) return path;
            return path.charAt(0) === '/' ? path : '/' + path.replace(/^\//, '');
        }

        function hideAllViews() {
            if (viewModules) viewModules.hidden = true;
            if (viewModuleAulas) viewModuleAulas.hidden = true;
            if (viewLesson) viewLesson.hidden = true;
            if (viewContentEditor) viewContentEditor.hidden = true;
        }

        function moduleHasAulas(moduleItem) {
            return Boolean(moduleItem && moduleItem.aulas && moduleItem.aulas.length);
        }

        function getModuleById(moduleId) {
            return state.modules.find(function (item) { return item.id === moduleId; }) || null;
        }

        function getActiveModule() {
            return getModuleById(state.activeModuleId);
        }

        function getActiveAulas() {
            var moduleItem = getActiveModule();
            if (!moduleItem) return [];
            return moduleHasAulas(moduleItem) ? moduleItem.aulas : [moduleItem];
        }

        function getAulaById(aulaId) {
            var found = null;
            state.modules.some(function (moduleItem) {
                if (moduleItem.id === aulaId) {
                    found = moduleItem;
                    return true;
                }
                return (moduleItem.aulas || []).some(function (lesson) {
                    if (lesson.id === aulaId) {
                        found = lesson;
                        return true;
                    }
                    return false;
                });
            });
            return found;
        }

        function getActiveAulaIndex() {
            return getActiveAulas().findIndex(function (item) {
                return item.id === state.activeAulaId;
            });
        }

        function isAulaLocked(aulaItem) {
            return Boolean(aulaItem && aulaItem.is_locked && !state.isAdmin);
        }

        function getItemProgress(itemId) {
            return state.progress[itemId] || 0;
        }

        function isItemComplete(itemId) {
            return getItemProgress(itemId) >= 100;
        }

        function getModuleProgress(moduleItem) {
            if (!moduleItem) return 0;
            if (moduleHasAulas(moduleItem)) {
                var total = moduleItem.aulas.length;
                if (!total) return 0;
                var done = moduleItem.aulas.filter(function (aula) {
                    return isItemComplete(aula.id);
                }).length;
                return Math.round((done / total) * 100);
            }
            return getItemProgress(moduleItem.id);
        }

        function updateUrl() {
            var next = new URLSearchParams();
            next.set('id', productId);
            if (offerSlug) next.set('offer', offerSlug);
            if (state.editMode) next.set('edit', '1');
            if (state.activeModuleId) next.set('module', state.activeModuleId);
            if (state.activeAulaId) next.set('aula', state.activeAulaId);
            window.history.replaceState({}, '', '/comunidade/produto?' + next.toString());
        }

        async function loadProgress() {
            var response = await window.ComunidadeAuth.apiFetch(
                '/api/comunidade/progress?product_id=' + encodeURIComponent(productId)
            );
            var data = await response.json();
            if (response.ok) state.progress = data.progress || {};
        }

        async function saveProgress(itemId, percent) {
            await window.ComunidadeAuth.apiFetch('/api/comunidade/progress', {
                method: 'POST',
                body: JSON.stringify({
                    product_id: productId,
                    module_id: itemId,
                    percent: percent,
                }),
            });
            state.progress[itemId] = percent;
        }

        function renderProgressMarkup(progress) {
            return (
                '<div class="comunidade-module-card__progress-bar">' +
                    '<span style="width:' + progress + '%"></span>' +
                '</div>' +
                '<span class="comunidade-module-card__progress-text">' + progress + '%</span>'
            );
        }

        function renderModuleGrid() {
            var query = state.searchQuery.trim().toLowerCase();
            var modules = state.modules.filter(function (moduleItem) {
                if (!query) return true;
                return (moduleItem.title + ' ' + (moduleItem.description || '')).toLowerCase().indexOf(query) !== -1;
            });

            if (!modules.length) {
                moduleGrid.innerHTML = '<p class="comunidade-panel__subtitle">Ainda não há módulos. Usa «Modo edição» para criar conteúdo.</p>';
                return;
            }

            moduleGrid.innerHTML = modules.map(function (moduleItem, index) {
                var image = moduleItem.image_url ? resolveAssetUrl(moduleItem.image_url) : '';
                var progress = getModuleProgress(moduleItem);
                return (
                    '<button type="button" class="comunidade-module-card" data-open-module="' + escapeHtml(moduleItem.id) + '">' +
                        '<div class="comunidade-module-card__progress">' + renderProgressMarkup(progress) + '</div>' +
                        '<div class="comunidade-module-card__title">' + escapeHtml(moduleItem.title) + '</div>' +
                        '<div class="comunidade-module-card__thumb comunidade-module-card__thumb--' + Math.min(index + 1, 5) + '">' +
                            (image ? '<img src="' + image + '" alt="">' : '<span class="comunidade-module-card__label">' + escapeHtml(moduleItem.title) + '</span>') +
                        '</div>' +
                    '</button>'
                );
            }).join('');

            moduleGrid.querySelectorAll('[data-open-module]').forEach(function (button) {
                button.addEventListener('click', function () {
                    openModule(button.getAttribute('data-open-module'));
                });
            });
        }

        function renderAulaList(aulas) {
            aulaList.innerHTML = aulas.map(function (aulaItem) {
                var image = aulaItem.image_url ? resolveAssetUrl(aulaItem.image_url) : '';
                var locked = isAulaLocked(aulaItem);
                var done = isItemComplete(aulaItem.id);
                return (
                    '<button type="button" class="comunidade-aula-item' + (done ? ' is-done' : '') + (locked ? ' is-locked' : '') + '" data-open-aula="' + escapeHtml(aulaItem.id) + '">' +
                        '<div class="comunidade-aula-item__thumb">' +
                            (image ? '<img src="' + image + '" alt="">' : '<span class="comunidade-aula-item__thumb-label">' + escapeHtml(aulaItem.title) + '</span>') +
                        '</div>' +
                        '<span class="comunidade-aula-item__meta">' +
                            '<span class="comunidade-aula-item__title">' + escapeHtml(aulaItem.title) + '</span>' +
                            (locked && aulaItem.unlock_label ? '<span class="comunidade-aula-item__unlock">' + escapeHtml(aulaItem.unlock_label) + '</span>' : '') +
                        '</span>' +
                    '</button>'
                );
            }).join('');

            aulaList.querySelectorAll('[data-open-aula]').forEach(function (button) {
                button.addEventListener('click', function () {
                    openAula(button.getAttribute('data-open-aula'));
                });
            });
        }

        function renderSidebar() {
            moduleList.innerHTML = state.modules.map(function (moduleItem) {
                var expanded = moduleItem.id === state.activeModuleId;
                var lessons = moduleHasAulas(moduleItem) ? moduleItem.aulas : [moduleItem];
                return (
                    '<div class="comunidade-sidebar-module' + (expanded ? ' is-expanded' : '') + '">' +
                        '<button type="button" class="comunidade-sidebar-module__head" data-sidebar-module="' + escapeHtml(moduleItem.id) + '">' +
                            escapeHtml(moduleItem.title) +
                        '</button>' +
                        '<div class="comunidade-sidebar-module__lessons">' +
                            lessons.map(function (lesson) {
                                var active = lesson.id === state.activeAulaId ? ' is-active' : '';
                                var locked = isAulaLocked(lesson) ? ' is-locked' : '';
                                return (
                                    '<button type="button" class="comunidade-sidebar-lesson' + active + locked + '" data-sidebar-aula="' + escapeHtml(lesson.id) + '">' +
                                        escapeHtml(lesson.title) +
                                    '</button>'
                                );
                            }).join('') +
                        '</div>' +
                    '</div>'
                );
            }).join('');

            moduleList.querySelectorAll('[data-sidebar-aula]').forEach(function (button) {
                button.addEventListener('click', function () {
                    var aulaId = button.getAttribute('data-sidebar-aula');
                    var aulaItem = getAulaById(aulaId);
                    if (isAulaLocked(aulaItem)) return;
                    showLessonView(findModuleIdForAula(aulaId), aulaId);
                });
            });
        }

        function findModuleIdForAula(aulaId) {
            var moduleId = aulaId;
            state.modules.forEach(function (moduleItem) {
                if (moduleItem.id === aulaId) moduleId = moduleItem.id;
                (moduleItem.aulas || []).forEach(function (lesson) {
                    if (lesson.id === aulaId) moduleId = moduleItem.id;
                });
            });
            return moduleId;
        }

        function renderMaterials(aulaItem) {
            var items = [];
            if (aulaItem.pdf_path) {
                var pdfUrl = resolveAssetUrl(aulaItem.pdf_path);
                items.push('<a class="comunidade-materials__file" href="' + pdfUrl + '" target="_blank" rel="noopener">PDF · ' + escapeHtml(aulaItem.title) + '</a>');
            }
            if (aulaItem.audio_path) {
                var audioUrl = resolveAssetUrl(aulaItem.audio_path);
                items.push('<a class="comunidade-materials__file" href="' + audioUrl + '" target="_blank" rel="noopener">Áudio · ' + escapeHtml(aulaItem.title) + '</a>');
            }
            if (!items.length) {
                lessonMaterials.hidden = true;
                materialsList.innerHTML = '';
                return;
            }
            lessonMaterials.hidden = false;
            materialsCount.textContent = String(items.length);
            materialsHint.textContent = 'Materiais desta aula';
            materialsList.innerHTML = items.join('');
        }

        function renderPlayer(aulaItem) {
            if (aulaItem.youtube_id) {
                contentPlayer.className = 'comunidade-player comunidade-player--video';
                contentPlayer.innerHTML = (
                    '<iframe src="https://www.youtube.com/embed/' + escapeHtml(aulaItem.youtube_id) + '" ' +
                    'title="' + escapeHtml(aulaItem.title) + '" allowfullscreen loading="lazy"></iframe>'
                );
                return;
            }
            if (aulaItem.video_path) {
                contentPlayer.className = 'comunidade-player comunidade-player--video';
                contentPlayer.innerHTML = '<video controls preload="metadata" src="' + resolveAssetUrl(aulaItem.video_path) + '"></video>';
                return;
            }
            if (aulaItem.pdf_path) {
                contentPlayer.className = 'comunidade-player comunidade-player--pdf';
                contentPlayer.innerHTML = '<div class="comunidade-pdf-viewer-host"></div>';
                if (window.ComunidadePdfViewer) {
                    window.ComunidadePdfViewer.render(contentPlayer.querySelector('.comunidade-pdf-viewer-host'), resolveAssetUrl(aulaItem.pdf_path));
                } else {
                    contentPlayer.innerHTML = '<iframe src="' + resolveAssetUrl(aulaItem.pdf_path) + '" title="PDF"></iframe>';
                }
                return;
            }
            if (aulaItem.audio_path) {
                contentPlayer.className = 'comunidade-player comunidade-player--audio';
                contentPlayer.innerHTML = '<audio controls preload="metadata" src="' + resolveAssetUrl(aulaItem.audio_path) + '"></audio>';
                return;
            }
            contentPlayer.className = 'comunidade-player';
            contentPlayer.innerHTML = '<p class="comunidade-panel__subtitle">Conteúdo ainda não configurado.</p>';
        }

        function selectAula(aulaId) {
            var aulaItem = getAulaById(aulaId);
            if (!aulaItem || isAulaLocked(aulaItem)) return;
            state.activeAulaId = aulaId;
            lessonTitle.textContent = aulaItem.title;
            lessonDescription.textContent = aulaItem.description || '';
            if (lessonInstructions) {
                lessonInstructions.hidden = true;
                lessonInstructions.innerHTML = '';
            }
            renderPlayer(aulaItem);
            renderMaterials(aulaItem);
            renderSidebar();
            updateNavButtons();
            if (btnCompleteLesson) {
                btnCompleteLesson.disabled = isItemComplete(aulaId);
            }
        }

        function updateNavButtons() {
            var index = getActiveAulaIndex();
            var aulas = getActiveAulas();
            btnPrev.disabled = index <= 0;
            btnNext.disabled = index < 0 || index >= aulas.length - 1;
        }

        function showModuleGridView() {
            hideAllViews();
            viewModules.hidden = false;
            btnToggleSidebar.hidden = true;
            state.activeModuleId = null;
            state.activeAulaId = null;
            updateUrl();
            renderModuleGrid();
        }

        function showModuleAulasView(moduleId) {
            var moduleItem = getModuleById(moduleId);
            if (!moduleItem) return;
            hideAllViews();
            viewModuleAulas.hidden = false;
            btnToggleSidebar.hidden = true;
            state.activeModuleId = moduleId;
            state.activeAulaId = null;
            updateUrl();
            var moduleIndex = state.modules.findIndex(function (item) { return item.id === moduleId; });
            moduleHeaderNum.textContent = String(moduleIndex + 1);
            moduleHeaderTitle.textContent = moduleItem.title;
            var progress = getModuleProgress(moduleItem);
            moduleHeaderProgress.style.width = progress + '%';
            moduleHeaderProgressText.textContent = progress + '%';
            renderAulaList(moduleHasAulas(moduleItem) ? moduleItem.aulas : [moduleItem]);
        }

        function showLessonView(moduleId, aulaId) {
            hideAllViews();
            viewLesson.hidden = false;
            btnToggleSidebar.hidden = false;
            state.activeModuleId = moduleId;
            state.activeAulaId = aulaId;
            updateUrl();
            renderSidebar();
            if (aulaId) selectAula(aulaId);
        }

        function openModule(moduleId) {
            var moduleItem = getModuleById(moduleId);
            if (!moduleItem) return;
            if (moduleHasAulas(moduleItem)) {
                showModuleAulasView(moduleId);
                return;
            }
            showLessonView(moduleId, moduleId);
        }

        function openAula(aulaId) {
            var aulaItem = getAulaById(aulaId);
            if (!aulaItem || isAulaLocked(aulaItem)) return;
            showLessonView(findModuleIdForAula(aulaId), aulaId);
        }

        function navigateAula(delta) {
            var aulas = getActiveAulas();
            var index = getActiveAulaIndex();
            var next = aulas[index + delta];
            if (next) openAula(next.id);
        }

        function resolveInitialView() {
            if (moduleParam) {
                if (aulaParam) {
                    showLessonView(moduleParam, aulaParam);
                    return;
                }
                openModule(moduleParam);
                return;
            }
            if (state.modules.length === 1) {
                openModule(state.modules[0].id);
                return;
            }
            showModuleGridView();
        }

        async function loadProduct() {
            var response = await window.ComunidadeAuth.apiFetch(apiProductQuery());
            var data = await response.json();
            if (!response.ok) {
                if (lessonTitle) lessonTitle.textContent = data.error || 'Produto indisponível';
                return;
            }
            state.product = data.product;
            state.modules = data.product.modules || [];
            document.title = data.product.name + ' — Comunidade';
            await loadProgress();
            if (!state.editMode) resolveInitialView();
        }

        function setEditMode(enabled) {
            state.editMode = Boolean(enabled);
            if (btnEditMode) {
                btnEditMode.classList.toggle('is-active', state.editMode);
                btnEditMode.textContent = state.editMode ? 'Ver como membro' : 'Modo edição';
            }
            if (state.editMode) {
                hideAllViews();
                viewContentEditor.hidden = false;
                if (!state.contentEditorMount && viewContentEditor && window.ComunidadeContentEditor) {
                    state.contentEditorMount = window.ComunidadeContentEditor.mount(viewContentEditor, {
                        productId: productId,
                        offerSlug: offerSlug || productId,
                        onProductChange: function (nextProductId) {
                            var nextParams = new URLSearchParams(window.location.search);
                            nextParams.set('id', nextProductId);
                            nextParams.set('edit', '1');
                            window.location.href = '/comunidade/produto?' + nextParams.toString();
                        },
                        onReload: function () { loadProduct(); },
                    });
                }
                if (state.contentEditorMount) state.contentEditorMount.load();
                return;
            }
            viewContentEditor.hidden = true;
            resolveInitialView();
        }

        async function bootSession() {
            var session = await window.ComunidadeAuth.requireAuth();
            if (!session) return;
            var meResponse = await window.ComunidadeAuth.apiFetch(
                '/api/comunidade/me' + (offerSlug ? '?offer=' + encodeURIComponent(offerSlug) : '')
            );
            var meData = await meResponse.json();
            if (meResponse.ok) {
                state.isAdmin = meData.role === 'admin';
                if (topbarUser) {
                    topbarUser.textContent = state.isAdmin
                        ? ((meData.name || 'Gestor') + ' · Admin')
                        : ((meData.name || meData.email) + '');
                }
                if (state.isAdmin && btnEditMode) btnEditMode.hidden = false;
            }
            await loadProduct();
            if (state.isAdmin && options.editMode) setEditMode(true);
        }

        if (moduleSearch) {
            moduleSearch.addEventListener('input', function () {
                state.searchQuery = moduleSearch.value;
                renderModuleGrid();
            });
        }
        if (btnEditMode) btnEditMode.addEventListener('click', function () { setEditMode(!state.editMode); });
        if (btnPrev) btnPrev.addEventListener('click', function () { navigateAula(-1); });
        if (btnNext) btnNext.addEventListener('click', function () { navigateAula(1); });
        if (btnList) btnList.addEventListener('click', function () {
            if (state.activeModuleId && moduleHasAulas(getActiveModule())) {
                showModuleAulasView(state.activeModuleId);
            } else {
                showModuleGridView();
            }
        });
        if (btnBackModules) btnBackModules.addEventListener('click', showModuleGridView);
        if (btnCompleteLesson) {
            btnCompleteLesson.addEventListener('click', async function () {
                if (!state.activeAulaId) return;
                await saveProgress(state.activeAulaId, 100);
                btnCompleteLesson.disabled = true;
                renderSidebar();
            });
        }
        if (btnLogout) btnLogout.addEventListener('click', function () { window.ComunidadeAuth.signOut(); });
        if (btnToggleSidebar && sidebarOverlay) {
            btnToggleSidebar.addEventListener('click', function () {
                sidebar.classList.toggle('is-open');
                sidebarOverlay.classList.toggle('is-visible');
            });
            sidebarOverlay.addEventListener('click', function () {
                sidebar.classList.remove('is-open');
                sidebarOverlay.classList.remove('is-visible');
            });
        }

        bootSession();
    }

    window.ComunidadeProdutoGeneric = {
        boot: boot,
    };
})();
