var store = {};

function getCacheKey(parts) {
    return parts.join('::');
}

function getCached(key, ttlMs) {
    var entry = store[key];

    if (!entry) {
        return null;
    }

    if (Date.now() - entry.at > ttlMs) {
        delete store[key];
        return null;
    }

    return entry.value;
}

function setCached(key, value) {
    store[key] = {
        at: Date.now(),
        value: value,
    };
}

function takeCached(key, ttlMs) {
    var value = getCached(key, ttlMs);

    if (value !== null) {
        delete store[key];
    }

    return value;
}

function clearMatching(prefix) {
    Object.keys(store).forEach(function (key) {
        if (key.indexOf(prefix) === 0) {
            delete store[key];
        }
    });
}

module.exports = {
    getCacheKey: getCacheKey,
    getCached: getCached,
    setCached: setCached,
    takeCached: takeCached,
    clearMatching: clearMatching,
};
