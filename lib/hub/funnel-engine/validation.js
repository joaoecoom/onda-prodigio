var constants = require('./constants');
var slugify = require('../slugify');

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSlug(value, fallback) {
    var slug = slugify.slugify(value || fallback || '');

    if (!slug) {
        throw new Error('Slug inválido.');
    }

    return slug;
}

function normalizeEnum(value, allowed, fallback) {
    var normalized = String(value || fallback || '').trim().toLowerCase();

    if (allowed.indexOf(normalized) === -1) {
        return fallback;
    }

    return normalized;
}

function normalizeSortOrder(value, fallback) {
    var order = parseInt(value, 10);

    if (!Number.isFinite(order)) {
        return fallback;
    }

    return Math.max(0, order);
}

function normalizeVisibility(value) {
    var input = isPlainObject(value) ? value : {};
    var base = constants.DEFAULT_VISIBILITY;

    return {
        desktop: input.desktop !== false,
        tablet: input.tablet !== false,
        mobile: input.mobile !== false,
    };
}

function normalizeJsonObject(value, fieldName) {
    if (value == null) {
        return {};
    }

    if (!isPlainObject(value)) {
        throw new Error(fieldName + ' deve ser um objecto JSON.');
    }

    return value;
}

function sanitizeContentString(value) {
    if (value == null || value === undefined) {
        return '';
    }

    var text = String(value).trim();

    if (text === 'undefined' || text === 'null') {
        return '';
    }

    return text;
}

function sanitizeBlockContent(content) {
    var normalized = normalizeJsonObject(content, 'content');

    if (normalized.text != null) {
        normalized.text = sanitizeContentString(normalized.text);
    }

    if (normalized.label != null) {
        normalized.label = sanitizeContentString(normalized.label);
    }

    if (normalized.href != null) {
        normalized.href = sanitizeContentString(normalized.href);
    }

    if (normalized.alt != null) {
        normalized.alt = sanitizeContentString(normalized.alt);
    }

    if (normalized.src != null) {
        normalized.src = sanitizeContentString(normalized.src);
    }

    if (normalized.url != null) {
        normalized.url = sanitizeContentString(normalized.url);
    }

    if (normalized.html != null) {
        normalized.html = sanitizeContentString(normalized.html);
    }

    return normalized;
}

function validateBlockPayload(input, isUpdate) {
    var payload = {};

    if (!isUpdate || (input && input.type != null)) {
        var type = normalizeEnum(input && input.type, constants.BLOCK_TYPES, '');

        if (!type) {
            var invalidBlock = new Error('Tipo de block inválido.');
            invalidBlock.code = 'INVALID_BLOCK_TYPE';
            throw invalidBlock;
        }

        payload.type = type;
    }

    if (!isUpdate || (input && input.sort_order != null)) {
        payload.sort_order = normalizeSortOrder(input && input.sort_order, constants.DEFAULT_SORT_GAP);
    }

    if (!isUpdate || (input && input.content != null)) {
        payload.content = sanitizeBlockContent(input && input.content);
    }

    if (!isUpdate || (input && input.settings != null)) {
        payload.settings = normalizeJsonObject(input && input.settings, 'settings');
    }

    if (!isUpdate || (input && input.styles != null)) {
        payload.styles = normalizeJsonObject(input && input.styles, 'styles');
    }

    if (!isUpdate || (input && input.visibility != null)) {
        payload.visibility = normalizeVisibility(input && input.visibility);
    }

    if (!isUpdate) {
        payload.sort_order = payload.sort_order || normalizeSortOrder(input && input.sort_order, constants.DEFAULT_SORT_GAP);
        payload.content = payload.content || sanitizeBlockContent(input && input.content);
        payload.settings = payload.settings || normalizeJsonObject(input && input.settings, 'settings');
        payload.styles = payload.styles || normalizeJsonObject(input && input.styles, 'styles');
        payload.visibility = payload.visibility || normalizeVisibility(input && input.visibility);
    }

    return payload;
}

