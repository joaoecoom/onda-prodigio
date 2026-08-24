var stripeClient = require('../lib/hub/stripe-client');
var checkoutResolver = require('../lib/hub/checkout-resolver');
var checkoutBuilder = require('../lib/hub/checkout-builder');
var productCheckoutConfig = require('../lib/product-checkout-config');

module.exports = async function handler(req, res) {
    var stripeContext = await stripeClient.resolveStripeContext(req, req.query || {});
    var settings = stripeContext.settings;
    var checkoutId = require('../lib/stripe-env').resolveCheckoutId(req, null);
    var productId = typeof req.query.product_id === 'string' ? req.query.product_id.trim() : '';

    if (stripeContext.error || !settings.publishableKey) {
        return res.status(500).json({ error: stripeContext.error || 'Stripe não configurado.' });
    }

    if (checkoutId === 'main' && stripeContext.offer) {
        try {
            var universal = await checkoutResolver.resolveUniversalCheckout(stripeContext.offer, {
                checkoutId: 'main',
                mode: settings.mode,
                productId: productId || stripeContext.offer.primary_product_id,
            });

            var bumps = await checkoutResolver.listCheckoutBumps(stripeContext.offer);
            var template = await checkoutBuilder.getTemplate(stripeContext.offer.id, {
                autoSeed: true,
                offerName: settings.offerName || stripeContext.offer.name,
                offerSlug: settings.offerSlug || stripeContext.offer.slug,
            });

            var productImage = '';
            var productAuthor = '';
            var productDescription = '';

            try {
                var productsService = require('../lib/comunidade/products-service');
                var productRow = await productsService.getProduct(universal.productId);

                if (productRow) {
                    productImage = productRow.image_url || '';
                    productDescription = productRow.description || '';
                }
            } catch (_) {
                /* product media is optional */
            }

            if (stripeContext.offer.branding && stripeContext.offer.branding.author) {
                productAuthor = stripeContext.offer.branding.author;
            }

            var bumpProductIds = bumps.map(function (row) {
                return row.product_id;
            }).filter(Boolean);
            var bumpMedia = {};

            if (bumpProductIds.length) {
                try {
                    var { getSupabaseAdmin } = require('../lib/supabase-admin');
                    var supabase = getSupabaseAdmin();

                    if (supabase) {
                        var mediaResult = await supabase
                            .from('products')
                            .select('id, name, description, image_url')
                            .in('id', bumpProductIds);

                        (mediaResult.data || []).forEach(function (row) {
                            bumpMedia[row.id] = row;
                        });
                    }
                } catch (_) {
                    /* bump media optional */
                }
            }

            return res.status(200).json({
                publishableKey: settings.publishableKey,
                amountCents: universal.amountCents,
                currency: universal.currency,
                productId: universal.productId,
                productName: settings.offerName || stripeContext.offer.name,
                productImage: productImage,
                productAuthor: productAuthor,
                productDescription: productDescription,
                mode: settings.mode,
                checkoutId: 'main',
                checkoutPath: universal.checkoutPath,
                thankYouPath: universal.successPath,
                offerId: settings.offerId || undefined,
                offerSlug: settings.offerSlug || undefined,
                template: template,
                orderBumps: bumps.map(function (row) {
                    var media = bumpMedia[row.product_id] || {};

                    return {
                        bumpId: row.bump_id,
                        productId: row.product_id,
                        label: row.label || media.name || row.bump_id,
                        description: media.description || '',
                        imageUrl: media.image_url || '',
                        amountCents: row.amount_cents,
                    };
                }),
            });
        } catch (error) {
            return res.status(400).json({ error: error.message || 'Checkout indisponível.' });
        }
    }

    if (productId) {
        var product = productCheckoutConfig.getProduct(productId);

        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        return res.status(200).json({
            product: productCheckoutConfig.toPublicProduct(product, settings.mode),
            publishableKey: settings.publishableKey,
            mode: settings.mode,
            offerId: settings.offerId || undefined,
            offerSlug: settings.offerSlug || undefined,
        });
    }

    return res.status(200).json({
        publishableKey: settings.publishableKey,
        amountCents: settings.amountCents,
        currency: 'eur',
        productName: settings.offerName || 'Onda Prodígio',
        mode: settings.mode,
        checkoutId: settings.checkoutId,
        checkoutPath: settings.checkoutPath,
        thankYouPath: settings.thankYouPath,
        offerId: settings.offerId || undefined,
        offerSlug: settings.offerSlug || undefined,
    });
};
