'use strict';

var crypto = require('crypto');
var defaults = require('./defaults');
var reorderUtil = require('./reorder');

var MAX_HISTORY = 50;

function cloneTree(tree) {
    return JSON.parse(JSON.stringify(tree));
}

function isTempId(id) {
    return String(id || '').indexOf('tmp-') === 0;
}

function tempId() {
    return 'tmp-' + crypto.randomUUID();
}

function createEditorState(tree) {
    return {
        tree: cloneTree(tree),
        baseline: cloneTree(tree),
        selected: { type: null, id: null },
        saveStatus: 'saved',
        device: 'desktop',
        undoStack: [],
        redoStack: [],
    };
}

function pushHistory(state) {
    state.undoStack.push(cloneTree(state.tree));
    state.redoStack = [];

    if (state.undoStack.length > MAX_HISTORY) {
        state.undoStack.shift();
    }

    state.saveStatus = 'unsaved';
}

function undo(state) {
    if (!state.undoStack.length) {
        return false;
    }

    state.redoStack.push(cloneTree(state.tree));
    state.tree = state.undoStack.pop();
    state.saveStatus = 'unsaved';
    return true;
}

function redo(state) {
    if (!state.redoStack.length) {
        return false;
    }

    state.undoStack.push(cloneTree(state.tree));
    state.tree = state.redoStack.pop();
    state.saveStatus = 'unsaved';
    return true;
}

function findSection(state, sectionId) {
    return (state.tree.sections || []).find(function (section) {
        return section.id === sectionId;
    }) || null;
}

function findBlock(state, blockId) {
    var sections = state.tree.sections || [];

    for (var i = 0; i < sections.length; i += 1) {
        var blocks = sections[i].blocks || [];

        for (var j = 0; j < blocks.length; j += 1) {
            if (blocks[j].id === blockId) {
                return { section: sections[i], block: blocks[j] };
            }
        }
    }

    return null;
}

function select(state, type, id) {
    state.selected = { type: type || null, id: id || null };
}

function addSection(state, type) {
    pushHistory(state);
    var section = defaults.defaultSection(type);
    section.id = tempId();
    section.sort_order = defaults.nextSortOrder(state.tree.sections);
    section.blocks = [];
    state.tree.sections = state.tree.sections || [];
    state.tree.sections.push(section);
    select(state, 'section', section.id);
    return section;
}

function addBlock(state, sectionId, type) {
    var section = findSection(state, sectionId);

    if (!section) {
        throw new Error('Section não encontrada.');
    }

    pushHistory(state);
    var block = defaults.defaultBlock(type);
    block.id = tempId();
    block.sort_order = defaults.nextSortOrder(section.blocks);
    section.blocks = section.blocks || [];
    section.blocks.push(block);
    select(state, 'block', block.id);
    return block;
}

function updateSection(state, sectionId, patch) {
    var section = findSection(state, sectionId);

    if (!section) {
        throw new Error('Section não encontrada.');
    }

    pushHistory(state);

    if (patch.settings) {
        section.settings = Object.assign({}, section.settings || {}, patch.settings);
    }

    if (patch.styles) {
        section.styles = Object.assign({}, section.styles || {}, patch.styles);
    }

    if (patch.visibility) {
        section.visibility = Object.assign({}, section.visibility || {}, patch.visibility);
    }

    if (patch.type != null) {
        section.type = patch.type;
    }

    if (patch.sort_order != null) {
        section.sort_order = patch.sort_order;
    }

    return section;
}

function updateBlock(state, blockId, patch) {
    var found = findBlock(state, blockId);

    if (!found) {
        throw new Error('Block não encontrado.');
    }

    pushHistory(state);
    var block = found.block;

    if (patch.content) {
        block.content = Object.assign({}, block.content || {}, patch.content);
    }

    if (patch.settings) {
        block.settings = Object.assign({}, block.settings || {}, patch.settings);
    }

    if (patch.styles) {
        block.styles = Object.assign({}, block.styles || {}, patch.styles);
    }

    if (patch.visibility) {
        block.visibility = Object.assign({}, block.visibility || {}, patch.visibility);
    }

    if (patch.type != null) {
        block.type = patch.type;
    }

    if (patch.sort_order != null) {
        block.sort_order = patch.sort_order;
    }

    return block;
}

function deleteSection(state, sectionId, options) {
    var section = findSection(state, sectionId);
    var opts = options || {};

    if (!section) {
        throw new Error('Section não encontrada.');
    }

    if ((section.blocks || []).length > 0 && !opts.force) {
        throw new Error('Section contém blocks.');
    }

    pushHistory(state);
    state.tree.sections = state.tree.sections.filter(function (row) {
        return row.id !== sectionId;
    });

    if (state.selected.id === sectionId) {
        select(state, null, null);
    }
}

function deleteBlock(state, blockId) {
    var found = findBlock(state, blockId);

    if (!found) {
        throw new Error('Block não encontrado.');
    }

    pushHistory(state);
    found.section.blocks = found.section.blocks.filter(function (row) {
        return row.id !== blockId;
    });

    if (state.selected.id === blockId) {
        select(state, null, null);
    }
}

function duplicateBlock(state, blockId) {
    var found = findBlock(state, blockId);

    if (!found) {
        throw new Error('Block não encontrado.');
    }

    pushHistory(state);
    var copy = cloneTree(found.block);
    copy.id = tempId();
    copy.sort_order = defaults.nextSortOrder(found.section.blocks);
    found.section.blocks.push(copy);
    select(state, 'block', copy.id);
    return copy;
}

