'use strict';

/**
 * Default Page Engine tree for checkout pages.
 * Vertical dark layout: scarcity → product/form/bumps/pay → testimonials.
 * Core Stripe form still lives at /checkout/; this is the editable starting canvas.
 */

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildCheckoutDefaultSections(options) {
    var offerName = escapeHtml((options && options.offerName) || 'A tua oferta');
    var priceLabel = escapeHtml((options && options.priceLabel) || '€10,00');
    var testimonialName = escapeHtml((options && options.testimonialName) || 'Cliente verificado');
    var testimonialQuote = escapeHtml(
        (options && options.testimonialQuote) ||
        'Processo simples e rápido. Recomendo — pagamento seguro e acesso imediato.'
    );

    var scarcityHtml =
        '<aside class="ck-seed-scarcity" aria-label="Tempo restante da oferta">' +
            '<div class="ck-seed-scarcity__inner">' +
                '<div class="ck-seed-scarcity__timer" aria-hidden="true">' +
                    '<span>10</span><span>:</span><span>00</span><span>:</span><span>00</span>' +
                '</div>' +
                '<p class="ck-seed-scarcity__text">Oferta por tempo limitado — garante o teu acesso a ' +
                    offerName + '</p>' +
            '</div>' +
        '</aside>';

    var coreHtml =
        '<div class="ck-seed-core">' +
            '<div class="ck-seed-panel">' +
                '<div class="ck-seed-product">' +
                    '<div class="ck-seed-product__thumb" aria-hidden="true"></div>' +
                    '<div class="ck-seed-product__info">' +
                        '<p class="ck-seed-product__title">' + offerName + '</p>' +
                        '<p class="ck-seed-product__price">' + priceLabel + '</p>' +
                        '<p class="ck-seed-product__vat">IVA incluído</p>' +
                    '</div>' +
                '</div>' +
                '<h2 class="ck-seed-title">Dados pessoais</h2>' +
                '<div class="ck-seed-field"><label>Nome completo</label><div class="ck-seed-input"></div></div>' +
                '<div class="ck-seed-field"><label>Email</label><div class="ck-seed-input"></div></div>' +
                '<div class="ck-seed-field"><label>Telemóvel</label><div class="ck-seed-input"></div></div>' +
                '<hr class="ck-seed-divider">' +
                '<h2 class="ck-seed-title">Comprar junto</h2>' +
                '<div class="ck-seed-bump">' +
                    '<div class="ck-seed-bump__img" aria-hidden="true"></div>' +
                    '<div class="ck-seed-bump__copy">' +
                        '<strong>Bump 1</strong>' +
                        '<p>Complemento opcional — personaliza este bloco.</p>' +
                        '<span class="ck-seed-bump__price">+ €2,00</span>' +
                    '</div>' +
                '</div>' +
                '<div class="ck-seed-bump">' +
                    '<div class="ck-seed-bump__img" aria-hidden="true"></div>' +
                    '<div class="ck-seed-bump__copy">' +
                        '<strong>Bump 2</strong>' +
                        '<p>Segundo complemento — edita texto e preço.</p>' +
                        '<span class="ck-seed-bump__price">+ €2,00</span>' +
                    '</div>' +
                '</div>' +
                '<hr class="ck-seed-divider">' +
                '<h2 class="ck-seed-title">Detalhes da compra</h2>' +
                '<div class="ck-seed-summary">' +
                    '<div class="ck-seed-summary__row"><span>' + offerName + '</span><span>' +
                        priceLabel + '</span></div>' +
                    '<div class="ck-seed-summary__row ck-seed-summary__row--total">' +
                        '<span>Total a pagar</span><span>' + priceLabel + '</span></div>' +
                '</div>' +
                '<hr class="ck-seed-divider">' +
                '<h2 class="ck-seed-title">Selecionar método de pagamento</h2>' +
                '<p class="ck-seed-hint">No checkout real, o Stripe Payment Element aparece aqui.</p>' +
                '<div class="ck-seed-paybox" aria-hidden="true">Cartão · MB WAY · Multibanco</div>' +
                '<div class="ck-seed-cta">Pagar agora</div>' +
                '<p class="ck-seed-secure">Pagamento processado de forma segura pela Stripe.</p>' +
            '</div>' +
        '</div>';

    var testimonialsHtml =
        '<section class="ck-seed-testimonials" aria-label="Testemunhos">' +
            '<article class="ck-seed-testimonial">' +
                '<p class="ck-seed-testimonial__name">' + testimonialName + ' — Portugal</p>' +
                '<div class="ck-seed-testimonial__stars" aria-label="5 em 5">★★★★★</div>' +
                '<blockquote><p>' + testimonialQuote + '</p></blockquote>' +
            '</article>' +
        '</section>';

    var stylesHtml =
        '<style>' +
        '.ck-seed-scarcity{background:linear-gradient(90deg,#1a1030,#2a1848);color:#f8fafc;padding:12px 16px;}' +
        '.ck-seed-scarcity__inner{max-width:640px;margin:0 auto;display:flex;gap:16px;align-items:center;justify-content:center;flex-wrap:wrap;}' +
        '.ck-seed-scarcity__timer{font-weight:800;letter-spacing:.04em;font-variant-numeric:tabular-nums;}' +
        '.ck-seed-scarcity__text{margin:0;font-size:14px;opacity:.92;text-align:center;}' +
        '.ck-seed-core{background:#0b0a12;color:#f8fafc;padding:28px 16px 8px;}' +
        '.ck-seed-panel{max-width:640px;margin:0 auto;}' +
        '.ck-seed-product{display:flex;gap:16px;align-items:center;margin-bottom:24px;}' +
        '.ck-seed-product__thumb{width:72px;height:72px;border-radius:12px;background:#1f1833;flex-shrink:0;}' +
        '.ck-seed-product__title{margin:0 0 4px;font-weight:700;font-size:18px;}' +
        '.ck-seed-product__price{margin:0;font-size:22px;font-weight:800;}' +
        '.ck-seed-product__vat{margin:4px 0 0;font-size:12px;opacity:.7;}' +
        '.ck-seed-title{margin:0 0 12px;font-size:16px;}' +
        '.ck-seed-field{margin-bottom:12px;}' +
        '.ck-seed-field label{display:block;font-size:13px;margin-bottom:6px;opacity:.85;}' +
        '.ck-seed-input{height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);}' +
        '.ck-seed-divider{border:0;border-top:1px solid rgba(255,255,255,.1);margin:20px 0;}' +
        '.ck-seed-bump{display:flex;gap:14px;align-items:flex-start;padding:14px;margin-bottom:10px;border-radius:12px;border:1px solid rgba(167,139,250,.28);background:rgba(15,12,28,.9);}' +
        '.ck-seed-bump__img{width:64px;height:64px;border-radius:10px;background:rgba(255,255,255,.06);flex-shrink:0;}' +
        '.ck-seed-bump__copy{min-width:0;}' +
        '.ck-seed-bump__copy p{margin:4px 0 6px;font-size:13px;opacity:.85;}' +
        '.ck-seed-bump__price{font-weight:700;color:#c4b5fd;}' +
        '.ck-seed-summary{border-radius:12px;border:1px solid rgba(255,255,255,.1);padding:12px 14px;}' +
        '.ck-seed-summary__row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:14px;}' +
        '.ck-seed-summary__row--total{font-weight:800;border-top:1px solid rgba(255,255,255,.1);margin-top:6px;padding-top:12px;}' +
        '.ck-seed-hint{font-size:13px;opacity:.75;margin:0 0 12px;}' +
        '.ck-seed-paybox{min-height:72px;border-radius:12px;border:1px dashed rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;opacity:.7;margin-bottom:14px;}' +
        '.ck-seed-cta{display:flex;align-items:center;justify-content:center;height:48px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#5b21b6);font-weight:700;}' +
        '.ck-seed-secure{text-align:center;font-size:12px;opacity:.7;margin:12px 0 0;}' +
        '.ck-seed-testimonials{background:#0b0a12;color:#f8fafc;padding:8px 16px 48px;}' +
        '.ck-seed-testimonial{max-width:640px;margin:0 auto;padding:20px;border-radius:14px;border:1px solid rgba(167,139,250,.28);background:rgba(15,12,28,.9);}' +
        '.ck-seed-testimonial__name{margin:0 0 6px;font-weight:700;}' +
        '.ck-seed-testimonial__stars{color:#fbbf24;margin-bottom:10px;}' +
        '.ck-seed-testimonial blockquote{margin:0;font-style:italic;opacity:.92;}' +
        '</style>';

    return [
        {
            type: 'checkout_scarcity',
            settings: { label: 'Escassez' },
            styles: {},
            blocks: [
                {
                    type: 'html',
                    content: { html: stylesHtml + scarcityHtml },
                    settings: {},
                    styles: {},
                },
            ],
        },
        {
            type: 'checkout_core',
            settings: { label: 'Checkout (produto → form → bumps → pagamento)' },
            styles: {},
            blocks: [
                {
                    type: 'html',
                    content: { html: coreHtml },
                    settings: {},
                    styles: {},
                },
            ],
        },
        {
            type: 'checkout_testimonials',
            settings: { label: 'Testemunhos' },
            styles: {},
            blocks: [
                {
                    type: 'html',
                    content: { html: testimonialsHtml },
                    settings: {},
                    styles: {},
                },
            ],
        },
    ];
}

module.exports = {
    buildCheckoutDefaultSections: buildCheckoutDefaultSections,
    TEMPLATE_ID: 'checkout-default',
};
