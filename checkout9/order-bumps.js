(function () {
    var BASE_AMOUNT_CENTS = 900;
    var BUMP_AMOUNT_CENTS = 500;

    var ORDER_BUMPS = [
        {
            id: 'tardes-sem-brigas',
            title: 'Tardes Sem Brigas',
            description: 'Chega de fazer tudo sozinho: medias as tarefas e ela executa o plano sem refilar nem inventar desculpas. Com o nosso Guia Passo a Passo, consegues acordos claros sobre como desenhar a semana, dividir sem gritos e manter o ritmo sem discussão no quarto.',
            image: 'assets/order-bump-tardes.jpg',
            compareAtCents: 1429,
            discountLabel: '-65%',
        },
        {
            id: 'caixa-super-truques',
            title: 'A Caixa Super Truques do Génio',
            description: 'Usa actividades rápidas de motivação e memória («Super Truques do Génio») que já vimos em mais de 500 famílias. Prepara campeonatos de Estudo Relâmpago e outras técnicas para que assimile mais e sinta orgulho pelas pequenas vitórias.',
            image: 'assets/order-bump-truques.jpg',
            compareAtCents: 1429,
            discountLabel: '-65%',
        },
        {
            id: 'grandes-mentes',
            title: 'Grandes Mentes',
            description: '+30 actividades para fazer juntos e compreender a gestão emocional do teu filho. É o passo seguro para comunicar sem guerras, alinhar discursos com a tua família e melhorar as reações diante dos golpes da rotina.',
            image: 'assets/order-bump-mentes.jpg',
            compareAtCents: 1786,
            discountLabel: '-72%',
        },
    ];

    var form = document.getElementById('checkout-form');
    var bumpList = document.getElementById('order-bump-list');
    var summaryLines = document.getElementById('order-summary-lines');
    var summaryTotal = document.getElementById('order-summary-total');

    if (!form || !bumpList || !summaryLines || !summaryTotal) {
        return;
    }

    function formatEuro(cents) {
        return (cents / 100).toFixed(2).replace('.', ',') + ' €';
    }

    function getSelectedBumpIds() {
        var selected = [];

        ORDER_BUMPS.forEach(function (bump) {
            var input = form.querySelector('input[name="order_bump"][value="' + bump.id + '"]');

            if (input && input.checked) {
                selected.push(bump.id);
            }
        });

        return selected;
    }

    function getTotalCents() {
        return BASE_AMOUNT_CENTS + (getSelectedBumpIds().length * BUMP_AMOUNT_CENTS);
    }

    function renderSummary() {
        var selectedIds = getSelectedBumpIds();
        var html = '';

        html += '<div class="order-summary__row">';
        html += '<span class="order-summary__label">Onda Prodígio</span>';
        html += '<span class="order-summary__value">' + formatEuro(BASE_AMOUNT_CENTS) + '</span>';
        html += '</div>';

        ORDER_BUMPS.forEach(function (bump) {
            if (selectedIds.indexOf(bump.id) === -1) {
                return;
            }

            html += '<div class="order-summary__row order-summary__row--bump">';
            html += '<span class="order-summary__label">' + bump.title + '</span>';
            html += '<span class="order-summary__value">' + formatEuro(BUMP_AMOUNT_CENTS) + '</span>';
            html += '</div>';
        });

        summaryLines.innerHTML = html;
        summaryTotal.textContent = formatEuro(getTotalCents());
    }

    function renderBumps() {
        bumpList.innerHTML = ORDER_BUMPS.map(function (bump, index) {
            var inputId = 'order-bump-' + (index + 1);

            return (
                '<article class="order-bump">' +
                    '<div class="order-bump__body">' +
                        '<img class="order-bump__image" src="' + bump.image + '" alt="" width="88" height="88" loading="lazy">' +
                        '<div class="order-bump__content">' +
                            '<h3 class="order-bump__title">Adiciona isto: ' + bump.title + '</h3>' +
                            '<p class="order-bump__description">' + bump.description + '</p>' +
                            '<div class="order-bump__pricing">' +
                                '<span class="order-bump__badge" aria-hidden="true">⬇ ' + bump.discountLabel + '</span>' +
                                '<span class="order-bump__compare">' + formatEuro(bump.compareAtCents) + '</span>' +
                                '<span class="order-bump__price">' + formatEuro(BUMP_AMOUNT_CENTS) + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<label class="order-bump__select" for="' + inputId + '">' +
                        '<input class="order-bump__checkbox" type="checkbox" id="' + inputId + '" name="order_bump" value="' + bump.id + '">' +
                        '<span class="order-bump__select-text">Adicionar item</span>' +
                    '</label>' +
                '</article>'
            );
        }).join('');
    }

    function dispatchTotalChange() {
        renderSummary();

        document.dispatchEvent(new CustomEvent('checkout:total-change', {
            detail: {
                amountCents: getTotalCents(),
                orderBumps: getSelectedBumpIds(),
            },
        }));
    }

    renderBumps();
    renderSummary();

    bumpList.addEventListener('change', function (event) {
        if (event.target && event.target.name === 'order_bump') {
            dispatchTotalChange();
        }
    });

    window.CheckoutOrderBumps = {
        getTotalCents: getTotalCents,
        getSelectedBumpIds: getSelectedBumpIds,
        formatEuro: formatEuro,
        BASE_AMOUNT_CENTS: BASE_AMOUNT_CENTS,
        BUMP_AMOUNT_CENTS: BUMP_AMOUNT_CENTS,
    };
})();