function duplicateSection(state, sectionId) {
    var section = findSection(state, sectionId);

    if (!section) {
        throw new Error('Section não encontrada.');
    }

    pushHistory(state);
    var copy = cloneTree(section);
    copy.id = tempId();
    copy.sort_order = defaults.nextSortOrder(state.tree.sections);
    copy.blocks = (section.blocks || []).map(function (block) {
        var blockCopy = cloneTree(block);
        blockCopy.id = tempId();
        return blockCopy;
    });
    state.tree.sections.push(copy);
    select(state, 'section', copy.id);
    return copy;
}

function moveSection(state, sectionId, direction) {
    var sections = (state.tree.sections || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
    var index = sections.findIndex(function (row) { return row.id === sectionId; });

    if (index === -1) {
        throw new Error('Section não encontrada.');
    }

    var target = direction === 'up' ? index - 1 : index + 1;

    if (target < 0 || target >= sections.length) {
        return false;
    }

    pushHistory(state);
    var current = sections[index];
    var swap = sections[target];
    var tmp = current.sort_order;
    current.sort_order = swap.sort_order;
    swap.sort_order = tmp;
    return true;
}

function moveBlock(state, blockId, direction) {
    var found = findBlock(state, blockId);

    if (!found) {
        throw new Error('Block não encontrado.');
    }

    var blocks = found.section.blocks.slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
    var index = blocks.findIndex(function (row) { return row.id === blockId; });
    var target = direction === 'up' ? index - 1 : index + 1;

    if (target < 0 || target >= blocks.length) {
        return false;
    }

    pushHistory(state);
    var current = blocks[index];
    var swap = blocks[target];
    var tmp = current.sort_order;
    current.sort_order = swap.sort_order;
    swap.sort_order = tmp;
    return true;
}

function reorderSectionsByIds(state, orderedIds) {
    if (!orderedIds || !orderedIds.length) {
        return false;
    }

    pushHistory(state);
    var map = {};
    (state.tree.sections || []).forEach(function (section) {
        map[section.id] = section;
    });

    state.tree.sections = orderedIds.map(function (id, index) {
        var section = map[id];

        if (!section) {
            throw new Error('Section não encontrada: ' + id);
        }

        section.sort_order = (index + 1) * reorderUtil.SORT_GAP;
        return section;
    });

    return true;
}

function reorderBlocksByIds(state, sectionId, orderedIds) {
    var section = findSection(state, sectionId);

    if (!section) {
        throw new Error('Section não encontrada.');
    }

    if (!orderedIds || !orderedIds.length) {
        return false;
    }

    pushHistory(state);
    var map = {};
    (section.blocks || []).forEach(function (block) {
        map[block.id] = block;
    });

    section.blocks = orderedIds.map(function (id, index) {
        var block = map[id];

        if (!block) {
            throw new Error('Block não encontrado: ' + id);
        }

        block.sort_order = (index + 1) * reorderUtil.SORT_GAP;
        return block;
    });

    return true;
}

function moveBlockToSection(state, blockId, targetSectionId, beforeBlockId) {
    var found = findBlock(state, blockId);
    var targetSection = findSection(state, targetSectionId);

    if (!found || !targetSection) {
        throw new Error('Block ou section não encontrados.');
    }

    pushHistory(state);
    var block = found.block;

    found.section.blocks = found.section.blocks.filter(function (row) {
        return row.id !== blockId;
    });

    var remaining = (targetSection.blocks || []).filter(function (row) {
        return row.id !== blockId;
    }).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    var orderedIds = remaining.map(function (row) { return row.id; });

    if (beforeBlockId && orderedIds.indexOf(beforeBlockId) !== -1) {
        orderedIds.splice(orderedIds.indexOf(beforeBlockId), 0, blockId);
    } else {
        orderedIds.push(blockId);
    }

    var map = {};
    remaining.forEach(function (row) { map[row.id] = row; });
    map[blockId] = block;

    targetSection.blocks = orderedIds.map(function (id, index) {
        map[id].sort_order = (index + 1) * reorderUtil.SORT_GAP;
        return map[id];
    });

    return true;
}

function markSaved(state, tree) {
    state.tree = cloneTree(tree);
    state.baseline = cloneTree(tree);
    state.saveStatus = 'saved';
    state.undoStack = [];
    state.redoStack = [];
}

module.exports = {
    cloneTree: cloneTree,
    isTempId: isTempId,
    tempId: tempId,
    createEditorState: createEditorState,
    pushHistory: pushHistory,
    undo: undo,
    redo: redo,
    select: select,
    findSection: findSection,
    findBlock: findBlock,
    addSection: addSection,
    addBlock: addBlock,
    updateSection: updateSection,
    updateBlock: updateBlock,
    deleteSection: deleteSection,
    deleteBlock: deleteBlock,
    duplicateBlock: duplicateBlock,
    duplicateSection: duplicateSection,
    moveSection: moveSection,
    moveBlock: moveBlock,
    reorderSectionsByIds: reorderSectionsByIds,
    reorderBlocksByIds: reorderBlocksByIds,
    moveBlockToSection: moveBlockToSection,
    markSaved: markSaved,
};
