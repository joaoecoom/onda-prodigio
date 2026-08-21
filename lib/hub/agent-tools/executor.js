'use strict';

var funnelEngine = require('../funnel-engine');
var offers = require('../offers');
var launchReadiness = require('../launch-readiness');
var context = require('./context');
var errors = require('./errors');
var registry = require('./registry');
var logger = require('./logger');

function pickFields(row, fields) {
    var output = {};

    fields.forEach(function (field) {
        if (row && row[field] != null) {
            output[field] = row[field];
        }
    });

    return output;
}

function summarizeFunnel(funnel) {
    return pickFields(funnel, ['id', 'offer_id', 'name', 'slug', 'type', 'status']);
}

function summarizePage(page) {
    return pickFields(page, ['id', 'offer_id', 'funnel_id', 'name', 'slug', 'type', 'status', 'sort_order']);
}

function summarizeSection(section) {
    return pickFields(section, ['id', 'page_id', 'offer_id', 'type', 'sort_order']);
}

function summarizeBlock(block) {
    return pickFields(block, ['id', 'section_id', 'page_id', 'offer_id', 'type', 'sort_order']);
}

function createExecutor(options) {
    var service = (options && options.service) || funnelEngine;
    var boundOfferId = options && options.boundOfferId;

    async function guard(input) {
        var offerId = context.requireNonEmptyString(input.offer_id, 'offer_id');
        var bound = boundOfferId || context.readBoundOfferId();

        if (!bound) {
            throw errors.ToolError(
                'Contexto de oferta não autorizado.',
                errors.ERROR_CODES.UNAUTHORIZED
            );
        }

        context.assertInputOfferId(offerId, bound);
        return offerId;
    }

    async function handlers() {
        return {
            get_funnel: async function (input) {
                var offerId = await guard(input);
                var funnel = await service.getFunnel(offerId, context.requireUuidLike(input.funnel_id, 'funnel_id'));
                return errors.toToolSuccess({ funnel: summarizeFunnel(funnel) });
            },
            list_funnels: async function (input) {
                var offerId = await guard(input);
                var funnels = await service.listFunnels(offerId);
                return errors.toToolSuccess({
                    funnels: funnels.map(summarizeFunnel),
                });
            },
            create_funnel: async function (input) {
                var offerId = await guard(input);
                var funnel = await service.createFunnel(offerId, {
                    name: input.name,
                    slug: input.slug,
                    type: input.type,
                    status: input.status,
                    description: input.description,
                    settings: input.settings,
                });
                return errors.toToolSuccess({
                    funnel_id: funnel.id,
                    offer_id: funnel.offer_id,
                    slug: funnel.slug,
                    status: funnel.status,
                    funnel: summarizeFunnel(funnel),
                });
            },
            update_funnel: async function (input) {
                var offerId = await guard(input);
                var funnelId = context.requireUuidLike(input.funnel_id, 'funnel_id');
                var funnel = await service.updateFunnel(offerId, funnelId, {
                    name: input.name,
                    slug: input.slug,
                    type: input.type,
                    status: input.status,
                    description: input.description,
                    settings: input.settings,
                });
                return errors.toToolSuccess({ funnel: summarizeFunnel(funnel) });
            },
            get_page: async function (input) {
                var offerId = await guard(input);
                var page = await service.getPage(offerId, context.requireUuidLike(input.page_id, 'page_id'));
                return errors.toToolSuccess({ page: summarizePage(page) });
            },
            list_pages: async function (input) {
                var offerId = await guard(input);
                var pages = await service.listPages(offerId, context.requireUuidLike(input.funnel_id, 'funnel_id'));
                return errors.toToolSuccess({
                    pages: pages.map(summarizePage),
                });
            },
            create_page: async function (input) {
                var offerId = await guard(input);
                var page = await service.createPage(offerId, context.requireUuidLike(input.funnel_id, 'funnel_id'), {
                    name: input.name,
                    slug: input.slug,
                    type: input.type || 'sales',
                    status: input.status || 'draft',
                    sort_order: input.sort_order,
                    settings: input.settings,
                    seo: input.seo,
                });
                return errors.toToolSuccess({
                    page_id: page.id,
                    offer_id: page.offer_id,
                    funnel_id: page.funnel_id,
                    slug: page.slug,
                    status: page.status,
                    page: summarizePage(page),
                });
            },
            update_page: async function (input) {
                var offerId = await guard(input);
                var pageId = context.requireUuidLike(input.page_id, 'page_id');
                var page = await service.updatePage(offerId, pageId, {
                    name: input.name,
                    slug: input.slug,
                    type: input.type,
                    status: input.status,
                    sort_order: input.sort_order,
                    settings: input.settings,
                    seo: input.seo,
                });
                return errors.toToolSuccess({ page: summarizePage(page) });
            },
            duplicate_page: async function (input) {
                var offerId = await guard(input);
                var page = await service.duplicatePage(offerId, context.requireUuidLike(input.page_id, 'page_id'), {
                    name: input.name,
                    slug: input.slug,
                });
                return errors.toToolSuccess({
                    page_id: page.id,
                    offer_id: page.offer_id,
                    funnel_id: page.funnel_id,
                    slug: page.slug,
                    status: page.status,
                    page: summarizePage(page),
                });
            },
            list_sections: async function (input) {
                var offerId = await guard(input);
                var sections = await service.listSections(offerId, context.requireUuidLike(input.page_id, 'page_id'));
                return errors.toToolSuccess({
                    sections: sections.map(summarizeSection),
                });
            },
            create_section: async function (input) {
                var offerId = await guard(input);
                var section = await service.createSection(offerId, context.requireUuidLike(input.page_id, 'page_id'), {
                    type: input.type,
                    sort_order: input.sort_order,
                    settings: input.settings,
                    styles: input.styles,
                    visibility: input.visibility,
                });
                return errors.toToolSuccess({
                    section_id: section.id,
                    page_id: section.page_id,
                    type: section.type,
                    sort_order: section.sort_order,
                    section: summarizeSection(section),
                });
            },
            update_section: async function (input) {
                var offerId = await guard(input);
                var section = await service.updateSection(offerId, context.requireUuidLike(input.section_id, 'section_id'), {
                    type: input.type,
                    sort_order: input.sort_order,
                    settings: input.settings,
                    styles: input.styles,
                    visibility: input.visibility,
                });
                return errors.toToolSuccess({ section: summarizeSection(section) });
            },
            delete_section: async function (input) {
                var offerId = await guard(input);
                var result = await service.deleteSection(offerId, context.requireUuidLike(input.section_id, 'section_id'));
                return errors.toToolSuccess(result);
            },
            reorder_sections: async function (input) {
                var offerId = await guard(input);
                var sections = await service.reorderSections(
                    offerId,
                    context.requireUuidLike(input.page_id, 'page_id'),
                    input.items
                );
                return errors.toToolSuccess({
                    sections: sections.map(summarizeSection),
                });
            },
            list_blocks: async function (input) {
                var offerId = await guard(input);
                var blocks = await service.listBlocks(offerId, context.requireUuidLike(input.section_id, 'section_id'));
                return errors.toToolSuccess({
                    blocks: blocks.map(summarizeBlock),
                });
            },
            create_block: async function (input) {
                var offerId = await guard(input);
                var block = await service.createBlock(offerId, context.requireUuidLike(input.section_id, 'section_id'), {
                    type: input.type,
                    sort_order: input.sort_order,
                    content: input.content,
                    settings: input.settings,
                    styles: input.styles,
                    visibility: input.visibility,
                });
                return errors.toToolSuccess({
                    block_id: block.id,
                    section_id: block.section_id,
                    type: block.type,
                    sort_order: block.sort_order,
                    block: summarizeBlock(block),
                });
            },
            update_block: async function (input) {
                var offerId = await guard(input);
                var block = await service.updateBlock(offerId, context.requireUuidLike(input.block_id, 'block_id'), {
                    type: input.type,
                    sort_order: input.sort_order,
                    content: input.content,
                    settings: input.settings,
                    styles: input.styles,
                    visibility: input.visibility,
                });
                return errors.toToolSuccess({ block: summarizeBlock(block) });
            },
            delete_block: async function (input) {
                var offerId = await guard(input);
                var result = await service.deleteBlock(offerId, context.requireUuidLike(input.block_id, 'block_id'));
                return errors.toToolSuccess(result);
            },
            reorder_blocks: async function (input) {
                var offerId = await guard(input);
                var blocks = await service.reorderBlocks(
                    offerId,
                    context.requireUuidLike(input.section_id, 'section_id'),
                    input.items
                );
                return errors.toToolSuccess({
                    blocks: blocks.map(summarizeBlock),
                });
            },
            get_page_tree: async function (input) {
                var offerId = await guard(input);
                var tree = await service.getPageTree(offerId, context.requireUuidLike(input.page_id, 'page_id'));
                return errors.toToolSuccess({
                    funnel: summarizeFunnel(tree.funnel),
                    page: summarizePage(tree.page),
                    sections: (tree.sections || []).map(function (section) {
                        return Object.assign({}, summarizeSection(section), {
                            blocks: (section.blocks || []).map(function (block) {
                                return Object.assign({}, summarizeBlock(block), {
                                    content: block.content || {},
                                    settings: block.settings || {},
                                });
                            }),
                        });
                    }),
                });
            },
            get_offer_launch_status: async function (input) {
                var offerId = await guard(input);
                var offerRecord = await offers.listOffers().then(function (list) {
                    return list.find(function (row) {
                        return row.id === offerId;
                    }) || null;
                });

                if (!offerRecord) {
                    throw errors.ToolError('Oferta não encontrada.', errors.ERROR_CODES.NOT_FOUND);
                }

                var report = await launchReadiness.evaluateLaunchReadiness(offerRecord.slug, {
                    refresh: true,
                });

                return errors.toToolSuccess({ launch: report });
            },
        };
    }

    var handlerCache = null;

    async function executeTool(toolName, input, meta) {
        if (!registry.isAllowedTool(toolName)) {
            throw errors.ToolError(
                'Tool não autorizada: ' + toolName,
                errors.ERROR_CODES.UNKNOWN_TOOL
            );
        }

        if (!handlerCache) {
            handlerCache = await handlers();
        }

        var handler = handlerCache[toolName];

        if (!handler) {
            throw errors.ToolError(
                'Tool não implementada: ' + toolName,
                errors.ERROR_CODES.UNKNOWN_TOOL
            );
        }

        var started = Date.now();
        var offerId = boundOfferId || context.readBoundOfferId() || (input && input.offer_id);

        try {
            var result = await handler(input || {});
            await logger.logToolCall({
                ai_task_id: (meta && meta.ai_task_id) || context.readBoundTaskId(),
                offer_id: offerId,
                tool_name: toolName,
                success: true,
                input: input,
                result: result,
            });
            result.duration_ms = Date.now() - started;
            return result;
        } catch (error) {
            var mapped = errors.mapDomainError(error);
            await logger.logToolCall({
                ai_task_id: (meta && meta.ai_task_id) || context.readBoundTaskId(),
                offer_id: offerId,
                tool_name: toolName,
                success: false,
                error_code: mapped.code,
                input: input,
                result: null,
            });
            throw mapped;
        }
    }

    return {
        executeTool: executeTool,
    };
}

async function executeTool(toolName, input, options) {
    var executor = createExecutor(options || {});
    return executor.executeTool(toolName, input, options && options.meta);
}

module.exports = {
    createExecutor: createExecutor,
    executeTool: executeTool,
};
