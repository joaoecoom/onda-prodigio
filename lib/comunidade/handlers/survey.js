var authHelpers = require('../auth-helpers');
var surveyConfig = require('../welcome-survey-config');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        var auth = await authHelpers.getAuthUserFromRequest(req);

        if (auth.error) {
            return authHelpers.jsonError(res, auth.status, auth.error);
        }

        var member = await authHelpers.getMemberByAuthUser(auth.admin, auth.user);
        var adminProfile = await authHelpers.getAdminByAuthUser(auth.admin, auth.user);

        if (!member && !adminProfile) {
            return authHelpers.jsonError(res, 403, 'Sem acesso.');
        }

        if (req.method === 'GET') {
            return handleGet(req, res, auth, member, adminProfile);
        }

        return handlePost(req, res, auth, member);
    } catch (error) {
        console.error('Erro no questionário:', error);
        return authHelpers.jsonError(res, 500, 'Não foi possível processar o questionário.');
    }
};

async function handleGet(req, res, auth, member, adminProfile) {
    var productId = typeof req.query.product_id === 'string' ? req.query.product_id.trim() : '';

    if (!productId) {
        return authHelpers.jsonError(res, 400, 'Produto em falta.');
    }

    var productIds = await authHelpers.getAccessibleProductIds(auth.admin, member, adminProfile);

    if (productIds.indexOf(productId) === -1) {
        return authHelpers.jsonError(res, 403, 'Sem acesso a este produto.');
    }

    if (adminProfile) {
        var adminResult = await auth.admin
            .from('welcome_survey_responses')
            .select('id, member_id, product_id, module_id, answers, created_at, members(full_name, email)')
            .eq('product_id', productId)
            .eq('survey_id', surveyConfig.SURVEY_ID)
            .order('created_at', { ascending: false });

        if (adminResult.error) {
            throw adminResult.error;
        }

        return res.status(200).json({
            submissions: (adminResult.data || []).map(formatSubmission),
        });
    }

    var memberResult = await auth.admin
        .from('welcome_survey_responses')
        .select('id, answers, created_at')
        .eq('product_id', productId)
        .eq('survey_id', surveyConfig.SURVEY_ID)
        .eq('member_id', member.id)
        .maybeSingle();

    if (memberResult.error) {
        throw memberResult.error;
    }

    if (!memberResult.data) {
        return res.status(200).json({ submitted: false });
    }

    return res.status(200).json({
        submitted: true,
        answers: memberResult.data.answers,
        created_at: memberResult.data.created_at,
    });
}

async function handlePost(req, res, auth, member) {
    if (!member) {
        return authHelpers.jsonError(res, 403, 'Apenas membros podem responder ao questionário.');
    }

    var body = req.body || {};
    var productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
    var moduleId = typeof body.module_id === 'string' ? body.module_id.trim() : null;
    var answers = body.answers && typeof body.answers === 'object' ? body.answers : null;

    if (!productId || !answers) {
        return authHelpers.jsonError(res, 400, 'Questionário inválido.');
    }

    var validationError = validateAnswers(answers);

    if (validationError) {
        return authHelpers.jsonError(res, 400, validationError);
    }

    var productIds = await authHelpers.getAccessibleProductIds(auth.admin, member, null);

    if (productIds.indexOf(productId) === -1) {
        return authHelpers.jsonError(res, 403, 'Sem acesso a este produto.');
    }

    var existingResult = await auth.admin
        .from('welcome_survey_responses')
        .select('id')
        .eq('product_id', productId)
        .eq('survey_id', surveyConfig.SURVEY_ID)
        .eq('member_id', member.id)
        .maybeSingle();

    if (existingResult.error) {
        throw existingResult.error;
    }

    if (existingResult.data) {
        return authHelpers.jsonError(res, 409, 'Já respondeste a este questionário.');
    }

    var insertResult = await auth.admin
        .from('welcome_survey_responses')
        .insert({
            member_id: member.id,
            product_id: productId,
            module_id: moduleId || null,
            survey_id: surveyConfig.SURVEY_ID,
            answers: sanitizeAnswers(answers),
        })
        .select('id, created_at')
        .single();

    if (insertResult.error) {
        throw insertResult.error;
    }

    return res.status(201).json({
        ok: true,
        created_at: insertResult.data.created_at,
    });
}

function validateAnswers(answers) {
    var index;

    for (index = 0; index < surveyConfig.REQUIRED_FIELDS.length; index += 1) {
        var field = surveyConfig.REQUIRED_FIELDS[index];
        var value = normalizeValue(answers[field]);

        if (!value) {
            return 'Responde a todas as perguntas obrigatórias.';
        }

        if (value === '__other__') {
            var otherField = surveyConfig.OTHER_FIELDS[field];
            var otherValue = otherField ? normalizeValue(answers[otherField]) : '';

            if (!otherValue) {
                return 'Preenche o campo «Outro» quando seleccionares essa opção.';
            }
        }
    }

    if (normalizeValue(answers.biggest_fear).length < 5) {
        return 'Descreve melhor o teu maior medo ou frustração.';
    }

    if (normalizeValue(answers.purchase_reason).length < 5) {
        return 'Descreve melhor o que te convenceu a adquirir o Onda Prodígio.';
    }

    return '';
}

function sanitizeAnswers(answers) {
    var sanitized = {};
    var keys = Object.keys(answers);

    keys.forEach(function (key) {
        sanitized[key] = normalizeValue(answers[key]);
    });

    return sanitized;
}

function normalizeValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function formatSubmission(row) {
    var memberData = row.members || {};

    return {
        id: row.id,
        member_name: memberData.full_name || '',
        member_email: memberData.email || '',
        module_id: row.module_id,
        answers: row.answers,
        created_at: row.created_at,
    };
}
