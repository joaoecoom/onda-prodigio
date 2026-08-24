function isEnabled(override) {
    if (override && typeof override.enabled === 'boolean') {
        return override.enabled;
    }

    return String(process.env.WHATSAPP_ENABLED || '').trim().toLowerCase() === 'true';
}

function getEnvConfig() {
    var baseUrl = String(process.env.EVOLUTION_API_URL || '').trim().replace(/\/$/, '');
    var apiKey = String(process.env.EVOLUTION_API_KEY || '').trim();
    var instance = String(process.env.EVOLUTION_INSTANCE_NAME || '').trim();

    if (!baseUrl || !apiKey || !instance) {
        return null;
    }

    return {
        enabled: isEnabled(),
        baseUrl: baseUrl,
        apiKey: apiKey,
        instance: instance,
    };
}

function getConfig(override) {
    if (override && override.baseUrl && override.apiKey && override.instance) {
        return {
            enabled: override.enabled !== false,
            baseUrl: String(override.baseUrl).trim().replace(/\/$/, ''),
            apiKey: String(override.apiKey).trim(),
            instance: String(override.instance).trim(),
        };
    }

    return getEnvConfig();
}

function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

function getRandomDelayMs() {
    var min = Number(process.env.WHATSAPP_MIN_DELAY_MS || 0);
    var max = Number(process.env.WHATSAPP_MAX_DELAY_MS || 0);

    if (!Number.isFinite(min) || min < 0) {
        min = 0;
    }

    if (!Number.isFinite(max) || max < min) {
        max = min;
    }

    if (max > 25000) {
        max = 25000;
    }

    if (max === 0) {
        return 0;
    }

    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {{ phoneDigits: string, text: string, offerId?: string, config?: object }} options
 */
async function sendTextMessage(options) {
    var override = options.config || null;

    if (!override && options.offerId) {
        try {
            var runtime = require('../hub/offer-runtime-config');
            override = await runtime.resolveWhatsAppConfig(options.offerId);
        } catch (error) {
            override = null;
        }
    }

    var config = getConfig(override);

    if (!config || !isEnabled(config)) {
        return {
            ok: false,
            skipped: true,
            reason: config ? 'disabled' : 'missing_config',
        };
    }

    if (!options.phoneDigits || !options.text) {
        return { ok: false, skipped: true, reason: 'missing_phone_or_text' };
    }

    var delayMs = getRandomDelayMs();

    if (delayMs > 0) {
        await sleep(delayMs);
    }

    var url = config.baseUrl + '/message/sendText/' + encodeURIComponent(config.instance);
    var payload = {
        number: options.phoneDigits,
        text: options.text,
    };

    try {
        var response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: config.apiKey,
            },
            body: JSON.stringify(payload),
        });

        var bodyText = await response.text();
        var body;

        try {
            body = bodyText ? JSON.parse(bodyText) : {};
        } catch (parseError) {
            body = { raw: bodyText };
        }

        if (!response.ok) {
            return {
                ok: false,
                reason: 'http_' + response.status,
                status: response.status,
                body: body,
            };
        }

        return {
            ok: true,
            message_id: body.key && body.key.id ? body.key.id : (body.messageId || ''),
            body: body,
            offer_id: options.offerId || null,
        };
    } catch (error) {
        return {
            ok: false,
            reason: 'network_error',
            error: error.message || 'send_failed',
        };
    }
}

module.exports = {
    isEnabled: isEnabled,
    getConfig: getConfig,
    sendTextMessage: sendTextMessage,
};
