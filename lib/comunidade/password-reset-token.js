var crypto = require('crypto');

var TOKEN_TTL_MS = 60 * 60 * 1000;

function getResetSecret() {
    return (
        process.env.PASSWORD_RESET_SECRET ||
        process.env.BOOTSTRAP_SECRET ||
        process.env.METRICS_DASHBOARD_PASSWORD ||
        ''
    );
}

function signPayload(payload) {
    var secret = getResetSecret();

    if (!secret) {
        throw new Error('PASSWORD_RESET_SECRET em falta.');
    }

    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function createPasswordResetToken(email) {
    var normalizedEmail = String(email || '').trim().toLowerCase();
    var expiresAt = Date.now() + TOKEN_TTL_MS;
    var payload = normalizedEmail + '|' + expiresAt;
    var signature = signPayload(payload);

    return Buffer.from(payload + '|' + signature, 'utf8').toString('base64url');
}

function verifyPasswordResetToken(token) {
    if (!token) {
        return { valid: false, reason: 'missing_token' };
    }

    try {
        var decoded = Buffer.from(String(token), 'base64url').toString('utf8');
        var parts = decoded.split('|');

        if (parts.length !== 3) {
            return { valid: false, reason: 'invalid_token' };
        }

        var email = parts[0];
        var expiresAt = Number(parts[1]);
        var signature = parts[2];
        var payload = email + '|' + expiresAt;
        var expected = signPayload(payload);

        if (signature !== expected) {
            return { valid: false, reason: 'invalid_signature' };
        }

        if (!expiresAt || Date.now() > expiresAt) {
            return { valid: false, reason: 'expired' };
        }

        return {
            valid: true,
            email: email,
            expires_at: new Date(expiresAt).toISOString(),
        };
    } catch (error) {
        return { valid: false, reason: 'invalid_token' };
    }
}

module.exports = {
    TOKEN_TTL_MS: TOKEN_TTL_MS,
    createPasswordResetToken: createPasswordResetToken,
    verifyPasswordResetToken: verifyPasswordResetToken,
};
