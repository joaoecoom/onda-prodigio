'use strict';

var offerContext = require('./offer-context');
var funnelEngine = require('./funnel-engine');
var aiContext = require('./page-builder/ai-context');
var launchReadiness = require('./launch-readiness');

async function buildPageContext(input) {
    var slug = String(input.slug || input.offer || '').trim();
    var funnelSlug = String(input.funnel_slug || input.funnel || '').trim();
    var pageSlug = String(input.page_slug || input.page || '').trim();
    var pageId = String(input.page_id || '').trim();
    var funnelId = String(input.funnel_id || '').trim();

    var offer = await offerContext.resolveOfferContext({ slug: slug });
    var lines = [
        'Módulo: PAGE BUILDER',
        'Offer: ' + offer.name + ' (' + offer.slug + ')',
        'Offer ID: ' + offer.id,
    ];
    var publicCtx = {
        module: 'page',
        offer: {
            id: offer.id,
            slug: offer.slug,
            name: offer.name,
        },
    };

    if (funnelId || funnelSlug) {
        var funnels = await funnelEngine.listFunnels(offer.id);
        var funnel = funnels.find(function (row) {
            if (funnelId) {
                return row.id === funnelId;
            }

            return row.slug === funnelSlug;
        });

        if (funnel) {
            lines.push('Funnel: ' + funnel.name + ' (' + funnel.slug + ')');
            lines.push('Funnel ID: ' + funnel.id);
            publicCtx.funnel = {
                id: funnel.id,
                slug: funnel.slug,
                name: funnel.name,
                type: funnel.type,
            };

            var pages = await funnelEngine.listPages(offer.id, funnel.id);
            publicCtx.pages = pages.map(function (page) {
                return {
                    id: page.id,
                    slug: page.slug,
                    name: page.name,
                    type: page.type,
                    status: page.status,
                };
            });

            lines.push('Pages existentes: ' + pages.map(function (p) {
                return p.slug + ' (' + p.type + ', ' + p.status + ')';
            }).join(', ') || 'nenhuma');

            var targetPage = null;

            if (pageId) {
                targetPage = pages.find(function (row) { return row.id === pageId; });
            } else if (pageSlug) {
                targetPage = pages.find(function (row) { return row.slug === pageSlug; });
            }

            if (targetPage) {
                var tree = null;
                var summary = null;

                if (input.client_tree && input.client_tree.sections && input.skipPageTreeLoad) {
                    tree = input.client_tree;
                    summary = input.client_page_summary || aiContext.buildPageSummary(tree);
                } else {
                    tree = await funnelEngine.getPageTree(offer.id, targetPage.id);
                    summary = aiContext.buildPageSummary(tree);
                }

                lines.push('Page activa: ' + targetPage.name + ' (' + targetPage.slug + ')');
                lines.push('Page ID: ' + targetPage.id);
                lines.push('Estrutura actual: ' + JSON.stringify(summary));
                lines.push('IMPORTANTE: NÃO chames get_page_tree — usa estes IDs directamente.');

                publicCtx.page = {
                    id: targetPage.id,
                    slug: targetPage.slug,
                    name: targetPage.name,
                    type: targetPage.type,
                    status: targetPage.status,
                };
                publicCtx.page_summary = summary;
            }
        }
    }

    if (input.selection || input.selected_section) {
        publicCtx.selection = input.selection || null;
        publicCtx.selected_section = input.selected_section || null;
        lines.push('Selecção: ' + JSON.stringify(input.selection || {}));
    }

    return {
        summary: lines.join('\n'),
        public: publicCtx,
    };
}

async function buildOfferContext(input) {
    var offer = await offerContext.resolveOfferContext({ slug: input.slug || input.offer });
    var readiness = null;
    var lines = [
        'Módulo: ' + String(input.module || input.mode || 'general').toUpperCase(),
        offerContext.buildAgentContextSummary(offer),
    ];

    try {
        readiness = await launchReadiness.evaluateLaunchReadiness(offer.slug);
    } catch (error) {
        readiness = null;
    }

    if (readiness) {
        lines.push('Launch status: ' + (readiness.overall_status || readiness.status || 'unknown'));
    }

    return {
        summary: lines.join('\n'),
        public: {
            module: input.module || input.mode || 'general',
            offer: {
                id: offer.id,
                slug: offer.slug,
                name: offer.name,
            },
            launch: readiness,
        },
    };
}

async function build(input) {
    var module = String(input.module || input.mode || 'general').trim().toLowerCase();

    if (module === 'page' || module === 'page_builder') {
        return buildPageContext(input);
    }

    return buildOfferContext(input);
}

module.exports = {
    build: build,
    buildPageContext: buildPageContext,
    buildOfferContext: buildOfferContext,
};
