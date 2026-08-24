(function () {
    var MODE_LABELS = {
        funnel: 'Funil',
        tracking: 'Tracking',
        domain: 'Domínio',
        checkout: 'Checkout',
        page: 'Página',
        general: 'Geral',
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderMessages(container, messages) {
        if (!messages.length) {
            container.innerHTML = '<p class="hub-gemini__empty">Descreve o que queres construir ou configurar.</p>';
            return;
        }

        container.innerHTML = messages.map(function (msg) {
            var roleClass = msg.role === 'user' ? 'is-user' : 'is-assistant';
            return '<div class="hub-gemini__msg ' + roleClass + '">' +
                '<div class="hub-gemini__msg-role">' +
                    (msg.role === 'user' ? 'Tu' : 'Gemini') +
                '</div>' +
                '<div class="hub-gemini__msg-body">' + escapeHtml(msg.content).replace(/\n/g, '<br>') + '</div>' +
            '</div>';
        }).join('');

        container.scrollTop = container.scrollHeight;
    }

    async function mount(container, options) {
        if (!container) {
            return;
        }

        var ctx = options || {};
        var mode = ctx.mode || 'general';
        var messages = [];
        var busy = false;
        var geminiConfigured = ctx.geminiConfigured;

        if (geminiConfigured === undefined && ctx.apiFetch) {
            container.innerHTML = '<p class="hub-panel__sub">A verificar Gemini…</p>';

            try {
                var statusPayload = await ctx.apiFetch('/api/sales-attribution?action=hub_gemini_status');
                geminiConfigured = Boolean(statusPayload.gemini && statusPayload.gemini.configured);
            } catch (error) {
                geminiConfigured = false;
            }
        } else {
            geminiConfigured = geminiConfigured !== false;
        }

        renderUi(container, ctx, mode, messages, busy, geminiConfigured);
    }

    function renderUi(container, ctx, mode, messages, busy, geminiConfigured) {

        container.innerHTML =
            '<div class="hub-gemini">' +
                '<div class="hub-gemini__head">' +
                    '<div>' +
                        '<strong>Assistente Gemini</strong>' +
                        '<span class="hub-gemini__mode">' + escapeHtml(MODE_LABELS[mode] || mode) + '</span>' +
                    '</div>' +
                    (geminiConfigured
                        ? '<span class="dr-status dr-status--connected"><span class="dr-status__dot"></span> Gemini</span>'
                        : '<span class="dr-status dr-status--missing"><span class="dr-status__dot"></span> GEMINI_API_KEY em falta</span>') +
                '</div>' +
                '<div class="hub-gemini__messages" id="hub-gemini-messages"></div>' +
                '<form class="hub-gemini__form" id="hub-gemini-form">' +
                    '<textarea class="hub-login__input hub-gemini__input" id="hub-gemini-input" rows="3" ' +
                        'placeholder="Ex.: Cria funil Vendas com sales page, upsell 1 e thank you…" ' +
                        (geminiConfigured ? '' : ' disabled') + '></textarea>' +
                    '<div class="hub-gemini__actions">' +
                        '<button type="submit" class="hub-button"' + (geminiConfigured ? '' : ' disabled') +
                            '>Enviar</button>' +
                    '</div>' +
                    '<p class="hub-form-message" id="hub-gemini-error" hidden></p>' +
                '</form>' +
            '</div>';

        var messagesEl = container.querySelector('#hub-gemini-messages');
        var form = container.querySelector('#hub-gemini-form');
        var input = container.querySelector('#hub-gemini-input');
        var errorEl = container.querySelector('#hub-gemini-error');

        renderMessages(messagesEl, messages);

        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            if (busy || !geminiConfigured || !ctx.apiFetch || !ctx.offer) {
                return;
            }

            var text = input.value.trim();

            if (!text) {
                return;
            }

            busy = true;
            errorEl.hidden = true;
            messages.push({ role: 'user', content: text });
            renderMessages(messagesEl, messages);
            input.value = '';

            if (ctx.onStatus) {
                ctx.onStatus('Gemini a trabalhar…');
            }

            try {
                if (!ctx.offer || !ctx.offer.slug) {
                    throw new Error('Oferta em falta — recarrega a página e tenta de novo.');
                }

                var payload = await ctx.apiFetch('/api/sales-attribution?action=hub_gemini_chat', {
                    method: 'POST',
                    body: {
                        slug: ctx.offer.slug,
                        mode: mode,
                        message: text,
                        messages: messages.slice(0, -1),
                    },
                });

                messages.push({ role: 'assistant', content: payload.reply || 'Feito.' });
                renderMessages(messagesEl, messages);

                if (ctx.onComplete) {
                    ctx.onComplete(payload);
                }

                if (ctx.onStatus) {
                    ctx.onStatus('');
                }
            } catch (error) {
                errorEl.textContent = error.message;
                errorEl.hidden = false;

                if (ctx.onStatus) {
                    ctx.onStatus('');
                }
            } finally {
                busy = false;
            }
        });
    }

    window.HubGemini = {
        mount: mount,
        MODE_LABELS: MODE_LABELS,
    };
})();
