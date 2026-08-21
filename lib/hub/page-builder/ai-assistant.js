'use strict';

var editorState = require('./editor-state');
var templateApply = require('./templates/apply');
var aiContext = require('./ai-context');

var LOCAL_ACTIONS = [
    {
        name: 'update_heading',
        pattern: /(?:muda|altera|troca|change|update)\s+(?:a\s+)?(?:headline|t[ií]tulo|heading)(?:\s+(?:para|to))?\s*[:"']?\s*(.+)$/i,
        run: function (state, match, selection) {
            return updateBlockContent(state, selection, 'heading', { text: match[1].trim() });
        },
    },
    {
        name: 'update_text',
        pattern: /(?:muda|altera|troca|change|update)\s+(?:o\s+)?(?:texto|par[aá]grafo|paragraph|text)(?:\s+(?:para|to))?\s*[:"']?\s*(.+)$/i,
        run: function (state, match, selection) {
            return updateBlockContent(state, selection, 'text', { text: match[1].trim() });
        },
    },
    {
        name: 'update_button',
        pattern: /(?:muda|altera|troca|change|update)\s+(?:o\s+)?(?:bot[aã]o|button|cta)(?:\s+(?:para|to))?\s*[:"']?\s*(.+)$/i,
        run: function (state, match, selection) {
            return updateBlockContent(state, selection, 'button', { label: match[1].trim() });
        },
    },
    {
        name: 'add_section_type',
        pattern: /(?:adiciona|add|cria|create)\s+(?:uma?\s+)?(?:sec[cç][aã]o|section|se[cç][aã]o)\s+(hero|benefits|cta|social[- ]proof)/i,
        run: function (state, match) {
            var map = {
                hero: 'hero-standard',
                benefits: 'benefits-list',
                cta: 'cta-simple',
                'social-proof': 'social-proof',
                'social proof': 'social-proof',
            };
            var key = match[1].toLowerCase().replace(/\s+/g, ' ');
            var templateId = map[key] || map[key.replace(/\s+/g, '-')];

            if (!templateId) {
                return null;
            }

            templateApply.applyTemplateToState(state, templateId);
            return 'Section template "' + templateId + '" adicionada.';
        },
    },
    {
        name: 'add_block',
        pattern: /(?:adiciona|add|cria|create)\s+(?:um?\s+)?(?:block|bloco)\s+(heading|text|button|image|video|spacer)/i,
        run: function (state, match, selection) {
            var sectionId = resolveSectionId(state, selection);

            if (!sectionId) {
                editorState.addSection(state, 'hero');
                sectionId = state.tree.sections[state.tree.sections.length - 1].id;
            }

            var block = editorState.addBlock(state, sectionId, match[1].toLowerCase());
            editorState.select(state, 'block', block.id);
            return 'Block "' + block.type + '" adicionado.';
        },
    },
    {
        name: 'delete_selected',
        pattern: /(?:apaga|remove|elimina|delete)\s+(?:o\s+)?(?:selecionado|selected|elemento|block|bloco|sec[cç][aã]o|section)/i,
        run: function (state, match, selection) {
            if (!selection || !selection.type || !selection.id) {
                return null;
            }

            if (selection.type === 'section') {
                editorState.deleteSection(state, selection.id);
                return 'Section removida.';
            }

            editorState.deleteBlock(state, selection.id);
            return 'Block removido.';
        },
    },
    {
        name: 'apply_template',
        pattern: /(?:aplica|apply)\s+(?:template|modelo)\s+([\w-]+)/i,
        run: function (state, match) {
            var templateId = match[1].toLowerCase();
            var template = templateApply.applyTemplateToState(state, templateId);
            return 'Template "' + template.label + '" aplicado.';
        },
    },
];

function resolveSectionId(state, selection) {
    if (selection && selection.type === 'section') {
        return selection.id;
    }

    if (selection && selection.type === 'block') {
        var found = editorState.findBlock(state.tree, selection.id);
        return found ? found.section.id : null;
    }

    var sections = state.tree.sections || [];
    return sections.length ? sections[sections.length - 1].id : null;
}

function resolveTargetBlock(state, selection, blockType) {
    if (selection && selection.type === 'block') {
        var selected = editorState.findBlock(state, selection.id);

        if (selected && (!blockType || selected.block.type === blockType)) {
            return selected;
        }
    }

    var sections = (state.tree.sections || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    for (var i = 0; i < sections.length; i += 1) {
        var blocks = (sections[i].blocks || []).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });

        for (var j = 0; j < blocks.length; j += 1) {
            if (!blockType || blocks[j].type === blockType) {
                return { section: sections[i], block: blocks[j] };
            }
        }
    }

    return null;
}

function updateBlockContent(state, selection, blockType, contentPatch) {
    var target = resolveTargetBlock(state, selection, blockType);

    if (!target) {
        var sectionId = resolveSectionId(state, selection);

        if (!sectionId) {
            editorState.addSection(state, 'hero');
            sectionId = state.tree.sections[state.tree.sections.length - 1].id;
        }

        var block = editorState.addBlock(state, sectionId, blockType);
        editorState.updateBlock(state, block.id, {
            content: contentPatch,
        });
        editorState.select(state, 'block', block.id);
        return capitalize(blockType) + ' criado e actualizado.';
    }

    editorState.updateBlock(state, target.block.id, {
        content: contentPatch,
    });
    editorState.select(state, 'block', target.block.id);
    return capitalize(blockType) + ' actualizado.';
}

function capitalize(value) {
    return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

function sanitizePrompt(prompt) {
    var text = String(prompt || '').trim();

    if (text.length < 3) {
        throw Object.assign(new Error('Prompt demasiado curto.'), { code: 'INVALID_PROMPT' });
    }

    if (text.length > 4000) {
        throw Object.assign(new Error('Prompt demasiado longo.'), { code: 'INVALID_PROMPT' });
    }

    return text;
}

function tryLocalAssistant(prompt, tree, selection) {
    var state = editorState.createEditorState(tree);
    state.selected = {
        type: selection && selection.type || null,
        id: selection && selection.id || null,
    };

    for (var i = 0; i < LOCAL_ACTIONS.length; i += 1) {
        var action = LOCAL_ACTIONS[i];
        var match = prompt.match(action.pattern);

        if (!match) {
            continue;
        }

        var summary = action.run(state, match, state.selected);

        if (!summary) {
            continue;
        }

        return {
            mode: 'local',
            applied: true,
            summary: summary,
            tree: state.tree,
            selected: state.selected,
            action: action.name,
            page_summary: aiContext.buildPageSummary(state.tree),
        };
    }

    return {
        mode: 'local',
        applied: false,
        summary: 'Não reconheci este pedido no modo rápido. Experimenta o modo Agent ou reformula (ex.: "muda a headline para …").',
        tree: tree,
        selected: selection || { type: null, id: null },
        page_summary: aiContext.buildPageSummary(tree),
        suggestions: [
            'Muda a headline para A tua nova oferta',
            'Adiciona secção CTA',
            'Adiciona block heading',
            'Aplica template sales-basic',
        ],
    };
}

function applyLocalAssistant(prompt, tree, selection) {
    sanitizePrompt(prompt);
    return tryLocalAssistant(prompt, tree, selection);
}

module.exports = {
    applyLocalAssistant: applyLocalAssistant,
    tryLocalAssistant: tryLocalAssistant,
    buildPageBuilderAgentPrompt: aiContext.buildPageBuilderAgentPrompt,
};
