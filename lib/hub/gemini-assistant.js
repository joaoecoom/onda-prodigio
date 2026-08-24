'use strict';

var geminiClient = require('../llm');
var geminiToolBridge = require('./gemini-tool-bridge');
var agentTools = require('./agent-tools');
var offerContext = require('./offer-context');
var referenceNormalize = require('./references/normalize');

var MAX_TOOL_ROUNDS = 3;

var MODE_PROMPTS = {
    funnel: [
        'Estás a ajudar a construir funis de vendas no HUB DR Ecoom.',
        'Usa setup_funnel_flow para criar a estrutura (Sales → Checkout → Upsell → Thank You).',
        'Depois create_page para páginas em branco ou apply_template se pedido.',
        'Checkout é sistema universal — não cries page tipo checkout com conteúdo pesado.',
        'Responde em português de Portugal, curto e operacional.',
    ].join('\n'),
    tracking: [
        'Estás a configurar tracking isolado por oferta (Meta Pixel, CAPI, GTM, Stape, GA4).',
        'Cada oferta tem credenciais próprias — nunca assumes valores de outras ofertas.',
        'Usa save_offer_integrations para guardar. Pede pixel e token CAPI como mínimo.',
        'Moeda reporting Meta deve coincidir com a moeda comercial quando possível.',
        'Responde em português de Portugal.',
    ].join('\n'),
    domain: [
        'Estás a registar domínios funil na Vercel para esta oferta.',
        'Usa register_funnel_domain com o domínio exacto (sem https).',
        'Indica ao utilizador os passos DNS se a API Vercel não estiver configurada.',
        'Responde em português de Portugal.',
    ].join('\n'),
    checkout: [
        'Estás a construir o checkout universal desta oferta (/checkout/?offer=…).',
        'Usa save_checkout_template para html_top (hero, scarcity, testemunhos), html_bottom (trust badges) e custom_css.',
        'Inspira-te no layout Onda (checkout9) mas NÃO copies preços hardcoded — preço vem de update_checkout_pricing / hub_offer_checkouts.',
        'NÃO removes nem renomeias IDs obrigatórios: checkout-form, payment-element, submit-payment, order-bump-list, order-bumps-section.',
        'Order bumps: upsert_order_bump (bump_id, product_id, label, amount_cents).',
        'Stripe: save_offer_integrations se pedido.',
        'Responde em português de Portugal.',
    ].join('\n'),
    page: [
        'Estás a criar ou editar páginas do funil.',
        'Usa create_page + apply_template ou create_section/create_block — Page Engine, não HTML solto.',
        'Para sales page completa: create_page → apply_template sales-full → ajusta blocks.',
        'CTA checkout: button com action checkout no block settings.',
        'Responde em português de Portugal.',
    ].join('\n'),
    page_builder: [
        'Page Builder — executa tools, não descrevas limitações.',
        'Com screenshot: REPLICAÇÃO PIXEL. HTML tem de parecer a imagem.',
        'Comentários Facebook: bolha #F0F2F5, nome #385898, replies com border-left, Gosto=SVG #0866FF (nunca 👍).',
        'Editar → update_block(block_id). Novo → create_section custom + blocks[{type:"html",content:{html}}].',
        'NUNCA apagar para mudar estilo. NUNCA pedir confirmação. 1 frase PT no fim.',
    ].join('\n'),
    general: [
        'Assistente operacional do HUB DR Ecoom para funis, tracking e domínios.',
        'Executa acções via tools — não inventes IDs.',
        'Responde em português de Portugal.',
    ].join('\n'),
};

function normalizeMessages(messages, limit) {
    var max = limit || 20;
    return (messages || []).slice(-max).map(function (msg) {
        return {
            role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(msg.content || msg.text || '').trim() }],
        };
    }).filter(function (msg) {
        return msg.parts[0].text;
    });
}

function buildSystemInstruction(context, mode, extraContext) {
    var normalizedMode = geminiToolBridge.normalizeMode(mode);
    var lines = [
        MODE_PROMPTS[normalizedMode] || MODE_PROMPTS.general,
        '',
        extraContext || context.agentContext || offerContext.buildAgentContextSummary(context),
        '',
        'Regras:',
        '- offer_id obrigatório em todas as tools: ' + context.id,
        '- Não expor secrets completos na resposta.',
        '- Se uma tool falhar, explica o erro — não finjas sucesso.',
    ];

    if (normalizedMode === 'page_builder') {
        lines.push('- OBRIGATÓRIO: chamar tools (update_block, create_section, apply_page_patches) — não responder só com texto.');
        lines.push('- PROIBIDO: pedir confirmação, apagar+recriar para estilos, dizer que faltam IDs (estão no BLOCK_MAP).');
        lines.push('- Confirma o que foi feito numa frase curta após executar.');
    } else {
        lines.push('- Confirma o que foi feito após cada tool.');
    }

    return lines.join('\n');
}

