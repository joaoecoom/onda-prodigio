function startOfDay(date) {
    var copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function addDays(date, days) {
    var copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

function formatUnlockLabel(date) {
    try {
        return new Intl.DateTimeFormat('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(date);
    } catch (error) {
        return '';
    }
}

var contentReadiness = require('./content-readiness');

function getUnlockInfo(grantedAt, unlockAfterDays, isAdmin) {
    if (isAdmin || !unlockAfterDays) {
        return {
            is_locked: false,
            unlock_at: null,
            unlock_label: '',
        };
    }

    if (!grantedAt) {
        return {
            is_locked: true,
            unlock_at: null,
            unlock_label: '',
        };
    }

    var unlockDate = startOfDay(addDays(startOfDay(new Date(grantedAt)), unlockAfterDays));
    var isLocked = startOfDay(new Date()) < unlockDate;

    return {
        is_locked: isLocked,
        unlock_at: unlockDate.toISOString(),
        unlock_label: isLocked ? ('Estreia ' + formatUnlockLabel(unlockDate)) : '',
    };
}

function applyUnlockToModule(moduleItem, grantedAt, isAdmin) {
    var unlock = getUnlockInfo(grantedAt, moduleItem.unlock_after_days || 0, isAdmin);
    var next = Object.assign({}, moduleItem, unlock);

    if (!isAdmin) {
        var contentLock = contentReadiness.getContentLockState(moduleItem, unlock);

        if (contentLock.force_locked) {
            next.is_locked = true;
            next.unlock_label = contentLock.unlock_label || next.unlock_label;
        }
    }

    next.has_content = contentReadiness.hasDeliverableContent(moduleItem);

    if (moduleItem.aulas && moduleItem.aulas.length) {
        next.aulas = moduleItem.aulas.map(function (aulaItem) {
            return applyUnlockToModule(aulaItem, grantedAt, isAdmin);
        });
    }

    return next;
}

function applyUnlockToModules(modules, grantedAt, isAdmin) {
    return (modules || []).map(function (moduleItem) {
        return applyUnlockToModule(moduleItem, grantedAt, isAdmin);
    });
}

module.exports = {
    getUnlockInfo: getUnlockInfo,
    applyUnlockToModules: applyUnlockToModules,
};
