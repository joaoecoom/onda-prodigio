'use strict';

var ERROR_CODES = {
    OFFER_NOT_FOUND: 'OFFER_NOT_FOUND',
    FUNNEL_NOT_FOUND: 'FUNNEL_NOT_FOUND',
    PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
    SECTION_NOT_FOUND: 'SECTION_NOT_FOUND',
    BLOCK_NOT_FOUND: 'BLOCK_NOT_FOUND',
    CROSS_OFFER_ACCESS: 'CROSS_OFFER_ACCESS',
    INVALID_BLOCK_TYPE: 'INVALID_BLOCK_TYPE',
    INVALID_PAGE_TYPE: 'INVALID_PAGE_TYPE',
    INVALID_FUNNEL_TYPE: 'INVALID_FUNNEL_TYPE',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    DUPLICATE_SLUG: 'DUPLICATE_SLUG',
    UNKNOWN_TOOL: 'UNKNOWN_TOOL',
    NOT_FOUND: 'NOT_FOUND',
};

function ToolError(message, code, details) {
    var error = new Error(message || code || 'Tool error');
    error.name = 'ToolError';
    error.code = code || ERROR_CODES.VALIDATION_ERROR;
    error.details = details || null;
    return error;
}

function mapDomainError(error) {
    if (!error) {
        return ToolError('Erro desconhecido.', ERROR_CODES.VALIDATION_ERROR);
    }

    if (error.name === 'ToolError') {
        return error;
    }

    var message = String(error.message || 'Erro de domínio.');
    var code = error.code || ERROR_CODES.VALIDATION_ERROR;

    if (message.indexOf('duplicate key') !== -1 || message.indexOf('unique constraint') !== -1) {
        return ToolError('Slug duplicado.', ERROR_CODES.DUPLICATE_SLUG);
    }

    if (code === 'OFFER_NOT_FOUND') {
        return ToolError(message, ERROR_CODES.OFFER_NOT_FOUND);
    }

    if (code === 'OFFER_MISMATCH') {
        return ToolError(message, ERROR_CODES.CROSS_OFFER_ACCESS);
    }

    if (code === 'NOT_FOUND') {
        if (message.indexOf('Funnel') !== -1) {
            return ToolError(message, ERROR_CODES.FUNNEL_NOT_FOUND);
        }

        if (message.indexOf('Page') !== -1 || message.indexOf('página') !== -1) {
            return ToolError(message, ERROR_CODES.PAGE_NOT_FOUND);
        }

        if (message.indexOf('Section') !== -1) {
            return ToolError(message, ERROR_CODES.SECTION_NOT_FOUND);
        }

        if (message.indexOf('Block') !== -1) {
            return ToolError(message, ERROR_CODES.BLOCK_NOT_FOUND);
        }

        return ToolError(message, ERROR_CODES.NOT_FOUND);
    }

    if (message.indexOf('Tipo de block inválido') !== -1) {
        return ToolError(message, ERROR_CODES.INVALID_BLOCK_TYPE);
    }

    if (message.indexOf('Slug inválido') !== -1 || message.indexOf('deve ser um objecto') !== -1) {
        return ToolError(message, ERROR_CODES.VALIDATION_ERROR);
    }

    return ToolError(message, code);
}

function toToolResponse(error) {
    var mapped = mapDomainError(error);

    return {
        success: false,
        error: {
            code: mapped.code,
            message: mapped.message,
        },
    };
}

function toToolSuccess(data) {
    return Object.assign({ success: true }, data || {});
}

module.exports = {
    ERROR_CODES: ERROR_CODES,
    ToolError: ToolError,
    mapDomainError: mapDomainError,
    toToolResponse: toToolResponse,
    toToolSuccess: toToolSuccess,
};
