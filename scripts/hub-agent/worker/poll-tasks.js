#!/usr/bin/env node
'use strict';

/**
 * HUB DR Ecoom — AI Task worker (Contabo VPS) — Fase 2 multi-offer
 */

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const offerClient = require('./offer-context-client');

const CONFIG = {
    supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    workerId: process.env.WORKER_ID || 'contabo-whatsapp-1',
    pollMs: Math.max(parseInt(process.env.POLL_INTERVAL_MS || '5000', 10) || 5000, 2000),
    logDir: process.env.HUB_AGENT_LOG_DIR || '/opt/hub-agent/logs',
    agentBin: process.env.AGENT_PATH || '/root/.local/bin/agent',
    stdoutMax: parseInt(process.env.AI_TASK_STDOUT_MAX || '24000', 10),
};

function log(message) {
    console.log('[' + new Date().toISOString() + '] ' + message);
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function supabaseHeaders(extra) {
    return Object.assign({
        apikey: CONFIG.supabaseKey,
        Authorization: 'Bearer ' + CONFIG.supabaseKey,
        'Content-Type': 'application/json',
    }, extra || {});
}

async function supabaseGet(table, query) {
    var response = await fetch(CONFIG.supabaseUrl + '/rest/v1/' + table + '?' + query, {
        method: 'GET',
        headers: supabaseHeaders(),
    });

    if (!response.ok) {
        var text = await response.text();
        throw new Error('GET ' + table + ' failed: ' + response.status + ' ' + text);
    }

    return response.json();
}

async function supabaseRpc(functionName, body) {
    var response = await fetch(CONFIG.supabaseUrl + '/rest/v1/rpc/' + functionName, {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(body || {}),
    });

    if (!response.ok) {
        var text = await response.text();
        throw new Error('RPC ' + functionName + ' failed: ' + response.status + ' ' + text);
    }

    return response.json();
}

async function patchTask(taskId, patch) {
    var response = await fetch(
        CONFIG.supabaseUrl + '/rest/v1/ai_tasks?id=eq.' + encodeURIComponent(taskId),
        {
            method: 'PATCH',
            headers: supabaseHeaders({ Prefer: 'return=representation' }),
            body: JSON.stringify(Object.assign({}, patch, {
                updated_at: new Date().toISOString(),
            })),
        }
    );

    if (!response.ok) {
        var text = await response.text();
        throw new Error('PATCH ai_tasks failed: ' + response.status + ' ' + text);
    }

    var data = await response.json();
    return Array.isArray(data) ? data[0] : data;
}

function truncate(text, max) {
    var value = String(text || '');
    return value.length <= max ? value : value.slice(0, max) + '\n…[truncado]';
}

async function fetchOfferById(offerId) {
    if (!offerId) {
        return null;
    }

    var rows = await supabaseGet(
        'hub_offers',
        'select=id,name,slug,status,mode,primary_product_id,funnel_domain,branding,agent_workspace_key,agent_branch,settings&id=eq.' +
            encodeURIComponent(offerId) +
            '&limit=1'
    );

    return rows && rows[0] ? rows[0] : null;
}

async function fetchPrimaryProduct(productId) {
    if (!productId) {
        return null;
    }

    var rows = await supabaseGet(
        'products',
        'select=id,name,description,billing_type&id=eq.' + encodeURIComponent(productId) + '&limit=1'
    );

    return rows && rows[0] ? rows[0] : null;
}

function gitPrepare(workspace, branch) {
    if (!fs.existsSync(path.join(workspace, '.git'))) {
        throw new Error('Workspace Git inválido: ' + workspace);
    }

    try {
        var remotes = execFileSync('git', ['remote'], { cwd: workspace, encoding: 'utf8' }).trim();
        if (remotes.split('\n').filter(Boolean).includes('origin')) {
            execFileSync('git', ['fetch', 'origin'], { cwd: workspace, stdio: 'pipe' });
        }
    } catch (error) {
        // Repositórios locais de teste podem não ter remote origin.
    }

    try {
        execFileSync('git', ['checkout', branch], { cwd: workspace, stdio: 'pipe' });
    } catch (error) {
        execFileSync('git', ['checkout', '-B', branch], { cwd: workspace, stdio: 'pipe' });
    }
}

function gitFilesChanged(workspace) {
    try {
        var output = execFileSync('git', ['status', '--porcelain'], {
            cwd: workspace,
            encoding: 'utf8',
        });
        return output.split('\n').filter(Boolean).map(function (line) {
            return line.slice(3).trim();
        });
    } catch (error) {
        return [];
    }
}

function verifyAgentAuth() {
    return new Promise(function (resolve) {
        var child = spawn(CONFIG.agentBin, ['status'], {
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        var out = '';
        child.stdout.on('data', function (chunk) { out += chunk; });
        child.stderr.on('data', function (chunk) { out += chunk; });
        child.on('close', function () {
            resolve(out.indexOf('Logged in as') !== -1);
        });
    });
}

function runAgent(prompt, workspace, logBase, runtimeEnv) {
    return new Promise(function (resolve) {
        var args = [
            '-p', '--trust', '--force', '--approve-mcps',
            '--workspace', workspace,
            '--output-format', 'text',
            prompt,
        ];

        var stdout = '';
        var stderr = '';
        var child = spawn(CONFIG.agentBin, args, {
            cwd: workspace,
            env: Object.assign({}, process.env, runtimeEnv || {}, {
                PATH: '/root/.local/bin:' + (process.env.PATH || ''),
            }),
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        child.stdout.on('data', function (chunk) { stdout += chunk; });
        child.stderr.on('data', function (chunk) { stderr += chunk; });
        child.on('close', function (exitCode) {
            fs.writeFileSync(logBase + '.stdout.log', stdout);
            fs.writeFileSync(logBase + '.stderr.log', stderr);
            resolve({
                exitCode: typeof exitCode === 'number' ? exitCode : 1,
                stdout: stdout,
                stderr: stderr,
            });
        });
        child.on('error', function (error) {
            stderr += error.message;
            fs.writeFileSync(logBase + '.stderr.log', stderr);
            resolve({ exitCode: 1, stdout: stdout, stderr: stderr });
        });
    });
}

async function resolveTaskWorkspace(task) {
    if (!task.offer_id) {
        throw new Error('Task sem offer_id — recusada por segurança.');
    }

    var offer = await fetchOfferById(task.offer_id);

    if (!offer) {
        throw new Error('Oferta não encontrada: ' + task.offer_id);
    }

    var expectedPath = offerClient.resolveWorkspacePathForOffer(offer);
    var legacyPath = offerClient.resolveLegacyWorkspacePathForOffer(offer);
    var taskPath = path.resolve(String(task.workspace || ''));

    if (!offerClient.isAuthorizedWorkspacePath(taskPath, offer)) {
        throw new Error('Workspace não autorizado para offer ' + offer.id + ': ' + task.workspace);
    }

    var usablePath = fs.existsSync(taskPath) ? taskPath :
        (fs.existsSync(expectedPath) ? expectedPath :
            (fs.existsSync(legacyPath) ? legacyPath : ''));

    if (!usablePath) {
        throw new Error('Workspace indisponível para offer ' + offer.id);
    }

    var branch = String(task.branch || offerClient.resolveBranchForOffer(offer));

    if (branch !== offerClient.resolveBranchForOffer(offer)) {
        throw new Error('Branch não autorizada para offer ' + offer.id);
    }

    return {
        offer: offer,
        workspace: usablePath,
        branch: branch,
    };
}

function resolveRepoRoot() {
    return process.env.HUB_AGENT_REPO_ROOT || path.resolve(__dirname, '../../..');
}

function writeWorkspaceMcpConfig(workspace, offerId, taskId) {
    var repoRoot = resolveRepoRoot();
    var wrapperPath = path.join(repoRoot, 'scripts/hub-agent/mcp/run-hub-page-tools.sh');

    if (!fs.existsSync(wrapperPath)) {
        throw new Error('MCP wrapper indisponível: ' + wrapperPath);
    }

    var cursorDir = path.join(workspace, '.cursor');
    ensureDir(cursorDir);

    var config = {
        mcpServers: {
            'hub-page-tools': {
                command: 'bash',
                args: [wrapperPath],
                env: {
                    HUB_AGENT_OFFER_ID: offerId,
                    HUB_AGENT_TASK_ID: taskId,
                    HUB_AGENT_REPO_ROOT: repoRoot,
                },
            },
        },
    };

    fs.writeFileSync(path.join(cursorDir, 'mcp.json'), JSON.stringify(config, null, 2));
}

function enableMcpServer(workspace) {
    try {
        execFileSync(CONFIG.agentBin, ['mcp', 'enable', 'hub-page-tools'], {
            cwd: workspace,
            env: Object.assign({}, process.env, {
                PATH: '/root/.local/bin:' + (process.env.PATH || ''),
            }),
            stdio: 'pipe',
        });
    } catch (error) {
        log('Aviso: agent mcp enable falhou (continua com --approve-mcps): ' +
            (error.stderr ? error.stderr.toString().slice(0, 200) : error.message));
    }
}

async function fetchMcpToolCalls(taskId) {
    try {
        var rows = await supabaseGet(
            'ai_task_tool_calls',
            'select=tool_name,success,error_code,created_at&ai_task_id=eq.' +
                encodeURIComponent(taskId) +
                '&order=created_at.asc'
        );
        return rows || [];
    } catch (error) {
        log('Aviso: não foi possível ler ai_task_tool_calls: ' + error.message);
        return [];
    }
}

function agentOutputMentionsMcpTool(stdout, stderr) {
    var blob = String(stdout || '') + '\n' + String(stderr || '');
    return /hub-page-tools|get_page_tree|create_page|create_funnel|list_funnels|Tool:/i.test(blob) &&
        /MCP|tool/i.test(blob);
}

async function assertMcpUsage(taskId, agentResult) {
    if (process.env.HUB_AGENT_REQUIRE_MCP !== '1') {
        return;
    }

    var toolCalls = await fetchMcpToolCalls(taskId);
    var successfulCalls = toolCalls.filter(function (row) { return row.success; });

    if (successfulCalls.length > 0) {
        log('MCP validado: ' + successfulCalls.length + ' tool call(s) para task ' + taskId);
        return;
    }

    if (agentOutputMentionsMcpTool(agentResult.stdout, agentResult.stderr)) {
        log('MCP validado via output do Agent para task ' + taskId);
        return;
    }

    throw new Error(
        'MCP não utilizado: nenhuma tool call registada para task ' + taskId +
        '. Task recusada (HUB_AGENT_REQUIRE_MCP=1).'
    );
}

async function executeTask(task) {
    var resolved = await resolveTaskWorkspace(task);
    var offer = resolved.offer;
    var workspace = resolved.workspace;
    var branch = resolved.branch;
    var taskId = task.id;
    var logBase = path.join(CONFIG.logDir, 'ai-task-' + taskId);
    var startedMs = Date.now();

    ensureDir(CONFIG.logDir);
    log('Executar task ' + taskId + ' offer=' + offer.id + ' workspace=' + workspace);

    gitPrepare(workspace, branch);
    writeWorkspaceMcpConfig(workspace, offer.id, taskId);
    enableMcpServer(workspace);

    var primaryProduct = await fetchPrimaryProduct(offer.primary_product_id);
    var agentPrompt = offerClient.buildAgentPrompt(offer, workspace, branch, primaryProduct, task.prompt);
    fs.writeFileSync(logBase + '.prompt.txt', agentPrompt);

    var runtimeEnv = {
        HUB_AGENT_OFFER_ID: offer.id,
        HUB_AGENT_TASK_ID: taskId,
    };

    var agentResult = await runAgent(agentPrompt, workspace, logBase, runtimeEnv);

    if (agentResult.exitCode === 0) {
        try {
            await assertMcpUsage(taskId, agentResult);
        } catch (mcpError) {
            agentResult.exitCode = 1;
            agentResult.mcpValidationError = mcpError.message;
            fs.appendFileSync(logBase + '.stderr.log', '\n' + mcpError.message + '\n');
        }
    }

    var mcpToolCalls = await fetchMcpToolCalls(taskId);
    var filesChanged = gitFilesChanged(workspace);
    var durationMs = Date.now() - startedMs;

    var resultPayload = {
        summary: truncate(agentResult.stdout, CONFIG.stdoutMax),
        stdout_preview: truncate(agentResult.stdout, 8000),
        stderr_preview: truncate(agentResult.stderr, 4000),
        files_changed: filesChanged,
        branch: branch,
        duration_ms: durationMs,
        worker_id: CONFIG.workerId,
        offer_id: offer.id,
        offer_slug: offer.slug,
        workspace: workspace,
        mcp_tool_calls: mcpToolCalls,
        mcp_validated: mcpToolCalls.some(function (row) { return row.success; }),
    };

    fs.writeFileSync(logBase + '.meta.json', JSON.stringify({
        task_id: taskId,
        offer_id: offer.id,
        exit_code: agentResult.exitCode,
        duration_ms: durationMs,
        files_changed: filesChanged,
        finished_at: new Date().toISOString(),
    }, null, 2));

    if (agentResult.exitCode === 0) {
        await patchTask(taskId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            exit_code: agentResult.exitCode,
            error: null,
            logs_reference: logBase,
            result: resultPayload,
        });
        log('Task ' + taskId + ' completed (exit 0)' +
            (resultPayload.mcp_validated ? ', MCP validated' : ''));
        return;
    }

    await patchTask(taskId, {
        status: 'failed',
        failed_at: new Date().toISOString(),
        exit_code: agentResult.exitCode,
        error: truncate(
            agentResult.mcpValidationError ||
            agentResult.stderr || agentResult.stdout || 'Agent exit ' + agentResult.exitCode,
            4000
        ),
        logs_reference: logBase,
        result: resultPayload,
    });
    log('Task ' + taskId + ' failed (exit ' + agentResult.exitCode + ')');
}

async function claimNextTask() {
    var data = await supabaseRpc('claim_next_ai_task', { p_worker_id: CONFIG.workerId });
    return data && data.id ? data : null;
}

async function recoverStaleTasks() {
    var timeoutMinutes = parseInt(process.env.AI_TASK_STALE_MINUTES || '45', 10);

    try {
        var response = await fetch(CONFIG.supabaseUrl + '/rest/v1/rpc/recover_stale_ai_tasks', {
            method: 'POST',
            headers: supabaseHeaders({ Prefer: 'return=representation' }),
            body: JSON.stringify({ p_timeout_minutes: timeoutMinutes }),
        });

        if (!response.ok) {
            return 0;
        }

        var count = await response.json();

        if (count > 0) {
            log('Recovered ' + count + ' stale running task(s)');
        }

        return count;
    } catch (error) {
        log('recoverStaleTasks falhou: ' + error.message);
        return 0;
    }
}

async function pollOnce() {
    await recoverStaleTasks();
    var task = await claimNextTask();
    if (!task) {
        return;
    }

    try {
        await executeTask(task);
    } catch (error) {
        log('Task ' + task.id + ' error: ' + error.message);
        await patchTask(task.id, {
            status: 'failed',
            failed_at: new Date().toISOString(),
            exit_code: 1,
            error: truncate(error.message, 4000),
        });
    }
}

async function main() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
        console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
        process.exit(1);
    }

    ensureDir(CONFIG.logDir);

    if (!(await verifyAgentAuth())) {
        console.error('Cursor Agent não autenticado.');
        process.exit(1);
    }

    log('Worker ' + CONFIG.workerId + ' online — multi-offer — poll ' + CONFIG.pollMs + 'ms');
    log('Workspaces root: ' + offerClient.getWorkspacesRoot());

    while (true) {
        try {
            await pollOnce();
        } catch (error) {
            log('Poll error: ' + error.message);
        }
        await new Promise(function (resolve) { setTimeout(resolve, CONFIG.pollMs); });
    }
}

main().catch(function (error) {
    console.error(error);
    process.exit(1);
});
