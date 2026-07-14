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

function normalizePhoneE164(phone) {
    var digits = String(phone || '').replace(/\D/g, '');

    if (!digits) {
        return '';
    }

    if (digits.indexOf('351') === 0) {
        return '+' + digits;
    }

    return '+351' + digits;
}

function buildExternalId(email, phone) {
    if (email) {
        return hashSha256(email);
    }

    if (phone) {
        return hashSha256(normalizePhoneE164(phone));
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
