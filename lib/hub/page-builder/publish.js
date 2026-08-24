'use strict';

var funnelEngine = require('../funnel-engine');
var save = require('./save');

async function publishPage(options) {
    var engine = options.service || funnelEngine;
    var offerId = options.offer_id;
    var pageId = options.page_id;
    var status = options.status === 'draft' ? 'draft' : 'published';
    var baseline = options.baseline;
    var working = options.working;

    if (baseline && working) {
        await save.saveTree(offerId, pageId, baseline, working, engine);
    }

    await engine.updatePage(offerId, pageId, { status: status });
    return engine.getPageTree(offerId, pageId);
}

module.exports = {
    publishPage: publishPage,
};
