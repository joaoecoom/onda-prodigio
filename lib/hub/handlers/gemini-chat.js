'use strict';

var metricsAuth = require('../../metrics/auth');
var aiOrchestrator = require('../ai-orchestrator');
var geminiAssistant = require('../gemini-assistant');

function sendUnauthorized(res) {
    return res.status(401).json({ error: 'Não autorizado.' });
}

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string' && req.body.trim()) {
        return JSON.parse(req.body);
    }

    return {};
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    var action = String(req.query.action || '').trim();

    if (req.method === 'GET' && action === 'hub_gemini_status') {
        return res.status(200).json({
            ok: true,
            gemini: aiOrchestrator.getStatus(),
        });
    }

    if (req.method !== 'POST' || action !== 'hub_gemini_chat') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        var body = await readJsonBody(req);
        var useOrchestrator = body.orchestrator !== false;
        var result = useOrchestrator
            ? await aiOrchestrator.run(body)
            : await geminiAssistant.chat(body);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            ok: false,
            error: error.message || 'Gemini assistant falhou.',
        });
    }
};
