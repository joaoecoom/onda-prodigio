(function () {
    var SW_URL = '/metricas/sw.js';
    var SW_SCOPE = '/metricas/';
    var currentSubscription = null;

    function urlBase64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        var rawData = window.atob(base64);
        var outputArray = new Uint8Array(rawData.length);

        for (var i = 0; i < rawData.length; i += 1) {
            outputArray[i] = rawData.charCodeAt(i);
        }

        return outputArray;
    }

    async function fetchPushConfig(token) {
        var response = await fetch('/api/sales-attribution?action=push_config', {
            headers: {
                Authorization: 'Bearer ' + token,
            },
        });
        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Push indisponível.');
        }

        return data;
    }

    async function postSubscription(token, subscription, action) {
        var response = await fetch('/api/sales-attribution?action=' + action, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subscription: subscription,
            }),
        });
        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível activar notificações.');
        }

        return data;
    }

    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service worker não suportado neste browser.');
        }

        return navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    }

    async function subscribe(token, options) {
        var opts = options || {};
        var config = await fetchPushConfig(token);

        if (!config.enabled || !config.vapid_public_key) {
            throw new Error('Push não configurado no servidor.');
        }

        await registerServiceWorker();
        var registration = await navigator.serviceWorker.ready;

        var existing = await registration.pushManager.getSubscription();

        if (existing) {
            currentSubscription = existing;
            await postSubscription(token, existing.toJSON(), 'push_subscribe');
            return existing;
        }

        if (!opts.force && Notification.permission === 'denied') {
            throw new Error('Notificações bloqueadas nas definições do telemóvel.');
        }

        var permission = Notification.permission;

        if (permission !== 'granted') {
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
            throw new Error('Permissão de notificações recusada.');
        }

        var subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
        });

        currentSubscription = subscription;
        await postSubscription(token, subscription.toJSON(), 'push_subscribe');
        return subscription;
    }

    async function unsubscribe(token) {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        try {
            var registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);

            if (!registration) {
                return;
            }

            var subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                return;
            }

            if (token) {
                await postSubscription(token, { endpoint: subscription.endpoint }, 'push_unsubscribe');
            }

            await subscription.unsubscribe();
            currentSubscription = null;
        } catch (error) {
            // Ignorar erros ao sair.
        }
    }

    function isSupported() {
        return 'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window;
    }

    function getPermission() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }

        return Notification.permission;
    }

    window.MetricsPush = {
        isSupported: isSupported,
        getPermission: getPermission,
        subscribe: subscribe,
        unsubscribe: unsubscribe,
    };
})();
