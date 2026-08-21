'use strict';

var { getSupabaseAdmin } = require('../supabase-admin');
var offers = require('./offers');
var funnelRepository = require('./funnel-engine/repository');
var legacyProducts = require('../comunidade/legacy-products');
var checkoutResolver = require('./checkout-resolver');
var vercelDomains = require('./vercel-domains');
var offerContext = require('./offer-context');

var READINESS = {
    READY: 'ready',
    ALMOST: 'almost_ready',
    NOT_READY: 'not_ready',
};

function makeCheck(input) {
    return {
        id: input.id,
        label: input.label,
        group: input.group,
        status: input.status || 'fail',
        severity: input.severity || 'critical',
        message: input.message || '',
        cause: input.cause || '',
        solution: input.solution || '',
        action: input.action || null,
        details: input.details || null,
    };
}

function pickStripeKeys(integrations, mode) {
    var data = integrations || {};
    var isTest = mode === 'test';

    return {
        secret: isTest
            ? String(data.stripe_test_secret_key || '').trim()
            : String(data.stripe_secret_key || '').trim(),
        publishable: isTest
            ? String(data.stripe_test_publishable_key || '').trim()
            : String(data.stripe_publishable_key || '').trim(),
        webhook: String(data.stripe_webhook_secret || '').trim(),
    };
}

function findMainCheckout(offer) {
    return (offer.checkouts || []).find(function (row) {
        return row.checkout_id === 'main';
    }) || (offer.checkouts || [])[0] || null;
}

function findCheckoutCtaBlocks(blocks, offer) {
    var matches = [];

    (blocks || []).forEach(function (block) {
        if (block.type !== 'button') {
            return;
        }

        var settings = block.settings || {};
        var content = block.content || {};
        var action = settings.action || content.action || '';

        if (action === 'checkout') {
            matches.push(block);
            return;
        }

        var href = String(content.href || settings.href || '');

        if (href.indexOf('/checkout/?') !== -1 || href.indexOf('/checkout?') !== -1) {
            matches.push(block);
        }
    });

    return matches.filter(function (block) {
        var settings = block.settings || {};
        var content = block.content || {};
        var productId = String(settings.product_id || content.product_id || offer.primary_product_id || '').trim();

        return Boolean(productId);
    });
}

function checkOffer(offer) {
    if (!offer || !offer.id) {
        return makeCheck({
            id: 'offer',
            label: 'Oferta',
            group: 'setup',
            status: 'fail',
            severity: 'critical',
            message: 'Oferta não encontrada.',
            cause: 'ID/slug inválido.',
            solution: 'Selecciona uma oferta válida no HUB.',
        });
    }

    if (!offers.normalizeSlug(offer.slug)) {
        return makeCheck({
            id: 'offer',
            label: 'Oferta',
            group: 'setup',
            status: 'fail',
            severity: 'critical',
            message: 'Slug inválido.',
            cause: 'O slug não cumpre o formato esperado.',
            solution: 'Actualiza o slug em Definições.',
            action: { moduleId: 'definicoes', label: 'Abrir definições' },
        });
    }

    return makeCheck({
        id: 'offer',
        label: 'Oferta',
        group: 'setup',
        status: 'pass',
        severity: 'critical',
        message: offer.status === 'active' ? 'Oferta activa.' : 'Oferta em rascunho.',
        details: { status: offer.status, slug: offer.slug },
    });
}

function checkProduct(offer, product) {
    if (!offer.primary_product_id && !product) {
        return makeCheck({
            id: 'product',
            label: 'Produto',
            group: 'setup',
            status: 'fail',
            severity: 'critical',
            message: 'Produto principal em falta.',
            cause: 'A oferta não tem produto provisionado.',
            solution: 'Recria a oferta ou associa um produto principal.',
        });
    }

    if (!product) {
        return makeCheck({
            id: 'product',
            label: 'Produto',
            group: 'setup',
            status: 'fail',
            severity: 'critical',
            message: 'Produto não encontrado.',
            cause: 'O produto principal não existe na base de dados.',
            solution: 'Verifica o provisioning da oferta.',
        });
    }

    if (product.offer_id && product.offer_id !== offer.id) {
        return makeCheck({
            id: 'product',
            label: 'Produto',
            group: 'setup',
            status: 'fail',
            severity: 'critical',
            message: 'Produto não pertence a esta oferta.',
            cause: 'offer_id do produto não coincide.',
            solution: 'Corrige a associação produto ↔ oferta.',
        });
    }

    return makeCheck({
        id: 'product',
        label: 'Produto',
        group: 'setup',
        status: 'pass',
        severity: 'critical',
        message: 'Produto "' + product.name + '" ligado à oferta.',
        details: { product_id: product.id },
    });
}

