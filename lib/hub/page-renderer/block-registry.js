var escapeUtil = require('./escape');
var stylesUtil = require('./styles');
var visibilityUtil = require('./visibility');

function wrapBlock(block, innerHtml, options) {
    var blockClass = 'pe-block pe-block--' + escapeUtil.escapeAttr(block.type);
    var visClass = visibilityUtil.visibilityClasses(block.visibility);
    var style = stylesUtil.buildInlineStyles(block.styles, (options && options.extraStyles) || {});

    return '<div class="' + blockClass + ' ' + visClass + '" data-block-id="' +
        escapeUtil.escapeAttr(block.id) + '" data-block-type="' +
        escapeUtil.escapeAttr(block.type) + '"' +
        (style ? ' style="' + escapeUtil.escapeAttr(style) + '"' : '') +
        '>' + innerHtml + '</div>';
}

function renderHeading(block, ctx) {
    var content = block.content || {};
    var settings = block.settings || {};
    var level = parseInt(settings.level || content.level || 1, 10);

    if (!Number.isFinite(level) || level < 1 || level > 6) {
        level = 1;
    }

    var tag = 'h' + level;
    var raw = String(content.text || '');
    var align = settings.alignment || content.alignment || 'left';
    var inner;

    if (/<[a-z][\s\S]*>/i.test(raw)) {
        var sanitized = escapeUtil.stripScriptTags(raw);
        inner = '<div class="pe-heading pe-heading--rich" style="text-align:' +
            escapeUtil.escapeAttr(align) + '">' + sanitized + '</div>';
    } else {
        var text = escapeUtil.escapeHtml(raw);
        inner = '<' + tag + ' class="pe-heading" style="text-align:' +
            escapeUtil.escapeAttr(align) + '">' + text + '</' + tag + '>';
    }

    return wrapBlock(block, inner, { extraStyles: { textAlign: align } });
}

function renderText(block) {
    var content = block.content || {};
    var settings = block.settings || {};
    var text = escapeUtil.escapeHtml(content.text || '').replace(/\n/g, '<br>');
    var align = settings.alignment || 'left';
    var inner = '<div class="pe-text" style="text-align:' + escapeUtil.escapeAttr(align) + '">' + text + '</div>';

    return wrapBlock(block, inner, { extraStyles: { textAlign: align } });
}

function renderImage(block) {
    var content = block.content || {};
    var settings = block.settings || {};
    var src = content.src || settings.src || '';

    if (!escapeUtil.isSafeUrl(src)) {
        return wrapBlock(block, '<div class="pe-placeholder">Image URL inválida</div>');
    }

    var alt = escapeUtil.escapeAttr(content.alt || settings.alt || '');
    var fit = escapeUtil.escapeAttr(settings.objectFit || 'cover');
    var align = settings.alignment || 'center';
    var width = settings.width || content.width || '100%';
    var height = settings.height || content.height || 'auto';

    var img = '<img class="pe-image" src="' + escapeUtil.escapeAttr(src) + '" alt="' + alt +
        '" style="width:' + escapeUtil.escapeAttr(String(width)) +
        ';height:' + escapeUtil.escapeAttr(String(height)) +
        ';object-fit:' + fit + ';display:block;margin:0 auto" loading="lazy">';

    var inner = '<div class="pe-image-wrap" style="text-align:' + escapeUtil.escapeAttr(align) + '">' + img + '</div>';
    return wrapBlock(block, inner);
}

function renderVideo(block) {
    var content = block.content || {};
    var settings = block.settings || {};
    var url = content.url || content.src || settings.url || '';

    if (!escapeUtil.isSafeUrl(url)) {
        return wrapBlock(block, '<div class="pe-placeholder">Video URL inválida</div>');
    }

    var poster = content.poster || settings.poster || '';
    var aspect = escapeUtil.escapeAttr(settings.aspectRatio || '16 / 9');
    var controls = settings.controls !== false;
    var autoplay = Boolean(settings.autoplay);
    var muted = Boolean(settings.muted);
    var attrs = ['class="pe-video"', 'src="' + escapeUtil.escapeAttr(url) + '"'];

    if (poster && escapeUtil.isSafeUrl(poster)) {
        attrs.push('poster="' + escapeUtil.escapeAttr(poster) + '"');
    }

    if (controls) {
        attrs.push('controls');
    }

    if (autoplay) {
        attrs.push('autoplay');
    }

    if (muted) {
        attrs.push('muted');
    }

    attrs.push('playsinline');

    var inner = '<div class="pe-video-wrap" style="aspect-ratio:' + aspect + '">' +
        '<video ' + attrs.join(' ') + '></video></div>';

    return wrapBlock(block, inner);
}

