'use strict';

var constants = require('../funnel-engine/constants');

function defaultSection(type) {
    return {
        type: type || 'hero',
        sort_order: constants.DEFAULT_SORT_GAP,
        settings: { label: type || 'hero' },
        styles: {},
        visibility: { desktop: true, tablet: true, mobile: true },
        blocks: [],
    };
}

function defaultBlock(type) {
    var blockType = type || 'heading';

    var templates = {
        heading: {
            type: 'heading',
            sort_order: constants.DEFAULT_SORT_GAP,
            content: { text: 'Nova headline' },
            settings: { level: 1, alignment: 'center' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
        },
        text: {
            type: 'text',
            sort_order: constants.DEFAULT_SORT_GAP,
            content: { text: 'Novo parágrafo.' },
            settings: { alignment: 'left' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
        },
        button: {
            type: 'button',
            sort_order: constants.DEFAULT_SORT_GAP,
            content: { label: 'Quero saber mais', href: '#' },
            settings: { variant: 'primary', alignment: 'center', target: '_self' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
        },
        image: {
            type: 'image',
            sort_order: constants.DEFAULT_SORT_GAP,
            content: { src: '', alt: '' },
            settings: { alignment: 'center', width: '100%' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
        },
        video: {
            type: 'video',
            sort_order: constants.DEFAULT_SORT_GAP,
            content: { url: '' },
            settings: { controls: true, autoplay: false, muted: false, aspectRatio: '16 / 9' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
        },
        spacer: {
            type: 'spacer',
            sort_order: constants.DEFAULT_SORT_GAP,
            content: {},
            settings: { height: '48px' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
        },
        html: {
            type: 'html',
            sort_order: constants.DEFAULT_SORT_GAP,
            content: { html: '<div>Novo bloco HTML</div>' },
            settings: {},
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
        },
    };

    return templates[blockType] || templates.heading;
}

function nextSortOrder(items) {
    if (!items || !items.length) {
        return constants.DEFAULT_SORT_GAP;
    }

    var max = items.reduce(function (acc, item) {
        return Math.max(acc, item.sort_order || 0);
    }, 0);

    return max + constants.DEFAULT_SORT_GAP;
}

module.exports = {
    defaultSection: defaultSection,
    defaultBlock: defaultBlock,
    nextSortOrder: nextSortOrder,
    COMPONENT_LIBRARY: [
        { type: 'heading', label: 'Heading', description: 'Título ou subtítulo', icon: 'H' },
        { type: 'text', label: 'Text', description: 'Parágrafo ou lista', icon: 'T' },
        { type: 'image', label: 'Image', description: 'Imagem por URL', icon: 'I' },
        { type: 'video', label: 'Video', description: 'Vídeo embed por URL', icon: 'V' },
        { type: 'button', label: 'Button', description: 'Botão com link', icon: 'B' },
        { type: 'spacer', label: 'Spacer', description: 'Espaço vertical', icon: '—' },
        { type: 'html', label: 'HTML', description: 'Bloco HTML editável', icon: '</>' },
    ],
};
