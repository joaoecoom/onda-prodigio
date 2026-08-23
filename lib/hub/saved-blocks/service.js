'use strict';

var { getSupabaseAdmin } = require('../../supabase-admin');
var funnelEngine = require('../funnel-engine');
var save = require('../page-builder/save');
var checkoutBuilder = require('../checkout-builder');
var orderBumps = require('../order-bumps');
var offerProvisioning = require('../offer-provisioning');

var ALLOWED_KINDS = ['section', 'block', 'script', 'popup', 'page', 'checkout'];

function nowIso() {
    return new Date().toISOString();
}

function getClient() {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    return supabase;
}

function dbError(result, message) {
    throw new Error((result.error && result.error.message) || message);
}

function normalizeKind(value) {
    var kind = String(value || 'section').trim().toLowerCase();

    if (ALLOWED_KINDS.indexOf(kind) === -1) {
        throw Object.assign(new Error('Tipo de bloco inválido.'), { code: 'VALIDATION_ERROR' });
    }

    return kind;
}

function stripBlockPayload(block) {
    return {
        type: block.type,
        sort_order: block.sort_order,
        content: block.content || {},
        settings: block.settings || {},
        styles: block.styles || {},
        visibility: block.visibility || { desktop: true, tablet: true, mobile: true },
    };
}

function stripSectionPayload(section) {
    return {
        type: section.type,
        sort_order: section.sort_order,
        settings: section.settings || {},
        styles: section.styles || {},
        visibility: section.visibility || { desktop: true, tablet: true, mobile: true },
        blocks: (section.blocks || []).map(stripBlockPayload),
    };
}

function stripPagePayload(tree) {
    var page = (tree && tree.page) || {};
    var sections = (tree && tree.sections) || [];

    return {
        page_type: page.type || 'sales',
        settings: page.settings || {},
        seo: page.seo || {},
        sections: sections.map(stripSectionPayload),
    };
}

function stripCheckoutPayload(context) {
    var template = (context && context.template) || {};
    var checkout = (context && context.checkout) || {};
    var bumps = (context && context.order_bumps) || [];

    return {
        html_top: template.html_top || '',
        html_bottom: template.html_bottom || '',
        custom_css: template.custom_css || '',
        settings: template.settings || {},
        amount_cents: checkout.amount_cents != null ? checkout.amount_cents : null,
        currency: checkout.currency || 'eur',
        label: checkout.label || '',
        order_bumps: bumps.map(function (bump) {
            return {
                bump_id: bump.bump_id,
                product_id: bump.product_id,
                label: bump.label,
                amount_cents: bump.amount_cents,
                sort_order: bump.sort_order,
                is_active: bump.is_active !== false,
            };
        }),
    };
}

function buildPayloadFromInput(input) {
    if (input.payload && typeof input.payload === 'object') {
        return input.payload;
    }

    if (input.page || input.tree) {
        return stripPagePayload(input.page || input.tree);
    }

    if (input.checkout) {
        return stripCheckoutPayload(input.checkout);
    }

    if (input.section) {
        return {
            section: stripSectionPayload(input.section),
        };
    }

    if (input.block) {
        return {
            block: stripBlockPayload(input.block),
        };
    }

    if (input.script != null) {
        return {
            script: String(input.script),
        };
    }

    throw Object.assign(new Error('Payload do bloco em falta.'), { code: 'VALIDATION_ERROR' });
}

async function listSavedBlocks(offerId, options) {
    var opts = options || {};
    var supabase = getClient();
    var query = supabase
        .from('hub_saved_blocks')
        .select('*')
        .order('updated_at', { ascending: false });

    if (opts.kind) {
        query = query.eq('kind', normalizeKind(opts.kind));
    }

    if (opts.scope === 'global') {
        query = query.is('offer_id', null);
    } else if (opts.scope === 'offer') {
        query = query.eq('offer_id', offerId);
    } else {
        query = query.or('offer_id.is.null,offer_id.eq.' + offerId);
    }

    var result = await query;

    if (result.error) {
        dbError(result, 'Não foi possível listar blocos guardados.');
    }

    return result.data || [];
}

async function getSavedBlock(blockId) {
    var supabase = getClient();
    var result = await supabase
        .from('hub_saved_blocks')
        .select('*')
        .eq('id', blockId)
        .maybeSingle();

    if (result.error) {
        dbError(result, 'Não foi possível carregar bloco guardado.');
    }

    return result.data || null;
}

function assertBlockAccess(savedBlock, offerId) {
    if (!savedBlock) {
        throw Object.assign(new Error('Bloco guardado não encontrado.'), { code: 'NOT_FOUND' });
    }

    if (savedBlock.offer_id && savedBlock.offer_id !== offerId) {
        throw Object.assign(new Error('Bloco guardado não pertence a esta oferta.'), { code: 'FORBIDDEN' });
    }
}

