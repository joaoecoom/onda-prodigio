'use strict';

var { getSupabaseAdmin } = require('../../supabase-admin');

function nowIso() {
    return new Date().toISOString();
}

function dbError(result, message) {
    throw new Error((result.error && result.error.message) || message);
}

function getClient() {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    return supabase;
}

async function insertRow(table, row) {
    var supabase = getClient();
    var result = await supabase.from(table).insert(row).select('*').single();

    if (result.error || !result.data) {
        dbError(result, 'Não foi possível criar ' + table + '.');
    }

    return result.data;
}

async function updateRow(table, id, patch) {
    var supabase = getClient();
    var result = await supabase
        .from(table)
        .update(Object.assign({}, patch, { updated_at: nowIso() }))
        .eq('id', id)
        .select('*')
        .single();

    if (result.error || !result.data) {
        dbError(result, 'Não foi possível actualizar ' + table + '.');
    }

    return result.data;
}

async function deleteRow(table, id) {
    var supabase = getClient();
    var result = await supabase.from(table).delete().eq('id', id);

    if (result.error) {
        dbError(result, 'Não foi possível eliminar ' + table + '.');
    }
}

async function getById(table, id) {
    var supabase = getClient();
    var result = await supabase.from(table).select('*').eq('id', id).maybeSingle();

    if (result.error) {
        dbError(result, 'Não foi possível carregar ' + table + '.');
    }

    return result.data || null;
}

async function listQuestions(funnelId) {
    var supabase = getClient();
    var result = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

    if (result.error) {
        dbError(result, 'Não foi possível listar perguntas.');
    }

    return result.data || [];
}

async function listAnswersForQuestions(questionIds) {
    if (!questionIds.length) {
        return [];
    }

    var supabase = getClient();
    var result = await supabase
        .from('quiz_answers')
        .select('*')
        .in('question_id', questionIds)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

    if (result.error) {
        dbError(result, 'Não foi possível listar respostas.');
    }

    return result.data || [];
}

async function listResults(funnelId) {
    var supabase = getClient();
    var result = await supabase
        .from('quiz_results')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (result.error) {
        dbError(result, 'Não foi possível listar resultados.');
    }

    return result.data || [];
}

async function insertSubmission(row) {
    return insertRow('quiz_submissions', row);
}

async function deleteQuestionsByFunnel(funnelId) {
    var supabase = getClient();
    var questions = await listQuestions(funnelId);

    if (questions.length) {
        var ids = questions.map(function (q) { return q.id; });
        var answerDelete = await supabase.from('quiz_answers').delete().in('question_id', ids);

        if (answerDelete.error) {
            dbError(answerDelete, 'Não foi possível limpar respostas.');
        }
    }

    var result = await supabase.from('quiz_questions').delete().eq('funnel_id', funnelId);

    if (result.error) {
        dbError(result, 'Não foi possível limpar perguntas.');
    }
}

async function deleteResultsByFunnel(funnelId) {
    var supabase = getClient();
    var result = await supabase.from('quiz_results').delete().eq('funnel_id', funnelId);

    if (result.error) {
        dbError(result, 'Não foi possível limpar resultados.');
    }
}

module.exports = {
    insertRow: insertRow,
    updateRow: updateRow,
    deleteRow: deleteRow,
    getById: getById,
    listQuestions: listQuestions,
    listAnswersForQuestions: listAnswersForQuestions,
    listResults: listResults,
    insertSubmission: insertSubmission,
    deleteQuestionsByFunnel: deleteQuestionsByFunnel,
    deleteResultsByFunnel: deleteResultsByFunnel,
};
