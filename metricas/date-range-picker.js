(function (global) {
    var MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    var WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    var PRESETS = [
        { id: 'today', label: 'Hoje' },
        { id: 'yesterday', label: 'Ontem' },
        { id: 'today_yesterday', label: 'Hoje e ontem' },
        { id: 'last_7', label: 'Últimos 7 dias' },
        { id: 'last_14', label: 'Últimos 14 dias' },
        { id: 'last_28', label: 'Últimos 28 dias' },
        { id: 'last_30', label: 'Últimos 30 dias' },
        { id: 'this_week', label: 'Esta semana' },
        { id: 'last_week', label: 'Última semana' },
        { id: 'this_month', label: 'Este mês' },
        { id: 'last_month', label: 'O mês passado' },
        { id: 'max', label: 'Máximo' },
    ];

    function cloneDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function startOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function addDays(date, amount) {
        var next = cloneDate(date);
        next.setDate(next.getDate() + amount);
        return next;
    }

    function toIso(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function fromIso(value) {
        var parts = String(value || '').split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function sameDay(a, b) {
        return a && b
            && a.getFullYear() === b.getFullYear()
            && a.getMonth() === b.getMonth()
            && a.getDate() === b.getDate();
    }

    function compareDays(a, b) {
        return startOfDay(a).getTime() - startOfDay(b).getTime();
    }

    function startOfWeek(date) {
        var day = cloneDate(date);
        var weekday = (day.getDay() + 6) % 7;
        day.setDate(day.getDate() - weekday);
        return day;
    }

    function endOfWeek(date) {
        return addDays(startOfWeek(date), 6);
    }

    function startOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function endOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    function getPresetRange(id) {
        var today = startOfDay(new Date());

        switch (id) {
            case 'today':
                return { from: today, to: today, presetId: id };
            case 'yesterday': {
                var yesterday = addDays(today, -1);
                return { from: yesterday, to: yesterday, presetId: id };
            }
            case 'today_yesterday':
                return { from: addDays(today, -1), to: today, presetId: id };
            case 'last_7':
                return { from: addDays(today, -6), to: today, presetId: id };
            case 'last_14':
                return { from: addDays(today, -13), to: today, presetId: id };
            case 'last_28':
                return { from: addDays(today, -27), to: today, presetId: id };
            case 'last_30':
                return { from: addDays(today, -29), to: today, presetId: id };
            case 'this_week':
                return { from: startOfWeek(today), to: endOfWeek(today), presetId: id };
            case 'last_week': {
                var lastWeekDay = addDays(today, -7);
                return { from: startOfWeek(lastWeekDay), to: endOfWeek(lastWeekDay), presetId: id };
            }
            case 'this_month':
                return { from: startOfMonth(today), to: endOfMonth(today), presetId: id };
            case 'last_month': {
                var lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth), presetId: id };
            }
            case 'max':
                return { from: addDays(today, -729), to: today, presetId: id };
            default:
                return getPresetRange('today');
        }
    }

    function normalizeRange(from, to) {
        if (!from || !to) {
            return { from: from, to: to };
        }

        if (compareDays(from, to) > 0) {
            return { from: to, to: from };
        }

        return { from: from, to: to };
    }

    function formatDisplayDate(date) {
        return date.toLocaleDateString('pt-PT', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }

    function formatTriggerLabel(range) {
        if (range.presetId === 'max') {
            return 'Máximo';
        }

        if (range.presetId) {
            var preset = PRESETS.find(function (item) {
                return item.id === range.presetId;
            });

            if (preset) {
                if (range.presetId === 'today') {
                    return 'Hoje: ' + formatDisplayDate(range.from);
                }

                return preset.label;
            }
        }

        if (!range.from || !range.to) {
            return 'Máximo';
        }

        if (sameDay(range.from, range.to)) {
            return formatDisplayDate(range.from);
        }

        return formatDisplayDate(range.from) + ' – ' + formatDisplayDate(range.to);
    }

    function detectPreset(from, to) {
        if (!from && !to) {
            return 'max';
        }

        for (var i = 0; i < PRESETS.length; i += 1) {
            var presetRange = getPresetRange(PRESETS[i].id);

            if (!presetRange.from && !presetRange.to) {
                continue;
            }

            if (sameDay(presetRange.from, from) && sameDay(presetRange.to, to)) {
                return PRESETS[i].id;
            }
        }

        return '';
    }

    function createDateRangePicker(options) {
        var root = options.root;
        var onApply = options.onApply;
        var appliedRange = getPresetRange(options.defaultPreset || 'today');
        var draftRange = Object.assign({}, appliedRange);
        var viewMonth = startOfMonth(appliedRange.from || new Date());
        var pendingStart = null;
        var open = false;

        root.className = 'metrics-date-picker';
        root.innerHTML = (
            '<button type="button" class="metrics-date-picker__trigger" id="metrics-date-trigger" aria-expanded="false" aria-haspopup="dialog">' +
            '<svg class="metrics-date-picker__icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v13A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-13A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1Zm12.5 7H4.5v10.5c0 .276.224.5.5.5h15a.5.5 0 0 0 .5-.5V9Z"/></svg>' +
            '<span class="metrics-date-picker__label" id="metrics-date-label"></span>' +
            '</button>' +
            '<div class="metrics-date-picker__popover" id="metrics-date-popover" hidden role="dialog" aria-label="Seleccionar período">' +
            '<div class="metrics-date-picker__layout">' +
            '<aside class="metrics-date-picker__presets" id="metrics-date-presets"></aside>' +
            '<div class="metrics-date-picker__main">' +
            '<div class="metrics-date-picker__calendars" id="metrics-date-calendars"></div>' +
            '<div class="metrics-date-picker__footer">' +
            '<div class="metrics-date-picker__inputs">' +
            '<input class="metrics-date-picker__input" id="metrics-date-from" type="date">' +
            '<span class="metrics-date-picker__dash">—</span>' +
            '<input class="metrics-date-picker__input" id="metrics-date-to" type="date">' +
            '</div>' +
            '<p class="metrics-date-picker__tz">Datas no teu fuso horário local (Portugal).</p>' +
            '<div class="metrics-date-picker__actions">' +
            '<button type="button" class="metrics-button metrics-button--ghost" id="metrics-date-cancel">Cancelar</button>' +
            '<button type="button" class="metrics-date-picker__apply" id="metrics-date-apply">Actualizar</button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>'
        );

        var trigger = root.querySelector('#metrics-date-trigger');
        var popover = root.querySelector('#metrics-date-popover');
        var labelNode = root.querySelector('#metrics-date-label');
        var presetsRoot = root.querySelector('#metrics-date-presets');
        var calendarsRoot = root.querySelector('#metrics-date-calendars');
        var fromInput = root.querySelector('#metrics-date-from');
        var toInput = root.querySelector('#metrics-date-to');
        var cancelButton = root.querySelector('#metrics-date-cancel');
        var applyButton = root.querySelector('#metrics-date-apply');

        function syncDraftToInputs() {
            fromInput.value = draftRange.from ? toIso(draftRange.from) : '';
            toInput.value = draftRange.to ? toIso(draftRange.to) : '';
        }

        function updateTriggerLabel() {
            labelNode.textContent = formatTriggerLabel(appliedRange);
        }

        function renderPresets() {
            presetsRoot.innerHTML = PRESETS.map(function (preset) {
                var active = draftRange.presetId === preset.id ? ' metrics-date-picker__preset--active' : '';
                return (
                    '<button type="button" class="metrics-date-picker__preset' + active + '" data-preset="' + preset.id + '">' +
                    escapeHtml(preset.label) +
                    '</button>'
                );
            }).join('');
        }

        function isInRange(day, from, to) {
            if (!from || !to) {
                return false;
            }

            var time = startOfDay(day).getTime();
            return time >= startOfDay(from).getTime() && time <= startOfDay(to).getTime();
        }

        function renderMonth(monthDate, side) {
            var monthStart = startOfMonth(monthDate);
            var monthEnd = endOfMonth(monthDate);
            var gridStart = startOfWeek(monthStart);
            var cells = [];
            var cursor = gridStart;

            while (cursor <= addDays(monthEnd, 6 - ((monthEnd.getDay() + 6) % 7))) {
                cells.push(cloneDate(cursor));
                cursor = addDays(cursor, 1);
            }

            var daysHtml = cells.map(function (day) {
                var classes = ['metrics-date-picker__day'];
                var inMonth = day.getMonth() === monthDate.getMonth();
                var selectedStart = draftRange.from && sameDay(day, draftRange.from);
                var selectedEnd = draftRange.to && sameDay(day, draftRange.to);
                var inRange = isInRange(day, draftRange.from, draftRange.to);
                var isToday = sameDay(day, new Date());

                if (!inMonth) {
                    classes.push('metrics-date-picker__day--muted');
                }

                if (selectedStart) {
                    classes.push('metrics-date-picker__day--start');
                }

                if (selectedEnd) {
                    classes.push('metrics-date-picker__day--end');
                }

                if (inRange && !selectedStart && !selectedEnd) {
                    classes.push('metrics-date-picker__day--in-range');
                }

                if (isToday) {
                    classes.push('metrics-date-picker__day--today');
                }

                return (
                    '<button type="button" class="' + classes.join(' ') + '" data-date="' + toIso(day) + '">' +
                    day.getDate() +
                    '</button>'
                );
            }).join('');

            var title = MONTHS[monthDate.getMonth()] + ' ' + monthDate.getFullYear();
            var headHtml = side === 'left'
                ? (
                    '<div class="metrics-date-picker__month-head">' +
                    '<button type="button" class="metrics-date-picker__nav metrics-date-picker__nav--prev" data-shift="-1" aria-label="Mês anterior">‹</button>' +
                    '<strong>' + title + '</strong>' +
                    '<span class="metrics-date-picker__nav-spacer"></span>' +
                    '</div>'
                )
                : (
                    '<div class="metrics-date-picker__month-head">' +
                    '<span class="metrics-date-picker__nav-spacer"></span>' +
                    '<strong>' + title + '</strong>' +
                    '<button type="button" class="metrics-date-picker__nav metrics-date-picker__nav--next" data-shift="1" aria-label="Mês seguinte">›</button>' +
                    '</div>'
                );

            return (
                '<section class="metrics-date-picker__month">' +
                headHtml +
                '<div class="metrics-date-picker__weekdays">' +
                WEEKDAYS.map(function (name) {
                    return '<span>' + name + '</span>';
                }).join('') +
                '</div>' +
                '<div class="metrics-date-picker__grid">' + daysHtml + '</div>' +
                '</section>'
            );
        }

        function renderCalendars() {
            var monthA = viewMonth;
            var monthB = startOfMonth(addDays(endOfMonth(viewMonth), 1));

            calendarsRoot.innerHTML = (
                '<div class="metrics-date-picker__months">' +
                renderMonth(monthA, 'left') +
                renderMonth(monthB, 'right') +
                '</div>'
            );
        }

        function renderAll() {
            renderPresets();
            renderCalendars();
            syncDraftToInputs();
        }

        function setDraftRange(range) {
            draftRange = Object.assign({}, range);
            pendingStart = null;
            renderAll();
        }

        function openPopover() {
            draftRange = Object.assign({}, appliedRange);
            pendingStart = null;
            viewMonth = startOfMonth(appliedRange.from || new Date());
            open = true;
            popover.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            renderAll();
        }

        function closePopover() {
            open = false;
            popover.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        }

        function applyDraft() {
            if (draftRange.presetId !== 'max' && (!draftRange.from || !draftRange.to)) {
                return;
            }

            appliedRange = Object.assign({}, draftRange);
            updateTriggerLabel();
            closePopover();

            if (typeof onApply === 'function') {
                onApply(getAppliedRange());
            }
        }

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function getAppliedRange() {
            return {
                from: appliedRange.from ? toIso(appliedRange.from) : '',
                to: appliedRange.to ? toIso(appliedRange.to) : '',
                presetId: appliedRange.presetId || detectPreset(appliedRange.from, appliedRange.to),
            };
        }

        trigger.addEventListener('click', function () {
            if (open) {
                closePopover();
            } else {
                openPopover();
            }
        });

        presetsRoot.addEventListener('click', function (event) {
            event.stopPropagation();

            var button = event.target.closest('[data-preset]');

            if (!button) {
                return;
            }

            var presetRange = getPresetRange(button.getAttribute('data-preset'));
            setDraftRange(presetRange);

            if (presetRange.from) {
                viewMonth = startOfMonth(presetRange.from);
            }
        });

        calendarsRoot.addEventListener('click', function (event) {
            event.stopPropagation();

            var nav = event.target.closest('[data-shift]');

            if (nav) {
                var shift = Number(nav.getAttribute('data-shift'));
                viewMonth = startOfMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + shift, 1));
                renderCalendars();
                return;
            }

            var dayButton = event.target.closest('[data-date]');

            if (!dayButton) {
                return;
            }

            var clicked = fromIso(dayButton.getAttribute('data-date'));

            if (pendingStart === null) {
                pendingStart = clicked;
                draftRange = { from: clicked, to: clicked, presetId: '' };
            } else {
                var normalized = normalizeRange(pendingStart, clicked);
                draftRange = {
                    from: normalized.from,
                    to: normalized.to,
                    presetId: detectPreset(normalized.from, normalized.to),
                };
                pendingStart = null;
            }

            renderAll();
        });

        popover.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        cancelButton.addEventListener('click', function (event) {
            event.stopPropagation();
            closePopover();
        });

        applyButton.addEventListener('click', function (event) {
            event.stopPropagation();
            applyDraft();
        });

        fromInput.addEventListener('change', function () {
            if (!fromInput.value) {
                return;
            }

            draftRange.from = fromIso(fromInput.value);
            draftRange.presetId = detectPreset(draftRange.from, draftRange.to);
            renderAll();
        });

        toInput.addEventListener('change', function () {
            if (!toInput.value) {
                return;
            }

            draftRange.to = fromIso(toInput.value);
            draftRange.presetId = detectPreset(draftRange.from, draftRange.to);
            renderAll();
        });

        document.addEventListener('click', function (event) {
            if (!open) {
                return;
            }

            var path = typeof event.composedPath === 'function' ? event.composedPath() : [];

            if (path.indexOf(root) !== -1 || root.contains(event.target)) {
                return;
            }

            closePopover();
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && open) {
                closePopover();
            }
        });

        updateTriggerLabel();

        return {
            getAppliedRange: getAppliedRange,
            open: openPopover,
            close: closePopover,
        };
    }

    global.MetricsDateRangePicker = {
        create: createDateRangePicker,
    };
}(window));
