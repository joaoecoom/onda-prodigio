'use strict';

var registry = require('./agent-tools/registry');

var MODE_TOOLS = {
    funnel: [
        'list_funnels',
        'create_funnel',
        'list_pages',
        'create_page',
        'update_page',
        'setup_funnel_flow',
        'publish_page',
    ],
    tracking: [
        'get_offer_integrations_status',
        'save_offer_integrations',
    ],
    domain: [
        'register_funnel_domain',
    ],
    checkout: [
        'get_checkout_context',
        'get_checkout_template',
        'save_checkout_template',
        'update_checkout_pricing',
        'list_order_bumps',
        'upsert_order_bump',
        'configure_stripe_catalog',
        'ensure_stripe_webhook',
        'get_offer_integrations_status',
        'save_offer_integrations',
        'validate_offer',
    ],
    recovery: [
        'list_offer_flows',
        'save_offer_flow',
        'generate_offer_flow',
        'get_offer_integrations_status',
        'save_offer_integrations',
    ],
    automation: [
        'list_offer_flows',
        'save_offer_flow',
        'generate_offer_flow',
        'get_offer_integrations_status',
        'save_offer_integrations',
    ],
    page: [
        'list_funnels',
        'list_pages',
        'create_page',
        'update_page',
        'apply_template',
        'publish_page',
        'get_page_tree',
        'create_section',
        'update_section',
        'create_block',
        'update_block',
    ],
    page_builder: [
        'create_section',
        'update_section',
        'delete_section',
        'reorder_sections',
        'create_block',
        'update_block',
        'delete_block',
        'apply_page_patches',
    ],
    general: [
        'list_funnels',
        'create_funnel',
        'setup_funnel_flow',
        'list_pages',
        'create_page',
        'save_offer_integrations',
        'get_offer_integrations_status',
        'register_funnel_domain',
        'provision_offer',
        'create_offer',
        'get_checkout_context',
        'save_checkout_template',
        'update_checkout_pricing',
        'upsert_order_bump',
        'configure_stripe_catalog',
        'ensure_stripe_webhook',
        'list_offer_flows',
        'save_offer_flow',
        'generate_offer_flow',
    ],
};

function normalizeMode(value) {
    var mode = String(value || 'general').trim().toLowerCase();
    return MODE_TOOLS[mode] ? mode : 'general';
}

function toGeminiDeclaration(tool) {
    return {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || { type: 'object', properties: {} },
    };
}

function getToolsForMode(mode) {
    var normalized = normalizeMode(mode);
    var allowed = MODE_TOOLS[normalized];
    var declarations = [];

    allowed.forEach(function (name) {
        var tool = registry.getToolDefinition(name);

        if (tool) {
            declarations.push(toGeminiDeclaration(tool));
        }
    });

    return declarations;
}

function listModes() {
    return Object.keys(MODE_TOOLS);
}

module.exports = {
    MODE_TOOLS: MODE_TOOLS,
    normalizeMode: normalizeMode,
    getToolsForMode: getToolsForMode,
    listModes: listModes,
    toGeminiDeclaration: toGeminiDeclaration,
};
