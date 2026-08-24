'use strict';

var editorState = require('./editor-state');
var aiContext = require('./ai-context');

var COMPLEX_PATTERNS = [
    /(?:cria|constr[oó]i|gera|faz)\s+(?:uma?\s+)?(?:sales\s*page|p[aá]gina\s+(?:completa|de\s+vendas|vsl))/i,
    /(?:vsl|sales\s*page|landing\s*page)\s+completa/i,
    /(?:hero|problem|benef[ií]t|faq|cta).+(?:hero|problem|benef[ií]t|faq|cta)/i,
    /(?:9|oito|sete|6|seis)\s+blocos/i,
];

function buildBlockIndex(tree) {
    var sections = (tree && tree.sections || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    return sections.map(function (section, index) {
        var alias = 'block_' + String(index + 1).padStart(2, '0');
        var blocks = (section.blocks || []).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });
        var primary = blocks[0] || null;
        var preview = '';

        if (primary) {
            if (primary.type === 'html') {
                preview = String((primary.content && primary.content.html) || '').replace(/<[^>]+>/g, ' ').slice(0, 120);
            } else if (primary.type === 'heading' || primary.type === 'text') {
                preview = String((primary.content && primary.content.text) || '').slice(0, 120);
            } else if (primary.type === 'image') {
                preview = String((primary.content && primary.content.src) || '').slice(0, 120);
            }
        }

        return {
            alias: alias,
            index: index + 1,
            section_id: section.id,
            label: (section.settings && section.settings.label) || alias,
            type: section.type,
            block_count: blocks.length,
            primary_block_id: primary && primary.id,
            primary_block_type: primary && primary.type,
            preview: preview.trim(),
            blocks: blocks.map(function (block) {
                return {
                    block_id: block.id,
                    type: block.type,
                    sort_order: block.sort_order,
                };
            }),
        };
    });
}

function resolveSectionByRef(ref, tree, selection) {
    var text = String(ref || '').trim().toLowerCase();
    var index = buildBlockIndex(tree);

    if (selection && selection.type === 'section' && selection.id) {
        var selected = index.find(function (row) {
            return row.section_id === selection.id;
        });

        if (selected) {
            return selected;
        }
    }

    var aliasMatch = text.match(/block[_\-\s]?(\d+)/i);

    if (aliasMatch) {
        var n = parseInt(aliasMatch[1], 10);
        return index[n - 1] || null;
    }

    if (/primeiro/i.test(text)) {
        return index[0] || null;
    }

    if (/segundo/i.test(text)) {
        return index[1] || null;
    }

    if (/terceiro/i.test(text)) {
        return index[2] || null;
    }

    if (/quarto/i.test(text)) {
        return index[3] || null;
    }

    if (/quinto/i.test(text)) {
        return index[4] || null;
    }

    var ordinalMatch = text.match(/(\d+)[ºª]?\s*bloco|bloco\s*(\d+)/i);

    if (ordinalMatch) {
        var num = parseInt(ordinalMatch[1] || ordinalMatch[2], 10);

        if (num) {
            return index[num - 1] || null;
        }
    }

    return index[index.length - 1] || null;
}

function isComplexRequest(message, references) {
    var text = String(message || '').trim();
    var refs = references || [];
    var hasImages = refs.some(function (row) {
        return row && (row.type === 'image' || row.type === 'video');
    });

    for (var i = 0; i < COMPLEX_PATTERNS.length; i += 1) {
        if (COMPLEX_PATTERNS[i].test(text)) {
            return true;
        }
    }

    if (hasImages && /(?:cria|constr[oó]i|gera|faz|replica|copia|igual|modela|novo\s+bloco|bloco\s+novo|coment[aá]rios|facebook|refer[eê]ncia)/i.test(text)) {
        return true;
    }

    if (/^(muda|altera|troca|update|change|apaga|remove|duplica|move|coloca|usa)\s/i.test(text)) {
        return false;
    }

    return hasImages && refs.length > 0 && !text;
}

