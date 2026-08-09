var DEFAULT_ACCOUNTS = [
    { id: '1078209721038923', label: 'Onda Prodígio' },
];

function normalizeAccountId(value) {
    return String(value || '').replace(/^act_/, '').trim();
}

function parseAccountsFromEnv() {
    var raw = String(process.env.META_AD_ACCOUNTS || '').trim();

    if (raw) {
        try {
            var parsed = JSON.parse(raw);

            if (Array.isArray(parsed) && parsed.length) {
                return parsed.map(function (entry) {
                    if (typeof entry === 'string' || typeof entry === 'number') {
                        return {
                            id: normalizeAccountId(entry),
                            label: '',
                        };
                    }

                    return {
                        id: normalizeAccountId(entry.id || entry.account_id),
                        label: String(entry.label || entry.name || '').trim(),
                    };
                }).filter(function (entry) {
                    return Boolean(entry.id);
                });
            }
        } catch (error) {
            // Fallback to comma-separated IDs below.
        }
    }

    var ids = String(process.env.META_AD_ACCOUNT_IDS || '').trim();

    if (ids) {
        return ids.split(',').map(function (part) {
            return {
                id: normalizeAccountId(part),
                label: '',
            };
        }).filter(function (entry) {
            return Boolean(entry.id);
        });
    }

    return DEFAULT_ACCOUNTS.slice();
}

function getConfiguredAccounts() {
    return parseAccountsFromEnv();
}

function getAccountConfig(accountId) {
    var normalized = normalizeAccountId(accountId);
    var accounts = getConfiguredAccounts();

    return accounts.find(function (account) {
        return account.id === normalized;
    }) || null;
}

function isAllowedAccountId(accountId) {
    return Boolean(getAccountConfig(accountId));
}

function toActId(accountId) {
    var normalized = normalizeAccountId(accountId);
    return normalized ? 'act_' + normalized : '';
}

module.exports = {
    normalizeAccountId: normalizeAccountId,
    getConfiguredAccounts: getConfiguredAccounts,
    getAccountConfig: getAccountConfig,
    isAllowedAccountId: isAllowedAccountId,
    toActId: toActId,
};
