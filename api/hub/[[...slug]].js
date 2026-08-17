var routes = {
    offers: require('../../lib/hub/handlers/offers-list'),
    offer: require('../../lib/hub/handlers/offer-detail'),
    health: require('../../lib/hub/handlers/health'),
};

function getRoute(req) {
    var slug = req.query.slug;

    if (Array.isArray(slug) && slug[0]) {
        return slug[0];
    }

    if (typeof slug === 'string' && slug) {
        return slug.split('/')[0];
    }

    var url = req.url || '';

    if (url.indexOf('?') !== -1) {
        url = url.split('?')[0];
    }

    var prefix = '/api/hub/';

    if (url.indexOf(prefix) === 0) {
        return url.slice(prefix.length).replace(/\/$/, '').split('/')[0];
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
