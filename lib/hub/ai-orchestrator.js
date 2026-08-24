'use strict';

var aiProvider = require('../llm');
var contextEngine = require('./ai-context-engine');
var geminiAssistant = require('./gemini-assistant');
var agentTools = require('./agent-tools');
var geminiToolBridge = require('./gemini-tool-bridge');

var TOOL_STEP_LABELS = {
    list_pages: 'A listar páginas',
    create_page: 'A criar página',
    update_page: 'A actualizar página',
    get_page_tree: 'A carregar estrutura',
    create_section: 'A criar secção',
    update_section: 'A actualizar secção',
    apply_page_patches: 'A aplicar alterações',
    create_block: 'A criar block',
    update_block: 'A actualizar block',
    apply_template: 'A aplicar template',
    publish_page: 'A publicar página',
    setup_funnel_flow: 'A configurar funil',
    save_checkout_template: 'A guardar checkout',
};

function buildSteps(toolLog) {
    return (toolLog || []).map(function (row) {
        return {
            tool: row.name,
            label: TOOL_STEP_LABELS[row.name] || row.name,
            ok: Boolean(row.ok),
            error: row.ok ? null : row.error,
        };
    });
}

function extractPageIdFromToolLog(toolLog) {
    var pageId = null;
    var funnelId = null;
    var pageSlug = null;

    (toolLog || []).forEach(function (row) {
        if (!row.ok || !row.result) {
            return;
        }

        var data = row.result.data || row.result;

        if (data.page_id) {
            pageId = data.page_id;
        }

        if (data.page && data.page.id) {
            pageId = data.page.id;
        }

        if (data.funnel_id) {
            funnelId = data.funnel_id;
        }

        if (data.slug) {
            pageSlug = data.slug;
        }

        if (data.page && data.page.slug) {
            pageSlug = data.page.slug;
        }
    });

    return {
        page_id: pageId,
        funnel_id: funnelId,
        page_slug: pageSlug,
    };
}

async function run(input) {
    var mode = geminiToolBridge.normalizeMode(input.mode || 'general');
    var timer = require('./page-builder/timing').createTimer();
    var context = input.extraContext && input.mode === 'page_builder'
        ? {
            summary: input.extraContext,
            public: {
                module: 'page_builder',
                offer: { slug: input.slug || input.offer },
            },
        }
        : await contextEngine.build(Object.assign({}, input, { mode: mode }));
    timer.mark('context_ms');

    var chatResult = await geminiAssistant.chat(Object.assign({}, input, {
        mode: mode,
        extraContext: context.summary,
        _timer: timer,
    }));
    timer.mark('gemini_ms');

    var steps = buildSteps(chatResult.tool_calls);
    var refs = extractPageIdFromToolLog(chatResult.tool_calls);

    return Object.assign({}, chatResult, {
        steps: steps,
        context: context.public,
        page_refs: refs,
        metrics: Object.assign({}, chatResult.metrics || {}, timer.toJSON()),
    });
}

function getStatus() {
    return {
        configured: aiProvider.isConfigured(),
        provider: 'gemini',
        model: aiProvider.getModel(),
        modes: geminiToolBridge.listModes(),
        tool_count: agentTools.ALLOWED_TOOL_NAMES.length,
    };
}

module.exports = {
    run: run,
    getStatus: getStatus,
    buildSteps: buildSteps,
    extractPageIdFromToolLog: extractPageIdFromToolLog,
};
