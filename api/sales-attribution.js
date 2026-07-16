var Stripe = require('stripe');
var attribution = require('../lib/tracking/attribution');

function getAuthToken(req) {
    var header = req.headers.authorization || '';

    if (header.indexOf('Bearer ') === 0) {
        return header.slice(7).trim();
    }

    return '';
}

function summarizePaymentIntent(paymentIntent) {
    var metadata = paymentIntent.metadata || {};
    var adLabel = attribution.getPrimaryAdLabel(metadata);

    return {
        payment_intent: paymentIntent.id,
        created: new Date(paymentIntent.created * 1000).toISOString(),
        amount_eur: Number((paymentIntent.amount / 100).toFixed(2)),
        email: metadata.email || paymentIntent.receipt_email || '',
        ad_name: metadata.ad_name || metadata.utm_content || '',
        ad_id: metadata.ad_id || '',
        adset_id: metadata.adset_id || '',
        campaign_name: metadata.campaign_name || metadata.utm_campaign || '',
        ad_platform: metadata.ad_platform || '',
        utm_source: metadata.utm_source || '',
        utm_medium: metadata.utm_medium || '',
        utm_campaign: metadata.utm_campaign || '',
        utm_content: metadata.utm_content || '',
        has_attribution: Boolean(adLabel || metadata.ad_id || metadata.fbc),
        ad_label: adLabel || 'desconhecido',
    };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var bootstrapSecret = process.env.BOOTSTRAP_SECRET;

    if (!bootstrapSecret || getAuthToken(req) !== bootstrapSecret) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        return res.status(500).json({ error: 'STRIPE_SECRET_KEY em falta.' });
    }

    var stripe = new Stripe(secretKey);

    try {
        var paymentIntents = [];
        var startingAfter;

        for (var page = 0; page < 5; page += 1) {
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

        var liveSales = paymentIntents
            .filter(function (paymentIntent) {
                var metadata = paymentIntent.metadata || {};
                return paymentIntent.status === 'succeeded' &&
                    metadata.checkout === 'checkout9' &&
                    metadata.stripe_mode !== 'test';
            })
            .map(summarizePaymentIntent)
            .sort(function (a, b) {
                return a.created.localeCompare(b.created);
            });

        var byAd = {};

        liveSales.forEach(function (sale) {
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

        return res.status(200).json({
            total_sales: liveSales.length,
            by_ad: Object.values(byAd).sort(function (a, b) {
                return b.sales - a.sales;
            }),
            sales: liveSales,
            note: 'Vendas antigas podem aparecer como ad_label=desconhecido até configurares utm_content={{ad.name}} nos anúncios.',
        });
    } catch (error) {
        console.error('Relatório de vendas falhou:', error);
        return res.status(500).json({
            error: error.message || 'Relatório falhou.',
        });
    }
};