function checkFunnel(funnels, offer) {
    var owned = (funnels || []).filter(function (funnel) {
        return funnel.offer_id === offer.id;
    });

    if (!owned.length) {
        return makeCheck({
            id: 'funnel',
            label: 'Funil',
            group: 'funnel',
            status: 'fail',
            severity: 'critical',
            message: 'Nenhum funil criado.',
            cause: 'Não existe funnel para esta oferta.',
            solution: 'Cria o primeiro funil no Page Engine.',
            action: { moduleId: 'funil', navKey: 'funil', label: 'Criar funil' },
        });
    }

    return makeCheck({
        id: 'funnel',
        label: 'Funil',
        group: 'funnel',
        status: 'pass',
        severity: 'critical',
        message: owned.length + ' funil(is) configurado(s).',
        details: { count: owned.length },
    });
}

function checkSalesPage(pages, funnels, offer) {
    var funnelIds = {};
    (funnels || []).forEach(function (funnel) {
        if (funnel.offer_id === offer.id) {
            funnelIds[funnel.id] = funnel;
        }
    });

    var ownedPages = (pages || []).filter(function (page) {
        return funnelIds[page.funnel_id];
    });
    var published = ownedPages.filter(function (page) {
        return page.status === 'published';
    });

    if (!ownedPages.length) {
        return makeCheck({
            id: 'sales_page',
            label: 'Sales Page',
            group: 'funnel',
            status: 'fail',
            severity: 'critical',
            message: 'Nenhuma página criada.',
            cause: 'O funil não tem pages.',
            solution: 'Cria uma sales page no Page Engine.',
            action: { moduleId: 'funil', navKey: 'pages', label: 'Criar página' },
        });
    }

    if (!published.length) {
        return makeCheck({
            id: 'sales_page',
            label: 'Sales Page',
            group: 'funnel',
            status: 'fail',
            severity: 'critical',
            message: 'Sales page não publicada.',
            cause: 'Existem pages em draft mas nenhuma publicada.',
            solution: 'Publica a página principal do funil.',
            action: { moduleId: 'funil', navKey: 'pages', label: 'Publicar página' },
        });
    }

    return makeCheck({
        id: 'sales_page',
        label: 'Sales Page',
        group: 'funnel',
        status: 'pass',
        severity: 'critical',
        message: published.length + ' página(s) publicada(s).',
        details: {
            published: published.map(function (page) {
                return { id: page.id, slug: page.slug, name: page.name };
            }),
        },
    });
}

function checkCtaCheckout(blocks, offer) {
    var ctas = findCheckoutCtaBlocks(blocks, offer);

    if (!ctas.length) {
        return makeCheck({
            id: 'cta_checkout',
            label: 'CTA → Checkout',
            group: 'funnel',
            status: 'fail',
            severity: 'critical',
            message: 'Nenhum CTA comercial encontrado.',
            cause: 'Nenhum botão com action=checkout ou link para /checkout/.',
            solution: 'Adiciona um botão com acção "checkout" na sales page.',
            action: { moduleId: 'funil', navKey: 'pages', label: 'Editar página' },
        });
    }

    return makeCheck({
        id: 'cta_checkout',
        label: 'CTA → Checkout',
        group: 'funnel',
        status: 'pass',
        severity: 'critical',
        message: ctas.length + ' CTA(s) com checkout detectado(s).',
        details: { count: ctas.length },
    });
}

