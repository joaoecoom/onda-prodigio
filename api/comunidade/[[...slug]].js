var routes = {
    'check-email': require('../../lib/comunidade/handlers/check-email'),
    'set-password': require('../../lib/comunidade/handlers/set-password'),
    config: require('../../lib/comunidade/handlers/config'),
    me: require('../../lib/comunidade/handlers/me'),
    products: require('../../lib/comunidade/handlers/products'),
    product: require('../../lib/comunidade/handlers/product'),
    comments: require('../../lib/comunidade/handlers/comments'),
};

module.exports = async function handler(req, res) {
    var slug = req.query.slug;
    var route = Array.isArray(slug) ? slug[0] : slug;

    if (!route || !routes[route]) {
        return res.status(404).json({ error: 'Rota não encontrada.' });
    }

    return routes[route](req, res);
};
