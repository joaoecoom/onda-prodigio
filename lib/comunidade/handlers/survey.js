var authHelpers = require('../auth-helpers');
var surveyRegistry = require('../survey-registry');

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

function resolveSurveyId(source) {
    var surveyId = typeof source.survey_id === 'string' ? source.survey_id.trim() : '';

    if (!surveyId) {
        return surveyRegistry.DEFAULT_SURVEY_ID;
    }

    return surveyId;
}

async function handleGet(req, res, auth, member, adminProfile) {
    var productId = typeof req.query.product_id === 'string' ? req.query.product_id.trim() : '';
    var surveyId = resolveSurveyId(req.query);

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
            .eq('survey_id', surveyId)
            .order('created_at', { ascending: false });

        if (adminResult.error) {
            throw adminResult.error;
        }

        return res.status(200).json({
            survey_id: surveyId,
            submissions: (adminResult.data || []).map(formatSubmission),
        });
    }

    var memberResult = await auth.admin
        .from('welcome_survey_responses')
        .select('id, answers, created_at')
        .eq('product_id', productId)
        .eq('survey_id', surveyId)
        .eq('member_id', member.id)
        .maybeSingle();

    if (memberResult.error) {
        throw memberResult.error;
    }

    if (!memberResult.data) {
        return res.status(200).json({ survey_id: surveyId, submitted: false });
    }

    return res.status(200).json({
        survey_id: surveyId,
        submitted: true,
        answers: memberResult.data.answers,
        result: memberResult.data.answers && memberResult.data.answers._result ?
            memberResult.data.answers._result :
            null,
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
    var surveyId = resolveSurveyId(body);
    var surveyConfig = surveyRegistry.getSurveyConfig(surveyId);
    var answers = body.answers && typeof body.answers === 'object' ? body.answers : null;

    if (!productId || !answers) {
        return authHelpers.jsonError(res, 400, 'Questionário inválido.');
    }

    var validationError = surveyConfig.validateAnswers(answers);

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
        .eq('survey_id', surveyId)
        .eq('member_id', member.id)
        .maybeSingle();

    if (existingResult.error) {
        throw existingResult.error;
    }

    if (existingResult.data) {
        return authHelpers.jsonError(res, 409, 'Já respondeste a este teste.');
    }

    var sanitizedAnswers = surveyConfig.sanitizeAnswers(answers);
    var result = sanitizedAnswers._result || null;

    var insertResult = await auth.admin
        .from('welcome_survey_responses')
        .insert({
            member_id: member.id,
            product_id: productId,
            module_id: moduleId || null,
            survey_id: surveyId,
            answers: sanitizedAnswers,
        })
        .select('id, created_at')
        .single();

    if (insertResult.error) {
        throw insertResult.error;
    }

    return res.status(201).json({
        ok: true,
        created_at: insertResult.data.created_at,
        result: result,
    });
}

function formatSubmission(row) {
    var memberData = row.members || {};

    return {
        id: row.id,
        member_name: memberData.full_name || '',
        member_email: memberData.email || '',
        module_id: row.module_id,
        answers: row.answers,
        result: row.answers && row.answers._result ? row.answers._result : null,
        created_at: row.created_at,
    };
}