function checkCheckoutConfig(offer) {
    var checkout = findMainCheckout(offer);

    if (!checkout) {
        return makeCheck({
            id: 'checkout',
            label: 'Checkout',
            group: 'setup',
            status: 'fail',
            severity: 'critical',
            message: 'Checkout não configurado.',
            cause: 'Não existe linha em hub_offer_checkouts.',
            solution: 'Reprovisiona a oferta ou configura checkout main.',
        });
    }

    var amount = parseInt(checkout.amount_cents, 10);

    if (!Number.isFinite(amount) || amount < 50) {
        return makeCheck({
            id: 'checkout',
            label: 'Checkout',
            group: 'setup',
            status: 'fail',
            severity: 'critical',
            message: 'Valor de checkout inválido.',
            cause: 'amount_cents em falta ou abaixo do mínimo Stripe.',
            solution: 'Define um preço válido (≥ €0,50).',
            action: { moduleId: 'integracoes', label: 'Configurar checkout' },
        });
    }

    return makeCheck({
        id: 'checkout',
        label: 'Checkout',
        group: 'setup',
        status: 'pass',
        severity: 'critical',
        message: 'Checkout universal configurado.',
        details: {
            path: checkout.path,
            amount_cents: amount,
            product_id: checkout.product_id || offer.primary_product_id,
        },
    });
}

function checkStripe(offer, integrations) {
    var mode = offer.mode === 'test' ? 'test' : 'live';
    var keys = pickStripeKeys(integrations, mode);

    if (!keys.secret || !keys.publishable) {
        return makeCheck({
            id: 'stripe',
            label: 'Stripe',
            group: 'stripe',
            status: 'fail',
            severity: 'critical',
            message: 'Stripe não configurado.',
            cause: 'Chaves Stripe em falta para modo ' + mode + '.',
            solution: 'Configura Stripe na oferta (Integrações).',
            action: { moduleId: 'integracoes', label: 'Configurar Stripe' },
        });
    }

    return makeCheck({
        id: 'stripe',
        label: 'Stripe',
        group: 'stripe',
        status: 'pass',
        severity: 'critical',
        message: 'Stripe conectado (' + mode + ').',
    });
}

function checkStripeWebhook(integrations) {
    var webhook = pickStripeKeys(integrations, 'live').webhook;

    if (!webhook) {
        return makeCheck({
            id: 'stripe_webhook',
            label: 'Webhook Stripe',
            group: 'stripe',
            status: 'warning',
            severity: 'critical',
            message: 'Webhook secret em falta.',
            cause: 'stripe_webhook_secret não configurado.',
            solution: 'Configura o webhook na Stripe e cola o signing secret.',
            action: { moduleId: 'integracoes', label: 'Configurar webhook' },
        });
    }

    return makeCheck({
        id: 'stripe_webhook',
        label: 'Webhook Stripe',
        group: 'stripe',
        status: 'pass',
        severity: 'critical',
        message: 'Webhook secret configurado.',
        cause: '',
        solution: 'Validação funcional depende de evento real na Stripe.',
    });
}

function checkTracking(integrations) {
    var data = integrations || {};
    var checks = [];

    checks.push(makeCheck({
        id: 'tracking_meta_pixel',
        label: 'Meta Pixel',
        group: 'tracking',
        status: data.meta_pixel_id ? 'pass' : 'warning',
        severity: 'important',
        message: data.meta_pixel_id ? 'Pixel configurado.' : 'Pixel Meta em falta.',
        action: data.meta_pixel_id ? null : { moduleId: 'tracking', label: 'Configurar Meta' },
    }));

    checks.push(makeCheck({
        id: 'tracking_meta_capi',
        label: 'Meta CAPI',
        group: 'tracking',
        status: data.meta_access_token ? 'pass' : 'warning',
        severity: 'important',
        message: data.meta_access_token ? 'CAPI configurado.' : 'Access token Meta em falta.',
        action: data.meta_access_token ? null : { moduleId: 'tracking', label: 'Configurar CAPI' },
    }));

    checks.push(makeCheck({
        id: 'tracking_ga4',
        label: 'GA4',
        group: 'tracking',
        status: data.ga4_measurement_id ? 'pass' : 'warning',
        severity: 'important',
        message: data.ga4_measurement_id ? 'GA4 configurado.' : 'GA4 em falta.',
        action: data.ga4_measurement_id ? null : { moduleId: 'tracking', label: 'Configurar GA4' },
    }));

    return checks;
}

