'use strict';

var geminiClient = require('./gemini-client');

var PROVIDERS = {
    gemini: geminiClient,
};

function getProvider(name) {
    var id = String(name || process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
    return PROVIDERS[id] || geminiClient;
}

function isConfigured(providerName) {
    return getProvider(providerName).isConfigured();
}

function getModel(providerName) {
    return getProvider(providerName).getModel();
}

async function generateContent(options, providerName) {
    return getProvider(providerName).generateContent(options);
}

module.exports = {
    PROVIDERS: PROVIDERS,
    getProvider: getProvider,
    isConfigured: isConfigured,
    getModel: getModel,
    generateContent: generateContent,
    extractParts: geminiClient.extractParts,
    extractText: geminiClient.extractText,
    extractFunctionCalls: geminiClient.extractFunctionCalls,
};
