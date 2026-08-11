var identity = require('../tracking/identity');

/**
 * Dígitos internacionais para Evolution API (ex.: 351912345678).
 */
function normalizePhoneForWhatsApp(phone, countryCode) {
    var e164 = identity.normalizePhoneE164(phone, countryCode);

    if (!e164) {
        return '';
    }

    return e164.replace(/\D/g, '');
}

module.exports = {
    normalizePhoneForWhatsApp: normalizePhoneForWhatsApp,
};
