'use strict';

var offerContext = require('../offer-context');
var errors = require('./errors');

function readBoundOfferId() {
    return String(process.env.HUB_AGENT_OFFER_ID || '').trim();
}

function readBoundTaskId() {
    return String(process.env.HUB_AGENT_TASK_ID || '').trim();
}

async function resolveBoundContext(options) {
    var opts = options || {};
    var boundOfferId = opts.boundOfferId || readBoundOfferId();

    if (!boundOfferId) {
        throw errors.ToolError(
            'Offer em falta no contexto do agent.',
            errors.ERROR_CODES.UNAUTHORIZED
        );
    }

    var context = await offerContext.resolveOfferContext({ offer_id: boundOfferId });
    return context;
}

function assertInputOfferId(inputOfferId, boundOfferId) {
    var input = String(inputOfferId || '').trim();
    var bound = String(boundOfferId || '').trim();

    if (!input || !bound) {
        throw errors.ToolError(
            'offer_id em falta.',
            errors.ERROR_CODES.VALIDATION_ERROR
        );
    }

    if (input !== bound) {
        throw errors.ToolError(
            'Operação recusada: offer_id não corresponde à oferta autorizada.',
            errors.ERROR_CODES.CROSS_OFFER_ACCESS
        );
    }
}

function requireNonEmptyString(value, fieldName) {
    var normalized = String(value || '').trim();

    if (!normalized) {
        throw errors.ToolError(
            fieldName + ' em falta.',
            errors.ERROR_CODES.VALIDATION_ERROR
        );
    }

    return normalized;
}

function requireUuidLike(value, fieldName) {
    var normalized = requireNonEmptyString(value, fieldName);

    if (!/^[0-9a-f-]{36}$/i.test(normalized)) {
        throw errors.ToolError(
            fieldName + ' inválido.',
            errors.ERROR_CODES.VALIDATION_ERROR
        );
    }

    return normalized;
}

module.exports = {
    readBoundOfferId: readBoundOfferId,
    readBoundTaskId: readBoundTaskId,
    resolveBoundContext: resolveBoundContext,
    assertInputOfferId: assertInputOfferId,
    requireNonEmptyString: requireNonEmptyString,
    requireUuidLike: requireUuidLike,
};
