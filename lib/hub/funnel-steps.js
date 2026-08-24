'use strict';

var constants = require('./funnel-engine/constants');

var FUNNEL_STEP_FLOW = [
    { type: 'sales', label: 'Sales Page', sort_order: 100, creatable: true },
    { type: 'checkout', label: 'Checkout', sort_order: 200, creatable: false, system: true },
    { type: 'upsell', label: 'Upsell', sort_order: 300, creatable: true },
    { type: 'downsell', label: 'Downsell', sort_order: 400, creatable: true },
    { type: 'thank_you', label: 'Thank You', sort_order: 500, creatable: true },
];

var TYPE_LABELS = {
    sales: 'Sales Page',
    presell: 'Pre Sell',
    vsl: 'VSL',
    landing: 'Landing',
    advertorial: 'Advertorial',
    checkout: 'Checkout',
    upsell: 'Upsell',
    downsell: 'Downsell',
    thank_you: 'Thank You',
    webinar: 'Webinar',
    custom: 'Custom',
};

function sortOrderForType(type) {
    var step = FUNNEL_STEP_FLOW.find(function (row) {
        return row.type === type;
    });

    if (step) {
        return step.sort_order;
    }

    return 900;
}

function defaultSlugForType(type, index) {
    if (type === 'sales') {
        return 'sales';
    }

    if (type === 'upsell') {
        return 'upsell-' + (index || 1);
    }

    if (type === 'downsell') {
        return 'downsell-' + (index || 1);
    }

    if (type === 'thank_you') {
        return 'obrigado';
    }

    return type.replace(/_/g, '-');
}

function defaultNameForType(type, index) {
    var label = TYPE_LABELS[type] || type;

    if (type === 'upsell' || type === 'downsell') {
        return label + ' ' + (index || 1);
    }

    return label;
}

function buildDefaultSteps() {
    return FUNNEL_STEP_FLOW.filter(function (step) {
        return step.creatable;
    }).map(function (step, index) {
        return {
            type: step.type,
            name: defaultNameForType(step.type, index + 1),
            slug: defaultSlugForType(step.type, index + 1),
            sort_order: step.sort_order,
        };
    });
}

function groupPagesIntoSteps(pages) {
    var byType = {};

    (pages || []).forEach(function (page) {
        var type = page.type || 'custom';

        if (!byType[type]) {
            byType[type] = [];
        }

        byType[type].push(page);
    });

    Object.keys(byType).forEach(function (type) {
        byType[type].sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });
    });

    return FUNNEL_STEP_FLOW.map(function (step) {
        var matched = byType[step.type] || [];

        return {
            type: step.type,
            label: step.label,
            sort_order: step.sort_order,
            system: Boolean(step.system),
            creatable: step.creatable !== false,
            pages: matched,
            linked: matched.length > 0,
        };
    });
}

function isAllowedPageType(type) {
    return constants.PAGE_TYPES.indexOf(type) !== -1;
}

module.exports = {
    FUNNEL_STEP_FLOW: FUNNEL_STEP_FLOW,
    TYPE_LABELS: TYPE_LABELS,
    sortOrderForType: sortOrderForType,
    defaultSlugForType: defaultSlugForType,
    defaultNameForType: defaultNameForType,
    buildDefaultSteps: buildDefaultSteps,
    groupPagesIntoSteps: groupPagesIntoSteps,
    isAllowedPageType: isAllowedPageType,
};
