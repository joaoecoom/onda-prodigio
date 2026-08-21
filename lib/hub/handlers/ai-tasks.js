var metricsAuth = require('../../metrics/auth');
var aiTasks = require('../ai-tasks');

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

async function handleCreate(req, res) {
    var body = await readJsonBody(req);

    try {
        var task = await aiTasks.createTask({
            prompt: body.prompt,
            offer_id: body.offer_id || null,
            task_type: body.task_type || 'general',
            requested_by: 'hub',
            metadata: {
                source: 'hub-ui',
                user_agent: String(req.headers['user-agent'] || '').slice(0, 200),
            },
        });

        return res.status(201).json({ task: task });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Não foi possível criar a task.',
        });
    }
}

async function handleGet(req, res) {
    var taskId = String(req.query.id || req.query.task_id || '').trim();

    if (!taskId) {
        return res.status(400).json({ error: 'Task em falta.' });
    }

    try {
        var task = await aiTasks.getTaskById(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task não encontrada.' });
        }

        return res.status(200).json({ task: task });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Não foi possível carregar a task.',
        });
    }
}

async function handleList(req, res) {
    try {
        var tasks = await aiTasks.listTasks({
            limit: req.query.limit,
            offer_id: req.query.offer_id || null,
        });

        return res.status(200).json({ tasks: tasks });
    } catch (error) {
        return res.status(400).json({
            error: error.message || 'Não foi possível listar tasks.',
        });
    }
}

module.exports = async function handler(req, res) {
    if (!metricsAuth.isAuthorized(req)) {
        return sendUnauthorized(res);
    }

    var action = String(req.query.action || '').trim();

    if (req.method === 'POST' && action === 'hub_ai_task_create') {
        return handleCreate(req, res);
    }

    if (req.method === 'GET' && action === 'hub_ai_task') {
        return handleGet(req, res);
    }

    if (req.method === 'GET' && action === 'hub_ai_tasks') {
        return handleList(req, res);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
};
