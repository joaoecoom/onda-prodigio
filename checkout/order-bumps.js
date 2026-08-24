(function () {
    var config = null;
    var form = null;
    var bumpList = null;
    var summaryLines = null;
    var summaryTotal = null;
    var onChange = null;

    function formatEuro(cents) {
        return (cents / 100).toFixed(2).replace('.', ',') + ' €';
    }

    function getSelectedBumpIds() {
        if (!form || !config || !config.orderBumps) {
            return [];
        }

        return config.orderBumps.filter(function (bump) {
            var input = form.querySelector('input[name="order_bump"][value="' + bump.bumpId + '"]');
            return input && input.checked;
        }).map(function (bump) {
            return bump.bumpId;
        });
    }

    function getTotalCents() {
        if (!config) {
            return 0;
        }

        var total = config.amountCents || 0;

        (config.orderBumps || []).forEach(function (bump) {
            if (getSelectedBumpIds().indexOf(bump.bumpId) !== -1) {
                total += bump.amountCents || 0;
            }
        });

        return total;
    }

    function renderSummary() {
        if (!summaryLines || !summaryTotal || !config) {
            return;
        }

        var html = '';
        html += '<div class="order-summary__row">';
        html += '<span class="order-summary__label">' + (config.productName || 'Produto') + '</span>';
        html += '<span class="order-summary__value">' + formatEuro(config.amountCents) + '</span>';
        html += '</div>';

        (config.orderBumps || []).forEach(function (bump) {
            if (getSelectedBumpIds().indexOf(bump.bumpId) === -1) {
                return;
            }

            html += '<div class="order-summary__row order-summary__row--bump">';
            html += '<span class="order-summary__label">' + bump.label + '</span>';
            html += '<span class="order-summary__value">' + formatEuro(bump.amountCents) + '</span>';
            html += '</div>';
        });

        summaryLines.innerHTML = html;
        summaryTotal.textContent = formatEuro(getTotalCents());
    }

    function renderBumps() {
        if (!bumpList || !config || !(config.orderBumps || []).length) {
            if (bumpList) {
                bumpList.innerHTML = '';
            }

            return;
        }

        bumpList.innerHTML = config.orderBumps.map(function (bump, index) {
            var inputId = 'order-bump-' + (index + 1);
            var imageHtml = bump.imageUrl
                ? '<img class="order-bump__image" src="' + String(bump.imageUrl).replace(/"/g, '&quot;') + '" alt="">'
                : '<div class="order-bump__image order-bump__image--empty" aria-hidden="true"></div>';
            var description = bump.description
                ? '<p class="order-bump__description">' + bump.description + '</p>'
                : '';

            return (
                '<article class="order-bump">' +
                    '<div class="order-bump__body">' +
                        imageHtml +
                        '<div class="order-bump__copy">' +
                            '<p class="order-bump__title">Adiciona isto: ' + bump.label + '</p>' +
                            description +
                            '<div class="order-bump__pricing">' +
                                '<strong class="order-bump__price">' + formatEuro(bump.amountCents) + '</strong>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<label class="order-bump__select" for="' + inputId + '">' +
                        '<input class="order-bump__checkbox" type="checkbox" id="' + inputId + '" name="order_bump" value="' + bump.bumpId + '">' +
                        '<span class="order-bump__select-text">Adicionar item</span>' +
                    '</label>' +
                '</article>'
            );
        }).join('');
    }

    function dispatchChange() {
        renderSummary();

        if (typeof onChange === 'function') {
            onChange({
                amountCents: getTotalCents(),
                selectedBumpIds: getSelectedBumpIds(),
            });
        }
    }

    function mount(nextConfig, elements) {
        config = nextConfig || {};
        form = elements.form;
        bumpList = elements.bumpList;
        summaryLines = elements.summaryLines;
        summaryTotal = elements.summaryTotal;
        onChange = elements.onChange || null;

        if (!form || !bumpList) {
            return;
        }

        renderBumps();
        renderSummary();

        bumpList.addEventListener('change', function (event) {
            if (event.target && event.target.name === 'order_bump') {
                dispatchChange();
            }
        });
    }

    window.CheckoutOrderBumps = {
        mount: mount,
        getTotalCents: getTotalCents,
        getSelectedBumpIds: getSelectedBumpIds,
        formatEuro: formatEuro,
    };
})();
