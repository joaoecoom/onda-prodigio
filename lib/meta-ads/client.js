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

async function graphGet(path, params) {
    var accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('META_ACCESS_TOKEN em falta.');
    }

    var response = await fetch(buildUrl(path, params, accessToken));
    var body = await response.json();

    if (!response.ok || body.error) {
        throw MetaApiError(body.error || { message: 'Meta API GET falhou.' });
    }

    return body;
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
    debugAccessToken: debugAccessToken,
};
