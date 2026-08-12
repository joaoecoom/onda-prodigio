var cache = require('./cache');

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

function formatVturbDate(dateValue, endOfDay) {
    var date = String(dateValue || '').trim();

    if (!date) {
        return date;
    }

    if (date.indexOf(' ') >= 0 || date.indexOf('T') >= 0) {
        return date;
    }

    return endOfDay ? date + ' 23:59:59 UTC' : date + ' 00:00:00 UTC';
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

    var payload = {
        player_id: getPlayerId(),
        start_date: formatVturbDate(from, false),
        end_date: formatVturbDate(to, true),
        timezone: getTimezone(),
    };

    var videoDuration = parseInt(process.env.VTURB_VIDEO_DURATION_SECONDS || '', 10);

    if (Number.isFinite(videoDuration) && videoDuration > 0) {
        payload.video_duration = videoDuration;
    }

    var pitchTime = parseInt(process.env.VTURB_PITCH_TIME_SECONDS || '', 10);

    if (Number.isFinite(pitchTime) && pitchTime > 0) {
        payload.pitch_time = pitchTime;
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
