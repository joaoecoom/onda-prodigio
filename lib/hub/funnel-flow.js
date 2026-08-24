'use strict';

var funnelSteps = require('./funnel-steps');

var STEP_KINDS = [
    { kind: 'page', label: 'Página', types: ['sales', 'vsl', 'landing', 'advertorial', 'custom'] },
    { kind: 'quiz', label: 'Quiz', types: ['quiz'] },
    { kind: 'checkout', label: 'Checkout', types: ['checkout'], system: true },
    { kind: 'upsell', label: 'Upsell', types: ['upsell'] },
    { kind: 'downsell', label: 'Downsell', types: ['downsell'] },
    { kind: 'thank_you', label: 'Thank You', types: ['thank_you'] },
];

function makeStepId() {
    return 'step-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function normalizeStep(step, index) {
    var kind = String(step.kind || step.type || 'page').trim().toLowerCase();
    var pageType = String(step.page_type || step.type || 'sales').trim().toLowerCase();

    if (kind === 'checkout') {
        pageType = 'checkout';
    }

    return {
        id: step.id || makeStepId(),
        kind: kind,
        page_type: pageType,
        label: String(step.label || funnelSteps.TYPE_LABELS[pageType] || kind).trim(),
        sort_order: parseInt(step.sort_order, 10) || (index + 1) * 100,
        active_page_id: step.active_page_id || step.page_id || null,
        variant_page_ids: Array.isArray(step.variant_page_ids) ? step.variant_page_ids : [],
        checkout_id: step.checkout_id || 'main',
        lane: step.lane === 'reject' ? 'reject' : 'main',
        parent_step_id: step.parent_step_id || null,
        is_step_active: step.is_step_active !== false,
    };
}

function normalizeFlow(rawFlow) {
    if (!Array.isArray(rawFlow)) {
        return [];
    }

    return rawFlow.map(normalizeStep).sort(function (a, b) {
        return a.sort_order - b.sort_order;
    });
}

function defaultSalesFlow() {
    return [
        normalizeStep({ kind: 'page', page_type: 'sales', label: 'Sales Page', sort_order: 100 }, 0),
        normalizeStep({ kind: 'checkout', label: 'Checkout', sort_order: 200 }, 1),
        normalizeStep({ kind: 'upsell', page_type: 'upsell', label: 'Upsell', sort_order: 300 }, 2),
        normalizeStep({ kind: 'downsell', page_type: 'downsell', label: 'Downsell', sort_order: 400 }, 3),
        normalizeStep({ kind: 'thank_you', page_type: 'thank_you', label: 'Thank You', sort_order: 500 }, 4),
    ];
}

function flowFromLegacyPages(pages) {
    var grouped = funnelSteps.groupPagesIntoSteps(pages || []);
    var flow = [];

    grouped.forEach(function (step, index) {
        if (step.system) {
            flow.push(normalizeStep({
                kind: 'checkout',
                page_type: 'checkout',
                label: step.label,
                sort_order: step.sort_order || (index + 1) * 100,
            }, index));
            return;
        }

        var firstPage = (step.pages || [])[0];

        flow.push(normalizeStep({
            kind: 'page',
            page_type: step.type,
            label: step.label,
            sort_order: step.sort_order || (index + 1) * 100,
            active_page_id: firstPage ? firstPage.id : null,
            variant_page_ids: (step.pages || []).slice(1).map(function (p) { return p.id; }),
        }, index));
    });

    return flow;
}

function getFlowFromFunnel(funnel, pages) {
    var settings = (funnel && funnel.settings) || {};
    var stored = normalizeFlow(settings.flow);

    if (stored.length) {
        return stored;
    }

    return flowFromLegacyPages(pages);
}

function attachPagesToFlow(flow, pages) {
    var byId = {};

    (pages || []).forEach(function (page) {
        byId[page.id] = page;
    });

    return (flow || []).map(function (step) {
        var active = step.active_page_id ? byId[step.active_page_id] : null;
        var variants = (step.variant_page_ids || []).map(function (id) {
            return byId[id];
        }).filter(Boolean);

        return Object.assign({}, step, {
            active_page: active,
            variant_pages: variants,
        });
    });
}

function pagesMatchingStep(step, allPages) {
    var type = step.page_type || step.kind;

    return (allPages || []).filter(function (page) {
        if (step.kind === 'quiz') {
            return page.type === 'quiz' || page.type === 'custom';
        }

        if (step.kind === 'checkout' || type === 'checkout') {
            return page.type === 'checkout' || page.type === 'custom';
        }

        return page.type === type || page.type === 'custom';
    });
}

function getMainFlowSteps(flow) {
    return normalizeFlow(flow).filter(function (step) {
        return step.lane !== 'reject';
    });
}

function getRejectStepForParent(flow, parentStepId) {
    return normalizeFlow(flow).find(function (step) {
        return step.lane === 'reject' && step.parent_step_id === parentStepId;
    }) || null;
}

module.exports = {
    STEP_KINDS: STEP_KINDS,
    normalizeFlow: normalizeFlow,
    defaultSalesFlow: defaultSalesFlow,
    flowFromLegacyPages: flowFromLegacyPages,
    getFlowFromFunnel: getFlowFromFunnel,
    attachPagesToFlow: attachPagesToFlow,
    pagesMatchingStep: pagesMatchingStep,
    getMainFlowSteps: getMainFlowSteps,
    getRejectStepForParent: getRejectStepForParent,
    makeStepId: makeStepId,
};
