'use strict';

var DEFAULT_MODEL = 'gemini-3.6-flash';
var DEFAULT_FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3-flash-preview',
];
var DEPRECATED_MODELS = [
    'gemini-2.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
];
var API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
var MAX_RETRIES_PER_MODEL = 2;
var RETRY_BASE_MS = 700;

function getApiKey() {
    return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim();
}

function normalizeModelId(model) {
    var id = String(model || '').trim().replace(/^models\//i, '');

    if (!id || DEPRECATED_MODELS.indexOf(id) !== -1) {
        return '';
    }

    return id;
}

function getModel() {
    return normalizeModelId(process.env.GEMINI_MODEL) || DEFAULT_MODEL;
}

function getFallbackModels() {
    var env = String(process.env.GEMINI_FALLBACK_MODELS || '').trim();

    if (env) {
        return env.split(',').map(function (row) {
            return normalizeModelId(row);
        }).filter(Boolean);
    }

    return DEFAULT_FALLBACK_MODELS.slice();
}

function getModelChain(preferredModel) {
    var primary = normalizeModelId(preferredModel) || getModel() || DEFAULT_MODEL;
    var chain = [];

    if (primary) {
        chain.push(primary);
    }

    getFallbackModels().forEach(function (model) {
        if (chain.indexOf(model) === -1) {
            chain.push(model);
        }
    });

    if (!chain.length) {
        chain.push('gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-2.0-flash');
    }

    return chain;
}

function isRetryableError(status, message) {
    var text = String(message || '').toLowerCase();
    var code = Number(status) || 0;

    if (code === 429 || code === 502 || code === 503 || code === 504 || code === 500) {
        return true;
    }

    if (isModelUnavailableError(status, message)) {
        return false;
    }

    return /high demand|resource exhausted|overloaded|temporarily unavailable|try again later|rate limit|quota exceeded|capacity/.test(text);
}

function isModelUnavailableError(status, message) {
    var text = String(message || '').toLowerCase();
    var code = Number(status) || 0;

    if (code === 404) {
        return true;
    }

    return /model not found|not supported|invalid model|does not exist|no longer available|not available to new users|please update your code|deprecated|has been shut down/.test(text);
}

function translateError(error) {
    var message = error && error.message ? error.message : 'Gemini indisponível.';
    var text = message.toLowerCase();

    if (/high demand|overloaded|temporarily unavailable|try again later/.test(text)) {
        return Object.assign(new Error(
            'Todos os modelos Gemini estão sob carga elevada. Tenta outra vez dentro de instantes.'
        ), { code: 'GEMINI_OVERLOADED', status: error.status, original: message });
    }

    if (/rate limit|quota|resource exhausted/.test(text)) {
        return Object.assign(new Error(
            'Limite de utilização da API Gemini atingido. Aguarda um momento e tenta novamente.'
        ), { code: 'GEMINI_RATE_LIMIT', status: error.status, original: message });
    }

    if (/api key|permission|unauthorized|401/.test(text)) {
        return Object.assign(new Error(
            'Chave Gemini inválida ou sem permissões. Verifica GEMINI_API_KEY na Vercel.'
        ), { code: 'GEMINI_AUTH', status: error.status, original: message });
    }

    if (/no longer available|not available to new users|deprecated|model not found|gemini-2\.5-pro|gemini-3\.1-pro-preview/.test(text)) {
        return Object.assign(new Error(
            'Modelo Gemini descontinuado. O sistema já usa modelos alternativos — tenta outra vez dentro de instantes.'
        ), { code: 'GEMINI_MODEL_UNAVAILABLE', status: error.status, original: message });
    }

    return error;
}

function isConfigured() {
    return Boolean(getApiKey());
}

function buildUrl(model) {
    return API_BASE + '/' + encodeURIComponent(model) + ':generateContent?key=' +
        encodeURIComponent(getApiKey());
}

function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

function buildRequestBody(opts) {
    var body = {
        contents: opts.contents || [],
        generationConfig: Object.assign({
            temperature: 0.4,
            maxOutputTokens: 8192,
        }, opts.generationConfig || {}),
    };

    if (opts.systemInstruction) {
        body.systemInstruction = {
            parts: [{ text: String(opts.systemInstruction) }],
        };
    }

    if (opts.tools && opts.tools.length) {
        body.tools = [{ functionDeclarations: opts.tools }];
    }

    if (opts.toolConfig) {
        body.toolConfig = opts.toolConfig;
    }

    return body;
}

async function generateContentOnce(opts, model) {
    var response = await fetch(buildUrl(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(opts)),
    });

    var data = await response.json().catch(function () {
        return {};
    });

    if (!response.ok) {
        var message = data.error && data.error.message
            ? data.error.message
            : ('Gemini API falhou (' + response.status + ').');
        throw Object.assign(new Error(message), { status: response.status });
    }

    data._gemini_meta = {
        model: model,
    };

    return data;
}

async function generateContent(options) {
    var opts = options || {};

    if (!isConfigured()) {
        throw new Error('GEMINI_API_KEY em falta. Configura em Vercel → Settings → Environment Variables.');
    }

    var chain = getModelChain(opts.model);
    var lastError = null;
    var attemptLog = [];

    for (var modelIndex = 0; modelIndex < chain.length; modelIndex += 1) {
        var model = chain[modelIndex];

        for (var retry = 0; retry < MAX_RETRIES_PER_MODEL; retry += 1) {
            if (retry > 0) {
                await sleep(RETRY_BASE_MS * Math.pow(2, retry - 1));
            }

            try {
                var data = await generateContentOnce(opts, model);
                data._gemini_meta = {
                    model: model,
                    model_index: modelIndex,
                    retries: retry,
                    attempts: attemptLog.concat([{ model: model, retry: retry, ok: true }]),
                    used_fallback: modelIndex > 0 || retry > 0,
                };
                return data;
            } catch (error) {
                lastError = error;
                attemptLog.push({
                    model: model,
                    retry: retry,
                    ok: false,
                    status: error.status,
                    message: error.message,
                });

                if (isModelUnavailableError(error.status, error.message)) {
                    break;
                }

                if (!isRetryableError(error.status, error.message)) {
                    throw translateError(error);
                }

                if (retry >= MAX_RETRIES_PER_MODEL - 1) {
                    break;
                }
            }
        }
    }

    throw translateError(lastError || new Error('Gemini indisponível.'));
}

function extractParts(candidate) {
    var content = candidate && candidate.content;
    return (content && content.parts) || [];
}

function extractText(parts) {
    return parts.filter(function (part) {
        return part.text;
    }).map(function (part) {
        return part.text;
    }).join('\n').trim();
}

function extractFunctionCalls(parts) {
    return parts.filter(function (part) {
        return part.functionCall;
    }).map(function (part) {
        return part.functionCall;
    });
}

module.exports = {
    DEFAULT_MODEL: DEFAULT_MODEL,
    DEFAULT_FALLBACK_MODELS: DEFAULT_FALLBACK_MODELS,
    MAX_RETRIES_PER_MODEL: MAX_RETRIES_PER_MODEL,
    getApiKey: getApiKey,
    normalizeModelId: normalizeModelId,
    getModel: getModel,
    getFallbackModels: getFallbackModels,
    getModelChain: getModelChain,
    isRetryableError: isRetryableError,
    isModelUnavailableError: isModelUnavailableError,
    translateError: translateError,
    isConfigured: isConfigured,
    generateContent: generateContent,
    generateContentOnce: generateContentOnce,
    extractParts: extractParts,
    extractText: extractText,
    extractFunctionCalls: extractFunctionCalls,
};
