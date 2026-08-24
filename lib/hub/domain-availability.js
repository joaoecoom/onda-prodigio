'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var offerSettings = require('./offer-settings');

var DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function normalizeDomain(value) {
    return offerSettings.normalizeDomain(value);
}

function validateDomainFormat(domain) {
    var normalized = normalizeDomain(domain);

    if (!normalized) {
        return { valid: false, domain: '', reason: 'Domínio em falta.' };
    }

    if (normalized.indexOf('/') !== -1 || normalized.indexOf(' ') !== -1) {
        return { valid: false, domain: normalized, reason: 'Formato inválido — usa apenas hostname (ex.: fruta.vercel.app).' };
    }

    if (!DOMAIN_PATTERN.test(normalized)) {
        return { valid: false, domain: normalized, reason: 'Formato de domínio inválido.' };
    }

    return { valid: true, domain: normalized, reason: '' };
}

async function checkDomainAvailability(domain, options) {
    var format = validateDomainFormat(domain);
    var excludeOfferId = options && options.excludeOfferId;

    if (!format.valid) {
        return {
            domain: format.domain,
            available: false,
            valid: false,
            reason: format.reason,
        };
    }

    var supabase = getSupabaseAdmin();

    if (!supabase) {
        return {
            domain: format.domain,
            available: true,
            valid: true,
            reason: 'Validação de unicidade indisponível (sem DB).',
            unchecked: true,
        };
    }

    var offerQuery = supabase
        .from('hub_offers')
        .select('id, slug, name')
        .eq('funnel_domain', format.domain);

    if (excludeOfferId) {
        offerQuery = offerQuery.neq('id', excludeOfferId);
    }

    var domainQuery = supabase
        .from('hub_offer_domains')
        .select('offer_id, domain')
        .eq('domain', format.domain);

    var offerResult = await offerQuery;
    var domainResult = await domainQuery;

    if (offerResult.error) {
        throw new Error(offerResult.error.message || 'Não foi possível verificar domínio.');
    }

    if (domainResult.error) {
        throw new Error(domainResult.error.message || 'Não foi possível verificar domínio.');
    }

    var conflictOffer = (offerResult.data || [])[0];
    var conflictDomain = (domainResult.data || []).find(function (row) {
        return !excludeOfferId || row.offer_id !== excludeOfferId;
    });

    if (conflictOffer || conflictDomain) {
        var owner = conflictOffer || { id: conflictDomain.offer_id };

        return {
            domain: format.domain,
            available: false,
            valid: true,
            reason: 'Domínio já utilizado por outra oferta.',
            used_by: owner.id,
        };
    }

    return {
        domain: format.domain,
        available: true,
        valid: true,
        reason: 'Disponível',
    };
}

module.exports = {
    DOMAIN_PATTERN: DOMAIN_PATTERN,
    normalizeDomain: normalizeDomain,
    validateDomainFormat: validateDomainFormat,
    checkDomainAvailability: checkDomainAvailability,
};
