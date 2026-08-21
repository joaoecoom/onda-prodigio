(function () {
    'use strict';

    function readDragPayload(event) {
        try {
            return JSON.parse(event.dataTransfer.getData('application/x-peb-drag') || '{}');
        } catch (error) {
            return {};
        }
    }

    function writeDragPayload(event, payload) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-peb-drag', JSON.stringify(payload));
    }

    function clearDropTargets(root) {
        root.querySelectorAll('.is-drop-target').forEach(function (node) {
            node.classList.remove('is-drop-target');
        });
    }

    function bindTreeDragDrop(root, api) {
        if (!root) {
            return;
        }

        root.querySelectorAll('[data-draggable="true"]').forEach(function (item) {
            item.addEventListener('dragstart', function (event) {
                writeDragPayload(event, {
                    kind: item.getAttribute('data-drag-kind'),
                    id: item.getAttribute('data-drag-id'),
                    sectionId: item.getAttribute('data-drag-section-id') || null,
                });
                item.classList.add('is-dragging');
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('is-dragging');
                clearDropTargets(root);
            });
        });

        root.querySelectorAll('[data-drop-target="true"]').forEach(function (target) {
            target.addEventListener('dragover', function (event) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                clearDropTargets(root);
                target.classList.add('is-drop-target');
            });

            target.addEventListener('dragleave', function () {
                target.classList.remove('is-drop-target');
            });

            target.addEventListener('drop', function (event) {
                event.preventDefault();
                clearDropTargets(root);

                var payload = readDragPayload(event);
                var dropKind = target.getAttribute('data-drop-kind');
                var dropId = target.getAttribute('data-drop-id');
                var dropSectionId = target.getAttribute('data-drop-section-id') || null;

                if (payload.kind === 'component' && dropKind === 'section') {
                    api.onDropComponent(payload.type, dropId);
                    return;
                }

                if (payload.kind === 'section' && dropKind === 'section' && payload.id !== dropId) {
                    api.onReorderSection(payload.id, dropId);
                    return;
                }

                if (payload.kind === 'block' && dropKind === 'block' && payload.id !== dropId) {
                    api.onReorderBlock(payload.id, dropSectionId, dropId);
                    return;
                }

                if (payload.kind === 'block' && dropKind === 'section') {
                    api.onMoveBlockToSection(payload.id, dropId, null);
                }
            });
        });
    }

    function bindComponentDragDrop(root, api) {
        if (!root) {
            return;
        }

        root.querySelectorAll('[data-component-type]').forEach(function (item) {
            item.setAttribute('draggable', 'true');
            item.setAttribute('data-draggable', 'true');
            item.setAttribute('data-drag-kind', 'component');

            item.addEventListener('dragstart', function (event) {
                writeDragPayload(event, {
                    kind: 'component',
                    type: item.getAttribute('data-component-type'),
                });
                item.classList.add('is-dragging');
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('is-dragging');
            });

            item.addEventListener('click', function (event) {
                if (event.defaultPrevented) {
                    return;
                }
            });
        });
    }

    window.PebDnD = {
        bindTree: bindTreeDragDrop,
        bindComponents: bindComponentDragDrop,
    };
})();
