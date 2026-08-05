(function () {
    var params = new URLSearchParams(window.location.search);
    var productId = params.get('id') || '';

    var state = {
        product: null,
        modules: [],
        activeModuleId: null,
        comments: [],
        isAdmin: false,
        replyToId: null,
    };

    var sidebar = document.getElementById('sidebar');
    var sidebarOverlay = document.getElementById('sidebar-overlay');
    var sidebarProductName = document.getElementById('sidebar-product-name');
    var moduleList = document.getElementById('module-list');
    var contentPlayer = document.getElementById('content-player');
    var ebookDownload = document.getElementById('ebook-download');
    var ebookLink = document.getElementById('ebook-link');
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

    function getActiveIndex() {
        return state.modules.findIndex(function (item) {
            return item.id === state.activeModuleId;
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
        var index = getActiveIndex();

        btnPrev.disabled = index <= 0;
        btnNext.disabled = index < 0 || index >= state.modules.length - 1;
    }

    function showCommentsError(message) {
        commentsError.hidden = false;
        commentsError.textContent = message;
    }

    function clearCommentsError() {
        commentsError.hidden = true;
        commentsError.textContent = '';
    }

    function renderModules() {
        moduleList.innerHTML = state.modules.map(function (moduleItem, index) {
            var isActive = moduleItem.id === state.activeModuleId;
            var typeLabel = moduleItem.type === 'video' ? 'Vídeo' : 'Ebook';

            return (
                '<button type="button" class="comunidade-module-item' + (isActive ? ' is-active' : '') + '" data-module-id="' + moduleItem.id + '">' +
                    '<span class="comunidade-module-item__num">' + (index + 1) + '</span>' +
                    '<span class="comunidade-module-item__info">' +
                        '<span class="comunidade-module-item__title">' + escapeHtml(moduleItem.title) + '</span>' +
                        '<span class="comunidade-module-item__type">' + typeLabel + '</span>' +
                    '</span>' +
                '</button>'
            );
        }).join('');

        moduleList.querySelectorAll('[data-module-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                selectModule(button.getAttribute('data-module-id'));
                closeSidebar();
            });
        });

        updateNavButtons();
    }

    function selectModule(moduleId) {
        var moduleItem = state.modules.find(function (item) {
            return item.id === moduleId;
        });

        if (!moduleItem) {
            return;
        }

        state.activeModuleId = moduleId;
        renderModules();

        lessonTitle.textContent = moduleItem.title;
        lessonDescription.textContent = moduleItem.type === 'video'
            ? 'Assiste a este módulo em vídeo.'
            : 'Descarrega o material em PDF.';

        if (moduleItem.type === 'video') {
            ebookDownload.hidden = true;

            if (moduleItem.youtube_id) {
                contentPlayer.className = 'comunidade-player';
                contentPlayer.innerHTML = '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(moduleItem.youtube_id) + '" title="' + escapeHtml(moduleItem.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
            } else {
                contentPlayer.className = 'comunidade-player comunidade-player--empty';
                contentPlayer.textContent = 'Vídeo em breve — estamos a preparar este conteúdo.';
            }

            return;
        }

        contentPlayer.className = 'comunidade-player comunidade-player--empty';
        contentPlayer.textContent = moduleItem.pdf_path ? 'Ebook disponível para download abaixo.' : 'Ebook em breve.';

        if (moduleItem.pdf_path) {
            ebookDownload.hidden = false;
            ebookLink.href = moduleItem.pdf_path;
        } else {
            ebookDownload.hidden = true;
        }
    }

    function navigateModule(direction) {
        var index = getActiveIndex();

        if (index < 0) {
            return;
        }

        var nextIndex = index + direction;

        if (nextIndex < 0 || nextIndex >= state.modules.length) {
            return;
        }

        selectModule(state.modules[nextIndex].id);
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
        sidebarProductName.textContent = data.product.name;
        document.title = data.product.name + ' — Comunidade Onda Prodígio';

        renderModules();

        if (state.modules.length) {
            selectModule(state.modules[0].id);
        }
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
        navigateModule(-1);
    });

    btnNext.addEventListener('click', function () {
        navigateModule(1);
    });

    btnList.addEventListener('click', openSidebar);
    btnToggleSidebar.addEventListener('click', openSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

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
            module_id: state.activeModuleId,
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
