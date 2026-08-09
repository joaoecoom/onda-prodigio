var client = require('./client');
var config = require('./config');

var ALLOWED_OBJECT_TYPES = {
    campaign: true,
    adset: true,
    ad: true,
};

var ALLOWED_STATUSES = {
    ACTIVE: true,
    PAUSED: true,
};

async function updateObjectStatus(params) {
    var accountId = config.normalizeAccountId(params.account_id);
    var objectId = String(params.object_id || '').trim();
    var objectType = String(params.object_type || 'campaign').trim().toLowerCase();
    var status = String(params.status || '').trim().toUpperCase();

    if (!config.isAllowedAccountId(accountId)) {
        throw new Error('Conta Meta não autorizada.');
    }

    if (!objectId) {
        throw new Error('object_id em falta.');
    }

    if (!ALLOWED_OBJECT_TYPES[objectType]) {
        throw new Error('object_type inválido.');
    }

    if (!ALLOWED_STATUSES[status]) {
        throw new Error('status inválido. Usa ACTIVE ou PAUSED.');
    }

    var result = await client.graphPost('/' + objectId, {
        status: status,
    });

    return {
        account_id: accountId,
        object_id: objectId,
        object_type: objectType,
        status: status,
        success: Boolean(result.success),
        result: result,
    };
}

module.exports = {
    updateObjectStatus: updateObjectStatus,
};