function checkPurchaseRuntime() {
    return makeCheck({
        id: 'purchase_tracking',
        label: 'Purchase tracking',
        group: 'tracking',
        status: 'pass',
        severity: 'important',
        message: 'Runtime purchase activo (webhook → hub_orders → CAPI/GA4).',
        cause: '',
        solution: 'Confirma com um pagamento teste após deploy.',
    });
}

function checkCommunity(offer, product, contentCount) {
    if (!product) {
        return [makeCheck({
            id: 'community',
            label: 'Comunidade',
            group: 'community',
            status: 'fail',
            severity: 'critical',
            message: 'Produto de comunidade em falta.',
        })];
    }

    var generic = legacyProducts.usesGenericRenderer(product.id);

    var contentCheck = makeCheck({
        id: 'community_content',
        label: 'Conteúdo comunidade',
        group: 'community',
        status: contentCount > 0 ? 'pass' : 'warning',
        severity: 'optional',
        message: contentCount > 0
            ? contentCount + ' item(ns) de conteúdo.'
            : 'Comunidade vazia — aceitável para lançamento inicial.',
        action: contentCount > 0 ? null : { moduleId: 'comunidade', label: 'Adicionar conteúdo' },
    });

    var accessCheck = makeCheck({
        id: 'community_access',
        label: 'Member access',
        group: 'community',
        status: 'pass',
        severity: 'critical',
        message: generic
            ? 'Renderer genérico disponível para "' + product.id + '".'
            : 'Produto legacy — renderer específico.',
        details: { generic_renderer: generic },
    });

    return [accessCheck, contentCheck];
}

function checkDomain(offer, domainRows, domainStatus) {
    var funnelDomain = String(offer.funnel_domain || '').trim().toLowerCase();
    var primary = (domainRows || []).find(function (row) {
        return row.domain_type === 'funnel' && row.is_primary;
    }) || (domainRows || []).find(function (row) {
        return row.domain_type === 'funnel';
    });

    if (!funnelDomain && !primary) {
        return makeCheck({
            id: 'domain',
            label: 'Domínio',
            group: 'domain',
            status: 'warning',
            severity: 'important',
            message: 'Domínio funil não configurado.',
            cause: 'Podes lançar via /p/ ou preview, mas não há domínio próprio.',
            solution: 'Configura o domínio público da oferta.',
            action: { moduleId: 'dominios', label: 'Configurar domínio' },
        });
    }

    var domain = funnelDomain || (primary && primary.domain) || '';
    var status = (domainStatus && domainStatus.status) ||
        (primary && primary.status) ||
        vercelDomains.DOMAIN_STATES.NOT_CONFIGURED;

    if (status === vercelDomains.DOMAIN_STATES.ACTIVE) {
        return makeCheck({
            id: 'domain',
            label: 'Domínio',
            group: 'domain',
            status: 'pass',
            severity: 'important',
            message: 'Domínio activo: ' + domain,
            details: { domain: domain, ssl: true },
        });
    }

    if (!vercelDomains.isVercelConfigured()) {
        return makeCheck({
            id: 'domain',
            label: 'Domínio',
            group: 'domain',
            status: 'warning',
            severity: 'important',
            message: domain + ' — VERCEL AUTOMATION NOT CONFIGURED',
            cause: 'VERCEL_TOKEN/VERCEL_PROJECT_ID em falta no runtime.',
            solution: 'Configura VERCEL_TOKEN e VERCEL_PROJECT_ID ou valida DNS manualmente. O runtime principal continua funcional via /p/{offer}/{funnel}/{page}.',
            action: { moduleId: 'dominios', label: 'Ver domínio' },
            details: {
                domain: domain,
                status: status,
                dns_records: vercelDomains.DEFAULT_DNS_HINTS,
            },
        });
    }

    if (status === vercelDomains.DOMAIN_STATES.DNS_REQUIRED) {
        return makeCheck({
            id: 'domain',
            label: 'Domínio',
            group: 'domain',
            status: 'warning',
            severity: 'important',
            message: 'DNS necessário para ' + domain,
            cause: (domainStatus && domainStatus.message) || 'Registos DNS em falta.',
            solution: 'Adiciona os registos DNS e clica Verificar.',
            action: { moduleId: 'dominios', label: 'Verificar domínio' },
            details: {
                domain: domain,
                dns_records: (domainStatus && domainStatus.dns_records) || vercelDomains.DEFAULT_DNS_HINTS,
            },
        });
    }

    return makeCheck({
        id: 'domain',
        label: 'Domínio',
        group: 'domain',
        status: status === vercelDomains.DOMAIN_STATES.ERROR ? 'fail' : 'warning',
        severity: 'important',
        message: domain + ' — ' + ((domainStatus && domainStatus.message) || status),
        action: { moduleId: 'dominios', label: 'Verificar domínio' },
        details: { domain: domain, status: status },
    });
}

