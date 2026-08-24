'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var offers = require('./offers');

function normalizeAccountId(value) {
    return String(value || '').replace(/^act_/, '').trim();
}

function normalizeAccountsInput(accounts) {
    if (!Array.isArray(accounts)) {
        return [];
    }

    var seen = {};
    var normalized = [];

    accounts.forEach(function (entry, index) {
        var accountId = normalizeAccountId(entry && (entry.account_id || entry.id));

        if (!accountId || seen[accountId]) {
            return;
        }

        seen[accountId] = true;
        normalized.push({
            account_id: accountId,
            label: String((entry && entry.label) || '').trim(),
            is_default: Boolean(entry && entry.is_default),
            sort_order: index,
        });
    });

    if (normalized.length && !normalized.some(function (entry) {
        return entry.is_default;
    })) {
        normalized[0].is_default = true;
    }

    return normalized;
}

async function saveOfferMetaAccounts(offerId, accountsInput) {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Base de dados indisponível.');
    }

    var accounts = normalizeAccountsInput(accountsInput);

    var removeResult = await supabase
        .from('hub_offer_meta_accounts')
        .delete()
        .eq('offer_id', offerId);

    if (removeResult.error) {
        throw new Error(removeResult.error.message || 'Não foi possível actualizar contas Meta.');
    }

    if (accounts.length) {
        var rows = accounts.map(function (account, index) {
            return {
                offer_id: offerId,
                account_id: account.account_id,
                label: account.label || ('Conta ' + account.account_id),
                is_default: account.is_default,
                sort_order: index,
            };
        });

        var insertResult = await supabase
            .from('hub_offer_meta_accounts')
            .insert(rows);

        if (insertResult.error) {
            throw new Error(insertResult.error.message || 'Não foi possível guardar contas Meta.');
        }
    }

    await supabase.from('hub_event_log').insert({
        offer_id: offerId,
        event_type: 'meta_accounts_updated',
        source: 'hub',
        payload: {
            count: accounts.length,
            account_ids: accounts.map(function (entry) {
                return entry.account_id;
            }),
        },
    });

    offers.clearOffersCache();

    return {
        count: accounts.length,
        accounts: accounts,
    };
}

module.exports = {
    normalizeAccountId: normalizeAccountId,
    normalizeAccountsInput: normalizeAccountsInput,
    saveOfferMetaAccounts: saveOfferMetaAccounts,
};
