var Stripe = require('stripe');
var metricsAuth = require('../lib/metrics/auth');
var salesReport = require('../lib/metrics/sales-report');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    if (!metricsAuth.isAuthorized(req)) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        return res.status(500).json({ error: 'STRIPE_SECRET_KEY em falta.' });
    }

    var stripe = new Stripe(secretKey);
    var days = parseInt(req.query.days, 10);
    var minTimestamp = Number.isFinite(days) && days > 0
        ? Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60)
        : 0;

    try {
        var paymentIntents = [];
        var startingAfter;

        for (var page = 0; page < 10; page += 1) {
            var listed = await stripe.paymentIntents.list({
                limit: 100,
                starting_after: startingAfter,
            });

            paymentIntents = paymentIntents.concat(listed.data || []);

            if (!listed.has_more) {
                break;
            }

            startingAfter = listed.data[listed.data.length - 1].id;
        }

        if (minTimestamp > 0) {
            paymentIntents = paymentIntents.filter(function (paymentIntent) {
                return paymentIntent.created >= minTimestamp;
            });
        }

        return res.status(200).json(salesReport.buildReport(paymentIntents));
    } catch (error) {
        console.error('Métricas falharam:', error);
        return res.status(500).json({
            error: error.message || 'Métricas falharam.',
        });
    }
};
