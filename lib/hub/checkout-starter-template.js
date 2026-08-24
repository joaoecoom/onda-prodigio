'use strict';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Default checkout chrome for new offers.
 * Core form (product header + dados + bumps + pagamento) lives in checkout/index.html.
 * Starter only adds light scarcity + testimonials below — vertical dark layout.
 */
function buildStarterTemplate(options) {
    var offerName = escapeHtml((options && options.offerName) || 'A tua oferta');
    var testimonialName = escapeHtml((options && options.testimonialName) || 'Cliente verificado');
    var testimonialQuote = escapeHtml(
        (options && options.testimonialQuote) ||
        'Processo simples e rápido. Recomendo — pagamento seguro e acesso imediato.'
    );

    var html_top =
        '<aside class="scarcity-bar" aria-live="polite" aria-label="Tempo restante da oferta">' +
            '<div class="scarcity-bar__inner">' +
                '<div class="scarcity-bar__timer" id="countdown-timer">' +
                    '<span class="scarcity-bar__segment" id="countdown-min">10</span>' +
                    '<span class="scarcity-bar__sep" aria-hidden="true">:</span>' +
                    '<span class="scarcity-bar__segment" id="countdown-sec">00</span>' +
                    '<span class="scarcity-bar__sep" aria-hidden="true">:</span>' +
                    '<span class="scarcity-bar__segment" id="countdown-cs">00</span>' +
                '</div>' +
                '<p class="scarcity-bar__text">Oferta por tempo limitado — garante o teu acesso a ' +
                    offerName + '</p>' +
            '</div>' +
        '</aside>';

    var html_bottom =
        '<section class="checkout-testimonials" aria-label="Testemunhos">' +
            '<article class="testimonial-card">' +
                '<p class="testimonial-card__name">' + testimonialName + ' — Portugal</p>' +
                '<div class="testimonial-card__stars" aria-label="5 em 5 estrelas">' +
                    '<span aria-hidden="true">★★★★★</span>' +
                '</div>' +
                '<blockquote class="testimonial-card__quote"><p>' + testimonialQuote + '</p></blockquote>' +
            '</article>' +
        '</section>';

    var custom_css = [
        'body.checkout-theme-dark{background:#0b0a12;color:#f8fafc;}',
        '#checkout-core{width:100%;max-width:100%;}',
        '#checkout-core .checkout-form-panel{width:100%;max-width:640px;margin:0 auto;}',
        '#checkout-title,#checkout-subtitle{display:none;}',
        '.checkout-testimonials{width:100%;max-width:640px;margin:24px auto 48px;padding:0 16px;}',
        '.testimonial-card{padding:20px;border-radius:14px;border:1px solid rgba(167,139,250,.28);background:rgba(15,12,28,.9);}',
        '.testimonial-card__name{margin:0 0 6px;font-weight:700;}',
        '.testimonial-card__stars{color:#fbbf24;margin-bottom:10px;}',
        '.testimonial-card__quote{margin:0;font-style:italic;opacity:.92;}',
        '.product-summary{display:flex;gap:16px;align-items:center;width:100%;}',
        '.product-summary__thumb{width:72px;height:72px;border-radius:12px;object-fit:cover;background:#1f1833;flex-shrink:0;}',
        '.order-bump{width:100%;}',
        '.order-bump__copy{min-width:0;}',
        '.order-bump__image--empty{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12);}',
    ].join('');

    return {
        html_top: html_top,
        html_bottom: html_bottom,
        custom_css: custom_css,
        settings: {
            title: '',
            subtitle: '',
            theme: 'dark',
        },
    };
}

module.exports = {
    buildStarterTemplate: buildStarterTemplate,
};
