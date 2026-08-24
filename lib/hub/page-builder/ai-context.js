'use strict';

function summarizeBlock(block) {
    if (!block) {
        return null;
    }

    var preview = '';

    if (block.type === 'heading' || block.type === 'text') {
        preview = String((block.content && block.content.text) || '').slice(0, 80);
    } else if (block.type === 'button') {
        preview = String((block.content && block.content.label) || '').slice(0, 80);
    } else if (block.type === 'image') {
        preview = String((block.content && block.content.src) || '').slice(0, 80);
    }

    return {
        id: block.id,
        type: block.type,
        preview: preview,
    };
}

function buildPageSummary(tree) {
    var sections = (tree && tree.sections) || [];

    return sections.slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    }).map(function (section) {
        var blocks = (section.blocks || []).slice().sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });

        return {
            id: section.id,
            type: section.type,
            label: section.settings && section.settings.label || section.type,
            blocks: blocks.map(summarizeBlock).filter(Boolean),
        };
    });
}

function buildSelectionSummary(tree, selected) {
    if (!selected || !selected.type || !selected.id) {
        return null;
    }

    if (selected.type === 'section') {
        var section = (tree.sections || []).find(function (row) {
            return row.id === selected.id;
        });

        if (!section) {
            return null;
        }

        return {
            type: 'section',
            id: section.id,
            section_type: section.type,
            label: section.settings && section.settings.label || section.type,
        };
    }

    var sections = tree.sections || [];

    for (var i = 0; i < sections.length; i += 1) {
        var blocks = sections[i].blocks || [];

        for (var j = 0; j < blocks.length; j += 1) {
            if (blocks[j].id === selected.id) {
                return {
                    type: 'block',
                    id: blocks[j].id,
                    block_type: blocks[j].type,
                    section_id: sections[i].id,
                    block: summarizeBlock(blocks[j]),
                };
            }
        }
    }

    return null;
}

function buildPageBuilderAgentPrompt(pageScope, userPrompt) {
    var lines = [
        'Page Builder — editar página existente via MCP hub-page-tools.',
        '',
        'Offer slug: ' + pageScope.offer_slug,
        'Offer ID: ' + pageScope.offer_id,
        'Funnel slug: ' + pageScope.funnel_slug,
        'Funnel ID: ' + pageScope.funnel_id,
        'Page slug: ' + pageScope.page_slug,
        'Page ID: ' + pageScope.page_id,
        '',
        'Regras:',
        '- Usa get_page_tree (offer_id + page_id) antes de alterar.',
        '- Usa create/update/delete/reorder tools — não SQL.',
        '- Não dupliques slugs nem recries entidades que já existem.',
        '- Mantém a página em draft salvo pedido contrário.',
        '',
        'Pedido do utilizador:',
        String(userPrompt || '').trim(),
    ];

    return lines.join('\n');
}

module.exports = {
    buildPageSummary: buildPageSummary,
    buildSelectionSummary: buildSelectionSummary,
    buildPageBuilderAgentPrompt: buildPageBuilderAgentPrompt,
};
