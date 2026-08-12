var cache = require('./cache');
var timezone = require('./timezone');

var API_BASE = 'https://analytics.vturb.net';
var CACHE_KEY_PREFIX = 'vturb:';
var CACHE_TTL_MS = 60 * 1000;

function getApiToken() {
    return (process.env.VTURB_ANALYTICS_API_TOKEN || '').trim();
}

function getPlayerId() {
    var playerId = (process.env.VTURB_PLAYER_ID || 'vid-6a7927038a043cc51fb71392').trim();

    if (playerId.indexOf('vid-') === 0) {
        return playerId.slice(4);
    }

    return playerId;
}

function formatVturbDateTime(dateValue, options) {
    var opts = options || {};
    var date = String(dateValue || '').trim();

    if (!date) {
        return date;
    }

    if (/T\d{2}:\d{2}:\d{2}/.test(date) || / \d{2}:\d{2}:\d{2}/.test(date)) {
        return date;
    }

    if (opts.untilNow) {
        return formatNowDatetime(getTimezone());
    }

    return opts.endOfDay ? date + ' 23:59:59' : date + ' 00:00:00';
}

function formatNowDatetime(timeZone) {
    var formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    var parts = formatter.formatToParts(new Date());
    var values = {};

    parts.forEach(function (part) {
        values[part.type] = part.value;
    });

    return values.year + '-' + values.month + '-' + values.day + ' ' +
        values.hour + ':' + values.minute + ':' + values.second;
}

function formatVturbDate(dateValue) {
    var date = String(dateValue || '').trim();

    if (!date) {
        return date;
    }

    // A API usa YYYY-MM-DD + timezone separado — não suffix UTC.
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    return date.slice(0, 10);
}

async function getJson(path, query) {
    var token = getApiToken();

    if (!token) {
        throw new Error('VTURB_ANALYTICS_API_TOKEN em falta.');
    }

    var url = API_BASE + path;

    if (query && Object.keys(query).length) {
        var params = new URLSearchParams(query);
        url += '?' + params.toString();
    }

    var response = await fetch(url, {
        method: 'GET',
        headers: {
            'X-Api-Token': token,
            'X-Api-Version': 'v1',
        },
    });

    var text = await response.text();
    var data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch (error) {
        throw new Error('Resposta VTurb inválida.');
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || ('VTurb API falhou (' + response.status + ').'));
    }

    return data;
}

async function getPlayerMetadata() {
    var cacheKey = 'vturb:player-meta:' + getPlayerId();
    var cached = cache.getCached(cacheKey, 60 * 60 * 1000);

    if (cached) {
        return cached;
    }

    var envPitch = parseInt(process.env.VTURB_PITCH_TIME_SECONDS || '', 10);
    var envDuration = parseInt(process.env.VTURB_VIDEO_DURATION_SECONDS || '', 10);

    if (Number.isFinite(envPitch) && envPitch > 0 && Number.isFinite(envDuration) && envDuration > 0) {
        var fromEnv = {
            pitch_time: envPitch,
            video_duration: envDuration,
            source: 'env',
        };
        cache.setCached(cacheKey, fromEnv);
        return fromEnv;
    }

    try {
        var players = await getJson('/players/list', {
            timezone: getTimezone(),
        });
        var rows = Array.isArray(players) ? players : (players.items || players.data || []);
        var playerId = getPlayerId();
        var match = rows.find(function (row) {
            return String(row.id || '') === playerId ||
                String(row.player_id || '') === playerId;
        });

        var metadata = {
            pitch_time: match && Number(match.pitch_time) > 0 ? Number(match.pitch_time) : (Number.isFinite(envPitch) && envPitch > 0 ? envPitch : null),
            video_duration: match && Number(match.duration) > 0 ? Number(match.duration) : (Number.isFinite(envDuration) && envDuration > 0 ? envDuration : null),
            source: match ? 'player' : 'fallback',
        };

        cache.setCached(cacheKey, metadata);
        return metadata;
    } catch (error) {
        return {
            pitch_time: Number.isFinite(envPitch) && envPitch > 0 ? envPitch : null,
            video_duration: Number.isFinite(envDuration) && envDuration > 0 ? envDuration : null,
            source: 'fallback',
            error: error.message || '',
        };
    }
}

function getTimezone() {
    return (process.env.METRICS_TIMEZONE || 'Europe/Lisbon').trim();
}

function buildCacheKey(from, to) {
    return CACHE_KEY_PREFIX + getPlayerId() + ':' + from + ':' + to;
}