function validateSectionPayload(input) {
    var type = String((input && input.type) || 'custom').trim().toLowerCase();

    if (!type) {
        throw new Error('Tipo de section inválido.');
    }

    return {
        type: type,
        sort_order: normalizeSortOrder(input && input.sort_order, constants.DEFAULT_SORT_GAP),
        settings: normalizeJsonObject(input && input.settings, 'settings'),
        styles: normalizeJsonObject(input && input.styles, 'styles'),
        visibility: normalizeVisibility(input && input.visibility),
    };
}

function validatePagePayload(input, isUpdate) {
    var payload = {};

    if (!isUpdate || input.name != null) {
        var name = String((input && input.name) || '').trim();

        if (!name) {
            throw new Error('Nome da página em falta.');
        }

        payload.name = name;
    }

    if (!isUpdate || input.slug != null) {
        payload.slug = normalizeSlug(input && input.slug, input && input.name);
    }

    if (!isUpdate || input.type != null) {
        payload.type = normalizeEnum(input && input.type, constants.PAGE_TYPES, 'custom');
    }

    if (!isUpdate || input.status != null) {
        payload.status = normalizeEnum(input && input.status, constants.PAGE_STATUSES, 'draft');
    }

    if (!isUpdate || input.sort_order != null) {
        payload.sort_order = normalizeSortOrder(input && input.sort_order, constants.DEFAULT_SORT_GAP);
    }

    if (!isUpdate || input.settings != null) {
        payload.settings = normalizeJsonObject(input && input.settings, 'settings');
    }

    if (!isUpdate || input.seo != null) {
        payload.seo = normalizeJsonObject(input && input.seo, 'seo');
    }

    return payload;
}

function validateFunnelPayload(input, isUpdate) {
    var payload = {};

    if (!isUpdate || input.name != null) {
        var name = String((input && input.name) || '').trim();

        if (!name) {
            throw new Error('Nome do funnel em falta.');
        }

        payload.name = name;
    }

    if (!isUpdate || input.slug != null) {
        payload.slug = normalizeSlug(input && input.slug, input && input.name);
    }

    if (!isUpdate || input.description != null) {
        payload.description = String((input && input.description) || '').trim();
    }

    if (!isUpdate || input.type != null) {
        payload.type = normalizeEnum(input && input.type, constants.FUNNEL_TYPES, 'custom');
    }

    if (!isUpdate || input.status != null) {
        payload.status = normalizeEnum(input && input.status, constants.FUNNEL_STATUSES, 'draft');
    }

    if (!isUpdate || input.is_default != null) {
        payload.is_default = Boolean(input && input.is_default);
    }

    if (!isUpdate || input.settings != null) {
        payload.settings = normalizeJsonObject(input && input.settings, 'settings');
    }

    return payload;
}

function assertOfferOwnership(entity, offerId, entityLabel) {
    if (!entity) {
        var missing = new Error(entityLabel + ' não encontrado.');
        missing.code = 'NOT_FOUND';
        throw missing;
    }

    if (entity.offer_id !== offerId) {
        var denied = new Error(entityLabel + ' não pertence à oferta indicada.');
        denied.code = 'OFFER_MISMATCH';
        throw denied;
    }
}

function validateReorderItems(items) {
    if (!Array.isArray(items) || !items.length) {
        throw new Error('Lista de reordenação inválida.');
    }

    return items.map(function (item, index) {
        var id = String((item && item.id) || '').trim();

        if (!id) {
            throw new Error('ID em falta na reordenação.');
        }

        return {
            id: id,
            sort_order: normalizeSortOrder(
                item && item.sort_order,
                (index + 1) * constants.DEFAULT_SORT_GAP
            ),
        };
    });
}

module.exports = {
    normalizeSlug: normalizeSlug,
    normalizeVisibility: normalizeVisibility,
    normalizeJsonObject: normalizeJsonObject,
    validateBlockPayload: validateBlockPayload,
    validateSectionPayload: validateSectionPayload,
    validatePagePayload: validatePagePayload,
    validateFunnelPayload: validateFunnelPayload,
    assertOfferOwnership: assertOfferOwnership,
    validateReorderItems: validateReorderItems,
    isPlainObject: isPlainObject,
};
