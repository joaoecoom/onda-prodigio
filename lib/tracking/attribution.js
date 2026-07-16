var identity = require('./identity');

var ATTRIBUTION_FIELDS = [
    'ad_name',
    'ad_id',
    'adset_id',
    'adset_name',
    'campaign_id',
    'campaign_name',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'fbclid',
    'ad_platform',
];

function buildAttributionMetadata(tracking) {
    var metadata = {};

    if (!tracking || typeof tracking !== 'object') {
        return metadata;
    }

    ATTRIBUTION_FIELDS.forEach(function (field) {
        if (tracking[field]) {
            metadata[field] = identity.sanitizeMetadataValue(tracking[field], field === 'fbclid' ? 200 : 120);
        }
    });

    return metadata;
}

function getPrimaryAdLabel(metadata) {
    if (!metadata || typeof metadata !== 'object') {
        return '';
    }

    return metadata.ad_name ||
        metadata.utm_content ||
        metadata.ad_id ||
        metadata.campaign_name ||
        '';
}

module.exports = {
    ATTRIBUTION_FIELDS: ATTRIBUTION_FIELDS,
    buildAttributionMetadata: buildAttributionMetadata,
    getPrimaryAdLabel: getPrimaryAdLabel,
};
