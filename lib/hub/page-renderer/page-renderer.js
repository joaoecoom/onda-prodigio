var sectionRenderer = require('./section-renderer');
var stylesUtil = require('./styles');
var visibilityUtil = require('./visibility');
var escapeUtil = require('./escape');

var DEFAULT_PAGE_SETTINGS = {
    maxWidth: '100%',
    background: '#ffffff',
    spacing: '0',
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
        'html,body{margin:0;padding:0;width:100%;min-height:100%}',
        'body{font-family:' + cfg.fontFamily + ';color:' + cfg.color + ';background:' + cfg.background + '}',
        '.pe-page{min-height:100vh;width:100%;max-width:100%}',
        '.pe-page__inner{width:100%;max-width:none;margin:0;padding:0}',
        '.pe-section{width:100%;max-width:100%;padding:0;margin:0}',
        '.pe-section__inner{max-width:100%;margin:0;padding:0;width:100%;display:flex;flex-direction:column;gap:0}',
        '.pe-block{width:100%;max-width:100%}',
        '.pe-heading{margin:0;line-height:1.2}',
        '.pe-text{line-height:1.6;font-size:1rem}',
        '.pe-button{display:inline-block;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600}',
        '.pe-button--primary{background:#6366f1;color:#fff}',
        '.pe-button--secondary{background:#e5e7eb;color:#111827}',
        '.pe-placeholder{padding:12px;border:1px dashed #cbd5e1;color:#64748b;background:#f8fafc;border-radius:8px}',
        '.pe-html-raw{width:100%;max-width:100%;text-align:left}',
        '.pe-html-raw > *{max-width:100%;width:100%;box-sizing:border-box}',
        '.pe-html-raw img{max-width:100%;height:auto}',
        '.pe-html-raw iframe{max-width:100%;width:100%}',
        '.pe-html-raw video{max-width:100%;width:100%}',
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

    // Background goes on .pe-page (full viewport). NEVER put max-width on
    // .pe-page__inner — that was clipping section backgrounds mid-page.
    var pageStyle = stylesUtil.buildInlineStyles({
        background: settings.background,
    });

    var body = banner +
        '<main class="pe-page" data-page-id="' + escapeUtil.escapeAttr(page.id) + '"' +
        (pageStyle ? ' style="' + escapeUtil.escapeAttr(pageStyle) + '"' : '') + '>' +
        '<div class="pe-page__inner">' +
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
