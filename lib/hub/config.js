var DEFAULT_HUB_HOST = 'hub-dr-ecoom.vercel.app';

function normalizeHost(value) {
    return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function getHubHost() {
    return normalizeHost(process.env.HUB_DOMAIN || DEFAULT_HUB_HOST);
}

function getHubBaseUrl() {
    var host = getHubHost();

    if (!host) {
        return '';
    }

    return 'https://' + host;
}

function isHubHost(hostHeader) {
    var host = normalizeHost(hostHeader);

    if (!host) {
        return false;
    }

    if (host === getHubHost()) {
        return true;
    }

    if (host === 'localhost' || host === '127.0.0.1') {
        return String(process.env.HUB_LOCAL_ENABLED || '').trim() === 'true';
    }

    return false;
}

function isFunnelHost(hostHeader) {
    return !isHubHost(hostHeader);
}

function getConfiguredHubHosts() {
    var hosts = [getHubHost()];
    var extra = String(process.env.HUB_EXTRA_HOSTS || '').trim();

    if (extra) {
        extra.split(',').forEach(function (entry) {
            var host = normalizeHost(entry);

            if (host && hosts.indexOf(host) === -1) {
                hosts.push(host);
            }
        });
    }

    return hosts;
}

module.exports = {
    DEFAULT_HUB_HOST: DEFAULT_HUB_HOST,
    normalizeHost: normalizeHost,
    getHubHost: getHubHost,
    getHubBaseUrl: getHubBaseUrl,
    isHubHost: isHubHost,
    isFunnelHost: isFunnelHost,
    getConfiguredHubHosts: getConfiguredHubHosts,
};
