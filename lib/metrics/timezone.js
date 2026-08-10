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

module.exports = {
    DEFAULT_TIMEZONE: DEFAULT_TIMEZONE,
    getReportingTimezone: getReportingTimezone,
    getDayStartUnix: getDayStartUnix,
    getDayEndUnix: getDayEndUnix,
};