function checkDomainRouting(offer, domainRows) {
    var domains = (domainRows || [])
        .filter(function (row) {
            return row.domain_type === 'funnel';
        })
        .map(function (row) {
            return String(row.domain || '').toLowerCase();
        })
        .filter(Boolean);

    if (!domains.length && !offer.funnel_domain) {
        return makeCheck({
            id: 'domain_routing',
            label: 'Routing domínio → oferta',
            group: 'domain',
            status: 'skip',
            severity: 'important',
            message: 'Sem domínio para validar routing.',
        });
    }

    return makeCheck({
        id: 'domain_routing',
        label: 'Routing domínio → oferta',
        group: 'domain',
        status: 'pass',
        severity: 'important',
        message: 'Domínio(s) mapeado(s) exclusivamente a esta oferta.',
        details: { domains: domains.length ? domains : [offer.funnel_domain] },
    });
}

async function checkCommercialSmoke(offer, integrations, product) {
    var issues = [];

    try {
        await checkoutResolver.resolveUniversalCheckout(offer, {
            checkoutId: 'main',
            mode: offer.mode === 'test' ? 'test' : 'live',
            productId: product && product.id,
        });
    } catch (error) {
        issues.push(error.message || 'Checkout resolver falhou.');
    }

    var keys = pickStripeKeys(integrations, offer.mode === 'test' ? 'test' : 'live');

    if (!keys.secret) {
        issues.push('Stripe secret em falta.');
    }

    if (!product) {
        issues.push('Produto em falta.');
    }

    if (issues.length) {
        return makeCheck({
            id: 'commercial_smoke',
            label: 'Teste comercial',
            group: 'commercial',
            status: 'fail',
            severity: 'critical',
            message: 'Fluxo comercial incompleto.',
            cause: issues.join(' '),
            solution: 'Corrige checkout, Stripe e produto antes de lançar.',
        });
    }

    return makeCheck({
        id: 'commercial_smoke',
        label: 'Teste comercial',
        group: 'commercial',
        status: 'pass',
        severity: 'critical',
        message: 'Configuração comercial válida (offer → produto → checkout → Stripe).',
        solution: 'Executa pagamento teste 4242… após deploy para validar webhook.',
    });
}

function checkTestOrder(ordersCount) {
    return makeCheck({
        id: 'test_order',
        label: 'Order de teste',
        group: 'commercial',
        status: ordersCount > 0 ? 'pass' : 'warning',
        severity: 'optional',
        message: ordersCount > 0
            ? ordersCount + ' order(s) registada(s) em hub_orders.'
            : 'Nenhuma order ainda — recomendado testar checkout em test mode.',
    });
}

