'use strict';

var { getSupabaseAdmin } = require('../../supabase-admin');
var save = require('./save');

var MAX_REVISIONS_PER_PAGE = 30;
var DEFAULT_LIST_LIMIT = 20;

function createMemoryStore() {
    var rows = [];

    return {
        rows: rows,
        async insert(row) {
            var record = Object.assign({}, row, {
                id: row.id || require('crypto').randomUUID(),
                created_at: row.created_at || new Date().toISOString(),
            });
            rows.push(record);
            return Object.assign({}, record);
        },
        async listByPage(pageId, limit) {
            return rows
                .filter(function (row) { return row.page_id === pageId; })
                .sort(function (a, b) {
                    return b.revision_number - a.revision_number;
                })
                .slice(0, limit)
                .map(function (row) { return Object.assign({}, row); });
        },
        async getById(id) {
            var row = rows.find(function (item) { return item.id === id; }) || null;
            return row ? Object.assign({}, row) : null;
        },
        async getMaxRevisionNumber(pageId) {
            var max = 0;

            rows.forEach(function (row) {
                if (row.page_id === pageId && row.revision_number > max) {
                    max = row.revision_number;
                }
            });

            return max;
        },
        async deleteBeyond(pageId, keep) {
            var pageRows = rows
                .filter(function (row) { return row.page_id === pageId; })
                .sort(function (a, b) {
                    return b.revision_number - a.revision_number;
                });

            if (pageRows.length <= keep) {
                return;
            }

            var dropIds = pageRows.slice(keep).map(function (row) { return row.id; });
            rows = rows.filter(function (row) {
                return dropIds.indexOf(row.id) === -1;
            });
        },
    };
}

function getDefaultStore() {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        return null;
    }

    return {
        async insert(row) {
            var result = await supabase.from('page_revisions').insert(row).select('*').single();

            if (result.error || !result.data) {
                throw new Error((result.error && result.error.message) || 'Não foi possível criar revisão.');
            }

            return result.data;
        },
        async listByPage(pageId, limit) {
            var result = await supabase
                .from('page_revisions')
                .select('id, page_id, offer_id, revision_number, source, label, page_status, created_at')
                .eq('page_id', pageId)
                .order('revision_number', { ascending: false })
                .limit(limit);

            if (result.error) {
                throw new Error((result.error && result.error.message) || 'Não foi possível listar revisões.');
            }

            return result.data || [];
        },
        async getById(id) {
            var result = await supabase.from('page_revisions').select('*').eq('id', id).maybeSingle();

            if (result.error) {
                throw new Error((result.error && result.error.message) || 'Não foi possível carregar revisão.');
            }

            return result.data || null;
        },
        async getMaxRevisionNumber(pageId) {
            var result = await supabase
                .from('page_revisions')
                .select('revision_number')
                .eq('page_id', pageId)
                .order('revision_number', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (result.error) {
                throw new Error((result.error && result.error.message) || 'Não foi possível calcular revisão.');
            }

            return result.data ? result.data.revision_number : 0;
        },
        async deleteBeyond(pageId, keep) {
            var listResult = await supabase
                .from('page_revisions')
                .select('id')
                .eq('page_id', pageId)
                .order('revision_number', { ascending: false })
                .range(keep, keep + 1000);

            var stale = listResult.data || [];

            if (!stale.length) {
                return;
            }

            var ids = stale.map(function (row) { return row.id; });
            var deleteResult = await supabase.from('page_revisions').delete().in('id', ids);

            if (deleteResult.error) {
                throw new Error((deleteResult.error && deleteResult.error.message) || 'Não foi possível limpar revisões.');
            }
        },
    };
}

function resolveStore(options) {
    if (options && options.store) {
        return options.store;
    }

    return getDefaultStore();
}

function defaultLabel(source) {
    if (source === 'publish') {
        return 'Published';
    }

    if (source === 'restore') {
        return 'Before restore';
    }

    return 'Manual save';
}

async function createRevision(options) {
    var store = resolveStore(options);

    if (!store) {
        return null;
    }

    var offerId = options.offer_id;
    var pageId = options.page_id;
    var tree = options.tree;
    var source = options.source || 'manual';
    var label = String(options.label || defaultLabel(source)).trim();
    var pageStatus = (tree && tree.page && tree.page.status) || 'draft';
    var nextNumber = (await store.getMaxRevisionNumber(pageId)) + 1;

    var row = await store.insert({
        page_id: pageId,
        offer_id: offerId,
        revision_number: nextNumber,
        source: source,
        label: label,
        tree: tree,
        page_status: pageStatus,
    });

    await store.deleteBeyond(pageId, MAX_REVISIONS_PER_PAGE);

    return {
        id: row.id,
        revision_number: row.revision_number,
        source: row.source,
        label: row.label,
        page_status: row.page_status,
        created_at: row.created_at,
    };
}

async function listRevisions(options) {
    var store = resolveStore(options);

    if (!store) {
        return [];
    }

    var limit = options.limit || DEFAULT_LIST_LIMIT;
    var rows = await store.listByPage(options.page_id, limit);

    return rows.map(function (row) {
        return {
            id: row.id,
            revision_number: row.revision_number,
            source: row.source,
            label: row.label,
            page_status: row.page_status,
            created_at: row.created_at,
        };
    });
}

async function getRevisionTree(options) {
    var store = resolveStore(options);
    var row = await store.getById(options.revision_id);

    if (!row) {
        throw Object.assign(new Error('Revisão não encontrada.'), { code: 'NOT_FOUND' });
    }

    if (row.offer_id !== options.offer_id || row.page_id !== options.page_id) {
        throw Object.assign(new Error('Revisão não pertence a esta página.'), { code: 'FORBIDDEN' });
    }

    return row;
}

async function restoreRevision(options) {
    var store = resolveStore(options);
    var service = options.service;
    var offerId = options.offer_id;
    var pageId = options.page_id;
    var revisionId = options.revision_id;
    var currentTree = options.current_tree;

    if (!currentTree || !currentTree.page) {
        throw Object.assign(new Error('current_tree em falta.'), { code: 'VALIDATION_ERROR' });
    }

    var revision = await getRevisionTree({
        store: store,
        offer_id: offerId,
        page_id: pageId,
        revision_id: revisionId,
    });

    await createRevision({
        store: store,
        offer_id: offerId,
        page_id: pageId,
        tree: currentTree,
        source: 'restore',
        label: 'Before restore #' + revision.revision_number,
    });

    var restoredTree = await save.saveTree(
        offerId,
        pageId,
        currentTree,
        revision.tree,
        service
    );

    return {
        tree: restoredTree,
        restored_from: {
            id: revision.id,
            revision_number: revision.revision_number,
            label: revision.label,
            created_at: revision.created_at,
        },
    };
}

module.exports = {
    MAX_REVISIONS_PER_PAGE: MAX_REVISIONS_PER_PAGE,
    createMemoryStore: createMemoryStore,
    createRevision: createRevision,
    listRevisions: listRevisions,
    getRevisionTree: getRevisionTree,
    restoreRevision: restoreRevision,
};
