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
    var from = String(req.query.from || '').trim();
    var to = String(req.query.to || '').trim();
    var datePattern = /^\d{4}-\d{2}-\d{2}$/;
    var minTimestamp = 0;
    var maxTimestamp = Number.POSITIVE_INFINITY;

    if (datePattern.test(from) && datePattern.test(to)) {
        minTimestamp = Math.floor(new Date(from + 'T00:00:00.000Z').getTime() / 1000);
        maxTimestamp = Math.floor(new Date(to + 'T23:59:59.999Z').getTime() / 1000);
    } else if (Number.isFinite(days) && days > 0) {
        minTimestamp = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
        maxTimestamp = Number.POSITIVE_INFINITY;
    }

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

        if (minTimestamp > 0 || Number.isFinite(maxTimestamp)) {
            paymentIntents = paymentIntents.filter(function (paymentIntent) {
                return paymentIntent.created >= minTimestamp && paymentIntent.created <= maxTimestamp;
            });
        }

        var report = salesReport.buildReport(paymentIntents);
        var byAd = {};

        report.recent_sales.forEach(function (sale) {
            var key = sale.ad_label || 'desconhecido';

            if (!byAd[key]) {
                byAd[key] = {
                    ad_label: key,
                    sales: 0,
                    revenue_eur: 0,
                    emails: [],
                };
            }

            byAd[key].sales += 1;
            byAd[key].revenue_eur = Number((byAd[key].revenue_eur + sale.amount_eur).toFixed(2));
            byAd[key].emails.push(sale.email);
        });

        return res.status(200).json(Object.assign({}, report, {
            total_sales: report.summary.total_sales,
            by_ad: Object.values(byAd).sort(function (a, b) {
                return b.sales - a.sales;
            }),
            sales: report.recent_sales,
        }));
    } catch (error) {
        console.error('Relatório de vendas falhou:', error);
        return res.status(500).json({
            error: error.message || 'Relatório falhou.',
        });
    }
};
