(function () {
    var params = new URLSearchParams(window.location.search);
    var productId = params.get('id') || '';
    var moduleParam = params.get('module') || '';
    var aulaParam = params.get('aula') || '';

    var THUMB_LABELS = [
        'Começa aqui',
        'Método Onda Prodígio',
        'Protocolo do Sono',
        'Ofertas',
        'Método Concluído',
    ];

    var AULA_THUMB_LABELS = [
        'Boas-vindas',
        'Questionário',
        'Instruções',
    ];

    var PDF_MATERIALS = {
        '/comunidade/assets/ebooks/seja-bem-vinda.pdf': {
            name: 'Boas-vindas PDF.pdf',
            size: '10,7 MB',
        },
        '/comunidade/assets/ebooks/instrucoes.pdf': {
            name: 'Instruções PDF.pdf',
            size: '14,8 MB',
        },
    };

    var state = {
        product: null,
        modules: [],
        activeModuleId: null,
        activeAulaId: null,
        comments: [],
        isAdmin: false,
        replyToId: null,
        searchQuery: '',
        sidebarSearchQuery: '',
        sidebarCollapsed: false,
        progress: {},
    };

    var viewModules = document.getElementById('view-modules');
    var viewModuleAulas = document.getElementById('view-module-aulas');
    var viewLesson = document.getElementById('view-lesson');
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
    var lessonPlayerWrap = document.querySelector('.comunidade-player-wrap');
    var contentPlayer = document.getElementById('content-player');
    var lessonSurvey = document.getElementById('lesson-survey');
    var lessonMaterials = document.getElementById('lesson-materials');
    var materialsList = document.getElementById('materials-list');
    var materialsCount = document.getElementById('materials-count');
    var lessonTitle = document.getElementById('lesson-title');
    var lessonDescription = document.getElementById('lesson-description');
    var commentsList = document.getElementById('comments-list');
    var commentsError = document.getElementById('comments-error');
    var commentForm = document.getElementById('comment-form');
    var commentContent = document.getElementById('comment-content');
    var topbarUser = document.getElementById('topbar-user');
    var btnPrev = document.getElementById('btn-prev');
    var btnNext = document.getElementById('btn-next');
    var btnList = document.getElementById('btn-list');
    var btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    var backBar = document.getElementById('back-bar');
    var btnBackModules = document.getElementById('btn-back-modules');
    var btnBackFromAulas = document.getElementById('btn-back-from-aulas');

    function getItemProgress(moduleId) {
        return state.progress[moduleId] || 0;
    }

    function getModuleProgress(moduleItem) {
        if (!moduleItem) {
            return 0;
        }

        if (moduleHasAulas(moduleItem)) {
            var aulas = moduleItem.aulas;

            if (!aulas.length) {
                return 0;
            }

            var total = 0;

            aulas.forEach(function (aulaItem) {
                total += getItemProgress(aulaItem.id);
            });

            return Math.round(total / aulas.length);
        }

        return getItemProgress(moduleItem.id);
    }

    function isItemComplete(moduleId) {
        return getItemProgress(moduleId) >= 100;
    }

    function renderProgressMarkup(percent) {
        return (
            '<span class="comunidade-module-card__progress-text">' + percent + '%</span>' +
            '<div class="comunidade-module-card__progress-bar">' +
                '<div class="comunidade-module-card__progress-fill" style="width:' + percent + '%"></div>' +
            '</div>'
        );
    }

    function refreshProgressUi() {
        if (!viewModules.hidden) {
            renderModuleGrid();
        }

        if (!viewModuleAulas.hidden) {
            var activeModule = getActiveModule();

            if (activeModule) {
                var moduleProgress = getModuleProgress(activeModule);
                moduleHeaderProgress.style.width = moduleProgress + '%';
                moduleHeaderProgressText.textContent = moduleProgress + '%';
                renderAulaList(activeModule.aulas);
            }
        }

        if (!viewLesson.hidden) {
            renderSidebarAulas();
        }
    }

    async function loadProgress() {
        var response = await window.ComunidadeAuth.apiFetch(
            '/api/comunidade/progress?product_id=' + encodeURIComponent(productId)
        );
        var data = await response.json();

        if (response.ok) {
            state.progress = data.progress || {};
        }
    }

    async function markContentViewed(moduleId) {
        if (state.isAdmin || !moduleId || getItemProgress(moduleId) >= 100) {
            return;
        }

        state.progress[moduleId] = 100;
        refreshProgressUi();

        await window.ComunidadeAuth.apiFetch('/api/comunidade/progress', {
            method: 'POST',
            body: JSON.stringify({
                product_id: productId,
                module_id: moduleId,
                progress_percent: 100,
            }),
        });
    }

    function resolveAssetUrl(path) {
        if (!path) {
            return '';
        }

        return path.charAt(0) === '/' ? path : '/' + path.replace(/^\//, '');
    }

    function getPdfMeta(pdfPath) {
        var url = resolveAssetUrl(pdfPath);
        var meta = PDF_MATERIALS[url];

        if (meta) {
            return meta;
        }

        var fileName = url.split('/').pop() || 'Material.pdf';

        return {
            name: decodeURIComponent(fileName),
            size: 'PDF',
        };
    }

    function renderMaterials(aulaItem) {
        if (!aulaItem.pdf_path) {
            lessonMaterials.hidden = true;
            materialsList.innerHTML = '';
            return;
        }

        var url = resolveAssetUrl(aulaItem.pdf_path);
        var meta = getPdfMeta(aulaItem.pdf_path);

        lessonMaterials.hidden = false;
        materialsCount.textContent = '1';
        materialsList.innerHTML = (
            '<a class="comunidade-materials__file" href="' + url + '" download="' + escapeHtml(meta.name) + '" target="_blank" rel="noopener">' +
                '<span class="comunidade-materials__file-icon" aria-hidden="true">' +
                    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>' +
                '</span>' +
                '<span class="comunidade-materials__file-info">' +
                    '<span class="comunidade-materials__file-name">' + escapeHtml(meta.name) + '</span>' +
                    '<span class="comunidade-materials__file-meta">PDF · ' + escapeHtml(meta.size) + '</span>' +
                '</span>' +
                '<span class="comunidade-materials__file-action">Descarregar</span>' +
            '</a>'
        );
    }

    function renderPdfViewer(aulaItem) {
        var url = resolveAssetUrl(aulaItem.pdf_path);

        contentPlayer.className = 'comunidade-player comunidade-player--pdf';
        contentPlayer.innerHTML = '<div class="comunidade-pdf-viewer-host"></div>';

        if (window.ComunidadePdfViewer) {
            window.ComunidadePdfViewer.render(
                contentPlayer.querySelector('.comunidade-pdf-viewer-host'),
                url,
                aulaItem.title
            );
        }
    }

    function renderVideoPlayer(aulaItem) {
        contentPlayer.className = 'comunidade-player';
        contentPlayer.innerHTML = (
            '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(aulaItem.youtube_id) + '" ' +
            'title="' + escapeHtml(aulaItem.title) + '" ' +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'
        );
    }
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(value) {
        try {
            return new Intl.DateTimeFormat('pt-PT', {
                dateStyle: 'short',
                timeStyle: 'short',
            }).format(new Date(value));
        } catch (error) {
            return value;
        }
    }

    function getModuleById(moduleId) {
        return state.modules.find(function (item) {
            return item.id === moduleId;
        });
    }

    function moduleHasAulas(moduleItem) {
        return Boolean(moduleItem && moduleItem.aulas && moduleItem.aulas.length);
    }

    function getActiveModule() {
        return getModuleById(state.activeModuleId);
    }

    function getActiveAulas() {
        var moduleItem = getActiveModule();

        if (!moduleItem) {
            return [];
        }

        if (moduleHasAulas(moduleItem)) {
            return moduleItem.aulas;
        }

        return [moduleItem];
    }

    function getActiveAula() {
        var aulas = getActiveAulas();

        return aulas.find(function (item) {
            return item.id === state.activeAulaId;
        }) || null;
    }

    function hasModuleGrid() {
        return state.modules.length > 1;
    }

    function hideAllViews() {
        viewModules.hidden = true;
        viewModuleAulas.hidden = true;
        viewLesson.hidden = true;
    }

    function updateUrl() {
        var url = new URL(window.location.href);

        if (state.activeModuleId && hasModuleGrid()) {
            url.searchParams.set('module', state.activeModuleId);
        } else {
            url.searchParams.delete('module');
        }

        if (state.activeAulaId) {
            url.searchParams.set('aula', state.activeAulaId);
        } else {
            url.searchParams.delete('aula');
        }

        history.replaceState(null, '', url.pathname + url.search);
    }

    function getActiveAulaIndex() {
        return getActiveAulas().findIndex(function (item) {
            return item.id === state.activeAulaId;
        });
    }

    function openSidebar() {
        sidebar.classList.add('is-open');
        sidebarOverlay.classList.add('is-visible');
    }

    function closeSidebar() {
        sidebar.classList.remove('is-open');
        sidebarOverlay.classList.remove('is-visible');
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

        if (!moduleItem || !moduleHasAulas(moduleItem)) {
            return;
        }

        hideAllViews();
        viewModuleAulas.hidden = false;
        btnToggleSidebar.hidden = true;
        state.activeModuleId = moduleId;
        state.activeAulaId = null;
        updateUrl();

        var moduleIndex = state.modules.findIndex(function (item) {
            return item.id === moduleId;
        });

        moduleHeaderNum.textContent = String(moduleIndex + 1);
        moduleHeaderTitle.textContent = moduleItem.title;

        var moduleProgress = getModuleProgress(moduleItem);
        moduleHeaderProgress.style.width = moduleProgress + '%';
        moduleHeaderProgressText.textContent = moduleProgress + '%';

        renderAulaList(moduleItem.aulas);
    }

    function showLessonView(moduleId, aulaId) {
        hideAllViews();
        viewLesson.hidden = false;
        btnToggleSidebar.hidden = false;

        state.activeModuleId = moduleId;
        state.activeAulaId = aulaId;

        var moduleItem = getModuleById(moduleId);
        backBar.hidden = !moduleHasAulas(moduleItem);

        updateUrl();
        renderSidebarAulas();

        if (aulaId) {
            selectAula(aulaId, false);
        }
    }

    function getFilteredModules() {
        var query = state.searchQuery.trim().toLowerCase();

        if (!query) {
            return state.modules;
        }

        return state.modules.filter(function (moduleItem) {
            var haystack = (moduleItem.title + ' ' + (moduleItem.description || '')).toLowerCase();
            return haystack.indexOf(query) !== -1;
        });
    }

    function renderModuleGrid() {
        var modules = getFilteredModules();

        if (!modules.length) {
            moduleGrid.innerHTML = '<p class="comunidade-panel__subtitle">Nenhum módulo encontrado.</p>';
            return;
        }

        moduleGrid.innerHTML = modules.map(function (moduleItem) {
            var index = state.modules.findIndex(function (item) {
                return item.id === moduleItem.id;
            });
            var thumbIndex = Math.min(index + 1, 5);
            var thumbLabel = THUMB_LABELS[index] || moduleItem.title;
            var image = moduleItem.image_url ? '/' + moduleItem.image_url.replace(/^\//, '') : '';
            var progress = getModuleProgress(moduleItem);

            return (
                '<button type="button" class="comunidade-module-card" data-open-module="' + moduleItem.id + '">' +
                    '<div class="comunidade-module-card__progress">' +
                        renderProgressMarkup(progress) +
                    '</div>' +
                    '<div class="comunidade-module-card__title">' + escapeHtml(moduleItem.title) + '</div>' +
                    '<div class="comunidade-module-card__thumb comunidade-module-card__thumb--' + thumbIndex + '">' +
                        (image ? '<img src="' + image + '" alt="">' : '<span class="comunidade-module-card__label">' + escapeHtml(thumbLabel) + '</span>') +
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
        aulaList.innerHTML = aulas.map(function (aulaItem, index) {
            var image = aulaItem.image_url ? '/' + aulaItem.image_url.replace(/^\//, '') : '';
            var thumbLabel = AULA_THUMB_LABELS[index] || aulaItem.title;
            var isDone = isItemComplete(aulaItem.id);

            return (
                '<button type="button" class="comunidade-aula-item' + (isDone ? ' is-done' : '') + '" data-open-aula="' + aulaItem.id + '">' +
                    '<div class="comunidade-aula-item__thumb">' +
                        (image ? '<img src="' + image + '" alt="">' : '<span class="comunidade-aula-item__thumb-label">' + escapeHtml(thumbLabel) + '</span>') +
                    '</div>' +
                    '<span class="comunidade-aula-item__title">' + escapeHtml(aulaItem.title) + '</span>' +
                    '<span class="comunidade-aula-item__check" aria-hidden="true">' +
                        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>' +
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

    function getFilteredSidebarAulas() {
        var aulas = getActiveAulas();
        var query = state.sidebarSearchQuery.trim().toLowerCase();

        if (!query) {
            return aulas;
        }

        return aulas.filter(function (aulaItem) {
            var haystack = (aulaItem.title + ' ' + (aulaItem.description || '')).toLowerCase();
            return haystack.indexOf(query) !== -1;
        });
    }

    function renderSidebarLessonItem(aulaItem, index) {
        var isActive = aulaItem.id === state.activeAulaId;
        var isDone = isItemComplete(aulaItem.id);
        var image = aulaItem.image_url ? '/' + aulaItem.image_url.replace(/^\//, '') : '';
        var thumbLabel = AULA_THUMB_LABELS[index] || aulaItem.title;

        return (
            '<button type="button" class="comunidade-sidebar-lesson' + (isActive ? ' is-active' : '') + (isDone ? ' is-done' : '') + '" data-aula-id="' + aulaItem.id + '">' +
                '<span class="comunidade-sidebar-lesson__thumb">' +
                    (image ?
                        '<img src="' + image + '" alt="">' :
                        '<span class="comunidade-sidebar-lesson__thumb-label">' + escapeHtml(thumbLabel) + '</span>') +
                    (isActive ?
                        '<span class="comunidade-sidebar-lesson__playing">' +
                            '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
                            'A reproduzir agora' +
                        '</span>' :
                        '') +
                '</span>' +
                '<span class="comunidade-sidebar-lesson__title">' + escapeHtml(aulaItem.title) + '</span>' +
                '<span class="comunidade-sidebar-lesson__check" aria-hidden="true">' +
                    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>' +
                '</span>' +
            '</button>'
        );
    }

    function renderSidebarAulas() {
        var moduleItem = getActiveModule();
        var aulas = getFilteredSidebarAulas();
        var allAulas = getActiveAulas();

        if (!moduleItem) {
            moduleList.innerHTML = '';
            return;
        }

        var moduleIndex = state.modules.findIndex(function (item) {
            return item.id === moduleItem.id;
        });
        var moduleProgress = getModuleProgress(moduleItem);

        moduleList.innerHTML = (
            '<div class="comunidade-sidebar-module">' +
                '<button type="button" class="comunidade-sidebar-module__head" id="sidebar-module-toggle" aria-expanded="' + (!state.sidebarCollapsed) + '">' +
                    '<span class="comunidade-sidebar-module__num">' + (moduleIndex + 1) + '</span>' +
                    '<span class="comunidade-sidebar-module__info">' +
                        '<span class="comunidade-sidebar-module__title">' + escapeHtml(moduleItem.title) + '</span>' +
                        '<div class="comunidade-sidebar-module__progress">' +
                            '<div class="comunidade-sidebar-module__progress-bar"><div class="comunidade-sidebar-module__progress-fill" style="width:' + moduleProgress + '%"></div></div>' +
                            '<span class="comunidade-sidebar-module__progress-text">' + moduleProgress + '%</span>' +
                        '</div>' +
                    '</span>' +
                    '<span class="comunidade-sidebar-module__chevron" aria-hidden="true">' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' +
                    '</span>' +
                '</button>' +
                '<div class="comunidade-sidebar-lessons' + (state.sidebarCollapsed ? ' is-collapsed' : '') + '" id="sidebar-lessons">' +
                    (aulas.length ?
                        aulas.map(function (aulaItem) {
                            var index = allAulas.findIndex(function (item) {
                                return item.id === aulaItem.id;
                            });
                            return renderSidebarLessonItem(aulaItem, index);
                        }).join('') :
                        '<p class="comunidade-sidebar-lessons__empty">Nenhuma aula encontrada.</p>') +
                '</div>' +
            '</div>'
        );

        var toggleBtn = document.getElementById('sidebar-module-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                state.sidebarCollapsed = !state.sidebarCollapsed;
                renderSidebarAulas();
            });
        }

        moduleList.querySelectorAll('[data-aula-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                selectAula(button.getAttribute('data-aula-id'));
                closeSidebar();
            });
        });

        updateNavButtons();
    }

    function openModule(moduleId) {
        var moduleItem = getModuleById(moduleId);

        if (!moduleItem) {
            return;
        }

        if (moduleHasAulas(moduleItem)) {
            showModuleAulasView(moduleId);
            return;
        }

        showLessonView(moduleId, moduleItem.id);
    }

    function openAula(aulaId) {
        if (!state.activeModuleId) {
            return;
        }

        showLessonView(state.activeModuleId, aulaId);
    }

    function selectAula(aulaId, syncUrl) {
        if (syncUrl === undefined) {
            syncUrl = true;
        }

        var aulaItem = getActiveAulas().find(function (item) {
            return item.id === aulaId;
        });

        if (!aulaItem) {
            return;
        }

        state.activeAulaId = aulaId;

        if (syncUrl) {
            updateUrl();
        }

        renderSidebarAulas();

        lessonTitle.textContent = aulaItem.title;
        lessonDescription.textContent = aulaItem.description || (aulaItem.type === 'video'
            ? 'Assiste a esta aula em vídeo.'
            : 'Descarrega o material em PDF.');

        if (window.ComunidadeWelcomeSurvey && window.ComunidadeWelcomeSurvey.isSurveyLesson(aulaItem)) {
            if (lessonPlayerWrap) {
                lessonPlayerWrap.hidden = true;
            }

            lessonMaterials.hidden = true;
            materialsList.innerHTML = '';

            window.ComunidadeWelcomeSurvey.mount(lessonSurvey, {
                productId: productId,
                moduleId: aulaItem.id,
                previewMode: state.isAdmin,
            });

            markContentViewed(aulaItem.id);
            return;
        }

        if (lessonSurvey) {
            window.ComunidadeWelcomeSurvey.unmount(lessonSurvey);
        }

        if (lessonPlayerWrap) {
            lessonPlayerWrap.hidden = false;
        }

        renderMaterials(aulaItem);

        if (aulaItem.youtube_id) {
            renderVideoPlayer(aulaItem);
            markContentViewed(aulaItem.id);
            return;
        }

        if (aulaItem.pdf_path) {
            renderPdfViewer(aulaItem);
            markContentViewed(aulaItem.id);
            return;
        }

        contentPlayer.className = 'comunidade-player comunidade-player--empty';
        contentPlayer.textContent = aulaItem.type === 'video'
            ? 'Vídeo em breve — estamos a preparar esta aula.'
            : 'Material em breve.';

        markContentViewed(aulaItem.id);
    }

    function navigateAula(direction) {
        var index = getActiveAulaIndex();
        var aulas = getActiveAulas();

        if (index < 0) {
            return;
        }

        var nextIndex = index + direction;

        if (nextIndex < 0 || nextIndex >= aulas.length) {
            return;
        }

        selectAula(aulas[nextIndex].id);
    }

    function showCommentsError(message) {
        commentsError.hidden = false;
        commentsError.textContent = message;
    }

    function clearCommentsError() {
        commentsError.hidden = true;
        commentsError.textContent = '';
    }

    function buildCommentTree(comments) {
        var roots = comments.filter(function (comment) {
            return !comment.parent_id;
        });

        return roots.map(function (comment) {
            var replies = comments.filter(function (item) {
                return item.parent_id === comment.id;
            });

            return { comment: comment, replies: replies };
        });
    }

    function renderComment(comment, isReply) {
        var adminActions = '';

        if (state.isAdmin) {
            adminActions = '<div class="comunidade-comment__actions">' +
                (!comment.is_admin ?
                    '<button type="button" class="comunidade-btn comunidade-btn--light" data-reply-id="' + comment.id + '">Responder</button>' :
                    '') +
                '<button type="button" class="comunidade-btn comunidade-btn--danger" data-delete-id="' + comment.id + '">Eliminar</button>' +
            '</div>';
        }

        return (
            '<article class="comunidade-comment' + (comment.is_admin ? ' is-admin' : '') + (isReply ? ' comunidade-comment__reply' : '') + '">' +
                '<div class="comunidade-comment__head">' +
                    '<span class="comunidade-comment__author">' + escapeHtml(comment.author_name) + (comment.is_admin ? ' · Suporte' : '') + '</span>' +
                    '<span class="comunidade-comment__date">' + escapeHtml(formatDate(comment.created_at)) + '</span>' +
                '</div>' +
                '<div class="comunidade-comment__content">' + escapeHtml(comment.content) + '</div>' +
                adminActions +
            '</article>'
        );
    }

    function renderComments() {
        var tree = buildCommentTree(state.comments);

        if (!tree.length) {
            commentsList.innerHTML = '<p class="comunidade-panel__subtitle" style="margin:0;">Ainda não há comentários neste produto. Sê o primeiro(a).</p>';
            return;
        }

        commentsList.innerHTML = tree.map(function (group) {
            return (
                '<div>' +
                    renderComment(group.comment, false) +
                    group.replies.map(function (reply) {
                        return renderComment(reply, true);
                    }).join('') +
                '</div>'
            );
        }).join('');

        commentsList.querySelectorAll('[data-reply-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                state.replyToId = button.getAttribute('data-reply-id');
                commentContent.placeholder = 'Resposta de suporte…';
                commentContent.focus();
            });
        });

        commentsList.querySelectorAll('[data-delete-id]').forEach(function (button) {
            button.addEventListener('click', async function () {
                var commentId = button.getAttribute('data-delete-id');

                if (!commentId) {
                    return;
                }

                if (!window.confirm('Eliminar este comentário? Esta acção não pode ser desfeita.')) {
                    return;
                }

                clearCommentsError();
                button.disabled = true;

                var response = await window.ComunidadeAuth.apiFetch('/api/comunidade/comments', {
                    method: 'DELETE',
                    body: JSON.stringify({ id: commentId }),
                });

                var data = await response.json();

                if (!response.ok) {
                    button.disabled = false;
                    showCommentsError(data.error || 'Não foi possível eliminar o comentário.');
                    return;
                }

                if (state.replyToId === commentId) {
                    state.replyToId = null;
                    commentContent.placeholder = 'Escreve um comentário ou resposta de suporte…';
                }

                await loadComments();
            });
        });
    }

    async function loadComments() {
        var response = await window.ComunidadeAuth.apiFetch('/api/comunidade/comments?product_id=' + encodeURIComponent(productId));
        var data = await response.json();

        if (!response.ok) {
            showCommentsError(data.error || 'Erro ao carregar comentários.');
            return;
        }

        state.comments = data.comments || [];
        renderComments();
    }

    function resolveInitialView() {
        if (moduleParam) {
            var moduleItem = getModuleById(moduleParam);

            if (!moduleItem) {
                showModuleGridView();
                return;
            }

            if (aulaParam) {
                showLessonView(moduleParam, aulaParam);
                return;
            }

            if (moduleHasAulas(moduleItem)) {
                showModuleAulasView(moduleParam);
                return;
            }

            showLessonView(moduleParam, moduleItem.id);
            return;
        }

        if (hasModuleGrid()) {
            showModuleGridView();
            return;
        }

        var onlyModule = state.modules[0];

        if (onlyModule) {
            if (moduleHasAulas(onlyModule)) {
                showModuleAulasView(onlyModule.id);
            } else {
                showLessonView(onlyModule.id, onlyModule.id);
            }
        }
    }

    async function loadProduct() {
        if (!productId) {
            window.location.href = '/comunidade';
            return;
        }

        var response = await window.ComunidadeAuth.apiFetch('/api/comunidade/product?id=' + encodeURIComponent(productId));
        var data = await response.json();

        if (!response.ok) {
            lessonTitle.textContent = data.error || 'Produto indisponível';
            return;
        }

        state.product = data.product;
        state.modules = data.product.modules || [];
        document.title = data.product.name + ' — Comunidade Onda Prodígio';

        await loadProgress();
        resolveInitialView();
    }

    async function boot() {
        var session = await window.ComunidadeAuth.requireAuth();

        if (!session) {
            return;
        }

        var meResponse = await window.ComunidadeAuth.apiFetch('/api/comunidade/me');
        var meData = await meResponse.json();

        if (meResponse.ok) {
            state.isAdmin = meData.role === 'admin';

            if (state.isAdmin) {
                topbarUser.textContent = (meData.name || 'Admin') + ' · Admin';
                topbarUser.title = meData.email || '';
                commentContent.placeholder = 'Escreve um comentário ou resposta de suporte…';

                var adminSurveyLink = document.getElementById('admin-survey-link');
                if (adminSurveyLink) {
                    adminSurveyLink.hidden = false;
                }
            } else {
                topbarUser.textContent = meData.name ? meData.name + ' · ' + meData.email : meData.email;
                topbarUser.title = '';
            }

            if (window.ComunidadeTheme && window.ComunidadeTheme.syncTopbarHeight) {
                window.ComunidadeTheme.syncTopbarHeight();
            }
        }

        await loadProduct();
        await loadComments();
    }

    btnPrev.addEventListener('click', function () {
        navigateAula(-1);
    });

    btnNext.addEventListener('click', function () {
        navigateAula(1);
    });

    btnList.addEventListener('click', function () {
        var moduleItem = getActiveModule();

        if (moduleItem && moduleHasAulas(moduleItem)) {
            showModuleAulasView(state.activeModuleId);
            return;
        }

        if (hasModuleGrid()) {
            showModuleGridView();
            return;
        }

        openSidebar();
    });

    btnBackModules.addEventListener('click', function () {
        if (state.activeModuleId && moduleHasAulas(getActiveModule())) {
            showModuleAulasView(state.activeModuleId);
            return;
        }

        showModuleGridView();
    });

    btnBackFromAulas.addEventListener('click', showModuleGridView);
    btnToggleSidebar.addEventListener('click', openSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    moduleSearch.addEventListener('input', function () {
        state.searchQuery = moduleSearch.value;
        renderModuleGrid();
    });

    if (sidebarSearch) {
        sidebarSearch.addEventListener('input', function () {
            state.sidebarSearchQuery = sidebarSearch.value;
            renderSidebarAulas();
        });
    }

    commentForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        clearCommentsError();

        var content = commentContent.value.trim();

        if (content.length < 2) {
            showCommentsError('Comentário demasiado curto.');
            return;
        }

        var payload = {
            product_id: productId,
            module_id: state.activeAulaId || state.activeModuleId,
            content: content,
        };

        if (state.isAdmin && state.replyToId) {
            payload.parent_id = state.replyToId;
            payload.admin_reply = true;
        } else if (state.isAdmin && content.indexOf('[resposta]') === 0) {
            payload.admin_reply = true;
            payload.content = content.replace(/^\[resposta\]\s*/i, '');
        }

        var response = await window.ComunidadeAuth.apiFetch('/api/comunidade/comments', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        var data = await response.json();

        if (!response.ok) {
            showCommentsError(data.error || 'Não foi possível publicar.');
            return;
        }

        commentContent.value = '';
        state.replyToId = null;
        commentContent.placeholder = state.isAdmin ? 'Escreve um comentário ou resposta de suporte…' : 'Escreve aqui…';
        await loadComments();
    });

    document.getElementById('btn-logout').addEventListener('click', function () {
        window.ComunidadeAuth.signOut();
    });

    boot();
})();
