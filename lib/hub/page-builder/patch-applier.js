'use strict';

var funnelEngine = require('../funnel-engine');

async function applyOperations(offerId, pageId, operations) {
    var applied = [];
    var sectionOrder = null;

    for (var i = 0; i < operations.length; i += 1) {
        var op = operations[i] || {};
        var name = String(op.operation || '').toUpperCase();

        if (name === 'CREATE_BLOCK') {
            var sortOrder = op.sort_order;

            if (sortOrder == null) {
                var existing = await funnelEngine.listSections(offerId, pageId);
                var maxOrder = 0;
                existing.forEach(function (row) {
                    maxOrder = Math.max(maxOrder, Number(row.sort_order) || 0);
                });
                sortOrder = maxOrder + 100;
            }

            var section = await funnelEngine.createSection(offerId, pageId, {
                type: op.type || op.block_type || 'custom',
                sort_order: sortOrder,
                settings: op.settings || {},
                styles: op.styles || {},
                visibility: op.visibility,
            });

            var nested = Array.isArray(op.blocks) ? op.blocks : [];
            var createdBlocks = [];

            for (var b = 0; b < nested.length; b += 1) {
                var block = await funnelEngine.createBlock(offerId, section.id, nested[b]);
                createdBlocks.push(block.id);
            }

            applied.push({ operation: name, section_id: section.id, block_ids: createdBlocks });
            continue;
        }

        if (name === 'UPDATE_BLOCK' || name === 'UPDATE_TEXT' || name === 'UPDATE_STYLE' || name === 'UPDATE_ASSET' || name === 'UPDATE_HTML') {
            if ((name === 'UPDATE_TEXT' || name === 'UPDATE_HTML' || name === 'UPDATE_STYLE') &&
                op.section_id && !op.block_id) {
                var sections = await funnelEngine.listSections(offerId, pageId);
                var targetSection = sections.find(function (row) { return row.id === op.section_id; });

                if (targetSection) {
                    var blocks = await funnelEngine.listBlocks(offerId, targetSection.id);
                    var primary = blocks.sort(function (a, b) {
                        return (a.sort_order || 0) - (b.sort_order || 0);
                    })[0];

                    if (primary) {
                        op.block_id = primary.id;
                    }
                }
            }

            if (name === 'UPDATE_HTML' && op.block_id) {
                await funnelEngine.updateBlock(offerId, op.block_id, {
                    type: 'html',
                    content: { html: String(op.html || (op.content && op.content.html) || '') },
                    styles: op.styles,
                    settings: op.settings,
                });
                applied.push({ operation: name, block_id: op.block_id });
                continue;
            }

            if (name === 'UPDATE_ASSET' && op.asset && op.section_id && !op.block_id) {
                var secBlocks = await funnelEngine.listBlocks(offerId, op.section_id);
                var pb = secBlocks.sort(function (a, b) {
                    return (a.sort_order || 0) - (b.sort_order || 0);
                })[0];

                if (pb) {
                    await funnelEngine.updateBlock(offerId, pb.id, {
                        type: 'html',
                        content: {
                            html: '<img src="' + String(op.asset).replace(/"/g, '&quot;') +
                                '" alt="" style="max-width:100%;height:auto;display:block;margin:0 auto;">',
                        },
                    });
                    applied.push({ operation: name, block_id: pb.id });
                    continue;
                }
            }

            if (op.block_id) {
                var patch = {};

                if (op.content) {
                    patch.content = op.content;
                }

                if (name === 'UPDATE_TEXT' && op.value != null) {
                    var field = op.field || 'text';
                    patch.content = field === 'headline' || field === 'heading'
                        ? { text: op.value }
                        : { text: op.value };
                    patch.type = field === 'headline' || field === 'heading' ? 'heading' : 'text';
                }

                if (op.styles) {
                    patch.styles = op.styles;
                }

                if (op.settings) {
                    patch.settings = op.settings;
                }

                if (op.type) {
                    patch.type = op.type;
                }

                if (op.block_type) {
                    patch.type = op.block_type;
                }

                await funnelEngine.updateBlock(offerId, op.block_id, patch);
                applied.push({ operation: name, block_id: op.block_id });
            } else if (op.section_id) {
                await funnelEngine.updateSection(offerId, op.section_id, {
                    settings: op.settings,
                    styles: op.styles,
                    type: op.type,
                });
                applied.push({ operation: name, section_id: op.section_id });
            }

            continue;
        }

        if (name === 'DELETE_BLOCK' && op.section_id) {
            await funnelEngine.deleteSection(offerId, op.section_id);
            applied.push({ operation: name, section_id: op.section_id });
            continue;
        }

        if (name === 'REORDER_BLOCKS' || name === 'MOVE_BLOCK') {
            var reorderItems = op.reorder_items || op.items;

            if (reorderItems) {
                await funnelEngine.reorderSections(offerId, pageId, reorderItems);
                applied.push({ operation: name, count: reorderItems.length });
            } else if (op.section_id && (op.before_section_id || op.after_section_id)) {
                var allSections = await funnelEngine.listSections(offerId, pageId);
                var ids = allSections.slice().sort(function (a, b) {
                    return (a.sort_order || 0) - (b.sort_order || 0);
                }).map(function (row) { return row.id; });
                var fromIdx = ids.indexOf(op.section_id);

                if (fromIdx >= 0) {
                    ids.splice(fromIdx, 1);

                    if (op.before_section_id) {
                        var beforeIdx = ids.indexOf(op.before_section_id);
                        ids.splice(beforeIdx >= 0 ? beforeIdx : 0, 0, op.section_id);
                    } else if (op.after_section_id) {
                        var afterIdx = ids.indexOf(op.after_section_id);
                        ids.splice(afterIdx >= 0 ? afterIdx + 1 : ids.length, 0, op.section_id);
                    }

                    sectionOrder = ids;
                }
            }

            continue;
        }

        if (name === 'DUPLICATE_BLOCK' && op.section_id) {
            var sourceTree = await funnelEngine.getPageTree(offerId, pageId);
            var source = (sourceTree.sections || []).find(function (row) {
                return row.id === op.section_id;
            });

            if (source) {
                var copyBlocks = (source.blocks || []).map(function (block) {
                    return {
                        type: block.type,
                        sort_order: block.sort_order,
                        content: block.content,
                        settings: block.settings,
                        styles: block.styles,
                        visibility: block.visibility,
                    };
                });
                var max = 0;
                (sourceTree.sections || []).forEach(function (row) {
                    max = Math.max(max, Number(row.sort_order) || 0);
                });
                var copied = await funnelEngine.createSection(offerId, pageId, {
                    type: source.type,
                    sort_order: max + 100,
                    settings: Object.assign({}, source.settings || {}),
                    styles: Object.assign({}, source.styles || {}),
                    visibility: source.visibility,
                });

                for (var c = 0; c < copyBlocks.length; c += 1) {
                    await funnelEngine.createBlock(offerId, copied.id, copyBlocks[c]);
                }

                applied.push({ operation: name, section_id: op.section_id, new_section_id: copied.id });
            }

            continue;
        }
    }

    if (sectionOrder) {
        await funnelEngine.reorderSections(offerId, pageId, sectionOrder.map(function (id, index) {
            return { id: id, sort_order: (index + 1) * 100 };
        }));
        applied.push({ operation: 'REORDER_BLOCKS', count: sectionOrder.length });
    }

    return {
        applied: applied,
        count: applied.length,
    };
}

module.exports = {
    applyOperations: applyOperations,
};
