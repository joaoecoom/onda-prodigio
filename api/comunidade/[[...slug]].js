var routes = {
    'check-email': require('../../lib/comunidade/handlers/check-email'),
    'set-password': require('../../lib/comunidade/handlers/set-password'),
    'request-password-reset': require('../../lib/comunidade/handlers/request-password-reset'),
    'verify-reset-token': require('../../lib/comunidade/handlers/verify-reset-token'),
    'reset-password': require('../../lib/comunidade/handlers/reset-password'),
    config: require('../../lib/comunidade/handlers/config'),
    me: require('../../lib/comunidade/handlers/me'),
    products: require('../../lib/comunidade/handlers/products'),
    product: require('../../lib/comunidade/handlers/product'),
    comments: require('../../lib/comunidade/handlers/comments'),
    'cron-ai-comments': require('../../lib/comunidade/handlers/cron-ai-comments'),
    survey: require('../../lib/comunidade/handlers/survey'),
    progress: require('../../lib/comunidade/handlers/progress'),
    'hub-admin-session': require('../../lib/comunidade/handlers/hub-admin-session'),
    'hub-admin-handoff': require('../../lib/comunidade/handlers/hub-admin-handoff'),
    'content-admin': require('../../lib/comunidade/handlers/content-admin'),
};

function getRoute(req) {
    var slug = req.query.slug;

    if (Array.isArray(slug) && slug[0]) {
        return slug[0];
    }

    if (typeof slug === 'string' && slug) {
        return slug;
    }

    var url = req.url || '';

    if (url.indexOf('?') !== -1) {
        url = url.split('?')[0];
    }

    var prefix = '/api/comunidade/';

    if (url.indexOf(prefix) === 0) {
        return url.slice(prefix.length).replace(/\/$/, '');
    }

    return '';
}

module.exports = async function handler(req, res) {
    var route = getRoute(req);

    if (!route || !routes[route]) {
        return res.status(404).json({ error: 'Rota não encontrada.' });
    }

    return routes[route](req, res);
};
