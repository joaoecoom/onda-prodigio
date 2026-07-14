(function () {
    var BASE_AMOUNT_CENTS = 900;
    var BUMP_AMOUNT_CENTS = 500;

    var ORDER_BUMPS = [
        {
            id: 'tardes-sem-brigas',
            title: 'A Fábrica das Tardes Tranquilas',
            description: 'As birras transformam-se em disciplina automática. Um sistema passo a passo para acordos claros, tarefas completas e tardes sem discussão no quarto.',
            image: 'assets/order-bump-tardes.png',
            compareAtCents: 1429,
            discountLabel: '-65%',
        },
        {
            id: 'caixa-super-truques',
            title: 'A Caixa dos Super Truques do Génio',
            description: 'Ferramentas práticas de concentração, autonomia, disciplina e motivação. As pequenas escolhas criam grandes resultados para rapazes e raparigas com futuro de génio.',
            image: 'assets/order-bump-truques.png',
            compareAtCents: 1429,
            discountLabel: '-65%',
        },
        {
            id: 'grandes-mentes',
            title: 'Grandes Mentes',
            description: 'Mais de 40 actividades criativas para ajudar as crianças a crescer confiantes e emocionalmente saudáveis. Desenvolve inteligência emocional, autoestima e confiança.',
            image: 'assets/order-bump-mentes.png',
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
