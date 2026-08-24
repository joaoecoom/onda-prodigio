'use strict';

var SECTION_TEMPLATES = [
    {
        id: 'hero-standard',
        kind: 'section',
        label: 'Hero',
        description: 'Headline, texto e botão CTA',
        preview: 'hero',
        section: {
            type: 'hero',
            settings: { label: 'Hero' },
            styles: {},
            blocks: [
                {
                    type: 'heading',
                    content: { text: 'A tua headline principal' },
                    settings: { level: 1, alignment: 'center' },
                },
                {
                    type: 'text',
                    content: { text: 'Subheadline que explica a proposta de valor em 1–2 frases.' },
                    settings: { alignment: 'center' },
                },
                {
                    type: 'button',
                    content: { label: 'Quero saber mais', href: '#' },
                    settings: { variant: 'primary', alignment: 'center', target: '_self' },
                },
            ],
        },
    },
    {
        id: 'benefits-list',
        kind: 'section',
        label: 'Benefits',
        description: 'Título + lista de benefícios',
        preview: 'benefits',
        section: {
            type: 'benefits',
            settings: { label: 'Benefits' },
            styles: {},
            blocks: [
                {
                    type: 'heading',
                    content: { text: 'Porquê escolher isto?' },
                    settings: { level: 2, alignment: 'center' },
                },
                {
                    type: 'text',
                    content: { text: '• Benefício 1\n• Benefício 2\n• Benefício 3' },
                    settings: { alignment: 'left' },
                },
            ],
        },
    },
    {
        id: 'cta-simple',
        kind: 'section',
        label: 'CTA',
        description: 'Chamada final à acção',
        preview: 'cta',
        section: {
            type: 'cta',
            settings: { label: 'CTA' },
            styles: {},
            blocks: [
                {
                    type: 'heading',
                    content: { text: 'Pronto para começar?' },
                    settings: { level: 2, alignment: 'center' },
                },
                {
                    type: 'button',
                    content: { label: 'Começar agora', href: '#' },
                    settings: { variant: 'primary', alignment: 'center', target: '_self' },
                },
            ],
        },
    },
    {
        id: 'social-proof',
        kind: 'section',
        label: 'Social Proof',
        description: 'Prova social / testemunho curto',
        preview: 'social',
        section: {
            type: 'custom',
            settings: { label: 'Social Proof' },
            styles: {},
            blocks: [
                {
                    type: 'heading',
                    content: { text: 'O que dizem os clientes' },
                    settings: { level: 2, alignment: 'center' },
                },
                {
                    type: 'text',
                    content: { text: '"Resultado incrível em poucos dias." — Cliente' },
                    settings: { alignment: 'center' },
                },
            ],
        },
    },
];

var PAGE_TEMPLATES = [
    {
        id: 'sales-basic',
        kind: 'page',
        label: 'Sales Page Basic',
        description: 'Hero + Benefits + CTA — estrutura clássica de vendas',
        page_type: 'sales',
        sections: ['hero-standard', 'benefits-list', 'cta-simple'],
    },
    {
        id: 'sales-minimal',
        kind: 'page',
        label: 'Sales Page Minimal',
        description: 'Apenas Hero — ideal para começar rápido',
        page_type: 'sales',
        sections: ['hero-standard'],
    },
    {
        id: 'sales-full',
        kind: 'page',
        label: 'Sales Page Full',
        description: 'Hero + Benefits + Social Proof + CTA',
        page_type: 'sales',
        sections: ['hero-standard', 'benefits-list', 'social-proof', 'cta-simple'],
    },
    {
        id: 'checkout-default',
        kind: 'page',
        label: 'Checkout padrão',
        description: 'Layout vertical dark: escassez → form → bumps → pagamento → testemunhos',
        page_type: 'checkout',
        sections: ['__checkout_default__'],
    },
];

function listTemplates() {
    return {
        page_templates: PAGE_TEMPLATES.map(function (template) {
            return {
                id: template.id,
                kind: template.kind,
                label: template.label,
                description: template.description,
                page_type: template.page_type,
                section_count: template.sections.length,
            };
        }),
        section_templates: SECTION_TEMPLATES.map(function (template) {
            return {
                id: template.id,
                kind: template.kind,
                label: template.label,
                description: template.description,
                preview: template.preview,
                block_count: (template.section.blocks || []).length,
            };
        }),
    };
}

function getPageTemplate(templateId) {
    var template = PAGE_TEMPLATES.find(function (row) {
        return row.id === templateId;
    });

    if (!template) {
        return null;
    }

    if (template.id === 'checkout-default') {
        var checkoutDefaultPage = require('../checkout-default-page');
        return {
            id: template.id,
            kind: 'page',
            label: template.label,
            description: template.description,
            sections: checkoutDefaultPage.buildCheckoutDefaultSections({}),
        };
    }

    var sections = template.sections.map(function (sectionId) {
        return getSectionTemplate(sectionId);
    }).filter(Boolean);

    return {
        id: template.id,
        kind: 'page',
        label: template.label,
        description: template.description,
        sections: sections.map(function (row) { return row.section; }),
    };
}

function getSectionTemplate(templateId) {
    return SECTION_TEMPLATES.find(function (row) {
        return row.id === templateId;
    }) || null;
}

function resolveTemplate(templateId) {
    var page = getPageTemplate(templateId);

    if (page) {
        return page;
    }

    var section = getSectionTemplate(templateId);

    if (section) {
        return {
            id: section.id,
            kind: 'section',
            label: section.label,
            description: section.description,
            sections: [section.section],
        };
    }

    return null;
}

module.exports = {
    PAGE_TEMPLATES: PAGE_TEMPLATES,
    SECTION_TEMPLATES: SECTION_TEMPLATES,
    listTemplates: listTemplates,
    getPageTemplate: getPageTemplate,
    getSectionTemplate: getSectionTemplate,
    resolveTemplate: resolveTemplate,
};
