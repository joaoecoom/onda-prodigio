function hasMediaContent(moduleItem) {
    if (!moduleItem) {
        return false;
    }

    return Boolean(
        moduleItem.youtube_id ||
        moduleItem.video_path ||
        moduleItem.pdf_path ||
        moduleItem.audio_path
    );
}

function isInteractiveLesson(moduleItem) {
    var title = String(moduleItem && moduleItem.title || '');

    return title.indexOf('Questionário Inicial') !== -1 ||
        title.indexOf('Teste para Descobrir o Génio') !== -1;
}

function hasDeliverableContent(moduleItem) {
    return hasMediaContent(moduleItem) || isInteractiveLesson(moduleItem);
}

function getContentLockState(moduleItem, dripUnlock) {
    dripUnlock = dripUnlock || {};

    if (hasDeliverableContent(moduleItem)) {
        return {
            force_locked: false,
            unlock_label: dripUnlock.unlock_label || '',
        };
    }

    var unlockLabel = 'Disponível em breve';

    if (dripUnlock.is_locked && dripUnlock.unlock_label) {
        unlockLabel = dripUnlock.unlock_label;
    }

    return {
        force_locked: true,
        unlock_label: unlockLabel,
    };
}

module.exports = {
    hasMediaContent: hasMediaContent,
    isInteractiveLesson: isInteractiveLesson,
    hasDeliverableContent: hasDeliverableContent,
    getContentLockState: getContentLockState,
};
