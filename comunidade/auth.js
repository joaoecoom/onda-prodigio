(function () {
    var supabaseClient = null;
    var configPromise = null;

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[data-supabase-sdk="true"]');

            if (existing) {
                if (window.supabase) {
                    resolve(window.supabase);
                    return;
                }

                existing.addEventListener('load', function () {
                    resolve(window.supabase);
                });

                existing.addEventListener('error', reject);
                return;
            }

            var script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.setAttribute('data-supabase-sdk', 'true');
            script.onload = function () {
                resolve(window.supabase);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function getConfig() {
        if (!configPromise) {
            configPromise = fetch('/api/comunidade/config').then(function (response) {
                if (!response.ok) {
                    throw new Error('Config indisponível.');
                }

                return response.json();
            });
        }

        return configPromise;
    }

    async function getClient() {
        if (supabaseClient) {
            return supabaseClient;
        }

        var sdk = await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
        var config = await getConfig();

        supabaseClient = sdk.createClient(config.supabaseUrl, config.supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        });

        return supabaseClient;
    }

    async function getSession() {
        var client = await getClient();
        var result = await client.auth.getSession();
        return result.data.session || null;
    }

    async function getAccessToken() {
        var session = await getSession();
        return session ? session.access_token : '';
    }

    async function apiFetch(path, options) {
        var token = await getAccessToken();
        var headers = Object.assign({
            'Content-Type': 'application/json',
        }, (options && options.headers) || {});

        if (token) {
            headers.Authorization = 'Bearer ' + token;
        }

        return fetch(path, Object.assign({}, options || {}, {
            headers: headers,
        }));
    }

    async function requireAuth() {
        var session = await getSession();

        if (!session) {
            window.location.href = '/comunidade/login';
            return null;
        }

        return session;
    }

    async function signOut() {
        var client = await getClient();
        await client.auth.signOut();
        window.location.href = '/comunidade/login';
    }

    window.ComunidadeAuth = {
        getClient: getClient,
        getSession: getSession,
        getAccessToken: getAccessToken,
        apiFetch: apiFetch,
        requireAuth: requireAuth,
        signOut: signOut,
    };
})();
