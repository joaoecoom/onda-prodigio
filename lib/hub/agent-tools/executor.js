'use strict';

var funnelEngine = require('../funnel-engine');
var offers = require('../offers');
var launchReadiness = require('../launch-readiness');
var offerProvisioning = require('../offer-provisioning');
var offerSetupWizard = require('../offer-setup-wizard');
var integrationsStore = require('../integrations-store');
var seedTemplate = require('../page-builder/seed-template');
var quizEngine = require('../quiz-engine');
var contentAdmin = require('../../comunidade/content-admin');
var productsService = require('../../comunidade/products-service');
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

    async function resolveOfferRecord(offerId) {
        var normalized = await guard({ offer_id: offerId });
        var offerRecord = await offers.listOffers().then(function (list) {
            return list.find(function (row) {
                return row.id === normalized;
            }) || null;
        });

        if (!offerRecord) {
            throw errors.ToolError('Oferta não encontrada.', errors.ERROR_CODES.NOT_FOUND);
        }

        return offerRecord;
    }

    async function resolveOfferProductId(offerId) {
        var offerRecord = await resolveOfferRecord(offerId);
        var productId = String(offerRecord.primary_product_id || offerRecord.slug || '').trim();

        if (!productId) {
            throw errors.ToolError('Produto principal em falta.', errors.ERROR_CODES.VALIDATION_ERROR);
        }

        await productsService.assertProductBelongsToOffer(productId, offerRecord.id);

        return productId;
    }

    async function assertContentItemForOffer(offerId, itemId, expectModule) {
        var productId = await resolveOfferProductId(offerId);
        var item = await contentAdmin.getContentItem(itemId);

        if (item.product_id !== productId) {
            throw errors.ToolError('Conteúdo não pertence à oferta.', errors.ERROR_CODES.CROSS_OFFER_ACCESS);
        }

        var isModule = !item.parent_id;

        if (expectModule === true && !isModule) {
            throw errors.ToolError('ID não corresponde a um módulo.', errors.ERROR_CODES.VALIDATION_ERROR);
        }

        if (expectModule === false && isModule) {
            throw errors.ToolError('ID não corresponde a uma aula.', errors.ERROR_CODES.VALIDATION_ERROR);
        }

        return item;
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
            provision_offer: async function (input) {
                var offerId = await guard(input);
                var offerRecord = await offers.listOffers().then(function (list) {
                    return list.find(function (row) {
                        return row.id === offerId;
                    }) || null;
                });

                if (!offerRecord) {
                    throw errors.ToolError('Oferta não encontrada.', errors.ERROR_CODES.NOT_FOUND);
                }

                var result = await offerProvisioning.provisionOffer(offerRecord.slug);

                if (input.amount_cents != null || input.currency != null) {
                    result.checkout = await offerProvisioning.updateMainCheckout(offerId, {
                        amount_cents: input.amount_cents,
                        currency: input.currency,
                    });
                }

                return errors.toToolSuccess({ provision: result });
            },
            validate_offer: async function (input) {
                var offerId = await guard(input);
                var offerRecord = await offers.listOffers().then(function (list) {
                    return list.find(function (row) {
                        return row.id === offerId;
                    }) || null;
                });

                if (!offerRecord) {
                    throw errors.ToolError('Oferta não encontrada.', errors.ERROR_CODES.NOT_FOUND);
                }

                var validation = await offerSetupWizard.validateOffer(offerRecord.slug, { refresh: true });

                return errors.toToolSuccess({
                    ok: validation.ok,
                    ready: validation.ready,
                    readiness: validation.readiness,
                    failures: validation.failures,
                    wizard: validation.wizard,
                });
            },
            launch_offer: async function (input) {
                var offerId = await guard(input);
                var offerRecord = await offers.listOffers().then(function (list) {
                    return list.find(function (row) {
                        return row.id === offerId;
                    }) || null;
                });

                if (!offerRecord) {
                    throw errors.ToolError('Oferta não encontrada.', errors.ERROR_CODES.NOT_FOUND);
                }

                try {
                    var launched = await offerSetupWizard.launchOffer(offerRecord.slug, { refresh: true });
                    return errors.toToolSuccess({
                        ok: true,
                        offer_id: offerId,
                        launch: launched.launch,
                    });
                } catch (error) {
                    if (error.code === 'NOT_READY' || error.code === 'ALMOST_READY') {
                        throw errors.ToolError(error.message, errors.ERROR_CODES.VALIDATION_ERROR, {
                            validation: error.validation,
                        });
                    }

                    throw error;
                }
            },
            create_offer: async function (input) {
                var name = context.requireNonEmptyString(input.name, 'name');
                var result = await offers.findOrCreateOffer({
                    name: name,
                    slug: input.slug,
                    funnel_domain: input.funnel_domain,
                });
                var offer = result.offer;

                if (input.amount_cents != null || input.currency != null) {
                    await offerProvisioning.provisionOffer(offer.slug);
                    await offerProvisioning.updateMainCheckout(offer.id, {
                        amount_cents: input.amount_cents,
                        currency: input.currency,
                    });
                }

                var status = await integrationsStore.getIntegrationStatusSummary(offer.id);

                return errors.toToolSuccess({
                    offer_id: offer.id,
                    slug: offer.slug,
                    name: offer.name,
                    created: result.created,
                    existing: result.existing,
                    integrations: status,
                    next_steps: status.stripe.configured
                        ? []
                        : ['STRIPE NOT CONFIGURED — configure via HUB Integrações ou save_offer_integrations'],
                });
            },
            save_offer_integrations: async function (input) {
                var offerId = await guard(input);
                var patches = input.integrations || {};

                if (!patches || typeof patches !== 'object' || !Object.keys(patches).length) {
                    throw errors.ToolError('Integrações em falta.', errors.ERROR_CODES.VALIDATION_ERROR);
                }

                await integrationsStore.saveOfferIntegrations(offerId, patches);
                var status = await integrationsStore.getIntegrationStatusSummary(offerId);

                return errors.toToolSuccess({
                    ok: true,
                    integrations: status,
                    message: status.stripe.configured ? 'Stripe configured' : 'STRIPE NOT CONFIGURED',
                });
            },
            get_offer_integrations_status: async function (input) {
                var offerId = await guard(input);
                var status = await integrationsStore.getIntegrationStatusSummary(offerId);

                return errors.toToolSuccess({
                    integrations: status,
                    stripe_configured: status.stripe.configured,
                    meta_configured: status.meta.configured,
                    ga4_configured: status.ga4.configured,
                });
            },
            apply_template: async function (input) {
                var offerId = await guard(input);
                var pageId = context.requireUuidLike(input.page_id, 'page_id');
                var templateId = context.requireNonEmptyString(input.template_id, 'template_id');
                var sectionsCreated = await seedTemplate.seedPageFromTemplate(offerId, pageId, templateId, service);

                return errors.toToolSuccess({
                    page_id: pageId,
                    template_id: templateId,
                    sections_created: sectionsCreated,
                });
            },
            publish_page: async function (input) {
                var offerId = await guard(input);
                var pageId = context.requireUuidLike(input.page_id, 'page_id');
                var page = await service.updatePage(offerId, pageId, {
                    status: 'published',
                });

                return errors.toToolSuccess({ page: summarizePage(page) });
            },
            get_content_tree: async function (input) {
                var offerId = await guard(input);
                var offerRecord = await resolveOfferRecord(offerId);
                var tree = await contentAdmin.getContentTree({
                    offerSlug: offerRecord.slug,
                    productId: offerRecord.primary_product_id,
                });

                return errors.toToolSuccess({ content: tree });
            },
            create_content_module: async function (input) {
                var offerId = await guard(input);
                var productId = await resolveOfferProductId(offerId);
                var moduleItem = await contentAdmin.createContentModule(productId, {
                    title: input.title,
                    description: input.description,
                    unlock_after_days: input.unlock_after_days,
                });

                return errors.toToolSuccess({ module: moduleItem });
            },
            create_content_lesson: async function (input) {
                var offerId = await guard(input);
                var moduleId = context.requireUuidLike(input.module_id, 'module_id');
                await assertContentItemForOffer(offerId, moduleId, true);
                var productId = await resolveOfferProductId(offerId);
                var lesson = await contentAdmin.createContentLesson(productId, moduleId, input);

                return errors.toToolSuccess({ lesson: lesson });
            },
            update_content_module: async function (input) {
                var offerId = await guard(input);
                var moduleId = context.requireUuidLike(input.module_id, 'module_id');
                await assertContentItemForOffer(offerId, moduleId, true);
                var patch = Object.assign({}, input);
                delete patch.offer_id;
                delete patch.module_id;
                var updated = await contentAdmin.updateContentItem(moduleId, patch);

                return errors.toToolSuccess({ module: updated });
            },
            update_content_lesson: async function (input) {
                var offerId = await guard(input);
                var lessonId = context.requireUuidLike(input.lesson_id, 'lesson_id');
                await assertContentItemForOffer(offerId, lessonId, false);
                var patch = Object.assign({}, input);
                delete patch.offer_id;
                delete patch.lesson_id;
                var updated = await contentAdmin.updateContentItem(lessonId, patch);

                return errors.toToolSuccess({ lesson: updated });
            },
            create_quiz: async function (input) {
                var offerId = await guard(input);
                var funnelId = context.requireUuidLike(input.funnel_id, 'funnel_id');
                var saved = await quizEngine.saveQuizDefinition(offerId, funnelId, {
                    questions: input.questions || [],
                    results: input.results || [],
                });

                if (input.settings) {
                    await funnelEngine.updateFunnel(offerId, funnelId, { settings: input.settings });
                }

                return errors.toToolSuccess({ quiz: saved });
            },
            get_quiz: async function (input) {
                var offerId = await guard(input);
                var funnelId = context.requireUuidLike(input.funnel_id, 'funnel_id');
                var quiz = await quizEngine.loadQuizBundle(funnelId, offerId);
                return errors.toToolSuccess({ quiz: quiz });
            },
            create_quiz_question: async function (input) {
                var offerId = await guard(input);
                var funnelId = context.requireUuidLike(input.funnel_id, 'funnel_id');
                var question = await quizEngine.createQuestion(offerId, funnelId, input);
                return errors.toToolSuccess({ question: question });
            },
            update_quiz_question: async function (input) {
                var offerId = await guard(input);
                var questionId = context.requireUuidLike(input.question_id, 'question_id');
                var question = await quizEngine.updateQuestion(offerId, questionId, input);
                return errors.toToolSuccess({ question: question });
            },
            create_quiz_answer: async function (input) {
                var offerId = await guard(input);
                var questionId = context.requireUuidLike(input.question_id, 'question_id');
                var answer = await quizEngine.createAnswer(offerId, questionId, input);
                return errors.toToolSuccess({ answer: answer });
            },
            update_quiz_answer: async function (input) {
                var offerId = await guard(input);
                var answerId = context.requireUuidLike(input.answer_id, 'answer_id');
                var answer = await quizEngine.updateAnswer(offerId, answerId, input);
                return errors.toToolSuccess({ answer: answer });
            },
            publish_quiz: async function (input) {
                var offerId = await guard(input);
                var funnelId = context.requireUuidLike(input.funnel_id, 'funnel_id');
                var pageSlug = String(input.page_slug || 'quiz').trim();
                var pages = await funnelEngine.listPages(offerId, funnelId);
                var page = pages.find(function (row) { return row.slug === pageSlug; });

                if (!page) {
                    page = await funnelEngine.createPage(offerId, funnelId, {
                        name: 'Quiz',
                        slug: pageSlug,
                        type: 'custom',
                        status: 'published',
                    });
                } else if (page.status !== 'published') {
                    page = await funnelEngine.updatePage(offerId, page.id, { status: 'published' });
                }

                await funnelEngine.updateFunnel(offerId, funnelId, { status: 'active' });

                return errors.toToolSuccess({
                    page_id: page.id,
                    slug: page.slug,
                    status: page.status,
                });
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
