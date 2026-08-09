function getEurPerUnit(currency) {
    var normalized = String(currency || 'EUR').trim().toUpperCase();

    if (normalized === 'EUR') {
        return 1;
    }

    var directKey = 'META_' + normalized + '_TO_EUR_RATE';
    var directRate = parseFloat(process.env[directKey] || '');

    if (Number.isFinite(directRate) && directRate > 0) {
        return directRate;
    }

    var inverseKey = 'META_EUR_TO_' + normalized + '_RATE';
    var inverseRate = parseFloat(process.env[inverseKey] || '');

    if (Number.isFinite(inverseRate) && inverseRate > 0) {
        return 1 / inverseRate;
    }

    if (normalized === 'USD') {
        var usdPerEur = parseFloat(process.env.META_EUR_TO_USD_RATE || '1.09');
        return 1 / usdPerEur;
    }

    if (normalized === 'BRL') {
        var brlPerEur = parseFloat(process.env.META_EUR_TO_BRL_RATE || '6.10');
        return 1 / brlPerEur;
    }

    return 1;
}

function convertToEur(amount, currency) {
    var numericAmount = Number(amount || 0);
    var eurPerUnit = getEurPerUnit(currency);

    return Number((numericAmount * eurPerUnit).toFixed(2));
}

module.exports = {
    getEurPerUnit: getEurPerUnit,
    convertToEur: convertToEur,
};
