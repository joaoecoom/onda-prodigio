(function () {
    var STORAGE_KEY = 'comunidade-theme';

    function getTheme() {
        return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
        updateToggleButtons(theme);
    }

    function toggle() {
        applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    }

    function updateToggleButtons(theme) {
        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            var isDark = theme === 'dark';

            button.setAttribute('aria-label', isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro');
            button.setAttribute('title', isDark ? 'Tema claro' : 'Tema escuro');
            button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        });
    }

    function init() {
        applyTheme(getTheme());

        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            button.addEventListener('click', toggle);
        });
    }

    window.ComunidadeTheme = {
        getTheme: getTheme,
        applyTheme: applyTheme,
        toggle: toggle,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