function groupChecks(checks) {
    var groups = {};
    var order = ['setup', 'funnel', 'stripe', 'tracking', 'community', 'domain', 'commercial'];
    var labels = {
        setup: 'Setup',
        funnel: 'Funil',
        stripe: 'Stripe',
        tracking: 'Tracking',
        community: 'Comunidade',
        domain: 'Domínio',
        commercial: 'Comercial',
    };

    checks.forEach(function (check) {
        if (!groups[check.group]) {
            groups[check.group] = {
                id: check.group,
                label: labels[check.group] || check.group,
                checks: [],
            };
        }

        groups[check.group].checks.push(check);
    });

    return order
        .filter(function (id) {
            return groups[id];
        })
        .map(function (id) {
            return groups[id];
        });
}

function computeReadiness(checks) {
    var criticalFails = checks.filter(function (check) {
        return check.severity === 'critical' && check.status === 'fail';
    });
    var importantIssues = checks.filter(function (check) {
        return check.severity === 'important' && (check.status === 'fail' || check.status === 'warning');
    });

    if (criticalFails.length) {
        return {
            readiness: READINESS.NOT_READY,
            ready: false,
            label: 'NOT READY',
            emoji: '🔴',
            critical_failures: criticalFails.length,
            important_warnings: importantIssues.length,
        };
    }

    if (importantIssues.length) {
        return {
            readiness: READINESS.ALMOST,
            ready: false,
            label: 'ALMOST READY',
            emoji: '🟡',
            critical_failures: 0,
            important_warnings: importantIssues.length,
        };
    }

    return {
        readiness: READINESS.READY,
        ready: true,
        label: 'READY TO LAUNCH',
        emoji: '🟢',
        critical_failures: 0,
        important_warnings: 0,
    };
}

async function loadLaunchContext(slug, options) {
    var normalizedSlug = offers.normalizeSlug(slug);

    if (!normalizedSlug) {
        throw new Error('Oferta inválida.');
    }

    var offer = await offers.getOfferBySlug(normalizedSlug, {
        forceRefresh: Boolean(options && options.refresh),
    });

    if (!offer) {
        throw new Error('Oferta não encontrada.');
    }

    var supabase = getSupabaseAdmin();
    var integrations = await offers.getOfferIntegrations(offer.id, { includeSecrets: true });
    var funnels = await funnelRepository.listFunnels(offer.id);
    var pages = [];

    for (var i = 0; i < funnels.length; i += 1) {
        var funnelPages = await funnelRepository.listPages(funnels[i].id);
        pages = pages.concat(funnelPages);
    }

    var blocks = [];
    var contentCount = 0;
    var ordersCount = 0;

    if (supabase) {
        var blocksResult = await supabase
            .from('page_blocks')
            .select('id, type, content, settings, offer_id, page_id')
            .eq('offer_id', offer.id);

        if (!blocksResult.error) {
            blocks = blocksResult.data || [];
        }

        if (offer.primary_product_id) {
            var contentResult = await supabase
                .from('content_items')
                .select('id', { count: 'exact', head: true })
                .eq('product_id', offer.primary_product_id);

            if (!contentResult.error) {
                contentCount = contentResult.count || 0;
            }
        }

        var ordersResult = await supabase
            .from('hub_orders')
            .select('id', { count: 'exact', head: true })
            .eq('offer_id', offer.id)
            .eq('status', 'paid');

        ordersCount = ordersResult.error ? 0 : (ordersResult.count || 0);
    }

    var domainRows = await offerContext.fetchOfferDomains(offer.id);
    var product = offer.primary_product_id
        ? await offerContext.fetchPrimaryProduct(offer.primary_product_id)
        : null;

    var domainStatus = null;
    var funnelDomain = String(offer.funnel_domain || '').trim().toLowerCase();

    if (funnelDomain && options && options.syncDomain) {
        try {
            domainStatus = await vercelDomains.syncDomainStatus(funnelDomain);

            if (supabase && domainStatus) {
                await supabase
                    .from('hub_offer_domains')
                    .update({
                        status: domainStatus.status,
                        dns_records: domainStatus.dns_records || [],
                        status_message: domainStatus.message || '',
                        last_checked_at: new Date().toISOString(),
                    })
                    .eq('offer_id', offer.id)
                    .eq('domain_type', 'funnel');
            }
        } catch (error) {
            domainStatus = {
                status: vercelDomains.DOMAIN_STATES.ERROR,
                message: error.message || 'Erro Vercel.',
            };
        }
    } else if (supabase && domainRows.length) {
        var primaryDomain = domainRows.find(function (row) {
            return row.domain_type === 'funnel';
        });

        if (primaryDomain && primaryDomain.status) {
            domainStatus = {
                status: primaryDomain.status,
                message: primaryDomain.status_message || '',
                dns_records: primaryDomain.dns_records || [],
            };
        }
    }

    return {
        offer: offer,
        integrations: integrations,
        funnels: funnels,
        pages: pages,
        blocks: blocks,
        product: product,
        domainRows: domainRows,
        domainStatus: domainStatus,
        contentCount: contentCount,
        ordersCount: ordersCount,
    };
}

