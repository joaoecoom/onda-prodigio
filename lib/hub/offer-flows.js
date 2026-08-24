'use strict';

/**
 * Offer recovery / automation flows — visual definition stored as JSON nodes.
 * Same paradigm as page builder: AI creates, user edits, AI can alter again.
 */

var { getSupabaseAdmin } = require('../supabase-admin');

var DEFAULT_ABANDONED_CHECKOUT_FLOW = {
    nodes: [
        { id: 'n1', type: 'trigger', trigger: 'checkout_abandoned', label: 'Checkout abandonado' },
        { id: 'n2', type: 'wait', minutes: 15, label: 'Esperar 15 minutos' },
        { id: 'n3', type: 'email', subject: 'Esqueceste-te de algo?', body: 'Olá {{name}}, o teu checkout ainda está aberto. Completa a compra aqui: {{checkout_url}}', label: 'Email 1' },
        { id: 'n4', type: 'wait', minutes: 180, label: 'Esperar 3 horas' },
        { id: 'n5', type: 'whatsapp', body: 'Olá {{name}}! Ainda posso ajudar com a tua compra? {{checkout_url}}', label: 'WhatsApp 1' },
        { id: 'n6', type: 'wait', minutes: 1440, label: 'Esperar 1 dia' },
        { id: 'n7', type: 'email', subject: 'Última oportunidade', body: 'Olá {{name}}, esta é a última mensagem sobre a tua compra. {{checkout_url}}', label: 'Email final' },
        { id: 'n8', type: 'end', label: 'Fim' },
    ],
};

function normalizeDefinition(input) {
    var nodes = (input && input.nodes) || [];

    if (!Array.isArray(nodes)) {
        nodes = [];
    }

    return {
        nodes: nodes.map(function (node, index) {
            return {
                id: String(node.id || ('n' + (index + 1))).trim(),
                type: String(node.type || 'wait').trim(),
                label: String(node.label || node.type || 'Node').trim(),
                minutes: node.minutes != null ? parseInt(node.minutes, 10) || 0 : undefined,
                subject: node.subject != null ? String(node.subject) : undefined,
                body: node.body != null ? String(node.body) : undefined,
                trigger: node.trigger != null ? String(node.trigger) : undefined,
            };
        }),
    };
}

async function listFlows(offerId, options) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var query = supabase
        .from('hub_offer_flows')
        .select('*')
        .eq('offer_id', offerId)
        .order('updated_at', { ascending: false });

    if (options && options.kind) {
        query = query.eq('kind', options.kind);
    }

    var result = await query;

    if (result.error) {
        if (String(result.error.message || '').indexOf('hub_offer_flows') !== -1) {
            return [];
        }

        throw new Error(result.error.message || 'Não foi possível listar flows.');
    }

    return result.data || [];
}

async function getFlow(offerId, flowId) {
    var supabase = getSupabaseAdmin();
    var result = await supabase
        .from('hub_offer_flows')
        .select('*')
        .eq('offer_id', offerId)
        .eq('id', flowId)
        .maybeSingle();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível carregar o flow.');
    }

    if (!result.data) {
        throw new Error('Flow não encontrado.');
    }

    return result.data;
}

async function saveFlow(offerId, input) {
    var supabase = getSupabaseAdmin();
    var payload = {
        offer_id: offerId,
        kind: input.kind === 'automation' ? 'automation' : 'recovery',
        name: String(input.name || 'Fluxo').trim(),
        status: String(input.status || 'draft').trim(),
        trigger: String(input.trigger || 'checkout_abandoned').trim(),
        definition: normalizeDefinition(input.definition),
        updated_at: new Date().toISOString(),
    };

    if (!['draft', 'active', 'paused', 'archived'].includes(payload.status)) {
        payload.status = 'draft';
    }

    if (input.id) {
        var updated = await supabase
            .from('hub_offer_flows')
            .update(payload)
            .eq('offer_id', offerId)
            .eq('id', input.id)
            .select('*')
            .maybeSingle();

        if (updated.error) {
            throw new Error(updated.error.message || 'Não foi possível actualizar o flow.');
        }

        if (!updated.data) {
            throw new Error('Flow não encontrado.');
        }

        return updated.data;
    }

    var inserted = await supabase
        .from('hub_offer_flows')
        .insert(payload)
        .select('*')
        .maybeSingle();

    if (inserted.error) {
        throw new Error(inserted.error.message || 'Não foi possível criar o flow.');
    }

    return inserted.data;
}

async function deleteFlow(offerId, flowId) {
    var supabase = getSupabaseAdmin();
    var result = await supabase
        .from('hub_offer_flows')
        .delete()
        .eq('offer_id', offerId)
        .eq('id', flowId);

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível eliminar o flow.');
    }

    return { deleted: true, id: flowId };
}

async function ensureDefaultRecoveryFlow(offerId) {
    var existing = await listFlows(offerId, { kind: 'recovery' });

    if (existing.length) {
        return existing[0];
    }

    try {
        return await saveFlow(offerId, {
            kind: 'recovery',
            name: 'Recuperação — checkout abandonado',
            status: 'draft',
            trigger: 'checkout_abandoned',
            definition: DEFAULT_ABANDONED_CHECKOUT_FLOW,
        });
    } catch (error) {
        // Table may not exist yet — non-fatal during provision.
        return null;
    }
}

async function generateRecoveryFlowFromPrompt(offerId, prompt) {
    var text = String(prompt || '').toLowerCase();
    var nodes = DEFAULT_ABANDONED_CHECKOUT_FLOW.nodes.slice();

    if (text.indexOf('upsell') !== -1 || text.indexOf('pós-venda') !== -1 || text.indexOf('pos-venda') !== -1) {
        nodes = [
            { id: 'n1', type: 'trigger', trigger: 'purchase', label: 'Compra confirmada' },
            { id: 'n2', type: 'email', subject: 'Bem-vindo(a)!', body: 'Olá {{name}}, obrigado pela compra. Acede aqui: {{community_url}}', label: 'Email boas-vindas' },
            { id: 'n3', type: 'wait', minutes: 2880, label: 'Esperar 2 dias' },
            { id: 'n4', type: 'whatsapp', body: 'Olá {{name}}! Temos uma oferta especial para ti.', label: 'WhatsApp upsell' },
            { id: 'n5', type: 'wait', minutes: 4320, label: 'Esperar 3 dias' },
            { id: 'n6', type: 'email', subject: 'Uma sugestão para ti', body: 'Olá {{name}}, pensámos que isto podia interessar-te.', label: 'Email cross-sell' },
            { id: 'n7', type: 'end', label: 'Fim' },
        ];

        return saveFlow(offerId, {
            kind: 'automation',
            name: 'Automação pós-venda',
            status: 'draft',
            trigger: 'purchase',
            definition: { nodes: nodes },
        });
    }

    return saveFlow(offerId, {
        kind: 'recovery',
        name: 'Recuperação — checkout abandonado',
        status: 'draft',
        trigger: 'checkout_abandoned',
        definition: { nodes: nodes },
    });
}

module.exports = {
    DEFAULT_ABANDONED_CHECKOUT_FLOW: DEFAULT_ABANDONED_CHECKOUT_FLOW,
    normalizeDefinition: normalizeDefinition,
    listFlows: listFlows,
    getFlow: getFlow,
    saveFlow: saveFlow,
    deleteFlow: deleteFlow,
    ensureDefaultRecoveryFlow: ensureDefaultRecoveryFlow,
    generateRecoveryFlowFromPrompt: generateRecoveryFlowFromPrompt,
};