async function saveSavedBlock(offerId, input) {
    var name = String(input.name || '').trim();

    if (!name) {
        throw Object.assign(new Error('Nome do bloco em falta.'), { code: 'VALIDATION_ERROR' });
    }

    var kind = normalizeKind(input.kind);
    var payload = buildPayloadFromInput(input);
    var isGlobal = Boolean(input.global || input.is_global);
    var tags = Array.isArray(input.tags)
        ? input.tags.map(function (tag) { return String(tag).trim(); }).filter(Boolean)
        : [];

    var row = {
        offer_id: isGlobal ? null : offerId,
        name: name,
        kind: kind,
        tags: tags,
        payload: payload,
        preview_note: String(input.preview_note || '').trim(),
        updated_at: nowIso(),
    };

    var supabase = getClient();
    var result = await supabase.from('hub_saved_blocks').insert(row).select('*').single();

    if (result.error || !result.data) {
        dbError(result, 'Não foi possível guardar bloco.');
    }

    return result.data;
}

async function savePageFromIds(offerId, pageId, input) {
    var tree = await funnelEngine.getPageTree(offerId, pageId);
    var pageType = (tree.page && tree.page.type) || 'sales';
    var defaultName = (tree.page && tree.page.name) || 'Página';

    return saveSavedBlock(offerId, {
        name: String((input && input.name) || defaultName).trim(),
        kind: 'page',
        global: input && input.global,
        tags: (input && input.tags) || [pageType],
        preview_note: (input && input.preview_note) || ('Tipo: ' + pageType),
        payload: stripPagePayload(tree),
    });
}

async function saveCheckoutFromOffer(offerId, input) {
    var context = await checkoutBuilder.getCheckoutContext(offerId);
    var defaultName = (context.offer && context.offer.name)
        ? ('Checkout — ' + context.offer.name)
        : 'Checkout';

    return saveSavedBlock(offerId, {
        name: String((input && input.name) || defaultName).trim(),
        kind: 'checkout',
        global: input && input.global,
        tags: (input && input.tags) || ['checkout'],
        preview_note: (input && input.preview_note) || 'Layout + bumps + preço',
        payload: stripCheckoutPayload(context),
    });
}

async function deleteSavedBlock(offerId, blockId) {
    var savedBlock = await getSavedBlock(blockId);
    assertBlockAccess(savedBlock, offerId);

    var supabase = getClient();
    var query = supabase.from('hub_saved_blocks').delete().eq('id', blockId);

    if (savedBlock.offer_id) {
        query = query.eq('offer_id', offerId);
    } else {
        query = query.is('offer_id', null);
    }

    var result = await query;

    if (result.error) {
        dbError(result, 'Não foi possível eliminar bloco.');
    }

    return { deleted: true, id: blockId };
}

async function insertBlockAsSection(offerId, pageId, blockData, sectionLabel) {
    var stripped = stripBlockPayload(blockData);

    await save.applyMutations(offerId, pageId, [{
        op: 'create_section',
        client_id: 'tmp_block_' + Date.now(),
        data: {
            type: 'custom',
            sort_order: 500,
            settings: { label: sectionLabel || stripped.type || 'Bloco' },
            styles: {},
            visibility: { desktop: true, tablet: true, mobile: true },
        },
        blocks: [{
            client_id: 'tmp_block_inner',
            data: stripped,
        }],
    }]);
}

async function applyPagePayload(offerId, pageId, payload) {
    var sections = (payload && payload.sections) || [];
    var tree = await funnelEngine.getPageTree(offerId, pageId);
    var mutations = [];

    (tree.sections || []).forEach(function (section) {
        mutations.push({ op: 'delete_section', section_id: section.id });
    });

    sections.forEach(function (section, index) {
        var stripped = stripSectionPayload(section);
        var blocks = stripped.blocks || [];

        mutations.push({
            op: 'create_section',
            client_id: 'tmp_page_s_' + index,
            data: {
                type: stripped.type || 'custom',
                sort_order: stripped.sort_order != null ? stripped.sort_order : (index + 1) * 100,
                settings: stripped.settings,
                styles: stripped.styles,
                visibility: stripped.visibility,
            },
            blocks: blocks.map(function (block, blockIndex) {
                return {
                    client_id: 'tmp_page_b_' + index + '_' + blockIndex,
                    data: stripBlockPayload(block),
                };
            }),
        });
    });

    if (payload && (payload.settings || payload.seo)) {
        var pagePatch = {};
        if (payload.settings) {
            pagePatch.settings = payload.settings;
        }
        if (payload.seo) {
            pagePatch.seo = payload.seo;
        }
        await funnelEngine.updatePage(offerId, pageId, pagePatch);
    }

    await save.applyMutations(offerId, pageId, mutations);
    return funnelEngine.getPageTree(offerId, pageId);
}

