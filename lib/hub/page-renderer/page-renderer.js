var sectionRenderer = require('./section-renderer');
var stylesUtil = require('./styles');
var visibilityUtil = require('./visibility');
var escapeUtil = require('./escape');

var DEFAULT_PAGE_SETTINGS = {
    maxWidth: '960px',
    background: '#ffffff',
    spacing: '24px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#111827',
};

function mergePageSettings(settings) {
    return Object.assign({}, DEFAULT_PAGE_SETTINGS, settings || {});
}

function buildMetaTags(page, offerContext) {
    var seo = page.seo || {};
    var title = seo.title || page.name || (offerContext && offerContext.name) || 'Page Preview';
    var description = seo.description || '';
    var canonical = seo.canonical || '';
    var tags = [
        '<title>' + escapeUtil.escapeHtml(title) + '</title>',
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    ];

    if (description) {
        tags.push('<meta name="description" content="' + escapeUtil.escapeAttr(description) + '">');
    }

    if (canonical && escapeUtil.isSafeUrl(canonical)) {
        tags.push('<link rel="canonical" href="' + escapeUtil.escapeAttr(canonical) + '">');
    }

    return tags.join('\n');
}

function basePageCss(settings) {
    var cfg = mergePageSettings(settings);

    return [
        visibilityUtil.baseVisibilityCss(),
        '*,*::before,*::after{box-sizing:border-box}',
        'body{margin:0;font-family:' + cfg.fontFamily + ';color:' + cfg.color + ';background:' + cfg.background + '}',
        '.pe-page{min-height:100vh}',
        '.pe-page__inner{max-width:' + cfg.maxWidth + ';margin:0 auto;padding:' + cfg.spacing + '}',
        '.pe-section{padding:24px 0}',
        '.pe-section__inner{display:flex;flex-direction:column;gap:16px}',
        '.pe-heading{margin:0;line-height:1.2}',
        '.pe-text{line-height:1.6;font-size:1rem}',
        '.pe-button{display:inline-block;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600}',
        '.pe-button--primary{background:#6366f1;color:#fff}',
        '.pe-button--secondary{background:#e5e7eb;color:#111827}',
        '.pe-placeholder{padding:12px;border:1px dashed #cbd5e1;color:#64748b;background:#f8fafc;border-radius:8px}',
        '.pe-html-warning{font-size:12px;color:#b45309;margin:0 0 8px}',
        '.pe-html-raw{overflow:auto}',
        '.pe-preview-banner{background:#fef3c7;color:#92400e;padding:8px 12px;text-align:center;font-size:13px}',
        '@media (max-width:479px){.pe-spacer{height:attr(data-mobile-height px)!important}}',
    ].join('');
}

function buildTrackingScripts(offerContext, mode) {
    if (mode !== 'production' || !offerContext || !offerContext.slug) {
        return '';
    }

    return '<script defer src="/assets/tracking.js"></script>\n' +
        '<script>document.documentElement.setAttribute("data-offer-slug","' +
        escapeUtil.escapeAttr(offerContext.slug) + '");document.documentElement.setAttribute("data-page-type","page-engine");</script>';
}

function renderPageDocument(tree, options) {
    var opts = options || {};
    var ctx = {
        mode: opts.mode || 'preview',
        offer: opts.offerContext || null,
        funnel: tree.funnel,
        page: tree.page,
    };
    var page = tree.page;
    var settings = mergePageSettings(page.settings);
    var sections = sectionRenderer.sortByOrder(tree.sections);
    var sectionsHtml = sections.map(function (section) {
        return sectionRenderer.renderSection(section, ctx);
    }).join('\n');

    var banner = opts.showPreviewBanner
        ? '<div class="pe-preview-banner">Preview — Page Engine (draft/preview mode)</div>'
        : '';

    var pageStyle = stylesUtil.buildInlineStyles(page.settings, {
        background: settings.background,
        maxWidth: settings.maxWidth,
    });

    var body = banner +
        '<main class="pe-page" data-page-id="' + escapeUtil.escapeAttr(page.id) + '">' +
        '<div class="pe-page__inner"' + (pageStyle ? ' style="' + escapeUtil.escapeAttr(pageStyle) + '"' : '') + '>' +
        sectionsHtml +
        '</div></main>';

    var meta = buildMetaTags(page, opts.offerContext);
    var trackingScripts = buildTrackingScripts(opts.offerContext, opts.mode);

    return '<!DOCTYPE html>\n<html lang="pt-PT">\n<head>\n' + meta +
        '\n<style>' + basePageCss(settings) + '</style>\n</head>\n<body>\n' +
        body + '\n' + trackingScripts + '\n</body>\n</html>';
}

function renderPageBody(tree, options) {
    var doc = renderPageDocument(tree, options);
    var match = doc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return match ? match[1] : doc;
}

module.exports = {
    DEFAULT_PAGE_SETTINGS: DEFAULT_PAGE_SETTINGS,
    mergePageSettings: mergePageSettings,
    renderPageDocument: renderPageDocument,
    renderPageBody: renderPageBody,
};
