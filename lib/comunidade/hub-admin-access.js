'use strict';

var crypto = require('crypto');

var supabaseAdmin = require('../supabase-admin');
var offers = require('../hub/offers');
var hubConfig = require('../hub/config');

var HANDOFF_TTL_MS = 2 * 60 * 1000;

function resolveCommunityBaseUrl(offer) {
    if (!offer) {
        return '';
    }

    var base = String(offer.funnel_url || offer.site_url || '').replace(/\/$/, '');

    if (!base && offer.funnel_domain) {
        base = 'https://' + String(offer.funnel_domain).replace(/^https?:\/\//, '').replace(/\/$/, '');
    }

    return base;
}

function resolveCommunityUrl(offer) {
    var base = resolveCommunityBaseUrl(offer);

    if (!base) {
        return '/comunidade/';
    }

    return base + '/comunidade/';
}

function resolveCommunityEnterBaseUrl(offer) {
    return resolveCommunityBaseUrl(offer) || hubConfig.getHubBaseUrl() || '';
}

function createHandoffToken(sessionPayload) {
    var payload = Object.assign({}, sessionPayload, {
        exp: Date.now() + HANDOFF_TTL_MS,
        nonce: crypto.randomBytes(12).toString('hex'),
    });
    var encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    var signature = crypto
        .createHmac('sha256', getHandoffSecret())
        .update(encoded)
        .digest('base64url');

    return encoded + '.' + signature;
}

function consumeHandoffToken(handoffToken) {
    var raw = String(handoffToken || '').trim();

    if (!raw) {
        return null;
    }

    var parts = raw.split('.');

    if (parts.length !== 2) {
        return null;
    }

    var encoded = parts[0];
    var signature = parts[1];
    var expected = crypto
        .createHmac('sha256', getHandoffSecret())
        .update(encoded)
        .digest('base64url');

    if (signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return null;
    }

    var payload;

    try {
        payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch (error) {
        return null;
    }

    if (!payload || !payload.exp || Date.now() > payload.exp) {
        return null;
    }

    return payload;
}

function getHandoffSecret() {
    return String(
        process.env.HUB_HANDOFF_SECRET ||
        process.env.METRICS_DASHBOARD_PASSWORD ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        'onda-hub-handoff-dev'
    ).trim();
}

async function resolveCommunityAdminEmail(adminClient) {
    var envEmail = supabaseAdmin.normalizeEmail(process.env.COMMUNITY_ADMIN_EMAIL);

    if (envEmail) {
        return envEmail;
    }

    var result = await adminClient
        .from('admins')
        .select('email')
        .order('email', { ascending: true })
        .limit(1);

    if (result.error) {
        throw result.error;
    }

    if (!result.data || !result.data.length) {
        return null;
    }

    return supabaseAdmin.normalizeEmail(result.data[0].email);
}

async function ensureAuthUserForAdmin(adminClient, email) {
    var listResult = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 200,
    });

    if (listResult.error) {
        throw listResult.error;
    }

    var existing = (listResult.data.users || []).find(function (user) {
        return supabaseAdmin.normalizeEmail(user.email) === email;
    });

    if (existing) {
        return existing;
    }

    var created = await adminClient.auth.admin.createUser({
        email: email,
        email_confirm: true,
    });

    if (created.error) {
        throw created.error;
    }

    return created.data.user;
}

async function createCommunityAdminSession(options) {
    var adminClient = supabaseAdmin.getSupabaseAdmin();

    if (!adminClient) {
        throw new Error('Supabase não configurado.');
    }

    var offerSlug = offers.normalizeSlug(options && options.offerSlug) || 'onda-prodigio';
    var offer = await offers.getOfferBySlug(offerSlug, { forceRefresh: true });

    if (!offer) {
        throw new Error('Oferta não encontrada.');
    }

    var email = await resolveCommunityAdminEmail(adminClient);

    if (!email) {
        throw new Error('Nenhum administrador da comunidade configurado.');
    }

    var adminProfile = await adminClient
        .from('admins')
        .select('email, name')
        .eq('email', email)
        .maybeSingle();

    if (adminProfile.error) {
        throw adminProfile.error;
    }

    if (!adminProfile.data) {
        throw new Error('Administrador da comunidade não encontrado.');
    }

    await ensureAuthUserForAdmin(adminClient, email);

    var linkResult = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
    });

    if (linkResult.error || !linkResult.data || !linkResult.data.properties) {
        throw new Error(
            (linkResult.error && linkResult.error.message) ||
            'Não foi possível gerar sessão de administrador.'
        );
    }

    var verifyResult = await adminClient.auth.verifyOtp({
        type: 'email',
        token_hash: linkResult.data.properties.hashed_token,
    });

    if (verifyResult.error || !verifyResult.data || !verifyResult.data.session) {
        throw new Error(
            (verifyResult.error && verifyResult.error.message) ||
            'Não foi possível iniciar sessão de administrador.'
        );
    }

    var session = verifyResult.data.session;
    var communityUrl = resolveCommunityUrl(offer);
    var enterBase = resolveCommunityEnterBaseUrl(offer).replace(/\/$/, '');
    var handoffId = createHandoffToken({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        community_url: communityUrl,
        offer_slug: offer.slug,
    });
    var enterUrl = enterBase + '/comunidade/hub-enter?handoff=' + encodeURIComponent(handoffId) +
        '&offer=' + encodeURIComponent(offer.slug);

    return {
        email: email,
        name: adminProfile.data.name || '',
        role: 'admin',
        offer_slug: offer.slug,
        offer_domain: offer.funnel_domain || '',
        community_url: communityUrl,
        enter_url: enterUrl,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
    };
}

module.exports = {
    HANDOFF_TTL_MS: HANDOFF_TTL_MS,
    resolveCommunityBaseUrl: resolveCommunityBaseUrl,
    resolveCommunityUrl: resolveCommunityUrl,
    resolveCommunityEnterBaseUrl: resolveCommunityEnterBaseUrl,
    createHandoffToken: createHandoffToken,
    consumeHandoffToken: consumeHandoffToken,
    resolveCommunityAdminEmail: resolveCommunityAdminEmail,
    createCommunityAdminSession: createCommunityAdminSession,
};
