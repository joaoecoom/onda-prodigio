var timezone = require('../metrics/timezone');

var TZ = timezone.DEFAULT_TIMEZONE;
var DEFAULT_PEAK_AFTER_15H = 15;
var DEFAULT_PEAK_BEFORE_15H = 21;
var DEFAULT_MIN_HOURS_BEFORE_15H = 24;
var DEFAULT_CUTOFF_HOUR = 15;

function peakAfter15h() {
    var value = parseInt(process.env.NEVER_LOGGED_IN_PEAK_AFTER_15H || '', 10);
    return Number.isFinite(value) ? value : DEFAULT_PEAK_AFTER_15H;
}

function peakBefore15h() {
    var value = parseInt(process.env.NEVER_LOGGED_IN_PEAK_BEFORE_15H || '', 10);
    return Number.isFinite(value) ? value : DEFAULT_PEAK_BEFORE_15H;
}

function minHoursBefore15h() {
    var value = parseFloat(process.env.NEVER_LOGGED_IN_MIN_HOURS || '');
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_MIN_HOURS_BEFORE_15H;
}

function cutoffHour() {
    var value = parseInt(process.env.NEVER_LOGGED_IN_CUTOFF_HOUR || '', 10);
    return Number.isFinite(value) ? value : DEFAULT_CUTOFF_HOUR;
}

function getLisbonParts(date) {
    var formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    var values = {};

    formatter.formatToParts(date).forEach(function (part) {
        values[part.type] = part.value;
    });

    return {
        dateStr: values.year + '-' + values.month + '-' + values.day,
        hour: Number(values.hour === '24' ? 0 : values.hour),
        minute: Number(values.minute),
    };
}

function addDaysToDateStr(dateStr, days) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));

    if (!match) {
        return dateStr;
    }

    var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
    return date.toISOString().slice(0, 10);
}

function zonedHourStart(dateStr, hour) {
    return new Date(timezone.getHourStartUnix(dateStr, hour, TZ) * 1000);
}

function purchasedAfterCutoff(parts) {
    var cutoff = cutoffHour();

    return parts.hour > cutoff || (parts.hour === cutoff && parts.minute > 0);
}

function computeIdealSendAfter(purchasedAt) {
    var purchaseDate = purchasedAt instanceof Date ? purchasedAt : new Date(purchasedAt);

    if (Number.isNaN(purchaseDate.getTime())) {
        purchaseDate = new Date();
    }

    var parts = getLisbonParts(purchaseDate);

    if (purchasedAfterCutoff(parts)) {
        return zonedHourStart(addDaysToDateStr(parts.dateStr, 1), peakAfter15h());
    }

    var minSendMs = purchaseDate.getTime() + (minHoursBefore15h() * 60 * 60 * 1000);
    var minParts = getLisbonParts(new Date(minSendMs));
    var eveningPeak = peakBefore15h();
    var candidate = zonedHourStart(minParts.dateStr, eveningPeak);

    if (candidate.getTime() >= minSendMs) {
        return candidate;
    }

    return zonedHourStart(addDaysToDateStr(minParts.dateStr, 1), eveningPeak);
}

function nextPeakSlotAfter(referenceDate) {
    var reference = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

    if (Number.isNaN(reference.getTime())) {
        reference = new Date();
    }

    var parts = getLisbonParts(reference);
    var refMs = reference.getTime();
    var peaks = [peakAfter15h(), peakBefore15h()];
    var peakIndex;

    for (peakIndex = 0; peakIndex < peaks.length; peakIndex += 1) {
        var slotToday = zonedHourStart(parts.dateStr, peaks[peakIndex]);

        if (slotToday.getTime() > refMs) {
            return slotToday;
        }
    }

    return zonedHourStart(addDaysToDateStr(parts.dateStr, 1), peakAfter15h());
}

function computeSendAfter(purchasedAt, now) {
    var referenceNow = now instanceof Date ? now : new Date(now || Date.now());
    var ideal = computeIdealSendAfter(purchasedAt);

    if (ideal.getTime() > referenceNow.getTime()) {
        return ideal;
    }

    return nextPeakSlotAfter(referenceNow);
}

function describeSchedule(purchasedAt, sendAfter) {
    var purchaseParts = getLisbonParts(purchasedAt instanceof Date ? purchasedAt : new Date(purchasedAt));
    var sendParts = getLisbonParts(sendAfter instanceof Date ? sendAfter : new Date(sendAfter));

    if (purchasedAfterCutoff(purchaseParts)) {
        return 'Compra após ' + cutoffHour() + 'h → follow-up às ' + peakAfter15h() + 'h do dia seguinte';
    }

    return 'Compra antes das ' + cutoffHour() + 'h → follow-up ≥' + minHoursBefore15h() + 'h às ' + peakBefore15h() + 'h (' + sendParts.dateStr + ')';
}

module.exports = {
    TZ: TZ,
    peakAfter15h: peakAfter15h,
    peakBefore15h: peakBefore15h,
    cutoffHour: cutoffHour,
    computeIdealSendAfter: computeIdealSendAfter,
    computeSendAfter: computeSendAfter,
    nextPeakSlotAfter: nextPeakSlotAfter,
    describeSchedule: describeSchedule,
    getLisbonParts: getLisbonParts,
};
