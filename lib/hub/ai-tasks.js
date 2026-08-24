var { getSupabaseAdmin } = require('../supabase-admin');
var offerContext = require('./offer-context');
var workspaceResolver = require('./workspace-resolver');

var ALLOWED_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'];
var ALLOWED_TASK_TYPES = ['general', 'analysis', 'content', 'code', 'page_builder'];
var MAX_PROMPT_LENGTH = 12000;
var MIN_PROMPT_LENGTH = 8;

function sanitizePrompt(value) {
    var prompt = String(value || '').trim();

    if (prompt.length < MIN_PROMPT_LENGTH) {
        throw new Error('Prompt demasiado curto.');
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
        throw new Error('Prompt demasiado longo.');
    }

    return prompt;
}

function normalizeTaskType(value) {
    var taskType = String(value || 'general').trim().toLowerCase();

    if (ALLOWED_TASK_TYPES.indexOf(taskType) === -1) {
        return 'general';
    }

    return taskType;
}

function toPublicTask(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        status: row.status,
        prompt: row.prompt,
        offer_id: row.offer_id || null,
        task_type: row.task_type,
        workspace: row.workspace,
        branch: row.branch,
        requested_by: row.requested_by,
        worker_id: row.worker_id || null,
        started_at: row.started_at || null,
        completed_at: row.completed_at || null,
        failed_at: row.failed_at || null,
        result: row.result || {},
        error: row.error || null,
        exit_code: row.exit_code,
        logs_reference: row.logs_reference || null,
        metadata: row.metadata || {},
    };
}

async function resolveTaskExecutionContext(offerId) {
    if (offerId) {
        return offerContext.resolveOfferContext({ offer_id: offerId });
    }

    return offerContext.resolveOfferContext({}, { allowDefault: true });
}

function pickWorkspacePath(context) {
    return context.workspace.path || context.workspace.legacy_path || '';
}

async function createTask(input) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var prompt = sanitizePrompt(input && input.prompt);
    var offerId = input && input.offer_id ? String(input.offer_id).trim() : null;
    var taskType = normalizeTaskType(input && input.task_type);
    var requestedBy = String((input && input.requested_by) || 'hub').trim() || 'hub';
    var metadata = input && input.metadata && typeof input.metadata === 'object' ? input.metadata : {};

    var executionContext = await resolveTaskExecutionContext(offerId);
    var workspacePath = pickWorkspacePath(executionContext);
    var branch = executionContext.workspace.branch;

    if (!workspacePath) {
        throw new Error('Workspace da oferta indisponível.');
    }

    var insertResult = await supabase
        .from('ai_tasks')
        .insert({
            status: 'pending',
            prompt: prompt,
            offer_id: executionContext.id,
            task_type: taskType,
            workspace: workspacePath,
            branch: branch,
            requested_by: requestedBy,
            metadata: Object.assign({}, metadata, {
                offer_slug: executionContext.slug,
                workspace_key: executionContext.workspace.key,
            }),
        })
        .select('*')
        .single();

    if (insertResult.error || !insertResult.data) {
        throw new Error((insertResult.error && insertResult.error.message) || 'Não foi possível criar a task.');
    }

    return toPublicTask(insertResult.data);
}

async function getTaskById(taskId) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var id = String(taskId || '').trim();

    if (!id) {
        throw new Error('Task em falta.');
    }

    var result = await supabase
        .from('ai_tasks')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível carregar a task.');
    }

    if (!result.data) {
        return null;
    }

    return toPublicTask(result.data);
}

async function listTasks(options) {
    var supabase = getSupabaseAdmin();
    var limit = Math.min(parseInt((options && options.limit) || '20', 10) || 20, 50);

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var query = supabase
        .from('ai_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (options && options.offer_id) {
        query = query.eq('offer_id', String(options.offer_id).trim());
    }

    var result = await query;

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível listar tasks.');
    }

    return (result.data || []).map(toPublicTask);
}

module.exports = {
    ALLOWED_STATUSES: ALLOWED_STATUSES,
    sanitizePrompt: sanitizePrompt,
    toPublicTask: toPublicTask,
    createTask: createTask,
    getTaskById: getTaskById,
    listTasks: listTasks,
    resolveTaskExecutionContext: resolveTaskExecutionContext,
    pickWorkspacePath: pickWorkspacePath,
};
