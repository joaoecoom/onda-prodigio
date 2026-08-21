'use strict';

var constants = require('../funnel-engine/constants');

var OFFER_ID = {
    type: 'string',
    description: 'ID da oferta (deve corresponder à oferta autorizada da task).',
};

var TOOL_DEFINITIONS = [
    {
        name: 'get_funnel',
        description: 'Obter um funnel por ID dentro da oferta autorizada.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID, funnel_id: { type: 'string' } },
            required: ['offer_id', 'funnel_id'],
        },
    },
    {
        name: 'list_funnels',
        description: 'Listar funnels da oferta autorizada.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID },
            required: ['offer_id'],
        },
    },
    {
        name: 'create_funnel',
        description: 'Criar funnel na oferta autorizada.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                name: { type: 'string' },
                slug: { type: 'string' },
                type: { type: 'string', enum: constants.FUNNEL_TYPES },
                status: { type: 'string', enum: constants.FUNNEL_STATUSES },
                description: { type: 'string' },
                settings: { type: 'object' },
            },
            required: ['offer_id', 'name'],
        },
    },
    {
        name: 'update_funnel',
        description: 'Actualizar funnel existente.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                funnel_id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                type: { type: 'string', enum: constants.FUNNEL_TYPES },
                status: { type: 'string', enum: constants.FUNNEL_STATUSES },
                description: { type: 'string' },
                settings: { type: 'object' },
            },
            required: ['offer_id', 'funnel_id'],
        },
    },
    {
        name: 'get_page',
        description: 'Obter page por ID.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID, page_id: { type: 'string' } },
            required: ['offer_id', 'page_id'],
        },
    },
    {
        name: 'list_pages',
        description: 'Listar pages de um funnel.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID, funnel_id: { type: 'string' } },
            required: ['offer_id', 'funnel_id'],
        },
    },
    {
        name: 'create_page',
        description: 'Criar page num funnel. Preferir status draft.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                funnel_id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                type: { type: 'string', enum: constants.PAGE_TYPES },
                status: { type: 'string', enum: constants.PAGE_STATUSES },
                sort_order: { type: 'number' },
                settings: { type: 'object' },
                seo: { type: 'object' },
            },
            required: ['offer_id', 'funnel_id', 'name'],
        },
    },
    {
        name: 'update_page',
        description: 'Actualizar page existente.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                page_id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                type: { type: 'string', enum: constants.PAGE_TYPES },
                status: { type: 'string', enum: constants.PAGE_STATUSES },
                sort_order: { type: 'number' },
                settings: { type: 'object' },
                seo: { type: 'object' },
            },
            required: ['offer_id', 'page_id'],
        },
    },
    {
        name: 'duplicate_page',
        description: 'Duplicar page com sections/blocks. Requer name e slug novos.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                page_id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
            },
            required: ['offer_id', 'page_id', 'name', 'slug'],
        },
    },
    {
        name: 'list_sections',
        description: 'Listar sections de uma page.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID, page_id: { type: 'string' } },
            required: ['offer_id', 'page_id'],
        },
    },
    {
        name: 'create_section',
        description: 'Criar section numa page.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                page_id: { type: 'string' },
                type: { type: 'string' },
                sort_order: { type: 'number' },
                settings: { type: 'object' },
                styles: { type: 'object' },
                visibility: { type: 'object' },
            },
            required: ['offer_id', 'page_id', 'type'],
        },
    },
    {
        name: 'update_section',
        description: 'Actualizar section existente.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                section_id: { type: 'string' },
                type: { type: 'string' },
                sort_order: { type: 'number' },
                settings: { type: 'object' },
                styles: { type: 'object' },
                visibility: { type: 'object' },
            },
            required: ['offer_id', 'section_id'],
        },
    },
    {
        name: 'delete_section',
        description: 'Eliminar section e blocks associados.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID, section_id: { type: 'string' } },
            required: ['offer_id', 'section_id'],
        },
    },
    {
        name: 'reorder_sections',
        description: 'Reordenar sections. items: [{id, sort_order}]',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                page_id: { type: 'string' },
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            sort_order: { type: 'number' },
                        },
                        required: ['id', 'sort_order'],
                    },
                },
            },
            required: ['offer_id', 'page_id', 'items'],
        },
    },
    {
        name: 'list_blocks',
        description: 'Listar blocks de uma section.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID, section_id: { type: 'string' } },
            required: ['offer_id', 'section_id'],
        },
    },
    {
        name: 'create_block',
        description: 'Criar block. Tipos: heading,text,image,video,button,spacer. Evitar html salvo se necessário.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                section_id: { type: 'string' },
                type: { type: 'string', enum: constants.BLOCK_TYPES },
                sort_order: { type: 'number' },
                content: { type: 'object' },
                settings: { type: 'object' },
                styles: { type: 'object' },
                visibility: { type: 'object' },
            },
            required: ['offer_id', 'section_id', 'type'],
        },
    },
    {
        name: 'update_block',
        description: 'Actualizar block existente.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                block_id: { type: 'string' },
                type: { type: 'string', enum: constants.BLOCK_TYPES },
                sort_order: { type: 'number' },
                content: { type: 'object' },
                settings: { type: 'object' },
                styles: { type: 'object' },
                visibility: { type: 'object' },
            },
            required: ['offer_id', 'block_id'],
        },
    },
    {
        name: 'delete_block',
        description: 'Eliminar block.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID, block_id: { type: 'string' } },
            required: ['offer_id', 'block_id'],
        },
    },
    {
        name: 'reorder_blocks',
        description: 'Reordenar blocks. items: [{id, sort_order}]',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                section_id: { type: 'string' },
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            sort_order: { type: 'number' },
                        },
                        required: ['id', 'sort_order'],
                    },
                },
            },
            required: ['offer_id', 'section_id', 'items'],
        },
    },
    {
        name: 'get_page_tree',
        description: 'Obter árvore completa page → sections → blocks.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID, page_id: { type: 'string' } },
            required: ['offer_id', 'page_id'],
        },
    },
    {
        name: 'get_offer_launch_status',
        description: 'Avaliar launch readiness / health check da oferta autorizada.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID },
            required: ['offer_id'],
        },
    },
    {
        name: 'provision_offer',
        description: 'Provisionar produto principal e checkout main de forma idempotente.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                amount_cents: { type: 'number' },
                currency: { type: 'string' },
            },
            required: ['offer_id'],
        },
    },
    {
        name: 'validate_offer',
        description: 'Executar validação completa de launch readiness da oferta.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID },
            required: ['offer_id'],
        },
    },
    {
        name: 'launch_offer',
        description: 'Lançar oferta (activar) se todos os checks críticos passarem.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID },
            required: ['offer_id'],
        },
    },
    {
        name: 'create_offer',
        description: 'Criar oferta (idempotente por slug). Devolve existente se slug já existir.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                slug: { type: 'string' },
                funnel_domain: { type: 'string' },
                amount_cents: { type: 'number' },
                currency: { type: 'string' },
            },
            required: ['name'],
        },
    },
    {
        name: 'save_offer_integrations',
        description: 'Guardar integrações da oferta (Stripe, Meta, GA4, etc.). Nunca devolve secrets.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                integrations: { type: 'object' },
            },
            required: ['offer_id', 'integrations'],
        },
    },
    {
        name: 'get_offer_integrations_status',
        description: 'Estado das integrações (configured flags only, sem secrets).',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID },
            required: ['offer_id'],
        },
    },
    {
        name: 'apply_template',
        description: 'Aplicar template de página (sales-basic, sales-minimal, sales-full) a uma page existente.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                page_id: { type: 'string' },
                template_id: {
                    type: 'string',
                    enum: ['sales-basic', 'sales-minimal', 'sales-full'],
                },
            },
            required: ['offer_id', 'page_id', 'template_id'],
        },
    },
    {
        name: 'publish_page',
        description: 'Publicar page (alias para status published).',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID, page_id: { type: 'string' } },
            required: ['offer_id', 'page_id'],
        },
    },
    {
        name: 'get_content_tree',
        description: 'Obter árvore Product → Modules → Lessons da oferta.',
        inputSchema: {
            type: 'object',
            properties: { offer_id: OFFER_ID },
            required: ['offer_id'],
        },
    },
    {
        name: 'create_content_module',
        description: 'Criar módulo de comunidade no produto da oferta.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                title: { type: 'string' },
                description: { type: 'string' },
                unlock_after_days: { type: 'number' },
            },
            required: ['offer_id', 'title'],
        },
    },
    {
        name: 'create_content_lesson',
        description: 'Criar aula num módulo da oferta.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                module_id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                type: { type: 'string', enum: ['video', 'ebook'] },
                youtube_id: { type: 'string' },
                video_path: { type: 'string' },
                pdf_path: { type: 'string' },
                audio_path: { type: 'string' },
                image_url: { type: 'string' },
                unlock_after_days: { type: 'number' },
            },
            required: ['offer_id', 'module_id', 'title'],
        },
    },
    {
        name: 'update_content_module',
        description: 'Actualizar módulo de comunidade.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                module_id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                unlock_after_days: { type: 'number' },
            },
            required: ['offer_id', 'module_id'],
        },
    },
    {
        name: 'update_content_lesson',
        description: 'Actualizar aula de comunidade.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                lesson_id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                type: { type: 'string', enum: ['video', 'ebook'] },
                youtube_id: { type: 'string' },
                video_path: { type: 'string' },
                pdf_path: { type: 'string' },
                audio_path: { type: 'string' },
                image_url: { type: 'string' },
                unlock_after_days: { type: 'number' },
            },
            required: ['offer_id', 'lesson_id'],
        },
    },
    {
        name: 'create_quiz',
        description: 'Criar ou substituir definição de quiz num funnel type=quiz.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                funnel_id: { type: 'string' },
                settings: { type: 'object' },
                questions: { type: 'array' },
                results: { type: 'array' },
            },
            required: ['offer_id', 'funnel_id', 'questions'],
        },
    },
    {
        name: 'get_quiz',
        description: 'Obter perguntas, respostas e resultados de um quiz funnel.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                funnel_id: { type: 'string' },
            },
            required: ['offer_id', 'funnel_id'],
        },
    },
    {
        name: 'create_quiz_question',
        description: 'Adicionar pergunta a um quiz funnel.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                funnel_id: { type: 'string' },
                question: { type: 'string' },
                question_type: { type: 'string', enum: ['single', 'multiple', 'text', 'email'] },
                required: { type: 'boolean' },
                position: { type: 'number' },
            },
            required: ['offer_id', 'funnel_id', 'question'],
        },
    },
    {
        name: 'update_quiz_question',
        description: 'Actualizar pergunta de quiz.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                question_id: { type: 'string' },
                question: { type: 'string' },
                question_type: { type: 'string', enum: ['single', 'multiple', 'text', 'email'] },
                required: { type: 'boolean' },
                position: { type: 'number' },
            },
            required: ['offer_id', 'question_id'],
        },
    },
    {
        name: 'create_quiz_answer',
        description: 'Adicionar resposta a uma pergunta de quiz.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                question_id: { type: 'string' },
                label: { type: 'string' },
                value: { type: 'string' },
                score: { type: 'number' },
                position: { type: 'number' },
            },
            required: ['offer_id', 'question_id', 'label'],
        },
    },
    {
        name: 'update_quiz_answer',
        description: 'Actualizar resposta de quiz.',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                answer_id: { type: 'string' },
                label: { type: 'string' },
                value: { type: 'string' },
                score: { type: 'number' },
                position: { type: 'number' },
            },
            required: ['offer_id', 'answer_id'],
        },
    },
    {
        name: 'publish_quiz',
        description: 'Publicar page do quiz funnel (slug quiz por defeito).',
        inputSchema: {
            type: 'object',
            properties: {
                offer_id: OFFER_ID,
                funnel_id: { type: 'string' },
                page_slug: { type: 'string' },
            },
            required: ['offer_id', 'funnel_id'],
        },
    },
];

var ALLOWED_TOOL_NAMES = TOOL_DEFINITIONS.map(function (tool) {
    return tool.name;
});

function getToolDefinition(name) {
    return TOOL_DEFINITIONS.find(function (tool) {
        return tool.name === name;
    }) || null;
}

function isAllowedTool(name) {
    return ALLOWED_TOOL_NAMES.indexOf(name) !== -1;
}

module.exports = {
    TOOL_DEFINITIONS: TOOL_DEFINITIONS,
    ALLOWED_TOOL_NAMES: ALLOWED_TOOL_NAMES,
    getToolDefinition: getToolDefinition,
    isAllowedTool: isAllowedTool,
};