async function evaluateLaunchReadiness(slug, options) {
    var ctx = await loadLaunchContext(slug, options);
    var offer = ctx.offer;
    var checks = [
        checkOffer(offer),
        checkProduct(offer, ctx.product),
        checkCheckoutConfig(offer),
        checkFunnel(ctx.funnels, offer),
        checkSalesPage(ctx.pages, ctx.funnels, offer),
        checkCtaCheckout(ctx.blocks, offer),
        checkStripe(offer, ctx.integrations),
        checkStripeWebhook(ctx.integrations),
    ].concat(
        checkTracking(ctx.integrations),
        [checkPurchaseRuntime()],
        checkCommunity(offer, ctx.product, ctx.contentCount),
        [
            checkDomain(offer, ctx.domainRows, ctx.domainStatus),
            checkDomainRouting(offer, ctx.domainRows),
            await checkCommercialSmoke(offer, ctx.integrations, ctx.product),
            checkTestOrder(ctx.ordersCount),
        ]
    );

    var flatChecks = checks.reduce(function (list, entry) {
        return list.concat(Array.isArray(entry) ? entry : [entry]);
    }, []);
    var summary = computeReadiness(flatChecks);
    var issues = flatChecks.filter(function (check) {
        return check.status === 'fail' || check.status === 'warning';
    }).map(function (check) {
        return {
            id: check.id,
            label: check.label,
            status: check.status,
            severity: check.severity,
            message: check.message,
            cause: check.cause,
            solution: check.solution,
            action: check.action,
        };
    });

    return {
        offer: {
            id: offer.id,
            slug: offer.slug,
            name: offer.name,
            status: offer.status,
        },
        ready: summary.ready,
        readiness: summary.readiness,
        label: summary.label,
        emoji: summary.emoji,
        summary: {
            passed: flatChecks.filter(function (check) { return check.status === 'pass'; }).length,
            warnings: flatChecks.filter(function (check) { return check.status === 'warning'; }).length,
            failures: flatChecks.filter(function (check) { return check.status === 'fail'; }).length,
            critical_failures: summary.critical_failures,
            important_warnings: summary.important_warnings,
        },
        groups: groupChecks(flatChecks),
        checks: flatChecks,
        issues: issues,
        generated_at: new Date().toISOString(),
    };
}

module.exports = {
    READINESS: READINESS,
    makeCheck: makeCheck,
    checkOffer: checkOffer,
    checkProduct: checkProduct,
    checkFunnel: checkFunnel,
    checkSalesPage: checkSalesPage,
    checkCtaCheckout: checkCtaCheckout,
    checkCheckoutConfig: checkCheckoutConfig,
    checkStripe: checkStripe,
    checkStripeWebhook: checkStripeWebhook,
    checkTracking: checkTracking,
    checkCommunity: checkCommunity,
    checkDomain: checkDomain,
    checkDomainRouting: checkDomainRouting,
    checkCommercialSmoke: checkCommercialSmoke,
    checkTestOrder: checkTestOrder,
    computeReadiness: computeReadiness,
    findCheckoutCtaBlocks: findCheckoutCtaBlocks,
    evaluateLaunchReadiness: evaluateLaunchReadiness,
    loadLaunchContext: loadLaunchContext,
};
