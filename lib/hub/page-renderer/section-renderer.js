var blockRegistry = require('./block-registry');
var stylesUtil = require('./styles');
var visibilityUtil = require('./visibility');
var escapeUtil = require('./escape');

function sortByOrder(items) {
    return (items || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0) ||
            String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
}

function renderSection(section, ctx) {
    var blocks = sortByOrder(section.blocks);
    var blocksHtml = blocks.map(function (block) {
        return blockRegistry.renderBlock(block, ctx);
    }).join('\n');

    var sectionStyle = stylesUtil.buildInlineStyles(section.styles, section.settings && section.settings.layout);
    var visClass = visibilityUtil.visibilityClasses(section.visibility);
    var label = section.settings && section.settings.label
        ? escapeUtil.escapeHtml(section.settings.label)
        : escapeUtil.escapeHtml(section.type || 'section');

    return '<section class="pe-section pe-section--' + escapeUtil.escapeAttr(section.type) +
        ' ' + visClass + '" data-section-id="' + escapeUtil.escapeAttr(section.id) +
        '" data-section-type="' + escapeUtil.escapeAttr(section.type) + '"' +
        (sectionStyle ? ' style="' + escapeUtil.escapeAttr(sectionStyle) + '"' : '') +
        '><div class="pe-section__inner">' + blocksHtml + '</div></section>';
}

module.exports = {
    renderSection: renderSection,
    sortByOrder: sortByOrder,
};
