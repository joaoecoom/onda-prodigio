'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var hubConfig = require('./config');
var offers = require('./offers');

function normalizeDomain(value) {
    return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

async function syncFunnelDomain(offerId, funnelDomain) {
    var supabase = getSupabaseAdmin();

    if (!supabase || !funnelDomain) {
        return;
    }

    var existing = await supabase
        .from('hub_offer_domains')
        .select('id, domain, domain_type, is_primary')
        .eq('offer_id', offerId)
        .eq('domain_type', 'funnel');

    if (existing.error) {
        throw new Error(existing.error.message || 'Não foi possível actualizar domínios.');
    }

    var rows = existing.data || [];
    var primary = rows.find(function (row) {
        return row.is_primary;
    }) || rows[0];

    if (primary) {
        var updateResult = await supabase
            .from('hub_offer_domains')
            .update({
                domain: funnelDomain,
                is_primary: true,
            })
            .eq('id', primary.id);

        if (updateResult.error) {
            throw updateResult.error;
        }

        return;
    }

    var insertResult = await supabase.from('hub_offer_domains').insert({
        offer_id: offerId,
        domain: funnelDomain,
        domain_type: 'funnel',
        is_primary: true,
    });

    if (insertResult.error) {
        throw insertResult.error;
    }
}

async function updateOfferSettings(slug, patch) {
    var normalizedSlug = offers.normalizeSlug(slug);

    if (!normalizedSlug) {
        throw new Error('Oferta inválida.');
    }

    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var offer = await offers.getOfferBySlug(normalizedSlug);

    if (!offer) {
        throw new Error('Oferta não encontrada.');
    }

    var updates = {};
    var branding = Object.assign({}, offer.branding || {});

    if (patch.name != null) {
        var name = String(patch.name).trim();

        if (!name) {
            throw new Error('Nome da oferta em falta.');
        }

        updates.name = name;
    }

    if (patch.status != null) {
        var status = String(patch.status).trim();

        if (status !== 'active' && status !== 'draft') {
            throw new Error('Estado inválido.');
        }

        updates.status = status;
    }

    if (patch.mode != null) {
        var mode = String(patch.mode).trim();

        if (mode !== 'live' && mode !== 'test') {
            throw new Error('Modo inválido.');
        }

        updates.mode = mode;
    }

    if (patch.primary_product_id != null) {
        updates.primary_product_id = String(patch.primary_product_id).trim() || null;
    }

    if (patch.branding && typeof patch.branding === 'object') {
        if (patch.branding.from_name != null) {
            branding.from_name = String(patch.branding.from_name).trim();
        }

        if (patch.branding.accent != null) {
            branding.accent = String(patch.branding.accent).trim() || '#7c6cff';
        }

        updates.branding = branding;
    }

    if (patch.funnel_domain != null) {
        var funnelDomain = normalizeDomain(patch.funnel_domain);
        var funnelUrl = funnelDomain ? 'https://' + funnelDomain : '';

        updates.funnel_domain = funnelDomain;
        updates.funnel_url = funnelUrl;
        updates.site_url = funnelUrl || offer.site_url || '';
    }

    if (!Object.keys(updates).length) {
        throw new Error('Nada para guardar.');
    }

    updates.updated_at = new Date().toISOString();

    var updateResult = await supabase
        .from('hub_offers')
        .update(updates)
        .eq('id', offer.id)
        .select('*')
        .single();

    if (updateResult.error || !updateResult.data) {
        throw new Error((updateResult.error && updateResult.error.message) || 'Não foi possível guardar.');
    }

    if (updates.funnel_domain) {
        await syncFunnelDomain(offer.id, updates.funnel_domain);
    }

    await supabase.from('hub_event_log').insert({
        offer_id: offer.id,
        event_type: 'offer_settings_updated',
        source: 'hub',
        payload: {
            fields: Object.keys(updates),
        },
    });

    offers.clearOffersCache();

    return updateResult.data;
}

module.exports = {
    normalizeDomain: normalizeDomain,
    updateOfferSettings: updateOfferSettings,
};
