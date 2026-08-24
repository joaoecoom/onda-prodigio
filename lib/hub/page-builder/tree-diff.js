'use strict';

var editorState = require('./editor-state');

function sectionPayload(section) {
    return {
        type: section.type,
        sort_order: section.sort_order,
        settings: section.settings || {},
        styles: section.styles || {},
        visibility: section.visibility || {},
    };
}

function blockPayload(block) {
    return {
        type: block.type,
        sort_order: block.sort_order,
        content: block.content || {},
        settings: block.settings || {},
        styles: block.styles || {},
        visibility: block.visibility || {},
    };
}

function jsonEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function buildMutations(baseline, working) {
    var mutations = [];
    var baselineSections = baseline.sections || [];
    var workingSections = working.sections || [];
    var baselineSectionMap = {};
    var workingSectionMap = {};

    baselineSections.forEach(function (section) {
        baselineSectionMap[section.id] = section;
    });

    workingSections.forEach(function (section) {
        workingSectionMap[section.id] = section;
    });

    workingSections.forEach(function (section) {
        if (editorState.isTempId(section.id) || !baselineSectionMap[section.id]) {
            mutations.push({
                op: 'create_section',
                client_id: section.id,
                data: sectionPayload(section),
                blocks: (section.blocks || []).map(function (block) {
                    return {
                        client_id: block.id,
                        data: blockPayload(block),
                    };
                }),
            });
        }
    });

    baselineSections.forEach(function (section) {
        if (!workingSectionMap[section.id]) {
            mutations.push({
                op: 'delete_section',
                section_id: section.id,
            });
        }
    });

    workingSections.forEach(function (section) {
        if (editorState.isTempId(section.id) || !baselineSectionMap[section.id]) {
            return;
        }

        var base = baselineSectionMap[section.id];

        if (!jsonEqual(sectionPayload(section), sectionPayload(base))) {
            mutations.push({
                op: 'update_section',
                section_id: section.id,
                data: sectionPayload(section),
            });
        }

        var baseBlocks = base.blocks || [];
        var workBlocks = section.blocks || [];
        var baseBlockMap = {};
        var workBlockMap = {};

        baseBlocks.forEach(function (block) {
            baseBlockMap[block.id] = block;
        });

        workBlocks.forEach(function (block) {
            workBlockMap[block.id] = block;
        });

        workBlocks.forEach(function (block) {
            if (editorState.isTempId(block.id) || !baseBlockMap[block.id]) {
                mutations.push({
                    op: 'create_block',
                    client_id: block.id,
                    section_id: section.id,
                    data: blockPayload(block),
                });
            }
        });

        baseBlocks.forEach(function (block) {
            if (!workBlockMap[block.id]) {
                mutations.push({
                    op: 'delete_block',
                    block_id: block.id,
                });
            }
        });

        workBlocks.forEach(function (block) {
            if (editorState.isTempId(block.id) || !baseBlockMap[block.id]) {
                return;
            }

            if (!jsonEqual(blockPayload(block), blockPayload(baseBlockMap[block.id]))) {
                mutations.push({
                    op: 'update_block',
                    block_id: block.id,
                    data: blockPayload(block),
                });
            }
        });
    });

    var baselineOrder = baselineSections.map(function (row) { return row.id; }).join(',');
    var workingOrder = workingSections
        .filter(function (row) { return !editorState.isTempId(row.id); })
        .slice()
        .sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        })
        .map(function (row) { return row.id; })
        .join(',');

    if (workingOrder && baselineOrder !== workingOrder) {
        var orderedWorking = workingSections
            .filter(function (row) { return !editorState.isTempId(row.id) && baselineSectionMap[row.id]; })
            .slice()
            .sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
            });

        mutations.push({
            op: 'reorder_sections',
            items: orderedWorking.map(function (row, index) {
                return { id: row.id, sort_order: (index + 1) * 100 };
            }),
        });
    }

    return mutations;
}

module.exports = {
    buildMutations: buildMutations,
    sectionPayload: sectionPayload,
    blockPayload: blockPayload,
};
