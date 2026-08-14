var cache = require('../metrics/cache');

var META_TTL_MS = 5 * 60 * 1000;
var META_LIVE_TTL_MS = 60 * 1000;

function isLiveDateRange(from, to) {
    var today = new Date().toISOString().slice(0, 10);
    return String(to || '').trim() >= today || String(from || '').trim() >= today;
}

function getReportTtl(from, to) {
    return isLiveDateRange(from, to) ? META_LIVE_TTL_MS : META_TTL_MS;
}

function getReportCacheKey(accountId, from, to) {
    return cache.getCacheKey(['meta-report-v4', accountId, from, to]);
}

function getCachedReport(accountId, from, to, ttlMs) {
    return cache.getCached(getReportCacheKey(accountId, from, to), ttlMs || META_TTL_MS);
}

function setCachedReport(accountId, from, to, report) {
    cache.setCached(getReportCacheKey(accountId, from, to), report);
}

function getSummaryCacheKey(accountId, from, to) {
    return cache.getCacheKey(['meta-summary-v4', accountId, from, to]);
}

function getCachedSummary(accountId, from, to, ttlMs) {
    return cache.getCached(getSummaryCacheKey(accountId, from, to), ttlMs || META_TTL_MS);
}

function setCachedSummary(accountId, from, to, report) {
    cache.setCached(getSummaryCacheKey(accountId, from, to), report);
}

function clearAccountReports(accountId) {
    cache.clearMatching('meta-report-v4::' + accountId + '::');
    cache.clearMatching('meta-summary-v4::' + accountId + '::');
}

module.exports = {
    getCachedReport: getCachedReport,
    setCachedReport: setCachedReport,
    getCachedSummary: getCachedSummary,
    setCachedSummary: setCachedSummary,
    clearAccountReports: clearAccountReports,
    getReportTtl: getReportTtl,
};
