var crypto = require('crypto');
var offerContext = require('../offer-context');
var validation = require('./validation');
var constants = require('./constants');

function createMemoryStore() {
    var state = {
        funnels: [],
        pages: [],
        page_sections: [],
        page_blocks: [],
    };

    function uuid() {
        return crypto.randomUUID();
    }

    function find(table, id) {
        return state[table].find(function (row) { return row.id === id; }) || null;
    }

    return {
        state: state,
        async insertRow(table, row) {
            var record = Object.assign({}, row, {
                id: row.id || uuid(),
                created_at: row.created_at || new Date().toISOString(),
                updated_at: row.updated_at || new Date().toISOString(),
            });
            state[table].push(record);
            return Object.assign({}, record);
        },
        async updateRow(table, id, patch) {
            var index = state[table].findIndex(function (row) { return row.id === id; });

            if (index === -1) {
                throw new Error('Registo não encontrado.');
            }

            state[table][index] = Object.assign({}, state[table][index], patch, {
                updated_at: new Date().toISOString(),
            });

            return Object.assign({}, state[table][index]);
        },
        async deleteRow(table, id) {
            if (table === 'funnels') {
                var pages = state.pages.filter(function (row) { return row.funnel_id === id; });
                for (var p = 0; p < pages.length; p += 1) {
                    await this.deleteRow('pages', pages[p].id);
                }
            }

            if (table === 'pages') {
                var sections = state.page_sections.filter(function (row) { return row.page_id === id; });
                for (var s = 0; s < sections.length; s += 1) {
                    await this.deleteRow('page_sections', sections[s].id);
                }
            }

            if (table === 'page_sections') {
                state.page_blocks = state.page_blocks.filter(function (row) {
                    return row.section_id !== id;
                });
            }

            state[table] = state[table].filter(function (row) { return row.id !== id; });
        },
        async getById(table, id) {
            var row = find(table, id);
            return row ? Object.assign({}, row) : null;
        },
        async getFunnelByOfferAndSlug(offerId, slug) {
            var row = state.funnels.find(function (item) {
                return item.offer_id === offerId && item.slug === slug;
            });
            return row ? Object.assign({}, row) : null;
        },
        async getPageByFunnelAndSlug(funnelId, slug) {
            var row = state.pages.find(function (item) {
                return item.funnel_id === funnelId && item.slug === slug;
            });
            return row ? Object.assign({}, row) : null;
        },
        async listFunnels(offerId) {
            return state.funnels.filter(function (row) { return row.offer_id === offerId; });
        },
        async listPages(funnelId) {
            return state.pages.filter(function (row) { return row.funnel_id === funnelId; });
        },
        async listSections(pageId) {
            return state.page_sections
                .filter(function (row) { return row.page_id === pageId; })
                .sort(function (a, b) {
                    return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
                });
        },
        async listBlocks(sectionId) {
            return state.page_blocks
                .filter(function (row) { return row.section_id === sectionId; })
                .sort(function (a, b) {
                    return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
                });
        },
        async listBlocksByPageId(pageId) {
            return state.page_blocks
                .filter(function (row) { return row.page_id === pageId; })
                .sort(function (a, b) {
                    return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
                });
        },
        async reorderRows(table, items) {
            items.forEach(function (item) {
                var index = state[table].findIndex(function (row) { return row.id === item.id; });

                if (index !== -1) {
                    state[table][index].sort_order = item.sort_order;
                    state[table][index].updated_at = new Date().toISOString();
                }
            });
        },
    };
}

