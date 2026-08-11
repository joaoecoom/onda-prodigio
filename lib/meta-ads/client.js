var API_VERSION = 'v21.0';
var BASE_URL = 'https://graph.facebook.com/' + API_VERSION;

function MetaApiError(errorBody) {
    var message = errorBody && errorBody.message
        ? errorBody.message
        : 'Meta API falhou.';
    var err = new Error(message);
    err.meta = errorBody || null;
    err.code = errorBody && errorBody.code ? errorBody.code : 0;
    return err;
}

function getAccessToken() {
    return String(process.env.META_ACCESS_TOKEN || process.env.META_ADS_ACCESS_TOKEN || '').trim();
}

function buildUrl(path, params, accessToken) {
    var url = new URL(BASE_URL + path);

    Object.keys(params || {}).forEach(function (key) {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            url.searchParams.set(key, String(params[key]));
        }
    });

    url.searchParams.set('access_token', accessToken);
    return url.toString();
}

function isRateLimitError(errorBody) {
    if (!errorBody) {
        return false;
    }

    var code = Number(errorBody.code || 0);
    var message = String(errorBody.message || '').toLowerCase();

    return code === 4 || code === 17 || code === 32 || code === 613 ||
        message.indexOf('request limit') !== -1 ||
        message.indexOf('rate limit') !== -1 ||
        message.indexOf('too many calls') !== -1;
}

function waitMs(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

async function graphGet(path, params) {
    var accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('META_ACCESS_TOKEN em falta.');
    }

    var attempt = 0;
    var maxAttempts = 3;

    while (attempt < maxAttempts) {
        var response = await fetch(buildUrl(path, params, accessToken));
        var body = await response.json();

        if ((!response.ok || body.error) && isRateLimitError(body.error) && attempt < maxAttempts - 1) {
            attempt += 1;
            await waitMs(attempt * 4000);
            continue;
        }

        if (!response.ok || body.error) {
            throw MetaApiError(body.error || { message: 'Meta API GET falhou.' });
        }

        return body;
    }

    throw MetaApiError({ message: 'Meta API GET falhou após retries.' });
}

async function batchFetchObjects(ids, fields) {
    var uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    var result = {};

    if (!uniqueIds.length) {
        return result;
    }

    for (var offset = 0; offset < uniqueIds.length; offset += 50) {
        var chunk = uniqueIds.slice(offset, offset + 50);
        var batch = chunk.map(function (id) {
            return {
                method: 'GET',
                relative_url: id + '?fields=' + encodeURIComponent(fields),
            };
        });

        var responses = await graphPost('/', {
            batch: JSON.stringify(batch),
        });

        if (!Array.isArray(responses)) {
            continue;
        }

        responses.forEach(function (item) {
            if (!item || item.code !== 200 || !item.body) {
                return;
            }

            try {
                var parsed = JSON.parse(item.body);

                if (parsed && parsed.id) {
                    result[parsed.id] = parsed;
                }
            } catch (error) {
                // Ignorar entradas inválidas do batch.
            }
        });
    }

    if (!Object.keys(result).length && uniqueIds.length) {
        await Promise.all(uniqueIds.map(function (id) {
            return graphGet('/' + id, { fields: fields }).then(function (object) {
                if (object && object.id) {
                    result[object.id] = object;
                }
            }).catch(function () {
                return null;
            });
        }));
    }

    return result;
}

async function graphPost(path, params) {
    var accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('META_ACCESS_TOKEN em falta.');
    }

    var payload = new URLSearchParams();

    Object.keys(params || {}).forEach(function (key) {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            payload.set(key, String(params[key]));
        }
    });

    payload.set('access_token', accessToken);

    var response = await fetch(BASE_URL + path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
    });
    var body = await response.json();

    if (!response.ok || body.error) {
        throw MetaApiError(body.error || { message: 'Meta API POST falhou.' });
    }

    return body;
}

async function debugAccessToken() {
    var accessToken = getAccessToken();

    if (!accessToken) {
        return {
            has_token: false,
            is_valid: false,
            scopes: [],
            missing_scopes: ['ads_read', 'ads_management'],
            type: '',
            error: 'META_ACCESS_TOKEN em falta.',
        };
    }

    try {
        var body = await graphGet('/debug_token', {
            input_token: accessToken,
        });
        var info = body.data || {};
        var scopes = info.scopes || [];
        var required = ['ads_read', 'ads_management'];
        var missing = required.filter(function (scope) {
            return scopes.indexOf(scope) === -1;
        });

        return {
            has_token: true,
            is_valid: Boolean(info.is_valid),
            scopes: scopes,
            missing_scopes: missing,
            type: info.type || '',
            expires_at: info.expires_at || null,
            error: missing.length
                ? 'Token sem permissões: ' + missing.join(', ')
                : '',
        };
    } catch (error) {
        return {
            has_token: true,
            is_valid: false,
            scopes: [],
            missing_scopes: ['ads_read', 'ads_management'],
            type: '',
            error: error.message,
        };
    }
}

module.exports = {
    getAccessToken: getAccessToken,
    graphGet: graphGet,
    graphPost: graphPost,
    batchFetchObjects: batchFetchObjects,
    debugAccessToken: debugAccessToken,
};
