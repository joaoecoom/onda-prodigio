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
    var sidebarProductName = document.getElementById('sidebar-product-name');
    var moduleList = document.getElementById('module-list');
    var contentPlayer = document.getElementById('content-player');
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
        contentPlayer.innerHTML = (
            '<iframe src="' + url + '#view=FitH&toolbar=1&navpanes=0" ' +
            'title="' + escapeHtml(aulaItem.title) + '" ' +
            'loading="lazy"></iframe>'
        );
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
        moduleHeaderProgress.style.width = '0%';
        moduleHeaderProgressText.textContent = '0%';

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

        sidebarProductName.textContent = moduleItem ? moduleItem.title : state.product.name;
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

            return (
                '<button type="button" class="comunidade-module-card" data-open-module="' + moduleItem.id + '">' +
                    '<div class="comunidade-module-card__thumb comunidade-module-card__thumb--' + thumbIndex + '">' +
                        (image ? '<img src="' + image + '" alt="">' : '<span class="comunidade-module-card__label">' + escapeHtml(thumbLabel) + '</span>') +
                        '<div class="comunidade-module-card__progress">' +
                            '<div class="comunidade-module-card__progress-bar"><div class="comunidade-module-card__progress-fill"></div></div>' +
                            '<span class="comunidade-module-card__progress-text">0%</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="comunidade-module-card__title">' + escapeHtml(moduleItem.title) + '</div>' +
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

            return (
                '<button type="button" class="comunidade-aula-item" data-open-aula="' + aulaItem.id + '">' +
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

    function renderSidebarAulas() {
        var aulas = getActiveAulas();

        moduleList.innerHTML = aulas.map(function (aulaItem, index) {
            var isActive = aulaItem.id === state.activeAulaId;
            var typeLabel = aulaItem.type === 'video' ? 'Vídeo' : 'Ebook';

            return (
                '<button type="button" class="comunidade-module-item' + (isActive ? ' is-active' : '') + '" data-aula-id="' + aulaItem.id + '">' +
                    '<span class="comunidade-module-item__num">' + (index + 1) + '</span>' +
                    '<span class="comunidade-module-item__info">' +
                        '<span class="comunidade-module-item__title">' + escapeHtml(aulaItem.title) + '</span>' +
                        '<span class="comunidade-module-item__type">' + typeLabel + '</span>' +
                    '</span>' +
                '</button>'
            );
        }).join('');

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

        renderMaterials(aulaItem);

        if (aulaItem.youtube_id) {
            renderVideoPlayer(aulaItem);
            return;
        }

        if (aulaItem.pdf_path) {
            renderPdfViewer(aulaItem);
            return;
        }

        contentPlayer.className = 'comunidade-player comunidade-player--empty';
        contentPlayer.textContent = aulaItem.type === 'video'
            ? 'Vídeo em breve — estamos a preparar esta aula.'
            : 'Material em breve.';
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
        return (
            '<article class="comunidade-comment' + (comment.is_admin ? ' is-admin' : '') + (isReply ? ' comunidade-comment__reply' : '') + '">' +
                '<div class="comunidade-comment__head">' +
                    '<span class="comunidade-comment__author">' + escapeHtml(comment.author_name) + (comment.is_admin ? ' · Suporte' : '') + '</span>' +
                    '<span class="comunidade-comment__date">' + escapeHtml(formatDate(comment.created_at)) + '</span>' +
                '</div>' +
                '<div class="comunidade-comment__content">' + escapeHtml(comment.content) + '</div>' +
                (state.isAdmin && !comment.is_admin ?
                    '<button type="button" class="comunidade-btn comunidade-btn--light" style="margin-top:0.65rem;" data-reply-id="' + comment.id + '">Responder</button>' :
                    '') +
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
            topbarUser.textContent = meData.name ? meData.name + ' · ' + meData.email : meData.email;

            if (state.isAdmin) {
                topbarUser.textContent += ' · Admin';
                commentContent.placeholder = 'Escreve um comentário ou resposta de suporte…';
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
