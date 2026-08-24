var loadPage = require('./load-page');
var pageRenderer = require('./page-renderer');
var blockRegistry = require('./block-registry');
var sectionRenderer = require('./section-renderer');

module.exports = {
    loadPage: loadPage,
    pageRenderer: pageRenderer,
    blockRegistry: blockRegistry,
    sectionRenderer: sectionRenderer,
    renderPageHtml: loadPage.renderPageHtml,
    getRenderablePageBySlugs: loadPage.getRenderablePageBySlugs,
    getRenderablePageById: loadPage.getRenderablePageById,
};