async function postJson(path, payload) {
    var token = getApiToken();

    if (!token) {
        throw new Error('VTURB_ANALYTICS_API_TOKEN em falta.');
    }

    var response = await fetch(API_BASE + path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Token': token,
            'X-Api-Version': 'v1',
        },
        body: JSON.stringify(payload),
    });

    var text = await response.text();
    var data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch (error) {
        throw new Error('Resposta VTurb inválida.');
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || ('VTurb API falhou (' + response.status + ').'));
    }

    return data;
}

function normalizeStats(stats) {
    var amountEur = Number(stats.total_amount_eur || 0);

    return {
        views: Number(stats.total_viewed || 0),
        views_unique_sessions: Number(stats.total_viewed_session_uniq || 0),
        views_unique_devices: Number(stats.total_viewed_device_uniq || 0),
        plays: Number(stats.total_started || 0),
        plays_unique_sessions: Number(stats.total_started_session_uniq || 0),
        plays_unique_devices: Number(stats.total_started_device_uniq || 0),
        play_rate: stats.play_rate !== undefined && stats.play_rate !== null
            ? Number(Number(stats.play_rate).toFixed(2))
            : null,
        engagement_rate: stats.engagement_rate !== undefined && stats.engagement_rate !== null
            ? Number(Number(stats.engagement_rate).toFixed(2))
            : null,
        finished: Number(stats.total_finished || 0),
        cta_clicks: Number(stats.total_clicked || 0),
        cta_clicks_unique_sessions: Number(stats.total_clicked_session_uniq || 0),
        over_pitch: Number(stats.total_over_pitch || 0),
        over_pitch_rate: stats.over_pitch_rate !== undefined && stats.over_pitch_rate !== null
            ? Number(Number(stats.over_pitch_rate).toFixed(2))
            : null,
        conversions: Number(stats.total_conversions || 0),
        conversion_rate: stats.overall_conversion_rate !== undefined && stats.overall_conversion_rate !== null
            ? Number(Number(stats.overall_conversion_rate).toFixed(2))
            : null,
        revenue_eur: Number((amountEur / 100).toFixed(2)),
        revenue_eur_cents: amountEur,
    };
}

async function buildVturbReport(query) {
    var token = getApiToken();

    if (!token) {
        return {
            ok: false,
            configured: false,
            error: 'VTURB_ANALYTICS_API_TOKEN em falta.',
            summary: null,
            player_id: getPlayerId(),
        };
    }

    var stripeSales = require('./stripe-sales');
    var bounds = stripeSales.resolveDateBounds(query || {});
    var from = bounds.from;
    var to = bounds.to;

    if (!from || !to) {
        var today = new Date();
        to = today.toISOString().slice(0, 10);
        var fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 29);
        from = fromDate.toISOString().slice(0, 10);
    }

    var skipCache = String(query.refresh || '') === '1';
    var cacheKey = buildCacheKey(from, to);

    if (!skipCache) {
        var cached = cache.getCached(cacheKey, CACHE_TTL_MS);

        if (cached) {
            return cached;
        }
    }

    var reportingTimezone = getTimezone();
    var todayReporting = timezone.formatIsoDateInTimezone(Math.floor(Date.now() / 1000), reportingTimezone);
    var endIsToday = to >= todayReporting;

    var payload = {
        player_id: getPlayerId(),
        start_date: formatVturbDateTime(from, { endOfDay: false }),
        end_date: formatVturbDateTime(to, { endOfDay: true, untilNow: endIsToday }),
        timezone: reportingTimezone,
    };

    var playerMeta = await getPlayerMetadata();

    if (playerMeta.video_duration) {
        payload.video_duration = playerMeta.video_duration;
    }

    if (playerMeta.pitch_time) {
        payload.pitch_time = playerMeta.pitch_time;
    }

    try {
        var stats = await postJson('/sessions/stats', payload);
        var report = {
            ok: true,
            configured: true,
            error: '',
            player_id: getPlayerId(),
            date_range: {
                from: from,
                to: to,
                timezone: getTimezone(),
            },
            player_meta: playerMeta,
            summary: normalizeStats(stats),
            generated_at: new Date().toISOString(),
        };

        cache.setCached(cacheKey, report);
        return report;
    } catch (error) {
        return {
            ok: false,
            configured: true,
            error: error.message || 'VTurb API falhou.',
            summary: null,
            player_id: getPlayerId(),
            date_range: {
                from: from,
                to: to,
                timezone: getTimezone(),
            },
            generated_at: new Date().toISOString(),
        };
    }
}

module.exports = {
    buildVturbReport: buildVturbReport,
};
