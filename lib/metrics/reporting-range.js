var timezone = require('./timezone');

var ALL_TIME_LOOKBACK_DAYS = 730;
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatIsoDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function getAllTimeRange(referenceDate) {
    var today = referenceDate ? new Date(referenceDate) : new Date();
    var to = formatIsoDate(today);
    var fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    fromDate.setDate(fromDate.getDate() - ALL_TIME_LOOKBACK_DAYS);

    return {
        from: formatIsoDate(fromDate),
        to: to,
    };
}

function resolveReportingRange(query) {
    var days = parseInt(query && query.days, 10);
    var from = String((query && query.from) || '').trim();
    var to = String((query && query.to) || '').trim();
    var reportingTimezone = timezone.getReportingTimezone();

    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
        var fallback = getAllTimeRange();

        from = fallback.from;
        to = fallback.to;
    }

    return {
        from: from,
        to: to,
        minTimestamp: timezone.getDayStartUnix(from, reportingTimezone),
        maxTimestamp: timezone.getDayEndUnix(to, reportingTimezone),
        timezone: reportingTimezone,
        is_all_time: String(query && query.days) === '0' &&
            !DATE_PATTERN.test(String((query && query.from) || '').trim()),
    };
}

module.exports = {
    ALL_TIME_LOOKBACK_DAYS: ALL_TIME_LOOKBACK_DAYS,
    getAllTimeRange: getAllTimeRange,
    resolveReportingRange: resolveReportingRange,
};
