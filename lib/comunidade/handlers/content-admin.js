'use strict';

var metricsAuth = require('../../metrics/auth');
var authHelpers = require('../auth-helpers');
var contentAdmin = require('../content-admin');
var contentUpload = require('../content-upload');

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string' && req.body.trim()) {
        return JSON.parse(req.body);
    }

    return {};
}

async function authorize(req) {
    if (metricsAuth.isAuthorized(req)) {
        return { ok: true };
    }

    var auth = await authHelpers.getAuthUserFromRequest(req);

    if (auth.error) {
        return { ok: false, status: auth.status, error: auth.error };
    }

    var adminProfile = await authHelpers.getAdminByAuthUser(auth.admin, auth.user);

    if (!adminProfile) {
        return { ok: false, status: 403, error: 'Sem permissão de administrador.' };
    }

    return { ok: true };
}

module.exports = async function handler(req, res) {
    var authResult = await authorize(req);

    if (!authResult.ok) {
        return authHelpers.jsonError(res, authResult.status || 401, authResult.error || 'Não autorizado.');
    }

    try {
        if (req.method === 'GET') {
            var productId = await contentAdmin.resolveProductId({
                productId: req.query.product_id || req.query.product,
                offerSlug: req.query.offer || req.query.slug,
            });

            var tree = await contentAdmin.getContentTree({
                productId: productId,
                offerSlug: req.query.offer || req.query.slug,
            });

            return res.status(200).json(tree);
        }

        if (req.method === 'POST') {
            var body = await readJsonBody(req);
            var action = String(body.action || '').trim();
            var resolvedProductId = await contentAdmin.resolveProductId({
                productId: body.product_id || body.product || req.query.product_id,
                offerSlug: body.offer || body.slug || req.query.offer,
            });

            if (action === 'reorder') {
                var tree = await contentAdmin.reorderContentItems(
                    resolvedProductId,
                    body.parent_id || null,
                    body.ordered_ids || body.ids || []
                );

                return res.status(200).json({ ok: true, tree: tree });
            }

            if (action === 'create_module') {
                var createdModule = await contentAdmin.createContentModule(resolvedProductId, body);

                return res.status(201).json({
                    ok: true,
                    item: createdModule,
                    tree: await contentAdmin.getContentTree({ productId: resolvedProductId }),
                });
            }

            if (action === 'create_lesson') {
                var createdLesson = await contentAdmin.createContentLesson(
                    resolvedProductId,
                    body.parent_id,
                    body
                );

                return res.status(201).json({
                    ok: true,
                    item: createdLesson,
                    tree: await contentAdmin.getContentTree({ productId: resolvedProductId }),
                });
            }

            if (action === 'update') {
                if (!body.id) {
                    return res.status(400).json({ error: 'ID em falta.' });
                }

                var updated = await contentAdmin.updateContentItem(body.id, body.patch || body);

                return res.status(200).json({
                    ok: true,
                    item: updated,
                });
            }

            if (action === 'delete') {
                if (!body.id) {
                    return res.status(400).json({ error: 'ID em falta.' });
                }

                var deleted = await contentAdmin.deleteContentItem(body.id);

                return res.status(200).json({
                    ok: true,
                    deleted: deleted,
                    tree: await contentAdmin.getContentTree({ productId: deleted.product_id }),
                });
            }

            if (action === 'prepare_upload') {
                if (!body.id || !body.field) {
                    return res.status(400).json({ error: 'Item ou campo em falta.' });
                }

                var itemForUpload = await contentAdmin.getContentItem(body.id);
                var prepared = await contentUpload.prepareContentUpload({
                    productId: itemForUpload.product_id,
                    itemId: itemForUpload.id,
                    field: body.field,
                    filename: body.filename,
                    contentType: body.content_type,
                });

                return res.status(200).json({ ok: true, upload: prepared });
            }

            if (action === 'upload') {
                if (!body.id || !body.field) {
                    return res.status(400).json({ error: 'Item ou campo em falta.' });
                }

                var itemForBase64 = await contentAdmin.getContentItem(body.id);
                var uploaded = await contentUpload.uploadContentFileBase64({
                    productId: itemForBase64.product_id,
                    itemId: itemForBase64.id,
                    field: body.field,
                    filename: body.filename,
                    contentType: body.content_type,
                    contentBase64: body.content_base64,
                });

                var patch = {};
                patch[uploaded.field] = uploaded.public_url;

                var itemAfterUpload = await contentAdmin.updateContentItem(body.id, patch);

                return res.status(200).json({
                    ok: true,
                    upload: uploaded,
                    item: itemAfterUpload,
                });
            }

            return res.status(400).json({ error: 'Acção inválida.' });
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('content-admin falhou:', error);
        return res.status(400).json({
            error: error.message || 'Não foi possível gerir conteúdo.',
        });
    }
};