async function runToolCalls(functionCalls, executor, offerId) {
    var tasks = functionCalls.map(function (call) {
        var name = call.name;
        var args = Object.assign({}, call.args || {});

        if (!args.offer_id) {
            args.offer_id = offerId;
        }

        return executor.executeTool(name, args, { source: 'gemini' })
            .then(function (result) {
                return { name: name, ok: true, result: result };
            })
            .catch(function (error) {
                return {
                    name: name,
                    ok: false,
                    error: error.message || String(error),
                };
            });
    });

    return Promise.all(tasks);
}

function toFunctionResponseParts(toolResults) {
    return toolResults.map(function (row) {
        return {
            functionResponse: {
                name: row.name,
                response: {
                    ok: row.ok,
                    result: row.ok ? row.result : undefined,
                    error: row.ok ? undefined : row.error,
                },
            },
        };
    });
}

async function chat(input) {
    if (!geminiClient.isConfigured()) {
        throw new Error('Gemini não configurado. Adiciona GEMINI_API_KEY nas variáveis de ambiente da Vercel.');
    }

    var metrics = {};
    var t0 = Date.now();
    var slug = String(input.slug || input.offer || '').trim();
    var mode = geminiToolBridge.normalizeMode(input.mode);
    var userMessage = String(input.message || '').trim();
    var references = referenceNormalize.normalizeReferences(input.references);
    var maxRounds = mode === 'page_builder' ? 2 : MAX_TOOL_ROUNDS;

    if (!slug && !input.offer_id) {
        throw new Error('Oferta em falta.');
    }

    if (!userMessage && !references.length) {
        throw new Error('Mensagem ou referência em falta.');
    }

    var context;

    if (input.offer_id && slug) {
        context = {
            id: input.offer_id,
            slug: slug,
            name: input.offer_name || slug,
        };
        metrics.offer_context_ms = 0;
    } else {
        context = await offerContext.resolveOfferContext({ slug: slug });
        metrics.offer_context_ms = Date.now() - t0;
    }

    var extraContext = String(input.extraContext || '').trim();
    var historyLimit = mode === 'page_builder' ? 6 : 20;
    var history = normalizeMessages(input.messages || [], historyLimit);
    var contents = history.concat([{
        role: 'user',
        parts: referenceNormalize.buildUserParts(userMessage, references),
    }]);

    var tools = geminiToolBridge.getToolsForMode(mode);
    var executor = agentTools.createExecutor({ boundOfferId: context.id });
    var toolLog = [];
    var rounds = 0;
    var finalText = '';

    while (rounds < maxRounds) {
        rounds += 1;
        var geminiStart = Date.now();

        var response = await geminiClient.generateContent({
            model: mode === 'page_builder' ? 'gemini-2.5-flash' : undefined,
            systemInstruction: buildSystemInstruction(context, mode, extraContext),
            contents: contents,
            tools: tools,
            generationConfig: mode === 'page_builder'
                ? {
                    temperature: references.length ? 0.1 : 0.25,
                    maxOutputTokens: references.length ? 12288 : 4096,
                }
                : undefined,
        });

        metrics['gemini_request_ms_' + rounds] = Date.now() - geminiStart;
        if (response._gemini_meta) {
            metrics.model_used = response._gemini_meta.model;
            metrics.gemini_fallback = Boolean(response._gemini_meta.used_fallback);
            metrics.gemini_retries = response._gemini_meta.retries;
        }

        var candidate = (response.candidates || [])[0];
        var parts = geminiClient.extractParts(candidate);
        var functionCalls = geminiClient.extractFunctionCalls(parts);
        finalText = geminiClient.extractText(parts);

        if (!functionCalls.length) {
            break;
        }

        contents.push({
            role: 'model',
            parts: parts,
        });

        var toolStart = Date.now();
        var toolResults = await runToolCalls(functionCalls, executor, context.id);
        metrics['tool_execution_ms_' + rounds] = Date.now() - toolStart;
        toolLog = toolLog.concat(toolResults);

        contents.push({
            role: 'user',
            parts: toFunctionResponseParts(toolResults),
        });
    }

    metrics.gemini_rounds = rounds;
    metrics.total_ms = Date.now() - t0;

    if (!finalText && toolLog.length) {
        finalText = 'Concluído: ' + toolLog.map(function (row) {
            return row.name + (row.ok ? ' ✓' : ' ✗');
        }).join(', ');
    }

    return {
        ok: true,
        mode: mode,
        model: geminiClient.getModel(),
        reply: finalText || 'Feito.',
        tool_calls: toolLog,
        metrics: metrics,
        offer: {
            id: context.id,
            slug: context.slug,
            name: context.name,
        },
    };
}

function getStatus() {
    return {
        configured: geminiClient.isConfigured(),
        model: geminiClient.getModel(),
        modes: geminiToolBridge.listModes(),
    };
}

module.exports = {
    chat: chat,
    getStatus: getStatus,
    MAX_TOOL_ROUNDS: MAX_TOOL_ROUNDS,
};
