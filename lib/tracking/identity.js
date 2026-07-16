var crypto = require('crypto');

function hashSha256(value) {
    if (!value) {
        return '';
    }

    return crypto
        .createHash('sha256')
        .update(String(value).trim().toLowerCase())
        .digest('hex');
}

var COUNTRY_DIAL_CODES = {
    PT: '351',
    LU: '352',
    FR: '33',
    BE: '32',
    CH: '41',
    DE: '49',
    ES: '34',
    IT: '39',
    NL: '31',
    GB: '44',
    IE: '353',
    AT: '43',
    SE: '46',
    NO: '47',
    DK: '45',
    US: '1',
    CA: '1',
    BR: '55',
    AO: '244',
    MZ: '258',
    CV: '238',
    GW: '245',
    ST: '239',
    AE: '971',
    ZA: '27',
    AU: '61',
    NZ: '64',
};

function normalizePhoneE164(phone, countryCode) {
    var digits = String(phone || '').replace(/\D/g, '');

    if (!digits) {
        return '';
    }

    if (digits.indexOf('00') === 0) {
        return '+' + digits.slice(2);
    }

    var dial = COUNTRY_DIAL_CODES[String(countryCode || 'PT').toUpperCase()] || '351';

    if (digits.indexOf(dial) === 0 && digits.length > dial.length + 5) {
        return '+' + digits;
    }

    return '+' + dial + digits;
}

function buildExternalId(email, phone, countryCode) {
    if (email) {
        return hashSha256(email);
    }

    if (phone) {
        return hashSha256(normalizePhoneE164(phone, countryCode));
    }

    return '';
}

function getEventTimeSeconds(timestamp) {
    if (timestamp) {
        return Math.floor(Number(timestamp));
    }

    return Math.floor(Date.now() / 1000);
}

function sanitizeMetadataValue(value, maxLength) {
    var text = String(value || '').trim();

    if (!text) {
        return '';
    }

    return text.slice(0, maxLength || 500);
}

module.exports = {
    hashSha256: hashSha256,
    normalizePhoneE164: normalizePhoneE164,
    buildExternalId: buildExternalId,
    getEventTimeSeconds: getEventTimeSeconds,
    sanitizeMetadataValue: sanitizeMetadataValue,
};
