(function () {
    var PRODUCT_ID = 'onda-prodigio';
    var responsesRoot = document.getElementById('responses-root');
    var topbarUser = document.getElementById('topbar-user');

    async function boot() {
        var session = await window.ComunidadeAuth.requireAuth();

        if (!session) {
            return;
        }

        var meResponse = await window.ComunidadeAuth.apiFetch('/api/comunidade/me');
        var meData = await meResponse.json();

        if (!meResponse.ok || meData.role !== 'admin') {
            window.location.href = '/comunidade';
            return;
        }

        topbarUser.textContent = (meData.name || 'Admin') + ' · Admin';
        topbarUser.title = meData.email || '';

        if (window.ComunidadeTheme && window.ComunidadeTheme.syncTopbarHeight) {
            window.ComunidadeTheme.syncTopbarHeight();
        }

        if (window.ComunidadeWelcomeSurvey) {
            await window.ComunidadeWelcomeSurvey.mountResponsesPage(responsesRoot, PRODUCT_ID);
        }
    }

    document.getElementById('btn-logout').addEventListener('click', function () {
        window.ComunidadeAuth.signOut();
    });

    boot();
})();
