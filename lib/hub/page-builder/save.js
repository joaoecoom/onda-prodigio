'use strict';

var funnelEngine = require('../funnel-engine');
var treeDiff = require('./tree-diff');
var editorState = require('./editor-state');

function resolveId(id, idMap) {
    if (editorState.isTempId(id)) {
        return idMap[id] || id;
    }

    return id;
}

async function applyMutations(offerId, pageId, mutations, service) {
    var engine = service || funnelEngine;
    var idMap = {};

    for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        var op = mutation.op;

        if (op === 'create_section') {
            var section = await engine.createSection(offerId, pageId, mutation.data);

            if (mutation.client_id) {
                idMap[mutation.client_id] = section.id;
            }

            var nestedBlocks = mutation.blocks || [];

            for (var b = 0; b < nestedBlocks.length; b += 1) {
                var nested = nestedBlocks[b];
                var createdBlock = await engine.createBlock(offerId, section.id, nested.data);

                if (nested.client_id) {
                    idMap[nested.client_id] = createdBlock.id;
                }
            }

            continue;
        }

        if (op === 'update_section') {
            await engine.updateSection(offerId, mutation.section_id, mutation.data);
            continue;
        }

        if (op === 'delete_section') {
            try {
                await engine.deleteSection(offerId, mutation.section_id);
            } catch (error) {
                if (error.code !== 'NOT_FOUND') {
                    throw error;
                }
            }
            continue;
        }

        if (op === 'create_block') {
            var sectionId = resolveId(mutation.section_id, idMap);
            var block = await engine.createBlock(offerId, sectionId, mutation.data);

            if (mutation.client_id) {
                idMap[mutation.client_id] = block.id;
            }

            continue;
        }

        if (op === 'update_block') {
            await engine.updateBlock(offerId, mutation.block_id, mutation.data);
            continue;
        }

        if (op === 'delete_block') {
            try {
                await engine.deleteBlock(offerId, mutation.block_id);
            } catch (error) {
                if (error.code !== 'NOT_FOUND') {
                    throw error;
                }
            }
            continue;
        }

        if (op === 'reorder_sections') {
            await engine.reorderSections(offerId, pageId, mutation.items);
            continue;
        }

        if (op === 'reorder_blocks') {
            var reorderSectionId = resolveId(mutation.section_id, idMap);
            await engine.reorderBlocks(offerId, reorderSectionId, mutation.items);
            continue;
        }

        throw Object.assign(new Error('Operação desconhecida: ' + op), { code: 'VALIDATION_ERROR' });
    }

    return idMap;
}

async function saveTree(offerId, pageId, baseline, working, service) {
    var engine = service || funnelEngine;
    var mutations = treeDiff.buildMutations(baseline, working);

    if (!mutations.length) {
        return engine.getPageTree(offerId, pageId);
    }

    await applyMutations(offerId, pageId, mutations, engine);
    return engine.getPageTree(offerId, pageId);
}

module.exports = {
    applyMutations: applyMutations,
    saveTree: saveTree,
    buildMutations: treeDiff.buildMutations,
};
