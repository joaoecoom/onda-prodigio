var FUNNEL_STATUSES = ['draft', 'active', 'archived'];
var FUNNEL_TYPES = ['vsl', 'quiz', 'advertorial', 'webinar', 'lead', 'custom'];

var PAGE_STATUSES = ['draft', 'published', 'archived'];
var PAGE_TYPES = [
    'sales', 'vsl', 'landing', 'advertorial', 'checkout',
    'upsell', 'downsell', 'thank_you', 'webinar', 'custom',
];

var BLOCK_TYPES = ['text', 'heading', 'image', 'video', 'button', 'spacer', 'html'];

var DEFAULT_VISIBILITY = {
    desktop: true,
    tablet: true,
    mobile: true,
};

var DEFAULT_SORT_GAP = 100;

module.exports = {
    FUNNEL_STATUSES: FUNNEL_STATUSES,
    FUNNEL_TYPES: FUNNEL_TYPES,
    PAGE_STATUSES: PAGE_STATUSES,
    PAGE_TYPES: PAGE_TYPES,
    BLOCK_TYPES: BLOCK_TYPES,
    DEFAULT_VISIBILITY: DEFAULT_VISIBILITY,
    DEFAULT_SORT_GAP: DEFAULT_SORT_GAP,
};
