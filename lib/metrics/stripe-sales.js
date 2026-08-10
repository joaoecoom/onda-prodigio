var Stripe = require('stripe');
var salesReport = require('./sales-report');
var cache = require('./cache');

var STRIPE_TTL_MS = 60 * 1000;

function resolveDateBounds(query) {
    var days = parseInt(query.days, 10);
    var from = String(query.from || '').trim();
    var to = String(query.to || '').trim();
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

    return {
        from: datePattern.test(from) ? from : '',
        to: datePattern.test(to) ? to : '',
        minTimestamp: minTimestamp,
        maxTimestamp: maxTimestamp,
    };
}

async function fetchPaymentIntents(stripe, bounds) {
    var paymentIntents = [];
    var startingAfter;
    var listParams = {
        limit: 100,
    };

    if (bounds.minTimestamp > 0) {
        listParams.created = { gte: bounds.minTimestamp };

        if (Number.isFinite(bounds.maxTimestamp)) {
            listParams.created.lte = bounds.maxTimestamp;
        }
    }

    for (var page = 0; page < 10; page += 1) {
        if (startingAfter) {
            listParams.starting_after = startingAfter;
        } else {
            delete listParams.starting_after;
        }

        var listed = await stripe.paymentIntents.list(listParams);

        paymentIntents = paymentIntents.concat(listed.data || []);

        if (!listed.has_more) {
            break;
        }

        startingAfter = listed.data[listed.data.length - 1].id;
    }

    return paymentIntents;
}

async function buildStripeReport(query) {
    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new Error('STRIPE_SECRET_KEY em falta.');
    }

    var bounds = resolveDateBounds(query || {});
    var cacheKey = cache.getCacheKey([
        'stripe-report',
        bounds.from || 'all',
        bounds.to || 'all',
        String(bounds.minTimestamp || 0),
    ]);
    var cached = cache.getCached(cacheKey, STRIPE_TTL_MS);

    if (cached && String(query.refresh || '') !== '1') {
        return cached;
    }

    var stripe = new Stripe(secretKey);
    var paymentIntents = await fetchPaymentIntents(stripe, bounds);

    if (bounds.minTimestamp > 0 || Number.isFinite(bounds.maxTimestamp)) {
        paymentIntents = paymentIntents.filter(function (paymentIntent) {
            return paymentIntent.created >= bounds.minTimestamp &&
                paymentIntent.created <= bounds.maxTimestamp;
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

    var payload = Object.assign({}, report, {
        total_sales: report.summary.total_sales,
        by_ad: Object.values(byAd).sort(function (a, b) {
            return b.sales - a.sales;
        }),
        sales: report.recent_sales,
        date_range: {
            from: bounds.from,
            to: bounds.to,
        },
    });

    cache.setCached(cacheKey, payload);
    return payload;
}

module.exports = {
    resolveDateBounds: resolveDateBounds,
    buildStripeReport: buildStripeReport,
};
