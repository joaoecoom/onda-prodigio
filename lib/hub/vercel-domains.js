'use strict';

var DOMAIN_STATES = {
    NOT_CONFIGURED: 'not_configured',
    PENDING: 'pending',
    DNS_REQUIRED: 'dns_required',
    VERIFYING: 'verifying',
    ACTIVE: 'active',
    ERROR: 'error',
};

var DEFAULT_DNS_HINTS = [
    {
        type: 'CNAME',
        name: 'www',
        value: 'cname.vercel-dns.com',
        purpose: 'Subdomínio www',
    },
    {
        type: 'A',
        name: '@',
        value: '76.76.21.21',
        purpose: 'Domínio raiz (apex)',
    },
];

function getConfig() {
    return {
        token: String(process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN || '').trim(),
        projectId: String(process.env.VERCEL_PROJECT_ID || '').trim(),
        teamId: String(process.env.VERCEL_TEAM_ID || '').trim(),
    };
}

function isVercelConfigured() {
    var cfg = getConfig();
    return Boolean(cfg.token && cfg.projectId);
}

function buildApiUrl(path, teamId) {
    var url = 'https://api.vercel.com' + path;

    if (teamId) {
        url += (path.indexOf('?') === -1 ? '?' : '&') + 'teamId=' + encodeURIComponent(teamId);
    }

    return url;
}

async function vercelRequest(path, options) {
    var cfg = getConfig();

    if (!cfg.token) {
        throw new Error('VERCEL_TOKEN em falta.');
    }

    var response = await fetch(buildApiUrl(path, cfg.teamId), {
        method: (options && options.method) || 'GET',
        headers: Object.assign({
            Authorization: 'Bearer ' + cfg.token,
            'Content-Type': 'application/json',
        }, options && options.headers),
        body: options && options.body ? JSON.stringify(options.body) : undefined,
    });

    var data = await response.json().catch(function () {
        return {};
    });

    if (!response.ok) {
        var message = data.error && data.error.message
            ? data.error.message
            : (data.message || 'Vercel API falhou.');
        throw new Error(message);
    }

    return data;
}

function mapVercelDomainStatus(domainPayload) {
    if (!domainPayload) {
        return {
            status: DOMAIN_STATES.PENDING,
            message: 'Domínio pendente na Vercel.',
            dns_records: DEFAULT_DNS_HINTS,
        };
    }

    if (domainPayload.verified === true && domainPayload.configured === true) {
        return {
            status: DOMAIN_STATES.ACTIVE,
            message: 'Domínio activo na Vercel.',
            dns_records: [],
        };
    }

    if (domainPayload.verification && domainPayload.verification.length) {
        return {
            status: DOMAIN_STATES.DNS_REQUIRED,
            message: 'Configura os registos DNS indicados.',
            dns_records: domainPayload.verification.map(function (entry) {
                return {
                    type: entry.type || 'TXT',
                    name: entry.domain || entry.value || '@',
                    value: entry.value || '',
                    purpose: 'Verificação Vercel',
                };
            }),
        };
    }

    if (domainPayload.configured === false) {
        return {
            status: DOMAIN_STATES.DNS_REQUIRED,
            message: 'DNS necessário para activar o domínio.',
            dns_records: DEFAULT_DNS_HINTS,
        };
    }

    return {
        status: DOMAIN_STATES.VERIFYING,
        message: 'A verificar domínio na Vercel…',
        dns_records: DEFAULT_DNS_HINTS,
    };
}

async function getProjectDomain(domain) {
    var cfg = getConfig();
    var normalized = String(domain || '').trim().toLowerCase();

    if (!normalized) {
        throw new Error('Domínio em falta.');
    }

    return vercelRequest('/v9/projects/' + encodeURIComponent(cfg.projectId) +
        '/domains/' + encodeURIComponent(normalized));
}

async function addProjectDomain(domain) {
    var cfg = getConfig();
    var normalized = String(domain || '').trim().toLowerCase();

    if (!normalized) {
        throw new Error('Domínio em falta.');
    }

    try {
        return await vercelRequest('/v10/projects/' + encodeURIComponent(cfg.projectId) + '/domains', {
            method: 'POST',
            body: { name: normalized },
        });
    } catch (error) {
        if (String(error.message || '').toLowerCase().indexOf('already') !== -1) {
            return getProjectDomain(normalized);
        }

        throw error;
    }
}

async function syncDomainStatus(domain) {
    if (!isVercelConfigured()) {
        return {
            configured: false,
            status: DOMAIN_STATES.PENDING,
            message: 'Vercel API não configurada — validação funcional pendente.',
            dns_records: DEFAULT_DNS_HINTS,
        };
    }

    var payload = await getProjectDomain(domain);
    var mapped = mapVercelDomainStatus(payload);

    return Object.assign({
        configured: true,
        vercel: payload,
    }, mapped);
}

module.exports = {
    DOMAIN_STATES: DOMAIN_STATES,
    DEFAULT_DNS_HINTS: DEFAULT_DNS_HINTS,
    getConfig: getConfig,
    isVercelConfigured: isVercelConfigured,
    mapVercelDomainStatus: mapVercelDomainStatus,
    getProjectDomain: getProjectDomain,
    addProjectDomain: addProjectDomain,
    syncDomainStatus: syncDomainStatus,
};