function createService(options) {
    var repository = (options && options.repository) || require('./repository');
    var resolveOffer = (options && options.resolveOffer) || function (input) {
        if (typeof input === 'string') {
            return offerContext.resolveOfferContext({ offer_id: input });
        }

        return offerContext.resolveOfferContext(input || {});
    };

    async function ensureOffer(offerId) {
        var id = String(offerId || '').trim();

        if (!id) {
            throw new Error('Offer em falta.');
        }

        await resolveOffer(id);
        return id;
    }

    async function getFunnelForOffer(offerId, funnelId) {
        var funnel = await repository.getById('funnels', funnelId);
        validation.assertOfferOwnership(funnel, offerId, 'Funnel');
        return funnel;
    }

    async function getPageForOffer(offerId, pageId) {
        var page = await repository.getById('pages', pageId);
        validation.assertOfferOwnership(page, offerId, 'Page');
        return page;
    }

    async function getSectionForOffer(offerId, sectionId) {
        var section = await repository.getById('page_sections', sectionId);

        if (!section) {
            var err = new Error('Section não encontrada.');
            err.code = 'NOT_FOUND';
            throw err;
        }

        validation.assertOfferOwnership(section, offerId, 'Section');
        return section;
    }

    async function getBlockForOffer(offerId, blockId) {
        var block = await repository.getById('page_blocks', blockId);

        if (!block) {
            var err = new Error('Block não encontrado.');
            err.code = 'NOT_FOUND';
            throw err;
        }

        validation.assertOfferOwnership(block, offerId, 'Block');
        return block;
    }

    async function createFunnel(offerId, input) {
        var id = await ensureOffer(offerId);
        var payload = validation.validateFunnelPayload(input || {}, false);
        var existing = await repository.getFunnelByOfferAndSlug(id, payload.slug);

        if (existing) {
            var dup = new Error('Slug de funnel duplicado.');
            dup.code = 'DUPLICATE_SLUG';
            throw dup;
        }

        return repository.insertRow('funnels', Object.assign({}, payload, {
            offer_id: id,
            version: 1,
        }));
    }

    async function getFunnel(offerId, funnelId) {
        await ensureOffer(offerId);
        return getFunnelForOffer(offerId, funnelId);
    }

    async function listFunnels(offerId) {
        await ensureOffer(offerId);
        return repository.listFunnels(offerId);
    }

    async function updateFunnel(offerId, funnelId, input) {
        await getFunnelForOffer(offerId, funnelId);
        var payload = validation.validateFunnelPayload(input || {}, true);
        return repository.updateRow('funnels', funnelId, Object.assign({}, payload, {
            version: undefined,
        }));
    }

    async function deleteFunnel(offerId, funnelId) {
        await getFunnelForOffer(offerId, funnelId);
        await repository.deleteRow('funnels', funnelId);
        return { deleted: true, id: funnelId };
    }

    async function createPage(offerId, funnelId, input) {
        var id = await ensureOffer(offerId);
        var funnel = await getFunnelForOffer(id, funnelId);
        var payload = validation.validatePagePayload(input || {}, false);
        var existing = await repository.getPageByFunnelAndSlug(funnel.id, payload.slug);

        if (existing) {
            var dup = new Error('Slug de page duplicado.');
            dup.code = 'DUPLICATE_SLUG';
            throw dup;
        }

        return repository.insertRow('pages', Object.assign({}, payload, {
            funnel_id: funnel.id,
            offer_id: funnel.offer_id,
            version: 1,
            published_at: payload.status === 'published' ? new Date().toISOString() : null,
        }));
    }

    async function getPage(offerId, pageId) {
        await ensureOffer(offerId);
        return getPageForOffer(offerId, pageId);
    }

    async function listPages(offerId, funnelId) {
        await getFunnelForOffer(offerId, funnelId);
        return repository.listPages(funnelId);
    }

    async function listPagesByOffer(offerId) {
        await ensureOffer(offerId);
        return repository.listPagesByOffer(offerId);
    }

    async function uniqueFunnelSlug(offerId, baseSlug) {
        var slug = String(baseSlug || 'funil').trim().toLowerCase();
        var attempt = slug;
        var counter = 1;

        while (await repository.getFunnelByOfferAndSlug(offerId, attempt)) {
            attempt = slug + '-copia' + (counter > 1 ? '-' + counter : '');
            counter += 1;
        }

        return attempt;
    }

    async function uniquePageSlug(funnelId, baseSlug) {
        var slug = String(baseSlug || 'page').trim().toLowerCase();
        var attempt = slug;
        var counter = 1;

        while (await repository.getPageByFunnelAndSlug(funnelId, attempt)) {
            attempt = slug + '-copia' + (counter > 1 ? '-' + counter : '');
            counter += 1;
        }

        return attempt;
    }

    async function duplicateFunnel(offerId, funnelId, input) {
        var source = await getFunnelForOffer(offerId, funnelId);
        var slugBase = (input && input.slug) || source.slug + '-copia';
        var slug = await uniqueFunnelSlug(offerId, slugBase);
        var name = (input && input.name) || source.name + ' (cópia)';

        var newFunnel = await createFunnel(offerId, {
            name: name,
            slug: slug,
            type: source.type,
            status: 'draft',
            description: source.description,
            settings: source.settings || {},
            is_default: false,
        });

        var pages = await listPages(offerId, funnelId);
        var pageIdMap = {};

        for (var i = 0; i < pages.length; i += 1) {
            var page = pages[i];
            var dupSlug = await uniquePageSlug(newFunnel.id, page.slug + '-copia');
            var duplicate = await duplicatePage(offerId, page.id, {
                name: page.name + ' (cópia)',
                slug: dupSlug,
                funnel_id: newFunnel.id,
            });
            pageIdMap[page.id] = duplicate.id;
        }

        var settings = Object.assign({}, source.settings || {});
        var flow = settings.flow;

        if (Array.isArray(flow) && flow.length) {
            var idMap = {};

            settings.flow = flow.map(function (step) {
                var copy = Object.assign({}, step, {
                    id: 'step-' + Math.random().toString(36).slice(2, 10),
                });
                idMap[step.id] = copy.id;

                if (copy.active_page_id && pageIdMap[copy.active_page_id]) {
                    copy.active_page_id = pageIdMap[copy.active_page_id];
                }

                if (Array.isArray(copy.variant_page_ids)) {
                    copy.variant_page_ids = copy.variant_page_ids.map(function (pid) {
                        return pageIdMap[pid] || pid;
                    });
                }

                return copy;
            }).map(function (step) {
                if (step.parent_step_id && idMap[step.parent_step_id]) {
                    step.parent_step_id = idMap[step.parent_step_id];
                }

                if (step.reject_step_id && idMap[step.reject_step_id]) {
                    step.reject_step_id = idMap[step.reject_step_id];
                }

                return step;
            });
        }

        if (settings.flow || Object.keys(settings).length) {
            newFunnel = await updateFunnel(offerId, newFunnel.id, { settings: settings });
        }

        return newFunnel;
    }

    async function updatePage(offerId, pageId, input) {
        var page = await getPageForOffer(offerId, pageId);
        var payload = validation.validatePagePayload(input || {}, true);
        var patch = Object.assign({}, payload);

        if (payload.status === 'published' && page.status !== 'published') {
            patch.published_at = new Date().toISOString();
        }

        if (payload.status && payload.status !== 'published') {
            patch.published_at = null;
        }

        return repository.updateRow('pages', pageId, patch);
    }

    async function deletePage(offerId, pageId) {
        await getPageForOffer(offerId, pageId);
        await repository.deleteRow('pages', pageId);
        return { deleted: true, id: pageId };
    }

    async function createSection(offerId, pageId, input) {
        var id = await ensureOffer(offerId);
        var page = await getPageForOffer(id, pageId);
        var payload = validation.validateSectionPayload(input || {});

        return repository.insertRow('page_sections', Object.assign({}, payload, {
            page_id: page.id,
            offer_id: page.offer_id,
        }));
    }

    async function updateSection(offerId, sectionId, input) {
        await getSectionForOffer(offerId, sectionId);
        var payload = validation.validateSectionPayload(input || {});
        return repository.updateRow('page_sections', sectionId, payload);
    }

    async function deleteSection(offerId, sectionId) {
        await getSectionForOffer(offerId, sectionId);
        await repository.deleteRow('page_sections', sectionId);
        return { deleted: true, id: sectionId };
    }

    async function reorderSections(offerId, pageId, items) {
        await getPageForOffer(offerId, pageId);
        var normalized = validation.validateReorderItems(items);
        var sections = await repository.listSections(pageId);
        var allowed = {};

        sections.forEach(function (section) {
            allowed[section.id] = true;
        });

        normalized.forEach(function (item) {
            if (!allowed[item.id]) {
                throw new Error('Section não pertence à página.');
            }
        });

        await repository.reorderRows('page_sections', normalized);
        return repository.listSections(pageId);
    }

    async function createBlock(offerId, sectionId, input) {
        var id = await ensureOffer(offerId);
        var section = await getSectionForOffer(id, sectionId);
        var payload = validation.validateBlockPayload(input || {}, false);

        return repository.insertRow('page_blocks', Object.assign({}, payload, {
            section_id: section.id,
            page_id: section.page_id,
            offer_id: section.offer_id,
        }));
    }

    async function updateBlock(offerId, blockId, input) {
        await getBlockForOffer(offerId, blockId);
        var payload = validation.validateBlockPayload(input || {}, true);
        return repository.updateRow('page_blocks', blockId, payload);
    }

    async function deleteBlock(offerId, blockId) {
        await getBlockForOffer(offerId, blockId);
        await repository.deleteRow('page_blocks', blockId);
        return { deleted: true, id: blockId };
    }

    async function reorderBlocks(offerId, sectionId, items) {
        await getSectionForOffer(offerId, sectionId);
        var normalized = validation.validateReorderItems(items);
        var blocks = await repository.listBlocks(sectionId);
        var allowed = {};

        blocks.forEach(function (block) {
            allowed[block.id] = true;
        });

        normalized.forEach(function (item) {
            if (!allowed[item.id]) {
                throw new Error('Block não pertence à section.');
            }
        });

        await repository.reorderRows('page_blocks', normalized);
        return repository.listBlocks(sectionId);
    }

    async function listSections(offerId, pageId) {
        await getPageForOffer(offerId, pageId);
        return repository.listSections(pageId);
    }

    async function listBlocks(offerId, sectionId) {
        await getSectionForOffer(offerId, sectionId);
        return repository.listBlocks(sectionId);
    }

    async function duplicatePage(offerId, pageId, input) {
        var source = await getPageForOffer(offerId, pageId);
        var payload = validation.validatePagePayload({
            name: input && input.name,
            slug: input && input.slug,
            type: source.type,
            status: 'draft',
            sort_order: source.sort_order,
            settings: source.settings,
            seo: source.seo,
        }, false);

        var duplicate = await repository.insertRow('pages', Object.assign({}, payload, {
            funnel_id: (input && input.funnel_id) || source.funnel_id,
            offer_id: source.offer_id,
            version: 1,
            published_at: null,
        }));

        var sections = await repository.listSections(pageId);

        for (var i = 0; i < sections.length; i += 1) {
            var section = sections[i];
            var newSection = await repository.insertRow('page_sections', {
                page_id: duplicate.id,
                offer_id: duplicate.offer_id,
                type: section.type,
                sort_order: section.sort_order,
                settings: section.settings,
                styles: section.styles,
                visibility: section.visibility,
            });

            var blocks = await repository.listBlocks(section.id);

            for (var b = 0; b < blocks.length; b += 1) {
                var block = blocks[b];
                await repository.insertRow('page_blocks', {
                    section_id: newSection.id,
                    page_id: duplicate.id,
                    offer_id: duplicate.offer_id,
                    type: block.type,
                    sort_order: block.sort_order,
                    content: block.content,
                    settings: block.settings,
                    styles: block.styles,
                    visibility: block.visibility,
                });
            }
        }

        return duplicate;
    }

    async function getPageTree(offerId, pageId) {
        var page = await getPageForOffer(offerId, pageId);
        var funnelAndSections = await Promise.all([
            getFunnelForOffer(offerId, page.funnel_id),
            repository.listSections(pageId),
            typeof repository.listBlocksByPageId === 'function'
                ? repository.listBlocksByPageId(pageId)
                : Promise.resolve(null),
        ]);
        var funnel = funnelAndSections[0];
        var sections = funnelAndSections[1] || [];
        var allBlocks = funnelAndSections[2];

        if (!allBlocks) {
            allBlocks = [];
            var perSection = await Promise.all(sections.map(function (section) {
                return repository.listBlocks(section.id);
            }));
            perSection.forEach(function (blocks) {
                allBlocks = allBlocks.concat(blocks || []);
            });
        }

        var blocksBySection = {};
        allBlocks.forEach(function (block) {
            var key = block.section_id;
            if (!blocksBySection[key]) {
                blocksBySection[key] = [];
            }
            blocksBySection[key].push(block);
        });

        var treeSections = sections.map(function (section) {
            return Object.assign({}, section, {
                blocks: blocksBySection[section.id] || [],
            });
        });

        return {
            funnel: funnel,
            page: page,
            sections: treeSections,
        };
    }

    async function getPageTreeBySlugs(offerSlug, funnelSlug, pageSlug, options) {
        var context = options && options.offer
            ? options.offer
            : await resolveOffer({ slug: offerSlug });
        var offerId = context.id;
        var funnel = await repository.getFunnelByOfferAndSlug(offerId, funnelSlug);

        if (!funnel) {
            var err = new Error('Funnel não encontrado.');
            err.code = 'NOT_FOUND';
            throw err;
        }

        validation.assertOfferOwnership(funnel, offerId, 'Funnel');

        var page = await repository.getPageByFunnelAndSlug(funnel.id, pageSlug);

        if (!page) {
            var pageErr = new Error('Page não encontrada.');
            pageErr.code = 'NOT_FOUND';
            throw pageErr;
        }

        validation.assertOfferOwnership(page, offerId, 'Page');

        if (page.funnel_id !== funnel.id) {
            var mismatch = new Error('Page não pertence ao funnel indicado.');
            mismatch.code = 'OFFER_MISMATCH';
            throw mismatch;
        }

        var sectionsAndBlocks = await Promise.all([
            repository.listSections(page.id),
            typeof repository.listBlocksByPageId === 'function'
                ? repository.listBlocksByPageId(page.id)
                : Promise.resolve(null),
        ]);
        var sections = sectionsAndBlocks[0] || [];
        var allBlocks = sectionsAndBlocks[1];

        if (!allBlocks) {
            allBlocks = [];
            var perSection = await Promise.all(sections.map(function (section) {
                return repository.listBlocks(section.id);
            }));
            perSection.forEach(function (blocks) {
                allBlocks = allBlocks.concat(blocks || []);
            });
        }

        var blocksBySection = {};
        allBlocks.forEach(function (block) {
            var key = block.section_id;
            if (!blocksBySection[key]) {
                blocksBySection[key] = [];
            }
            blocksBySection[key].push(block);
        });

        return {
            funnel: funnel,
            page: page,
            sections: sections.map(function (section) {
                return Object.assign({}, section, {
                    blocks: blocksBySection[section.id] || [],
                });
            }),
        };
    }

    return {
        createFunnel: createFunnel,
        getFunnel: getFunnel,
        listFunnels: listFunnels,
        updateFunnel: updateFunnel,
        deleteFunnel: deleteFunnel,
        createPage: createPage,
        getPage: getPage,
        listPages: listPages,
        listPagesByOffer: listPagesByOffer,
        duplicateFunnel: duplicateFunnel,
        updatePage: updatePage,
        deletePage: deletePage,
        createSection: createSection,
        updateSection: updateSection,
        deleteSection: deleteSection,
        reorderSections: reorderSections,
        createBlock: createBlock,
        updateBlock: updateBlock,
        deleteBlock: deleteBlock,
        reorderBlocks: reorderBlocks,
        listSections: listSections,
        listBlocks: listBlocks,
        duplicatePage: duplicatePage,
        getPageTree: getPageTree,
        getPageTreeBySlugs: getPageTreeBySlugs,
    };
}

module.exports = {
    createService: createService,
    createMemoryStore: createMemoryStore,
};
