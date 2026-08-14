var Stripe = require('stripe');
var salesReport = require('./sales-report');
var cache = require('./cache');
var timezone = require('./timezone');
var reportingRange = require('./reporting-range');

var STRIPE_TTL_MS = 30 * 1000;

function resolveDateBounds(query) {
    var range = reportingRange.resolveReportingRange(query || {});

    return {
        from: range.from,
        to: range.to,
        minTimestamp: range.minTimestamp,
        maxTimestamp: range.maxTimestamp,
        timezone: range.timezone,
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
        bounds.timezone || timezone.getReportingTimezone(),
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
            timezone: bounds.timezone,
        },
    });

    cache.setCached(cacheKey, payload);
    return payload;
}

var PULSE_TTL_MS = 15 * 1000;

async function buildSalesPulse(query) {
    var secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new Error('STRIPE_SECRET_KEY em falta.');
    }

    var bounds = resolveDateBounds(query || {});
    var cacheKey = cache.getCacheKey([
        'stripe-pulse',
        bounds.from || 'all',
        bounds.to || 'all',
        bounds.timezone || timezone.getReportingTimezone(),
    ]);
    var cached = cache.getCached(cacheKey, PULSE_TTL_MS);

    if (cached && String(query.refresh || '') !== '1') {
        return cached;
    }

    var stripe = new Stripe(secretKey);
    var listParams = {
        limit: 25,
    };

    if (bounds.minTimestamp > 0) {
        listParams.created = { gte: bounds.minTimestamp };

        if (Number.isFinite(bounds.maxTimestamp)) {
            listParams.created.lte = bounds.maxTimestamp;
        }
    }

    var listed = await stripe.paymentIntents.list(listParams);
    var sales = (listed.data || [])
        .filter(salesReport.isOndaProdigioProductSale)
        .map(function (paymentIntent) {
            var sale = salesReport.summarizeSale(paymentIntent);
            sale.amount_eur = salesReport.getOndaProdigioProductRevenueEur(paymentIntent);
            sale.is_traffic = salesReport.isTrafficSale(sale);
            return sale;
        })
        .sort(function (a, b) {
            return new Date(b.created).getTime() - new Date(a.created).getTime();
        });

    var payload = {
        sales: sales,
        generated_at: new Date().toISOString(),
        date_range: {
            from: bounds.from,
            to: bounds.to,
            timezone: bounds.timezone,
        },
    };

    cache.setCached(cacheKey, payload);
    return payload;
}

module.exports = {
    resolveDateBounds: resolveDateBounds,
    buildStripeReport: buildStripeReport,
    buildSalesPulse: buildSalesPulse,
    fetchPaymentIntents: fetchPaymentIntents,
};
