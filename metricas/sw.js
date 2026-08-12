/* eslint-disable no-restricted-globals */
self.addEventListener('push', function (event) {
    var payload = {
        title: 'Nova venda',
        body: '',
        tag: 'onda-sale',
        url: '/metricas/',
    };

    if (event.data) {
        try {
            payload = Object.assign(payload, event.data.json());
        } catch (error) {
            payload.body = event.data.text();
        }
    }

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            clientList.forEach(function (client) {
                client.postMessage({ type: 'play-sale-sound' });
            });

            return self.registration.showNotification(payload.title || 'Nova venda', {
                body: payload.body || '',
                icon: '/comunidade/assets/onda-prodigio.png',
                badge: '/comunidade/assets/onda-prodigio.png',
                tag: payload.tag || 'onda-sale',
                renotify: true,
                silent: false,
                sound: payload.sound || '/metricas/sounds/ka-ching.wav',
                vibrate: [120, 60, 120],
                data: {
                    url: payload.url || '/metricas/',
                    playSound: true,
                },
            });
        })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    var targetUrl = (event.notification.data && event.notification.data.url) || '/metricas/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
            for (var i = 0; i < clients.length; i += 1) {
                var client = clients[i];

                if (client.url.indexOf('/metricas') !== -1 && 'focus' in client) {
                    return client.focus();
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }

            return undefined;
        })
    );
});

self.addEventListener('install', function (event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});
