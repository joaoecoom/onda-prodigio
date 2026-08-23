(function () {
    'use strict';

    var STEP_KINDS = [
        { kind: 'page', label: 'Página', page_type: 'sales' },
        { kind: 'page', label: 'Pre Sell', page_type: 'presell' },
        { kind: 'page', label: 'VSL', page_type: 'vsl' },
        { kind: 'quiz', label: 'Quiz', page_type: 'quiz' },
        { kind: 'checkout', label: 'Checkout', page_type: 'checkout', system: true },
        { kind: 'upsell', label: 'Upsell', page_type: 'upsell' },
        { kind: 'downsell', label: 'Downsell', page_type: 'downsell' },
        { kind: 'thank_you', label: 'Thank You', page_type: 'thank_you' },
    ];

    var PAGE_TYPE_OPTIONS = [
        { value: 'sales', label: 'Sales Page' },
        { value: 'presell', label: 'Pre Sell' },
        { value: 'vsl', label: 'VSL' },
        { value: 'landing', label: 'Landing' },
        { value: 'upsell', label: 'Upsell' },
        { value: 'downsell', label: 'Downsell' },
        { value: 'thank_you', label: 'Thank You' },
        { value: 'custom', label: 'Custom' },
    ];

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function pageOptionsHtml(pages, selectedId, pageType) {
        var html = '<option value="">— seleccionar page —</option>';
        var filtered = (pages || []).filter(function (page) {
            if (!pageType || pageType === 'quiz') {
                return true;
            }

            return page.type === pageType || page.type === 'custom';
        });

        filtered.forEach(function (page) {
            html += '<option value="' + escapeHtml(page.id) + '"' +
                (selectedId === page.id ? ' selected' : '') + '>' +
                escapeHtml(page.name) + ' (' + escapeHtml(page.slug) + ')</option>';
        });

        html += '<option value="__create__">+ Criar page…</option>';

        return html;
    }

    function renderStepToolbar(step, ctx) {
        var activeClass = step.is_step_active !== false ? 'is-on' : '';
        var index = typeof ctx.step_index === 'number' ? ctx.step_index : -1;
        var count = typeof ctx.step_count === 'number' ? ctx.step_count : 0;
        var moveLeft = index > 0
            ? '<button type="button" class="hub-step-btn hub-step-btn--move" data-step-move="left" ' +
                'data-step-id="' + escapeHtml(step.id) + '" title="Mover para trás">◀</button>'
            : '';
        var moveRight = index >= 0 && index < count - 1
            ? '<button type="button" class="hub-step-btn hub-step-btn--move" data-step-move="right" ' +
                'data-step-id="' + escapeHtml(step.id) + '" title="Mover para a frente">▶</button>'
            : '';

        return '<div class="hub-step-card__toolbar">' +
            moveLeft +
            moveRight +
            '<button type="button" class="hub-step-btn hub-step-btn--activate ' + activeClass + '" ' +
                'data-step-id="' + escapeHtml(step.id) + '" title="Activar step">●</button>' +
            '<button type="button" class="hub-step-btn hub-step-btn--duplicate" ' +
                'data-step-id="' + escapeHtml(step.id) + '" title="Duplicar page">⎘</button>' +
            '<button type="button" class="hub-step-btn hub-step-btn--remove" ' +
                'data-step-id="' + escapeHtml(step.id) + '" title="Eliminar step">×</button>' +
        '</div>';
    }

    function renderStepSaveLink(step, ctx) {
        var isCheckout = step.kind === 'checkout' || step.page_type === 'checkout';

        if (isCheckout) {
            return '<button type="button" class="hub-link hub-link--save" data-step-save-checkout="1" ' +
                'title="Gravar checkout na biblioteca">Gravar</button>';
        }

        if (step.active_page && step.active_page.id) {
            return '<button type="button" class="hub-link hub-link--save" data-step-save-page="' +
                escapeHtml(step.active_page.id) + '" data-page-name="' +
                escapeHtml(step.active_page.name || step.active_page.slug || 'Página') +
                '" title="Gravar página na biblioteca">Gravar</button>';
        }

        return '';
    }

    function renderStepEditLink(step, ctx) {
        var offerSlug = ctx.offer_slug;
        var funnelSlug = ctx.funnel_slug;
        var isCheckout = step.kind === 'checkout' || step.page_type === 'checkout';
        var saveLink = renderStepSaveLink(step, ctx);
        var editLink = '';

        if (isCheckout) {
            // Hard link — always opens checkout module (SPA deep-link + fallback).
            editLink = '<a class="hub-link hub-link--studio" data-open-checkout-editor="1" href="/hub/?offer=' +
                encodeURIComponent(offerSlug) + '&module=checkout">Editar checkout ↗</a>';
        } else if (step.active_page && step.active_page.slug) {
            editLink = '<a class="hub-link hub-link--studio" href="/studio/' +
                encodeURIComponent(offerSlug) + '/' + encodeURIComponent(funnelSlug) + '/' +
                encodeURIComponent(step.active_page.slug) + '">' +
                'Editar ↗</a>';
        } else {
            editLink = '<span class="hub-link hub-link--disabled" title="Selecciona ou cria uma page">Editar ↗</span>';
        }

        return '<div class="hub-step-card__links">' + editLink + saveLink + '</div>';
    }

    function pageTemplateOptionsHtml(templates, pageType) {
        var html = '<option value="">— página em branco —</option>';
        var rows = (templates || []).filter(function (row) {
            if (!pageType) {
                return true;
            }

            var payloadType = row.payload && row.payload.page_type;
            var tags = row.tags || [];

            return !payloadType || payloadType === pageType || payloadType === 'custom' ||
                tags.indexOf(pageType) !== -1;
        });

        rows.forEach(function (row) {
            html += '<option value="' + escapeHtml(row.id) + '">' +
                escapeHtml(row.name) + '</option>';
        });

        return html;
    }

    function checkoutTemplateOptionsHtml(templates) {
        var html = '<option value="">— aplicar checkout gravado —</option>';

        (templates || []).forEach(function (row) {
            html += '<option value="' + escapeHtml(row.id) + '">' +
                escapeHtml(row.name) + '</option>';
        });

        return html;
    }

    function renderStepCard(step, ctx, rejectStep) {
        var allPages = ctx.offer_pages || ctx.all_pages || ctx.pages || [];
        var offerSlug = ctx.offer_slug;
        var funnelSlug = ctx.funnel_slug;
        var checkoutUrl = ctx.checkout_url || ('/checkout/?offer=' + encodeURIComponent(offerSlug));
        var isCheckout = step.kind === 'checkout' || step.page_type === 'checkout';
        var pageType = step.page_type || step.kind;
        var statusClass = isCheckout ? 'is-system' : (step.active_page_id ? 'is-linked' : 'is-empty');
        var inactiveClass = step.is_step_active === false ? ' is-inactive' : '';
        var body = '';

        if (isCheckout) {
            body = '<span class="hub-step-card__meta">' + escapeHtml(checkoutUrl) + '</span>' +
                '<span class="hub-step-card__meta">checkout: ' + escapeHtml(step.checkout_id || 'main') + '</span>' +
                '<div class="hub-step-checkout-apply">' +
                    '<select class="hub-login__input hub-step-checkout-template" data-step-id="' +
                        escapeHtml(step.id) + '">' +
                        checkoutTemplateOptionsHtml(ctx.checkout_templates || []) +
                    '</select>' +
                    '<button type="button" class="hub-button hub-button--ghost hub-step-checkout-apply-btn" ' +
                        'data-step-id="' + escapeHtml(step.id) + '">Aplicar</button>' +
                '</div>';
        } else {
            body = '<label class="hub-field"><span class="hub-field__label">Page</span>' +
                '<select class="hub-login__input hub-funnel-flow-page" data-step-id="' + escapeHtml(step.id) + '" ' +
                'data-page-type="' + escapeHtml(pageType) + '">' +
                pageOptionsHtml(allPages, step.active_page_id, pageType) +
                '</select></label>' +
                '<div class="hub-step-create-inline" data-step-create="' + escapeHtml(step.id) + '" hidden>' +
                    '<input class="hub-login__input hub-step-create-name" placeholder="Nome da page" minlength="2">' +
                    '<label class="hub-field hub-field--compact">' +
                        '<span class="hub-field__label">Usar página gravada</span>' +
                        '<select class="hub-login__input hub-step-create-template">' +
                            pageTemplateOptionsHtml(ctx.page_templates || [], pageType) +
                        '</select>' +
                    '</label>' +
                    '<button type="button" class="hub-button hub-button--ghost hub-step-create-submit">Criar</button>' +
                '</div>';
        }

        var branchBlock = '';

        if (!isCheckout && step.lane !== 'reject') {
            if (rejectStep) {
                branchBlock = '<div class="hub-funnel-builder__branch">' +
                    '<span class="hub-funnel-builder__branch-label">Não aceita ↓</span>' +
                    renderStepCard(rejectStep, ctx, null) +
                '</div>';
            } else {
                branchBlock = '<button type="button" class="hub-funnel-add-branch" data-parent-step="' +
                    escapeHtml(step.id) + '">+ Não aceita ↓</button>';
            }
        }

        return '<div class="hub-funnel-builder__column" data-column-step="' + escapeHtml(step.id) + '">' +
            '<article class="hub-step-card ' + statusClass + inactiveClass + '" data-step-id="' + escapeHtml(step.id) + '">' +
                '<div class="hub-step-card__head">' +
                    '<span class="hub-step-drag-handle" data-drag-step="' + escapeHtml(step.id) + '" ' +
                        'title="Arrastar para reordenar (modo Seleccionar)">⋮⋮</span>' +
                    '<span class="hub-step-card__label">' + escapeHtml(step.label || pageType) + '</span>' +
                    renderStepToolbar(step, ctx) +
                '</div>' +
                '<div class="hub-step-card__body">' + body + '</div>' +
                renderStepEditLink(step, ctx) +
            '</article>' +
            branchBlock +
        '</div>';
    }

    function renderFunnelBuilder(ctx) {
        var flow = ctx.flow || [];
        var offerSlug = ctx.offer_slug;
        var funnelSlug = ctx.funnel_slug;
        var mainSteps = flow.filter(function (step) {
            return step.lane !== 'reject';
        }).sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });
        var rejectByParent = {};

        flow.forEach(function (step) {
            if (step.lane === 'reject' && step.parent_step_id) {
                rejectByParent[step.parent_step_id] = step;
            }
        });

        var columns = mainSteps.map(function (step, index) {
            var reject = rejectByParent[step.id] || null;
            var stepCtx = Object.assign({}, ctx, {
                step_index: index,
                step_count: mainSteps.length,
            });
            var column = renderStepCard(step, stepCtx, reject);
            var arrow = index < mainSteps.length - 1
                ? '<button type="button" class="hub-funnel-insert-step" data-after-step="' + escapeHtml(step.id) + '" ' +
                    'title="Inserir etapa aqui">+</button>'
                : '';

            return column + arrow;
        }).join('');

        var addOptions = STEP_KINDS.map(function (kind, index) {
            var optionValue = kind.system
                ? kind.kind
                : 'step-' + (kind.page_type || kind.kind) + '-' + index;

            return '<option value="' + escapeHtml(optionValue) + '" data-kind="' + escapeHtml(kind.kind) + '" ' +
                'data-page-type="' + escapeHtml(kind.page_type) + '" ' +
                'data-label="' + escapeHtml(kind.label) + '">' + escapeHtml(kind.label) + '</option>';
        }).join('');

        return '<div class="hub-funnel-builder" data-funnel-slug="' + escapeHtml(funnelSlug) + '" ' +
            'data-pan-x="' + (parseInt(ctx.pan_x, 10) || 0) + '" tabindex="0">' +
            '<div class="hub-funnel-builder__nav" role="toolbar" aria-label="Navegação do funil">' +
                '<button type="button" class="hub-funnel-nav-btn hub-funnel-nav-btn--select' +
                    (ctx.nav_mode !== 'hand' ? ' is-active' : '') + '" data-nav-tool="select" title="Seleccionar (V)">' +
                    '<span aria-hidden="true">↖</span><span class="hub-funnel-nav-btn__label">Seleccionar <kbd>V</kbd></span></button>' +
                '<button type="button" class="hub-funnel-nav-btn hub-funnel-nav-btn--hand' +
                    (ctx.nav_mode === 'hand' ? ' is-active' : '') + '" data-nav-tool="hand" title="Mão — arrastar (M)">' +
                    '<span aria-hidden="true">✋</span><span class="hub-funnel-nav-btn__label">Mão <kbd>M</kbd></span></button>' +
                '<span class="hub-funnel-builder__nav-sep" aria-hidden="true"></span>' +
                '<button type="button" class="hub-funnel-nav-btn" data-nav-scroll="left" title="Anterior">←</button>' +
                '<button type="button" class="hub-funnel-nav-btn" data-nav-scroll="right" title="Seguinte">→</button>' +
            '</div>' +
            '<p class="hub-funnel-builder__hint">' +
                '<strong>Seleccionar (V)</strong> — reordenar etapas (⋮⋮ ou ◀ ▶) · ' +
                '<strong>Mão (M)</strong> — deslocar funil (só quando há overflow)' +
            '</p>' +
            '<div class="hub-funnel-builder__canvas" data-funnel-canvas tabindex="0">' +
                '<div class="hub-funnel-builder__viewport" data-funnel-viewport>' +
                    '<div class="hub-funnel-builder__row-main">' + columns + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="hub-funnel-builder__actions">' +
                '<label class="hub-field hub-field--inline">' +
                    '<span class="hub-field__label">+ Etapa</span>' +
                    '<select class="hub-login__input" id="hub-funnel-add-kind-' + escapeHtml(funnelSlug) + '">' +
                        addOptions +
                    '</select>' +
                '</label>' +
                '<button type="button" class="hub-button hub-button--ghost hub-funnel-flow-add">Adicionar</button>' +
                '<button type="button" class="hub-button hub-funnel-flow-save">Guardar funil</button>' +
            '</div>' +
            '<p class="hub-form-message" data-funnel-flow-message hidden></p>' +
        '</div>';
    }

    function renderQuizStub(funnel, offerSlug) {
        return '<div class="hub-quiz-stub">' +
            '<p class="hub-panel__sub">Cria e edita pages do quiz no <strong>funil visual</strong> — usa + entre steps ou criar page.</p>' +
            '<button type="button" class="hub-button" data-quiz-open-funnel="' + escapeHtml(funnel.slug) + '">' +
                'Abrir funil visual</button>' +
        '</div>';
    }

    function pageTypeSelectHtml(name) {
        var options = PAGE_TYPE_OPTIONS.map(function (opt) {
            return '<option value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + '</option>';
        }).join('');

        return '<label class="hub-field"><span class="hub-field__label">Tipo</span>' +
            '<select class="hub-login__input" name="' + name + '">' + options + '</select></label>';
    }

    function bindCanvasNavigation(builderEl, options) {
        if (!builderEl) {
            return null;
        }

        if (builderEl._navAbort) {
            builderEl._navAbort.abort();
        }

        var abort = new AbortController();
        builderEl._navAbort = abort;
        var signal = abort.signal;

        var opts = options || {};
        var canvas = builderEl.querySelector('[data-funnel-canvas]');
        var viewport = builderEl.querySelector('[data-funnel-viewport]');
        var mode = opts.mode || builderEl.getAttribute('data-nav-mode') || 'select';
        var isPanning = false;
        var startX = 0;
        var startPanX = parseInt(builderEl.getAttribute('data-pan-x') || String(opts.pan_x || 0), 10) || 0;
        var panX = startPanX;
        var spaceHeld = false;

        function isEditableTarget(target) {
            if (!target || !target.closest) {
                return false;
            }

            return Boolean(target.closest('input, textarea, select, button, a, [contenteditable="true"]'));
        }

        function measureOverflow() {
            if (!canvas || !viewport) {
                return 0;
            }

            return Math.max(0, viewport.scrollWidth - canvas.clientWidth);
        }

        function getPanLimits() {
            var overflow = measureOverflow();

            if (overflow <= 1) {
                return { min: 0, max: 0 };
            }

            return { min: -overflow, max: 0 };
        }

        function clampPan(nextPanX) {
            var limits = getPanLimits();
            return Math.max(limits.min, Math.min(limits.max, nextPanX));
        }

        function updateNavScrollState() {
            var limits = getPanLimits();
            var hasOverflow = limits.min < 0;

            builderEl.querySelectorAll('[data-nav-scroll]').forEach(function (button) {
                var direction = button.getAttribute('data-nav-scroll');
                var disabled = !hasOverflow;

                if (!disabled && direction === 'left') {
                    disabled = panX >= limits.max - 1;
                }

                if (!disabled && direction === 'right') {
                    disabled = panX <= limits.min + 1;
                }

                button.disabled = disabled;
                button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
            });
        }

        function applyPan() {
            if (!viewport) {
                return;
            }

            panX = clampPan(panX);
            viewport.style.transform = 'translate3d(' + panX + 'px,0,0)';
            builderEl.setAttribute('data-pan-x', String(Math.round(panX)));
            updateNavScrollState();

            if (typeof opts.onPanChange === 'function') {
                opts.onPanChange(panX);
            }
        }

        function nudgePan(delta) {
            panX = clampPan(panX + delta);
            applyPan();
        }

        function setMode(nextMode) {
            mode = nextMode === 'hand' ? 'hand' : 'select';
            builderEl.setAttribute('data-nav-mode', mode);
            builderEl.classList.toggle('is-pan-mode', mode === 'hand');

            builderEl.querySelectorAll('[data-nav-tool]').forEach(function (button) {
                button.classList.toggle('is-active', button.getAttribute('data-nav-tool') === mode);
            });

            if (typeof opts.onModeChange === 'function') {
                opts.onModeChange(mode);
            }
        }

        setMode(mode);

        function scheduleMeasure() {
            window.requestAnimationFrame(function () {
                applyPan();
            });
        }

        scheduleMeasure();

        var parentDetails = [];

        (function collectDetails(node) {
            while (node) {
                if (node.tagName === 'DETAILS') {
                    parentDetails.push(node);
                }

                node = node.parentElement;
            }
        }(builderEl.parentElement));

        parentDetails.forEach(function (detailsEl) {
            detailsEl.addEventListener('toggle', scheduleMeasure, { signal: signal });
        });

        if (canvas && typeof ResizeObserver !== 'undefined') {
            var resizeObserver = new ResizeObserver(function () {
                applyPan();
            });

            resizeObserver.observe(canvas);

            if (viewport) {
                resizeObserver.observe(viewport);
            }

            signal.addEventListener('abort', function () {
                resizeObserver.disconnect();
            });
        }

        builderEl.querySelectorAll('[data-nav-tool]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                setMode(button.getAttribute('data-nav-tool'));
            }, { signal: signal });
        });

        builderEl.querySelectorAll('[data-nav-scroll]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                var delta = button.getAttribute('data-nav-scroll') === 'left' ? 320 : -320;
                nudgePan(delta);
            }, { signal: signal });
        });

        builderEl.addEventListener('keydown', function (event) {
            if (isEditableTarget(event.target)) {
                return;
            }

            handleShortcutKey(event);
        }, { signal: signal });

        function handleShortcutKey(event) {
            var key = String(event.key || '').toLowerCase();

            if (key === 'v') {
                event.preventDefault();
                setMode('select');
                return;
            }

            if (key === 'm') {
                event.preventDefault();
                setMode('hand');
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                nudgePan(320);
                return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                nudgePan(-320);
            }
        }

        document.addEventListener('keydown', function (event) {
            if (!builderEl.isConnected) {
                return;
            }

            if (event.code === 'Space' && !isEditableTarget(event.target)) {
                var detailsForSpace = builderEl.closest('details');

                if (!detailsForSpace || detailsForSpace.open) {
                    var inPanel = builderEl.contains(event.target) ||
                        Boolean(builderEl.closest('#hub-module-panel'));

                    if (inPanel) {
                        spaceHeld = true;
                        event.preventDefault();
                    }
                }
            }

            var details = builderEl.closest('details');

            if (details && !details.open) {
                return;
            }

            if (isEditableTarget(event.target)) {
                return;
            }

            var inFunnel = builderEl.contains(event.target) ||
                Boolean(event.target.closest && event.target.closest('.hub-funnel-builder'));

            if (!inFunnel && !builderEl.closest('#hub-module-panel')) {
                return;
            }

            handleShortcutKey(event);
        }, { signal: signal });

        document.addEventListener('keyup', function (event) {
            if (event.code === 'Space') {
                spaceHeld = false;

                if (isPanning) {
                    endPan();
                }
            }
        }, { signal: signal });

        builderEl.addEventListener('click', function (event) {
            if (!event.target.closest('input, textarea, select')) {
                builderEl.focus({ preventScroll: true });
            }
        }, { signal: signal });

        if (!canvas || !viewport) {
            return { setMode: setMode, nudgePan: nudgePan, applyPan: applyPan };
        }

        function beginPan(pageX) {
            isPanning = true;
            startX = pageX;
            startPanX = panX;
            canvas.classList.add('is-grabbing');
        }

        function movePan(pageX) {
            if (!isPanning) {
                return;
            }

            panX = clampPan(startPanX + (pageX - startX));
            viewport.style.transform = 'translate3d(' + panX + 'px,0,0)';
            updateNavScrollState();
        }

        function endPan() {
            if (!isPanning) {
                return;
            }

            isPanning = false;
            canvas.classList.remove('is-grabbing');
            applyPan();
        }

        function shouldStartPan(target, event) {
            var middlePan = event && event.button === 1;
            var handPan = mode === 'hand';
            var spacePan = spaceHeld && event && event.button === 0;

            if (!handPan && !middlePan && !spacePan) {
                return false;
            }

            if (target.closest('.hub-funnel-builder__nav, .hub-funnel-builder__actions')) {
                return false;
            }

            if (target.closest('button, input, textarea, select, a, label, .hub-step-drag-handle, .hub-step-card__toolbar, .hub-step-card__links')) {
                return false;
            }

            return true;
        }

        canvas.addEventListener('pointerdown', function (event) {
            if (!shouldStartPan(event.target, event)) {
                return;
            }

            beginPan(event.pageX);
            canvas.setPointerCapture(event.pointerId);
            event.preventDefault();
        }, { signal: signal, capture: true });

        canvas.addEventListener('pointermove', function (event) {
            if (!isPanning) {
                return;
            }

            movePan(event.pageX);
            event.preventDefault();
        }, { signal: signal, capture: true });

        canvas.addEventListener('pointerup', function (event) {
            endPan();

            try {
                canvas.releasePointerCapture(event.pointerId);
            } catch (error) {
                /* ignore */
            }
        }, { signal: signal, capture: true });

        canvas.addEventListener('pointercancel', function () {
            endPan();
        }, { signal: signal, capture: true });

        canvas.addEventListener('wheel', function (event) {
            if (measureOverflow() <= 1) {
                return;
            }

            if (mode !== 'hand' && !event.shiftKey && Math.abs(event.deltaX) < 1) {
                return;
            }

            event.preventDefault();
            nudgePan(-(event.deltaY + event.deltaX));
        }, { signal: signal, passive: false });

        return { setMode: setMode, nudgePan: nudgePan, applyPan: applyPan };
    }

    function bindDragReorder(builderEl, options) {
        if (!builderEl || !options || typeof options.onReorder !== 'function') {
            return;
        }

        var signal = options.signal;
        var draggingId = null;
        var activePointerId = null;
        var activeHandle = null;

        function clearDragState() {
            draggingId = null;
            activePointerId = null;
            activeHandle = null;
            builderEl.querySelectorAll('[data-column-step]').forEach(function (col) {
                col.classList.remove('is-dragging', 'is-drag-over');
            });
        }

        function findDropColumn(clientX, clientY) {
            var columns = builderEl.querySelectorAll('[data-column-step]');
            var hit = null;
            var nearest = null;
            var nearestDist = Infinity;

            columns.forEach(function (col) {
                if (col.classList.contains('is-dragging')) {
                    return;
                }

                var rect = col.getBoundingClientRect();

                if (clientX >= rect.left && clientX <= rect.right &&
                    clientY >= rect.top && clientY <= rect.bottom) {
                    hit = col;
                }

                var centerX = rect.left + (rect.width / 2);
                var dist = Math.abs(clientX - centerX);

                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = col;
                }
            });

            return hit || nearest;
        }

        function highlightDropTarget(clientX, clientY) {
            var column = findDropColumn(clientX, clientY);

            builderEl.querySelectorAll('[data-column-step]').forEach(function (col) {
                var isTarget = Boolean(column && col === column &&
                    col.getAttribute('data-column-step') !== draggingId);
                col.classList.toggle('is-drag-over', isTarget);
            });

            return column;
        }

        builderEl.querySelectorAll('[data-drag-step]').forEach(function (handle) {
            handle.addEventListener('pointerdown', function (event) {
                if (event.button !== 0) {
                    return;
                }

                if (builderEl.classList.contains('is-pan-mode') && typeof options.setSelectMode === 'function') {
                    options.setSelectMode();
                }

                event.preventDefault();
                event.stopPropagation();

                draggingId = handle.getAttribute('data-drag-step');
                activePointerId = event.pointerId;
                activeHandle = handle;
                handle.setPointerCapture(event.pointerId);

                var column = handle.closest('.hub-funnel-builder__column');

                if (column) {
                    column.classList.add('is-dragging');
                }
            }, signal ? { signal: signal } : undefined);

            handle.addEventListener('pointermove', function (event) {
                if (!draggingId || event.pointerId !== activePointerId) {
                    return;
                }

                highlightDropTarget(event.clientX, event.clientY);
            }, signal ? { signal: signal } : undefined);

            handle.addEventListener('pointerup', function (event) {
                if (!draggingId || event.pointerId !== activePointerId) {
                    return;
                }

                var column = highlightDropTarget(event.clientX, event.clientY);
                var targetId = column ? column.getAttribute('data-column-step') : null;

                if (targetId && targetId !== draggingId) {
                    options.onReorder(draggingId, targetId);
                }

                clearDragState();

                try {
                    handle.releasePointerCapture(event.pointerId);
                } catch (error) {
                    /* ignore */
                }
            }, signal ? { signal: signal } : undefined);

            handle.addEventListener('pointercancel', function (event) {
                if (event.pointerId !== activePointerId) {
                    return;
                }

                clearDragState();
            }, signal ? { signal: signal } : undefined);
        });
    }

    window.HubFunnelUI = {
        renderFunnelBuilder: renderFunnelBuilder,
        renderQuizStub: renderQuizStub,
        pageTypeSelectHtml: pageTypeSelectHtml,
        bindCanvasNavigation: bindCanvasNavigation,
        bindDragReorder: bindDragReorder,
        PAGE_TYPE_OPTIONS: PAGE_TYPE_OPTIONS,
        STEP_KINDS: STEP_KINDS,
    };
})();
