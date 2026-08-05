var authHelpers = require('../auth-helpers');

function normalizeProgress(value) {
    var parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round(parsed)));
}

module.exports = {
    normalizeProgress: normalizeProgress,
    buildProgressMap: buildProgressMap,
    getModuleProgressPercent: getModuleProgressPercent,
};

function buildProgressMap(rows) {
    var map = {};

    (rows || []).forEach(function (row) {
        map[row.module_id] = normalizeProgress(row.progress_percent);
    });

    return map;
}

function getModuleProgressPercent(moduleItem, progressMap) {
    if (!moduleItem) {
        return 0;
    }

    if (moduleItem.aulas && moduleItem.aulas.length) {
        var total = 0;

        moduleItem.aulas.forEach(function (aulaItem) {
            total += progressMap[aulaItem.id] || 0;
        });

        return Math.round(total / moduleItem.aulas.length);
    }

    return progressMap[moduleItem.id] || 0;
}