function classifyIntent(message, selection, references) {
    if (isComplexRequest(message, references)) {
        return { tier: 'gemini', intent: 'build_or_multimodal' };
    }

    var text = String(message || '').trim().toLowerCase();

    if (/^(muda|altera|troca|update|change)\s/.test(text)) {
        return { tier: 'fast', intent: 'update' };
    }

    if (/^(apaga|remove|elimina|delete)\s/.test(text)) {
        return { tier: 'fast', intent: 'delete' };
    }

    if (/^(duplica|copia|duplicate)\s/.test(text)) {
        return { tier: 'fast', intent: 'duplicate' };
    }

    if (/^(move|coloca|ponha|p[oõ]e)\s/.test(text)) {
        return { tier: 'fast', intent: 'move' };
    }

    return { tier: 'gemini', intent: 'general' };
}

function updatePrimaryBlockContent(state, sectionId, patch) {
    var section = editorState.findSection(state, sectionId);

    if (!section) {
        return false;
    }

    var blocks = (section.blocks || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
    var block = blocks[0];

    if (!block) {
        block = editorState.addBlock(state, sectionId, patch.type || 'html');
    } else {
        editorState.updateBlock(state, block.id, {
            content: Object.assign({}, block.content || {}, patch.content || {}),
            styles: Object.assign({}, block.styles || {}, patch.styles || {}),
            settings: Object.assign({}, block.settings || {}, patch.settings || {}),
            type: patch.type || block.type,
        });
    }

    return true;
}

function reorderSectionBefore(state, sectionId, beforeSectionId) {
    var sections = (state.tree.sections || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
    var ids = sections.map(function (row) { return row.id; });
    var fromIndex = ids.indexOf(sectionId);
    var beforeIndex = ids.indexOf(beforeSectionId);

    if (fromIndex < 0 || beforeIndex < 0 || fromIndex === beforeIndex) {
        return false;
    }

    ids.splice(fromIndex, 1);
    var insertAt = ids.indexOf(beforeSectionId);

    if (insertAt < 0) {
        return false;
    }

    ids.splice(insertAt, 0, sectionId);
    return editorState.reorderSectionsByIds(state, ids);
}

function reorderSectionAfter(state, sectionId, afterSectionId) {
    var sections = (state.tree.sections || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
    var ids = sections.map(function (row) { return row.id; });
    var fromIndex = ids.indexOf(sectionId);
    var afterIndex = ids.indexOf(afterSectionId);

    if (fromIndex < 0 || afterIndex < 0) {
        return false;
    }

    ids.splice(fromIndex, 1);
    afterIndex = ids.indexOf(afterSectionId);
    ids.splice(afterIndex + 1, 0, sectionId);
    return editorState.reorderSectionsByIds(state, ids);
}

function tryFastPath(message, tree, selection, selectedSection) {
    var state = editorState.createEditorState(tree);
    state.selected = {
        type: selection && selection.type || null,
        id: selection && selection.id || null,
    };

    if (selectedSection && selectedSection.id) {
        state.selected = { type: 'section', id: selectedSection.id };
    }

    var text = String(message || '').trim();
    var patches = [];

    var duplicateMatch = text.match(/(?:duplica|copia|duplicate)\s+(?:o\s+)?(?:bloco|sec[cç][aã]o|section)?\s*(?:actual|seleccionad[oa]|selected|(\d+)|block[_\-\s]?(\d+))?/i);

    if (duplicateMatch) {
        var dupRef = resolveSectionByRef(
            duplicateMatch[1] || duplicateMatch[2] || 'seleccionado',
            tree,
            state.selected
        );

        if (dupRef) {
            var dup = editorState.duplicateSection(state, dupRef.section_id);
            patches.push({ operation: 'DUPLICATE_BLOCK', section_id: dupRef.section_id, new_section_id: dup.id });
            return finishFast(state, patches, 'Bloco duplicado.');
        }
    }

    var moveMatch = text.match(/(?:move|coloca|p[oõ]e)\s+(?:o\s+)?(?:bloco|sec[cç][aã]o)?\s*(?:actual|seleccionad[oa]|(\d+)|block[_\-\s]?(\d+))?\s*(antes|before|depois|after)\s+(?:do\s+)?(?:bloco\s*)?(\d+|block[_\-\s]?\d+|primeiro|segundo|terceiro|quarto|quinto)/i);

    if (moveMatch) {
        var moveFrom = resolveSectionByRef(moveMatch[1] || moveMatch[2] || 'seleccionado', tree, state.selected);
        var moveTo = resolveSectionByRef(moveMatch[4], tree, state.selected);

        if (moveFrom && moveTo && moveFrom.section_id !== moveTo.section_id) {
            var moved = /depois|after/i.test(moveMatch[3])
                ? reorderSectionAfter(state, moveFrom.section_id, moveTo.section_id)
                : reorderSectionBefore(state, moveFrom.section_id, moveTo.section_id);

            if (moved) {
                patches.push({ operation: 'MOVE_BLOCK', section_id: moveFrom.section_id, relative_to: moveTo.section_id });
                return finishFast(state, patches, 'Bloco movido.');
            }
        }
    }

    var urlInText = extractUrl(text);
    var imageMatch = text.match(/(?:usa|coloca|troca|muda)\s+(?:esta\s+)?(?:imagem|image|foto)(?:\s+(?:para|por|com))?\s*(.+)$/i);

    if (imageMatch || (/imagem|foto|image/i.test(text) && urlInText)) {
        var imgTarget = resolveSectionByRef(text, tree, state.selected);
        var src = urlInText || extractUrl(imageMatch && imageMatch[1] || '');

        if (imgTarget && src) {
            updatePrimaryBlockContent(state, imgTarget.section_id, {
                type: 'html',
                content: {
                    html: '<img src="' + escapeAttr(src) + '" alt="" style="max-width:100%;height:auto;display:block;margin:0 auto;">',
                },
            });
            patches.push({ operation: 'UPDATE_ASSET', section_id: imgTarget.section_id, asset: src });
            return finishFast(state, patches, 'Imagem actualizada.');
        }
    }

    var videoMatch = text.match(/(?:coloca|usa|adiciona)\s+(?:este\s+)?(?:v[ií]deo|video)(?:\s+(?:para|em|no))?\s*(.+)$/i);

    if (videoMatch || (/v[ií]deo|video/i.test(text) && urlInText)) {
        var vidTarget = resolveSectionByRef(text, tree, state.selected);
        var videoUrl = urlInText || extractUrl(videoMatch && videoMatch[1] || '');

        if (vidTarget && videoUrl && !isValidVideoUrl(videoUrl)) {
            return {
                applied: false,
                reason: 'invalid_video_url',
                message: 'URL de vídeo inválida. Usa YouTube, Vimeo ou URL directa .mp4.',
            };
        }

        if (vidTarget && videoUrl) {
            updatePrimaryBlockContent(state, vidTarget.section_id, {
                type: 'html',
                content: { html: buildVideoEmbed(videoUrl) },
            });
            patches.push({ operation: 'UPDATE_VIDEO', section_id: vidTarget.section_id, url: videoUrl });
            return finishFast(state, patches, 'Vídeo actualizado.');
        }
    }

    var headingMatch = text.match(/(?:muda|altera|troca|change|update)\s+(?:a\s+)?(?:headline|t[ií]tulo|heading)(?:\s+(?:para|to))?\s*[:"']?\s*(.+)$/i);

    if (headingMatch) {
        var hTarget = resolveSectionByRef(text, tree, state.selected);

        if (hTarget) {
            updatePrimaryBlockContent(state, hTarget.section_id, {
                type: 'heading',
                content: { text: headingMatch[1].trim() },
            });
            patches.push({ operation: 'UPDATE_TEXT', section_id: hTarget.section_id, field: 'headline', value: headingMatch[1].trim() });
            return finishFast(state, patches, 'Headline actualizada.');
        }
    }

    var textMatch = text.match(/(?:muda|altera|troca|change|update)\s+(?:o\s+)?(?:texto|par[aá]grafo|subheadline|subt[ií]tulo)(?:\s+(?:para|to))?\s*[:"']?\s*(.+)$/i);

    if (textMatch) {
        var tTarget = resolveSectionByRef(text, tree, state.selected);

        if (tTarget) {
            updatePrimaryBlockContent(state, tTarget.section_id, {
                type: 'text',
                content: { text: textMatch[1].trim() },
            });
            patches.push({ operation: 'UPDATE_TEXT', section_id: tTarget.section_id, field: 'text', value: textMatch[1].trim() });
            return finishFast(state, patches, 'Texto actualizado.');
        }
    }

    if (/(?:apaga|remove|elimina|delete)\s+(?:o\s+)?(?:bloco|sec[cç][aã]o|seleccionad[oa]|actual)/i.test(text)) {
        var dTarget = resolveSectionByRef('seleccionado', tree, state.selected);

        if (dTarget) {
            editorState.deleteSection(state, dTarget.section_id, { force: true });
            patches.push({ operation: 'DELETE_BLOCK', section_id: dTarget.section_id });
            return finishFast(state, patches, 'Bloco removido.');
        }
    }

    var aiAssistant = require('./ai-assistant');
    var legacy = aiAssistant.tryLocalAssistant(text, state.tree, state.selected);

    if (legacy.applied) {
        patches.push({ operation: 'LEGACY', action: legacy.action });
        return {
            applied: true,
            mode: 'fast',
            summary: legacy.summary,
            tree: legacy.tree,
            selected: legacy.selected,
            patches: patches,
            page_summary: legacy.page_summary,
        };
    }

    return {
        applied: false,
        mode: 'fast',
        tree: tree,
        selected: selection || { type: null, id: null },
    };
}

function finishFast(state, patches, summary) {
    return {
        applied: true,
        mode: 'fast',
        summary: summary,
        tree: state.tree,
        selected: state.selected,
        patches: patches,
        page_summary: aiContext.buildPageSummary(state.tree),
    };
}

function extractUrl(text) {
    var found = String(text || '').match(/https?:\/\/[^\s<>"')\]]+/i);
    return found ? found[0].replace(/[.,;:!?)]+$/, '') : '';
}

function escapeAttr(value) {
    return String(value || '').replace(/"/g, '&quot;');
}

function isValidVideoUrl(url) {
    return /^(https?:\/\/)(www\.)?(youtube\.com|youtu\.be|vimeo\.com|.*\.(mp4|webm|mov)(\?|$))/i.test(url);
}

function buildVideoEmbed(url) {
    var yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);

    if (yt) {
        return '<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;">' +
            '<iframe src="https://www.youtube.com/embed/' + yt[1] + '" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div>';
    }

    var vimeo = url.match(/vimeo\.com\/(\d+)/i);

    if (vimeo) {
        return '<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;">' +
            '<iframe src="https://player.vimeo.com/video/' + vimeo[1] + '" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div>';
    }

    return '<video controls style="width:100%;max-width:100%;" src="' + escapeAttr(url) + '"></video>';
}

function summarizePatches(patches) {
    if (!patches || !patches.length) {
        return '';
    }

    if (patches.length === 1) {
        var op = patches[0].operation;

        if (op === 'UPDATE_TEXT') {
            return patches[0].field === 'headline' ? 'Headline actualizada' : 'Texto actualizado';
        }

        if (op === 'UPDATE_ASSET') {
            return 'Imagem actualizada';
        }

        if (op === 'UPDATE_VIDEO') {
            return 'Vídeo actualizado';
        }

        if (op === 'DUPLICATE_BLOCK') {
            return 'Bloco duplicado';
        }

        if (op === 'MOVE_BLOCK') {
            return 'Bloco movido';
        }

        if (op === 'DELETE_BLOCK') {
            return 'Bloco removido';
        }
    }

    return patches.length + ' alterações aplicadas';
}

module.exports = {
    buildBlockIndex: buildBlockIndex,
    resolveSectionByRef: resolveSectionByRef,
    classifyIntent: classifyIntent,
    isComplexRequest: isComplexRequest,
    tryFastPath: tryFastPath,
    summarizePatches: summarizePatches,
};
