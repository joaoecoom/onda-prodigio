'use strict';

var fs = require('fs');
var path = require('path');
var { getSupabaseAdmin } = require('../../supabase-admin');

function getLogDir() {
    return String(process.env.HUB_AGENT_TOOL_LOG_DIR || process.env.HUB_AGENT_LOG_DIR || '/opt/hub-agent/logs').trim();
}

function sanitizeInput(input) {
    if (!input || typeof input !== 'object') {
        return {};
    }

    var clone = Object.assign({}, input);
    var secretKeys = ['password', 'token', 'secret', 'key', 'authorization'];

    Object.keys(clone).forEach(function (key) {
        var lower = key.toLowerCase();

        if (lower === 'integrations' && clone[key] && typeof clone[key] === 'object') {
            clone[key] = '[redacted-integration-patches]';
            return;
        }

        if (secretKeys.some(function (part) { return lower.indexOf(part) !== -1; })) {
            clone[key] = '[redacted]';
        }
    });

    return clone;
}

async function logToolCall(entry) {
    var payload = {
        ai_task_id: entry.ai_task_id || null,
        offer_id: entry.offer_id,
        tool_name: entry.tool_name,
        success: Boolean(entry.success),
        error_code: entry.error_code || null,
        input: sanitizeInput(entry.input),
        result: entry.result || null,
        created_at: new Date().toISOString(),
    };

    try {
        var supabase = getSupabaseAdmin();

        if (supabase) {
            await supabase.from('ai_task_tool_calls').insert(payload);
            return;
        }
    } catch (error) {
        // Fallback to file logging below.
    }

    try {
        var dir = getLogDir();
        fs.mkdirSync(dir, { recursive: true });
        var file = path.join(dir, 'tool-calls.jsonl');
        fs.appendFileSync(file, JSON.stringify(payload) + '\n');
    } catch (fileError) {
        // Best effort only.
    }
}

module.exports = {
    logToolCall: logToolCall,
    sanitizeInput: sanitizeInput,
};
