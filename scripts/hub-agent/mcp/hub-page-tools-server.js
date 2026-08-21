#!/usr/bin/env node
'use strict';

/**
 * HUB DR Ecoom — MCP server privado para Page Engine tools (Fase 3C).
 * Expõe apenas operações allowlisted do funnel-engine ao Cursor Agent.
 *
 * Env obrigatório:
 * - HUB_AGENT_OFFER_ID
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Env opcional:
 * - HUB_AGENT_TASK_ID
 */

var readline = require('readline');
var agentTools = require('../../../lib/hub/agent-tools');

var SERVER_INFO = {
    name: 'hub-page-tools',
    version: '1.0.0',
};

function send(message) {
    process.stdout.write(JSON.stringify(message) + '\n');
}

function toolResultPayload(result) {
    return {
        content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
        }],
    };
}

function toolErrorPayload(error) {
    var mapped = agentTools.errors.mapDomainError(error);
    return {
        isError: true,
        content: [{
            type: 'text',
            text: JSON.stringify({
                success: false,
                error: {
                    code: mapped.code,
                    message: mapped.message,
                },
            }, null, 2),
        }],
    };
}

async function handleToolsCall(params) {
    var toolName = params && params.name;
    var input = (params && params.arguments) || {};

    console.error('[hub-page-tools] tool_call ' + toolName + ' task=' +
        (process.env.HUB_AGENT_TASK_ID || 'none'));

    try {
        var result = await agentTools.executeTool(toolName, input, {
            boundOfferId: process.env.HUB_AGENT_OFFER_ID,
            meta: { ai_task_id: process.env.HUB_AGENT_TASK_ID },
        });
        return toolResultPayload(result);
    } catch (error) {
        return toolErrorPayload(error);
    }
}

function handleRequest(request) {
    var method = request.method;
    var id = request.id;

    if (method === 'initialize') {
        send({
            jsonrpc: '2.0',
            id: id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: SERVER_INFO,
            },
        });
        return;
    }

    if (method === 'notifications/initialized') {
        return;
    }

    if (method === 'tools/list') {
        send({
            jsonrpc: '2.0',
            id: id,
            result: {
                tools: agentTools.TOOL_DEFINITIONS,
            },
        });
        return;
    }

    if (method === 'tools/call') {
        handleToolsCall(request.params || {}).then(function (result) {
            send({ jsonrpc: '2.0', id: id, result: result });
        }).catch(function (error) {
            send({
                jsonrpc: '2.0',
                id: id,
                error: {
                    code: -32000,
                    message: error.message || 'Tool call failed',
                },
            });
        });
        return;
    }

    if (id != null) {
        send({
            jsonrpc: '2.0',
            id: id,
            error: { code: -32601, message: 'Method not found: ' + method },
        });
    }
}

function main() {
    if (!process.env.HUB_AGENT_OFFER_ID) {
        console.error('hub-page-tools: HUB_AGENT_OFFER_ID em falta');
        process.exit(1);
    }

    console.error('hub-page-tools MCP server starting (offer=' +
        process.env.HUB_AGENT_OFFER_ID + ', task=' +
        (process.env.HUB_AGENT_TASK_ID || 'none') + ')');

    var rl = readline.createInterface({
        input: process.stdin,
        terminal: false,
    });

    rl.on('line', function (line) {
        var trimmed = String(line || '').trim();
        if (!trimmed) {
            return;
        }

        try {
            var request = JSON.parse(trimmed);
            handleRequest(request);
        } catch (error) {
            send({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32700, message: 'Parse error' },
            });
        }
    });
}

main();
