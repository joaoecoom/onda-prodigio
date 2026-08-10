var cache = require('../metrics/cache');

var META_TTL_MS = 3 * 60 * 1000;

function getReportCacheKey(accountId, from, to) {
    return cache.getCacheKey(['meta-report', accountId, from, to]);
}

function getCachedReport(accountId, from, to) {
    return cache.getCached(getReportCacheKey(accountId, from, to), META_TTL_MS);
}

function setCachedReport(accountId, from, to, report) {
    cache.setCached(getReportCacheKey(accountId, from, to), report);
}

function clearAccountReports(accountId) {
    cache.clearMatching('meta-report::' + accountId + '::');
}

module.exports = {
    getCachedReport: getCachedReport,
    setCachedReport: setCachedReport,
    clearAccountReports: clearAccountReports,
};
