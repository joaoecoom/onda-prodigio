'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var offers = require('./offers');
var offerProvisioning = require('./offer-provisioning');
var orderBumps = require('./order-bumps');
var checkoutResolver = require('./checkout-resolver');
var checkoutStarter = require('./checkout-starter-template');

var DEFAULT_SETTINGS = {
    title: '',
    subtitle: '',
    theme: 'dark',
};

function normalizeSettings(input) {
    var base = Object.assign({}, DEFAULT_SETTINGS, input || {});

    return {
        title: String(base.title || '').trim(),
        subtitle: String(base.subtitle || '').trim(),
        theme: base.theme === 'light' ? 'light' : 'dark',
    };
}

function toPublicTemplate(row) {
    if (!row) {
        return {
            offer_id: '',
            html_top: '',
            html_bottom: '',
            custom_css: '',
            settings: Object.assign({}, DEFAULT_SETTINGS),
            has_custom: false,
            updated_at: null,
        };
    }

    return {
        offer_id: row.offer_id,
        html_top: row.html_top || '',
        html_bottom: row.html_bottom || '',
        custom_css: row.custom_css || '',
        settings: normalizeSettings(row.settings),
        has_custom: Boolean(row.html_top || row.html_bottom || row.custom_css),
        updated_at: row.updated_at || null,
    };
}

var LEGACY_CHECKOUT_ONLY = ['onda-prodigio'];

function isLegacyCheckoutOnly(slug) {
    return LEGACY_CHECKOUT_ONLY.indexOf(String(slug || '').trim()) !== -1;
}

async function ensureStarterTemplate(offerId, offerName, offerSlug) {
    if (!offerId || isLegacyCheckoutOnly(offerSlug)) {
        return toPublicTemplate(null);
    }

    var existing = await getTemplate(offerId);

    if (existing.has_custom) {
        return existing;
    }

    var starter = checkoutStarter.buildStarterTemplate({
        offerName: offerName || offerSlug || 'Checkout',
    });

    return saveTemplate(offerId, starter);
}

async function getTemplate(offerId, options) {
    var supabase = getSupabaseAdmin();

    if (!supabase || !offerId) {
        return toPublicTemplate(null);
    }

    var result = await supabase
        .from('hub_offer_checkout_templates')
        .select('*')
        .eq('offer_id', offerId)
        .maybeSingle();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível carregar template de checkout.');
    }

    var template = toPublicTemplate(result.data);

    if (!template.has_custom && options && options.autoSeed) {
        return ensureStarterTemplate(offerId, options.offerName, options.offerSlug);
    }

    return template;
}

async function saveTemplate(offerId, patch) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var existing = await getTemplate(offerId);
    var row = {
        offer_id: offerId,
        html_top: patch.html_top != null ? String(patch.html_top) : existing.html_top,
        html_bottom: patch.html_bottom != null ? String(patch.html_bottom) : existing.html_bottom,
        custom_css: patch.custom_css != null ? String(patch.custom_css) : existing.custom_css,
        settings: normalizeSettings(
            patch.settings ? Object.assign({}, existing.settings, patch.settings) : existing.settings
        ),
        updated_at: new Date().toISOString(),
    };

    var result = await supabase
        .from('hub_offer_checkout_templates')
        .upsert(row, { onConflict: 'offer_id' })
        .select('*')
        .single();

    if (result.error) {
        throw new Error(result.error.message || 'Não foi possível guardar template de checkout.');
    }

    return toPublicTemplate(result.data);
}

async function getCheckoutContext(offerId) {
    var offer = await offers.listOffers().then(function (list) {
        return list.find(function (row) {
            return row.id === offerId;
        }) || null;
    });

    if (!offer) {
        throw new Error('Oferta não encontrada.');
    }

    var template = await ensureStarterTemplate(offerId, offer.name, offer.slug);
    var bumps = await orderBumps.listOrderBumps(offerId, { activeOnly: false });
    var checkout = null;

    try {
        checkout = await checkoutResolver.resolveUniversalCheckout(offer, {
            checkoutId: 'main',
            mode: offer.mode === 'live' ? 'live' : 'test',
            productId: offer.primary_product_id,
        });
    } catch (error) {
        checkout = null;
    }

    return {
        offer: {
            id: offer.id,
            slug: offer.slug,
            name: offer.name,
            primary_product_id: offer.primary_product_id,
        },
        checkout: checkout,
        template: template,
        order_bumps: bumps,
        preview_url: '/checkout/?offer=' + encodeURIComponent(offer.slug) + '&mode=test',
        required_dom_ids: [
            'checkout-form',
            'payment-element',
            'submit-payment',
            'order-bump-list',
            'order-bumps-section',
            'checkout-title',
            'checkout-subtitle',
            'checkout-price',
        ],
    };
}

async function updateCheckoutPricing(offerId, patch) {
    return offerProvisioning.updateMainCheckout(offerId, {
        amount_cents: patch.amount_cents,
        currency: patch.currency,
        label: patch.label,
    });
}

module.exports = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    isLegacyCheckoutOnly: isLegacyCheckoutOnly,
    getTemplate: getTemplate,
    saveTemplate: saveTemplate,
    ensureStarterTemplate: ensureStarterTemplate,
    getCheckoutContext: getCheckoutContext,
    updateCheckoutPricing: updateCheckoutPricing,
};
