(function () {
    'use strict';

    var stackEl = null;
    var commandEl = null;
    var commandInput = null;
    var commandList = null;
    var commandCallback = null;
    var activeIndex = 0;
    var allCommandItems = [];

    function ensureToastStack() {
        if (stackEl) {
            return stackEl;
        }

        stackEl = document.createElement('div');
        stackEl.className = 'dr-toast-stack';
        stackEl.setAttribute('aria-live', 'polite');
        document.body.appendChild(stackEl);
        return stackEl;
    }

    function toast(message, type, durationMs) {
        var stack = ensureToastStack();
        var el = document.createElement('div');
        el.className = 'dr-toast dr-toast--' + (type || 'info');
        el.textContent = message;
        stack.appendChild(el);

        setTimeout(function () {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            el.style.transition = 'opacity 160ms ease, transform 160ms ease';

            setTimeout(function () {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            }, 180);
        }, durationMs || 3200);
    }

    function renderCommandList(items) {
        if (!commandList) {
            return;
        }

        var list = items || allCommandItems;

        commandList.innerHTML = list.map(function (item, index) {
            return '<button type="button" class="dr-command__item' +
                (index === activeIndex ? ' is-active' : '') +
                '" data-index="' + index + '">' +
                (item.icon || '') +
                '<span>' + item.label + '</span></button>';
        }).join('');

        commandList.querySelectorAll('.dr-command__item').forEach(function (button) {
            button.addEventListener('click', function () {
                var idx = parseInt(button.getAttribute('data-index'), 10);
                selectCommand(idx, list);
            });
        });
    }

    function filterCommands(query) {
        var q = String(query || '').trim().toLowerCase();

        if (!q) {
            return allCommandItems;
        }

        return allCommandItems.filter(function (item) {
            return item.label.toLowerCase().indexOf(q) !== -1 ||
                (item.keywords || []).some(function (kw) {
                    return kw.indexOf(q) !== -1;
                });
        });
    }

    function openCommand(items, onSelect) {
        if (!commandEl) {
            return;
        }

        allCommandItems = items || [];
        commandCallback = onSelect;
        activeIndex = 0;
        commandEl.hidden = false;
        commandInput.value = '';
        renderCommandList(allCommandItems);
        commandInput.focus();
    }

    function closeCommand() {
        if (commandEl) {
            commandEl.hidden = true;
        }

        commandCallback = null;
    }

    function selectCommand(index, list) {
        var filtered = list || filterCommands(commandInput ? commandInput.value : '');
        var item = filtered[index];

        if (!item || !commandCallback) {
            closeCommand();
            return;
        }

        closeCommand();
        commandCallback(item);
    }

    function bindCommandPalette() {
        commandEl = document.getElementById('dr-command-overlay');

        if (!commandEl) {
            return;
        }

        commandInput = commandEl.querySelector('.dr-command__input');
        commandList = commandEl.querySelector('.dr-command__list');

        commandEl.addEventListener('click', function (event) {
            if (event.target === commandEl) {
                closeCommand();
            }
        });

        if (commandInput) {
            commandInput.addEventListener('input', function () {
                activeIndex = 0;
                renderCommandList(filterCommands(commandInput.value));
            });

            commandInput.addEventListener('keydown', function (event) {
                var filtered = filterCommands(commandInput.value);

                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeCommand();
                    return;
                }

                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    activeIndex = Math.min(activeIndex + 1, Math.max(filtered.length - 1, 0));
                    renderCommandList(filtered);
                    return;
                }

                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    activeIndex = Math.max(activeIndex - 1, 0);
                    renderCommandList(filtered);
                    return;
                }

                if (event.key === 'Enter') {
                    event.preventDefault();
                    selectCommand(activeIndex, filtered);
                }
            });
        }
    }

    function initKeyboardShortcut(getItems, onSelect) {
        document.addEventListener('keydown', function (event) {
            var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            var mod = isMac ? event.metaKey : event.ctrlKey;

            if (mod && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                openCommand(getItems(), onSelect);
            }
        });
    }

    window.PlatformUI = {
        toast: toast,
        openCommand: openCommand,
        closeCommand: closeCommand,
        initCommandPalette: bindCommandPalette,
        initKeyboardShortcut: initKeyboardShortcut,
    };
})();
