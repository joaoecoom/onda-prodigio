'use strict';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildStarterTemplate(options) {
    var offerName = escapeHtml((options && options.offerName) || 'A tua oferta');
    var headline = escapeHtml((options && options.headline) || 'Garante o teu acesso agora');
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
                '<div class="scarcity-bar__icon" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                        '<path d="M4 13c0-4.4 3.6-8 8-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
                        '<path d="M4 10V13H7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
                        '<circle cx="12" cy="13" r="7.5" stroke="currentColor" stroke-width="1.8"/>' +
                        '<path d="M12 9v4.5l2.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '</svg>' +
                '</div>' +
                '<p class="scarcity-bar__text">Oferta por tempo limitado — ' + headline + '</p>' +
            '</div>' +
        '</aside>' +
        '<main class="checkout-hero">' +
            '<div class="checkout-hero__grid">' +
                '<section class="offer-banner" aria-label="Resumo da oferta">' +
                    '<div class="offer-banner__placeholder">' +
                        '<p class="offer-banner__title">' + offerName + '</p>' +
                        '<p class="offer-banner__sub">Compra 100% segura · Pagamento único</p>' +
                    '</div>' +
                '</section>' +
                '<aside class="testimonial-card" aria-label="Testemunho">' +
                    '<p class="testimonial-card__name">' + testimonialName + ' — Portugal</p>' +
                    '<div class="testimonial-card__stars" aria-label="5 em 5 estrelas">' +
                        '<span aria-hidden="true">★★★★★</span>' +
                    '</div>' +
                    '<blockquote class="testimonial-card__quote"><p>' + testimonialQuote + '</p></blockquote>' +
                '</aside>' +
            '</div>' +
        '</main>';

    var html_bottom = '';

    var custom_css =
        '.offer-banner__placeholder {' +
            'display:flex;flex-direction:column;justify-content:center;align-items:center;' +
            'min-height:220px;padding:32px 24px;border-radius:16px;' +
            'background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%);' +
            'border:1px solid rgba(139,92,246,.35);text-align:center;' +
        '}' +
        '.offer-banner__title{font-size:1.75rem;font-weight:800;margin:0 0 8px;color:#fff;}' +
        '.offer-banner__sub{margin:0;color:rgba(255,255,255,.75);font-size:.95rem;}' +
        'body.checkout-theme-dark{background:#0b0a12;color:#f8fafc;}' +
        '#checkout-core .checkout-form-panel{max-width:640px;margin:0 auto;}' +
        '#checkout-title,#checkout-subtitle{display:none;}';

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
