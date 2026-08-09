var constants = require('./constants');

function getReportingCurrency() {
    return String(process.env.META_REPORTING_CURRENCY || 'EUR').trim().toUpperCase();
}

function getRateFromEur(targetCurrency) {
    var normalized = String(targetCurrency || 'EUR').trim().toUpperCase();

    if (normalized === 'EUR') {
        return 1;
    }

    if (normalized === 'USD') {
        return parseFloat(process.env.META_EUR_TO_USD_RATE || '1.09');
    }

    if (normalized === 'BRL') {
        return parseFloat(process.env.META_EUR_TO_BRL_RATE || '6.10');
    }

    var envKey = 'META_EUR_TO_' + normalized + '_RATE';
    var customRate = parseFloat(process.env[envKey] || '');

    return Number.isFinite(customRate) && customRate > 0 ? customRate : 1;
}

function convertEurValueForMeta(valueEur) {
    var reporting = getReportingCurrency();
    var numericValue = Number(valueEur || 0);

    if (reporting === 'EUR') {
        return {
            currency: 'EUR',
            value: Number(numericValue.toFixed(2)),
        };
    }

    return {
        currency: reporting,
        value: Number((numericValue * getRateFromEur(reporting)).toFixed(2)),
    };
}

function convertEurCentsForMeta(cents) {
    return convertEurValueForMeta(constants.centsToValue(cents));
}

function convertItemPriceForMeta(priceEur) {
    return convertEurValueForMeta(priceEur).value;
}

module.exports = {
    getReportingCurrency: getReportingCurrency,
    getRateFromEur: getRateFromEur,
    convertEurValueForMeta: convertEurValueForMeta,
    convertEurCentsForMeta: convertEurCentsForMeta,
    convertItemPriceForMeta: convertItemPriceForMeta,
};