async function applyCheckoutPayload(offerId, payload) {
    var data = payload || {};
    var template = await checkoutBuilder.saveTemplate(offerId, {
        html_top: data.html_top || '',
        html_bottom: data.html_bottom || '',
        custom_css: data.custom_css || '',
        settings: data.settings || {},
    });

    var bumpsApplied = 0;
    var bumpsSkipped = 0;
    var bumps = Array.isArray(data.order_bumps) ? data.order_bumps : [];

    for (var i = 0; i < bumps.length; i += 1) {
        try {
            await orderBumps.upsertOrderBump(offerId, bumps[i]);
            bumpsApplied += 1;
        } catch (error) {
            bumpsSkipped += 1;
        }
    }

    var pricing = null;

    if (data.amount_cents != null) {
        try {
            pricing = await offerProvisioning.updateMainCheckout(offerId, {
                amount_cents: data.amount_cents,
                currency: data.currency,
                label: data.label,
            });
        } catch (error) {
            pricing = null;
        }
    }

    return {
        template: template,
        bumps_applied: bumpsApplied,
        bumps_skipped: bumpsSkipped,
        pricing: pricing,
    };
}

async function applySavedBlock(offerId, pageId, blockId, options) {
    var opts = options || {};
    var savedBlock = await getSavedBlock(blockId);
    assertBlockAccess(savedBlock, offerId);

    var payload = savedBlock.payload || {};
    var kind = savedBlock.kind;

    if (kind === 'checkout' || opts.target === 'checkout') {
        if (kind !== 'checkout') {
            throw Object.assign(new Error('Este item não é um checkout gravado.'), { code: 'VALIDATION_ERROR' });
        }

        var checkoutResult = await applyCheckoutPayload(offerId, payload);
        return {
            kind: 'checkout',
            saved_block: savedBlock,
            result: checkoutResult,
        };
    }

    if (kind === 'page') {
        if (!pageId) {
            throw Object.assign(new Error('page_id em falta para aplicar página.'), { code: 'VALIDATION_ERROR' });
        }

        var tree = await applyPagePayload(offerId, pageId, payload);
        return {
            kind: 'page',
            saved_block: savedBlock,
            tree: tree,
        };
    }

    if (!pageId) {
        throw Object.assign(new Error('page_id em falta.'), { code: 'VALIDATION_ERROR' });
    }

    if (kind === 'script') {
        var scriptText = String(payload.script || payload.content || '').trim();

        if (!scriptText) {
            throw Object.assign(new Error('Script vazio.'), { code: 'VALIDATION_ERROR' });
        }

        await insertBlockAsSection(offerId, pageId, {
            type: 'html',
            sort_order: 100,
            content: { html: scriptText },
        }, savedBlock.name || 'Script');

        return funnelEngine.getPageTree(offerId, pageId);
    }

    if (kind === 'block') {
        var blockSource = payload.block || payload;

        if (!blockSource || !blockSource.type) {
            throw Object.assign(new Error('Payload de bloco inválido.'), { code: 'VALIDATION_ERROR' });
        }

        await insertBlockAsSection(offerId, pageId, blockSource, savedBlock.name);

        return funnelEngine.getPageTree(offerId, pageId);
    }

    var sectionSource = payload.section || payload;

    if (!sectionSource || !sectionSource.type) {
        throw Object.assign(new Error('Payload de secção inválido.'), { code: 'VALIDATION_ERROR' });
    }

    var stripped = stripSectionPayload(sectionSource);
    var blocks = stripped.blocks || [];

    await save.applyMutations(offerId, pageId, [{
        op: 'create_section',
        client_id: 'tmp_saved_' + Date.now(),
        data: {
            type: stripped.type,
            sort_order: stripped.sort_order || 500,
            settings: stripped.settings,
            styles: stripped.styles,
            visibility: stripped.visibility,
        },
        blocks: blocks.map(function (block, index) {
            return {
                client_id: 'tmp_saved_b_' + index,
                data: stripBlockPayload(block),
            };
        }),
    }]);

    return funnelEngine.getPageTree(offerId, pageId);
}

module.exports = {
    ALLOWED_KINDS: ALLOWED_KINDS,
    stripBlockPayload: stripBlockPayload,
    stripSectionPayload: stripSectionPayload,
    stripPagePayload: stripPagePayload,
    stripCheckoutPayload: stripCheckoutPayload,
    listSavedBlocks: listSavedBlocks,
    saveSavedBlock: saveSavedBlock,
    savePageFromIds: savePageFromIds,
    saveCheckoutFromOffer: saveCheckoutFromOffer,
    deleteSavedBlock: deleteSavedBlock,
    applySavedBlock: applySavedBlock,
    applyPagePayload: applyPagePayload,
    applyCheckoutPayload: applyCheckoutPayload,
    getSavedBlock: getSavedBlock,
};
