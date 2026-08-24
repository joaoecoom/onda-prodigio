'use strict';

var patchEngine = require('./patch-engine');
var aiContext = require('./ai-context');
var visualGuide = require('./visual-replication-guide');

function buildSelectedContext(tree, selection, selectedSection) {
    if (selectedSection && selectedSection.id) {
        return {
            type: 'section',
            id: selectedSection.id,
            label: selectedSection.settings && selectedSection.settings.label,
            section: compactSection(selectedSection),
            primary_block_id: pickPrimaryBlockId(selectedSection),
            primary_block_type: pickPrimaryBlockType(selectedSection),
        };
    }

    if (!selection || !selection.type || !selection.id) {
        return null;
    }

    if (selection.type === 'section') {
        var section = (tree.sections || []).find(function (row) {
            return row.id === selection.id;
        });

        if (!section) {
            return null;
        }

        return {
            type: 'section',
            id: section.id,
            label: section.settings && section.settings.label,
            section: compactSection(section),
            primary_block_id: pickPrimaryBlockId(section),
            primary_block_type: pickPrimaryBlockType(section),
        };
    }

    return aiContext.buildSelectionSummary(tree, selection);
}

function pickPrimaryBlockId(section) {
    var blocks = (section && section.blocks || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    return blocks[0] && blocks[0].id;
}

function pickPrimaryBlockType(section) {
    var blocks = (section && section.blocks || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    return blocks[0] && blocks[0].type;
}

function compactSection(section) {
    return {
        id: section.id,
        type: section.type,
        sort_order: section.sort_order,
        settings: section.settings || {},
        styles: section.styles || {},
        visibility: section.visibility || {},
        blocks: (section.blocks || []).map(function (block) {
            return {
                id: block.id,
                type: block.type,
                content: block.content || {},
                settings: block.settings || {},
                styles: block.styles || {},
                visibility: block.visibility || {},
            };
        }),
    };
}

function buildBlockMap(blockIndex) {
    return (blockIndex || []).map(function (row) {
        return {
            alias: row.alias,
            section_id: row.section_id,
            section_type: row.type,
            label: row.label,
            blocks: row.blocks || [],
            primary_block_id: row.primary_block_id,
            primary_block_type: row.primary_block_type,
        };
    });
}

function resolveTargetFromMessage(message, blockIndex, selection, selectedSection) {
    if (selectedSection && selectedSection.id) {
        return blockIndex.find(function (row) {
            return row.section_id === selectedSection.id;
        }) || null;
    }

    if (selection && selection.type === 'section' && selection.id) {
        return blockIndex.find(function (row) {
            return row.section_id === selection.id;
        }) || null;
    }

    var text = String(message || '').toLowerCase();

    if (/primeiro|block_01|bloco\s*1|headline\s*principal/i.test(text)) {
        return blockIndex[0] || null;
    }

    if (/segundo|block_02|bloco\s*2/i.test(text)) {
        return blockIndex[1] || null;
    }

    var aliasMatch = text.match(/block[_\-\s]?(\d+)/i);

    if (aliasMatch) {
        var n = parseInt(aliasMatch[1], 10);
        return blockIndex[n - 1] || null;
    }

    if (/headline|t[ií]tulo|hero|este\s+bloco|isto|seleccionad/i.test(text)) {
        return blockIndex[0] || null;
    }

    return null;
}

function buildMinimalGeminiContext(input) {
    var tree = input.client_tree || null;
    var lines = [];
    var blockIndex = tree ? patchEngine.buildBlockIndex(tree) : [];
    var blockMap = buildBlockMap(blockIndex);
    var target = resolveTargetFromMessage(
        input.message || '',
        blockIndex,
        input.selection,
        input.selected_section
    );

    lines.push('PAGE BUILDER — contexto operacional');
    lines.push('Page ID: ' + (input.page_id || ''));
    lines.push('Offer ID: ' + (input.offer_id || ''));

    if (blockIndex.length) {
        lines.push('');
        lines.push('Índice de blocos (UI = section; conteúdo = block_id interno):');
        blockIndex.forEach(function (row) {
            var blockIds = (row.blocks || []).map(function (b) {
                return b.block_id + '(' + b.type + ')';
            }).join(', ') || 'sem blocks';

            lines.push('- ' + row.alias +
                ' → section_id=' + row.section_id +
                ' section_type=' + row.type +
                ' block_id=' + (row.primary_block_id || 'CRIAR') +
                ' block_type=' + (row.primary_block_type || 'html') +
                ' blocks=[' + blockIds + ']' +
                (row.preview ? ' preview="' + row.preview.slice(0, 50) + '"' : ''));
        });

        lines.push('');
        lines.push('BLOCK_MAP (usar estes IDs — nunca inventar):');
        lines.push(JSON.stringify(blockMap));
    } else {
        lines.push('Page vazia — sem blocos.');
    }

    if (target && target.primary_block_id) {
        lines.push('');
        lines.push('ALVO DO PEDIDO (editar ESTE block_id):');
        lines.push('alias=' + target.alias +
            ' section_id=' + target.section_id +
            ' block_id=' + target.primary_block_id +
            ' block_type=' + target.primary_block_type);
    }

    var selected = buildSelectedContext(tree, input.selection, input.selected_section);

    if (selected) {
        lines.push('');
        lines.push('BLOCO SELECCIONADO:');
        lines.push(JSON.stringify(selected));
    }

    var intent = patchEngine.classifyIntent(input.message || '', input.selection, input.references);

    lines.push('');
    lines.push('Intent: ' + intent.tier + ' / ' + intent.intent);

    if (intent.tier === 'gemini' && input.client_page_summary) {
        lines.push('');
        lines.push('Resumo page (não chames get_page_tree):');
        lines.push(JSON.stringify(input.client_page_summary));
    }

    if (input.references && input.references.length) {
        lines.push('');
        lines.push(visualGuide.buildReferenceReplicationPrompt(input.references, input.message));
    }

    lines.push('');
    lines.push('REGRAS OBRIGATÓRIAS:');
    lines.push('1. PATCH mínimo — update_block(block_id) para texto, cores, HTML, gradientes.');
    lines.push('2. section type "custom" é NORMAL — edita o block_id interno (type html ou heading).');
    lines.push('3. PROIBIDO delete_section/create_section para mudar cores, estilos ou texto.');
    lines.push('4. PROIBIDO pedir confirmação ao utilizador — executa a tool directamente.');
    lines.push('5. Headlines multi-cor → update_block { type:"html", content:{ html:"..." } }.');
    lines.push('6. Novo bloco OU referência visual → create_section custom + blocks[{type:"html", content:{html}}] FIEL à imagem.');
    lines.push('7. Comentários Facebook: bolha #F0F2F5, nome #385898, replies com border-left, SVG Gosto #0866FF.');
    lines.push('8. Várias alterações → apply_page_patches ou várias tools no mesmo turno.');
    lines.push('9. Responde 1 frase PT após executar — não expliques limitações técnicas.');

    return lines.join('\n');
}

module.exports = {
    buildMinimalGeminiContext: buildMinimalGeminiContext,
    buildSelectedContext: buildSelectedContext,
    buildBlockMap: buildBlockMap,
    resolveTargetFromMessage: resolveTargetFromMessage,
    compactSection: compactSection,
};
