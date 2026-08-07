(function () {
    var OFFERS = {
        'clube-super-cerebros': {
            id: 'clube-super-cerebros',
            step: 'Oferta 1 de 2',
            image: '/comunidade/assets/products/clube-super-cerebros.png',
            headline: 'Entra no Clube dos Super Cérebros',
            subheadline: 'Comunidade exclusiva de pais com conteúdo novo todos os meses.',
            bullets: [
                'Acesso a uma comunidade fechada de pais comprometidos.',
                'Novos conteúdos e apoio contínuo para acompanhar o teu filho.',
                'Mensalidade — manténs o acesso enquanto a subscrição estiver activa.',
            ],
            billingNote: 'Subscrição mensal. Se deixares de renovar, o acesso ao clube é removido.',
            cta: 'Quero entrar no Clube',
            skip: 'Não, obrigado',
            nextPath: '/obgd/upsell2',
        },
        'codigo-autoridade': {
            id: 'codigo-autoridade',
            step: 'Oferta 2 de 2',
            image: '/comunidade/assets/products/codigo-autoridade.png',
            headline: 'Desbloqueia o Código da Autoridade',
            subheadline: 'Aulas práticas para criar rotina, autonomia e liderança em casa.',
            bullets: [
                'Aulas em vídeo para aplicares no dia a dia com o teu filho.',
                'Foco em autoridade calma, acordos claros e autonomia.',
                'Pagamento único — acesso permanente na área de membros.',
            ],
            billingNote: 'Compra única. O acesso fica disponível para sempre na tua conta.',
            cta: 'Sim, quero o Código da Autoridade',
            skip: 'Não, continuar sem esta oferta',
            nextPath: '/obgd/',
        },
    };

    var root = document.getElementById('upsell-root');
    var offerId = document.documentElement.getAttribute('data-upsell-id');
    var offer = OFFERS[offerId];

    function getParams() {
        return new URLSearchParams(window.location.search);
    }

    function getPaymentIntentId() {
        var params = getParams();
        var paymentIntentId = params.get('payment_intent') || '';
        var clientSecret = params.get('payment_intent_client_secret') || '';

        if (!paymentIntentId && clientSecret.indexOf('_secret') !== -1) {
            paymentIntentId = clientSecret.split('_secret')[0];
        }

        return paymentIntentId;
    }

    function isTestMode() {
        return getParams().get('mode') === 'test' || document.documentElement.getAttribute('data-stripe-mode') === 'test';
    }

    function buildNextUrl(path) {
        var params = getParams();
        params.delete('upsell');
        params.delete('upsell_status');
        params.delete('session_id');
        params.set('upsells', 'done');

        var query = params.toString();
        return path + (query ? '?' + query : '');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function render() {
        if (!root || !offer) {
            return;
        }

        root.innerHTML = (
            '<p class="upsell-step">' + escapeHtml(offer.step) + '</p>' +
            '<article class="upsell-card">' +
                '<div class="upsell-card__image-wrap">' +
                    '<img class="upsell-card__image" src="' + escapeHtml(offer.image) + '" alt="' + escapeHtml(offer.headline) + '">' +
                '</div>' +
                '<div class="upsell-card__body">' +
                    '<p class="upsell-card__eyebrow">Oferta exclusiva</p>' +
                    '<h1 class="upsell-card__title">' + escapeHtml(offer.headline) + '</h1>' +
                    '<p class="upsell-card__subtitle">' + escapeHtml(offer.subheadline) + '</p>' +
                    '<ul class="upsell-card__list">' +
                        offer.bullets.map(function (item) {
                            return '<li>' + escapeHtml(item) + '</li>';
                        }).join('') +
                    '</ul>' +
                    '<p class="upsell-card__note">' + escapeHtml(offer.billingNote) + '</p>' +
                    '<div class="upsell-card__actions">' +
                        '<button type="button" class="upsell-btn upsell-btn--primary" id="upsell-accept">' + escapeHtml(offer.cta) + '</button>' +
                        '<button type="button" class="upsell-btn upsell-btn--ghost" id="upsell-skip">' + escapeHtml(offer.skip) + '</button>' +
                    '</div>' +
                    '<p class="upsell-error" id="upsell-error" hidden></p>' +
                '</div>' +
            '</article>'
        );

        document.getElementById('upsell-skip').addEventListener('click', function () {
            window.location.href = buildNextUrl(offer.nextPath);
        });

        document.getElementById('upsell-accept').addEventListener('click', acceptOffer);
    }

    async function acceptOffer() {
        var paymentIntentId = getPaymentIntentId();
        var errorBox = document.getElementById('upsell-error');
        var acceptBtn = document.getElementById('upsell-accept');

        if (!paymentIntentId) {
            window.location.href = buildNextUrl(offer.nextPath);
            return;
        }

        errorBox.hidden = true;
        acceptBtn.disabled = true;
        acceptBtn.textContent = 'A preparar pagamento…';

        try {
            var payload = {
                upsell_id: offer.id,
                payment_intent_id: paymentIntentId,
            };

            if (isTestMode()) {
                payload.mode = 'test';
            }

            var response = await fetch(window.location.origin + '/api/create-upsell-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            var data = await response.json();

            if (!response.ok || !data.url) {
                throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
            }

            window.location.href = data.url;
        } catch (error) {
            acceptBtn.disabled = false;
            acceptBtn.textContent = offer.cta;
            errorBox.hidden = false;
            errorBox.textContent = error.message || 'Não foi possível iniciar o pagamento.';
        }
    }

    if (!offer) {
        if (root) {
            root.innerHTML = '<p class="upsell-error">Oferta indisponível.</p>';
        }
        return;
    }

    if (!getPaymentIntentId()) {
        window.location.replace(buildNextUrl(offer.nextPath));
        return;
    }

    render();
})();
