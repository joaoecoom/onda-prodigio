var DEFAULT_TIMEZONE = 'Europe/Lisbon';

function getReportingTimezone() {
    return String(process.env.METRICS_TIMEZONE || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
}

function getTimezoneOffsetMs(date, timeZone) {
    var formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    var parts = formatter.formatToParts(date);
    var values = {};

    parts.forEach(function (part) {
        values[part.type] = part.value;
    });

    var asUtc = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour === '24' ? 0 : values.hour),
        Number(values.minute),
        Number(values.second)
    );

    return asUtc - date.getTime();
}

function zonedDateTimeToUnix(dateStr, hour, minute, second, millisecond, timeZone) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));

    if (!match) {
        return 0;
    }

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var guess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

    for (var attempt = 0; attempt < 5; attempt += 1) {
        var offset = getTimezoneOffsetMs(new Date(guess), timeZone);
        var next = Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - offset;

        if (next === guess) {
            break;
        }

        guess = next;
    }

    return Math.floor(guess / 1000);
}

function getDayStartUnix(dateStr, timeZone) {
    return zonedDateTimeToUnix(dateStr, 0, 0, 0, 0, timeZone);
}

function getDayEndUnix(dateStr, timeZone) {
    return zonedDateTimeToUnix(dateStr, 23, 59, 59, 999, timeZone);
}

function formatIsoDateInTimezone(unixSeconds, timeZone) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(Number(unixSeconds) * 1000));
}

function getHourStartUnix(dateStr, hour, timeZone) {
    return zonedDateTimeToUnix(dateStr, hour, 0, 0, 0, timeZone);
}

function countDaysInRange(from, to) {
    var fromDate = String(from || '').trim();
    var toDate = String(to || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
        return 0;
    }

    var start = Date.parse(fromDate + 'T12:00:00Z');
    var end = Date.parse(toDate + 'T12:00:00Z');

    return Math.floor((end - start) / 86400000) + 1;
}

function addDaysIso(isoDate, days) {
    var date = new Date(isoDate + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function resolveMetaDateRange(from, to, accountTimezone) {
    var reportingTimezone = getReportingTimezone();
    var accountTz = String(accountTimezone || reportingTimezone).trim() || reportingTimezone;
    var fromDate = String(from || '').trim();
    var toDate = String(to || '').trim();

    if (!fromDate || !toDate) {
        return {
            since: fromDate,
            until: toDate,
            adjusted: false,
            reporting_timezone: reportingTimezone,
            account_timezone: accountTz,
        };
    }

    if (accountTz === reportingTimezone) {
        return {
            since: fromDate,
            until: toDate,
            adjusted: false,
            reporting_timezone: reportingTimezone,
            account_timezone: accountTz,
        };
    }

    var todayReporting = formatIsoDateInTimezone(Math.floor(Date.now() / 1000), reportingTimezone);
    var includesToday = toDate >= todayReporting;
    var spanDays = countDaysInRange(fromDate, toDate);
    var useHourlyFilter = accountTz !== reportingTimezone && includesToday && spanDays <= 31;

    // Períodos só passados: usar calendário da conta Meta (evita somar 2 dias inteiros).
    if (!includesToday) {
        return {
            since: fromDate,
            until: toDate,
            adjusted: true,
            alignment: 'account_calendar',
            reporting_timezone: reportingTimezone,
            account_timezone: accountTz,
            requested_from: fromDate,
            requested_to: toDate,
        };
    }

    var startUnix = getDayStartUnix(fromDate, reportingTimezone);
    var endUnix = Math.floor(Date.now() / 1000);
    var since = formatIsoDateInTimezone(startUnix, accountTz);
    var until = formatIsoDateInTimezone(endUnix, accountTz);

    return {
        since: since,
        until: until,
        adjusted: true,
        alignment: 'reporting_window',
        reporting_timezone: reportingTimezone,
        account_timezone: accountTz,
        requested_from: fromDate,
        requested_to: toDate,
        start_unix: startUnix,
        end_unix: endUnix,
        use_hourly_filter: useHourlyFilter,
    };
}

module.exports = {
    DEFAULT_TIMEZONE: DEFAULT_TIMEZONE,
    getReportingTimezone: getReportingTimezone,
    getDayStartUnix: getDayStartUnix,
    getDayEndUnix: getDayEndUnix,
    getHourStartUnix: getHourStartUnix,
    formatIsoDateInTimezone: formatIsoDateInTimezone,
    countDaysInRange: countDaysInRange,
    addDaysIso: addDaysIso,
    resolveMetaDateRange: resolveMetaDateRange,
};
