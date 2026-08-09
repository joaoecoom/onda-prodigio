var identity = require('./identity');

function splitFullName(fullName) {
    var parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);

    if (!parts.length) {
        return {
            firstName: '',
            lastName: '',
        };
    }

    if (parts.length === 1) {
        return {
            firstName: parts[0],
            lastName: '',
        };
    }

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    };
}

function normalizeMetaName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]/g, '');
}

function normalizeMetaState(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function normalizeCountryCode(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .slice(0, 2);
}

function normalizePhoneForMetaHash(phone, countryCode) {
    return identity.normalizePhoneE164(phone, countryCode).replace(/\D/g, '');
}

/**
 * @param {object} params
 * @param {string} [params.email]
 * @param {string} [params.phone]
 * @param {string} [params.phoneCountry]
 * @param {string} [params.country]
 * @param {string} [params.fullName]
 * @param {string} [params.region]
 * @param {string} [params.fbp]
 * @param {string} [params.fbc]
 * @param {string} [params.clientIpAddress]
 * @param {string} [params.clientUserAgent]
 */
function buildMetaUser(params) {
    params = params || {};

    var email = String(params.email || '').trim();
    var phone = String(params.phone || '').trim();
    var phoneCountry = params.phoneCountry || params.country || 'PT';
    var names = splitFullName(params.fullName || '');

    return {
        email: email,
        phone: phone,
        phoneCountry: phoneCountry,
        firstName: names.firstName,
        lastName: names.lastName,
        country: normalizeCountryCode(params.country || phoneCountry),
        state: params.region || '',
        fbp: params.fbp || '',
        fbc: params.fbc || '',
        externalId: identity.buildExternalId(email, phone, phoneCountry),
        clientIpAddress: params.clientIpAddress || '',
        clientUserAgent: params.clientUserAgent || '',
    };
}

/**
 * @param {object} metadata
 * @param {import('http').IncomingMessage} req
 */
function buildMetaUserFromPaymentMetadata(metadata, req) {
    metadata = metadata || {};

    return buildMetaUser({
        email: metadata.email || '',
        phone: metadata.phone || '',
        phoneCountry: metadata.phone_country || metadata.country || 'PT',
        country: metadata.country || metadata.phone_country || 'PT',
        fullName: metadata.full_name || '',
        region: metadata.region || '',
        fbp: metadata.fbp || '',
        fbc: metadata.fbc || '',
        clientIpAddress: getClientIp(req),
        clientUserAgent: metadata.client_user_agent || (req && req.headers ? req.headers['user-agent'] : '') || '',
    });
}

function getClientIp(req) {
    if (!req || !req.headers) {
        return '';
    }

    var forwarded = req.headers['x-forwarded-for'];

    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
        return String(forwarded[0]).split(',')[0].trim();
    }

    return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '';
}

module.exports = {
    splitFullName: splitFullName,
    normalizeMetaName: normalizeMetaName,
    normalizeMetaState: normalizeMetaState,
    normalizeCountryCode: normalizeCountryCode,
    normalizePhoneForMetaHash: normalizePhoneForMetaHash,
    buildMetaUser: buildMetaUser,
    buildMetaUserFromPaymentMetadata: buildMetaUserFromPaymentMetadata,
};