function renderButton(block, ctx) {
    var content = block.content || {};
    var settings = block.settings || {};
    var label = escapeUtil.escapeHtml(content.label || settings.label || 'Button');
    var action = settings.action || content.action || '';
    var href = '';

    if (action === 'checkout' && ctx.offer) {
        var offerSlug = ctx.offer.slug || ctx.offer.id || '';
        var productId = settings.product_id || content.product_id || ctx.offer.primary_product_id || offerSlug;
        var params = ['offer=' + encodeURIComponent(offerSlug), 'product_id=' + encodeURIComponent(productId)];

        if (ctx.funnel && ctx.funnel.slug) {
            params.push('funnel=' + encodeURIComponent(ctx.funnel.slug));
        }

        if (ctx.page && ctx.page.slug) {
            params.push('page=' + encodeURIComponent(ctx.page.slug));
        }

        href = '/checkout/?' + params.join('&');
    } else {
        href = escapeUtil.normalizeHref(content.href || settings.href || '#');
    }

    var target = escapeUtil.normalizeTarget(settings.target || content.target);
    var variant = escapeUtil.escapeAttr(settings.variant || content.variant || 'primary');
    var align = settings.alignment || content.alignment || 'center';
    var rel = target === '_blank' ? ' rel="noopener noreferrer"' : '';
    var inner = '<div class="pe-button-wrap" style="text-align:' + escapeUtil.escapeAttr(align) + '">' +
        '<a class="pe-button pe-button--' + variant + '" href="' + escapeUtil.escapeAttr(href) +
        '" target="' + escapeUtil.escapeAttr(target) + '"' + rel + '>' + label + '</a></div>';

    return wrapBlock(block, inner);
}

function renderSpacer(block) {
    var settings = block.settings || {};
    var content = block.content || {};
    var height = settings.height || content.height || '32px';
    var mobile = settings.mobileHeight || content.mobileHeight || height;
    var inner = '<div class="pe-spacer" style="height:' + escapeUtil.escapeAttr(String(height)) +
        '" data-mobile-height="' + escapeUtil.escapeAttr(String(mobile)) + '"></div>';

    return wrapBlock(block, inner);
}

function renderHtml(block, ctx) {
    var content = block.content || {};
    var raw = String(content.html || content.text || '');
    var sanitized = escapeUtil.stripScriptTags(raw);
    var inner = '<div class="pe-html-raw">' + sanitized + '</div>';

    return wrapBlock(block, inner);
}

function renderUnknown(block, ctx) {
    var mode = (ctx && ctx.mode) || 'preview';
    var type = escapeUtil.escapeHtml(block.type || 'unknown');

    if (mode === 'production') {
        return '<!-- unsupported block: ' + type + ' -->';
    }

    return wrapBlock(block, '<div class="pe-placeholder">Unsupported block: ' + type + '</div>');
}

var BLOCK_RENDERERS = {
    heading: renderHeading,
    text: renderText,
    image: renderImage,
    video: renderVideo,
    button: renderButton,
    spacer: renderSpacer,
    html: renderHtml,
};

function renderBlock(block, ctx) {
    var renderer = BLOCK_RENDERERS[block.type];

    if (!renderer) {
        return renderUnknown(block, ctx);
    }

    return renderer(block, ctx);
}

module.exports = {
    BLOCK_RENDERERS: BLOCK_RENDERERS,
    renderBlock: renderBlock,
    renderUnknown: renderUnknown,
};
