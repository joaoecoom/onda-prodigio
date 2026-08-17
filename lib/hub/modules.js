var hubConfig = require('./config');

var HUB_MODULES = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        description: 'Métricas Stripe, Meta multi-conta, VTurb, ROAS e falhados.',
        href: '/metricas/',
        status: 'live',
        icon: 'chart',
    },
    {
        id: 'tracking',
        label: 'Tracking',
        description: 'Pixel, CAPI, GA4, Stape, health checks e snippet para o funil.',
        href: '/tracking',
        status: 'soon',
        icon: 'radar',
    },
    {
        id: 'recupera',
        label: 'Recupera',
        description: 'Email e WhatsApp — pagamentos falhados, nunca entrou, win-back.',
        href: '/recupera',
        status: 'soon',
        icon: 'recover',
    },
    {
        id: 'impulsiona',
        label: 'Impulsiona',
        description: 'Email e WhatsApp pós-venda — upsell, cross-sell, nurture.',
        href: '/impulsiona',
        status: 'soon',
        icon: 'boost',
    },
    {
        id: 'comunidade',
        label: 'Comunidade',
        description: 'Membros, aulas, módulos, comentários e branding por oferta.',
        href: '/adm/',
        status: 'live',
        icon: 'community',
    },
    {
        id: 'integracoes',
        label: 'Integrações',
        description: 'Stripe, Supabase, Gmail, WhatsApp, VTurb — credenciais por oferta.',
        href: '/integracoes',
        status: 'soon',
        icon: 'plug',
    },
    {
        id: 'funil',
        label: 'Funil',
        description: 'Site público, checkouts e domínio próprio da oferta.',
        href: '',
        status: 'live',
        icon: 'funnel',
        external: true,
    },
];

function getModulesForOffer(offer) {
    return HUB_MODULES.map(function (module) {
        var href = module.href;
        var external = Boolean(module.external);
        var slug = encodeURIComponent(offer.slug);

        if (module.id === 'dashboard') {
            href = '/metricas/?offer=' + slug;
        }

        if (module.id === 'comunidade') {
            href = '/adm/?offer=' + slug;
        }

        if (module.id === 'funil') {
            href = offer.funnel_url || (offer.funnel_domain ? 'https://' + offer.funnel_domain : offer.site_url || '#');
            external = true;
        }

        if (!external && module.href && module.href.indexOf('/') === 0 && module.id !== 'dashboard' && module.id !== 'comunidade') {
            href = module.href + '?offer=' + slug;
        }

        return {
            id: module.id,
            label: module.label,
            description: module.description,
            href: href,
            status: module.status,
            icon: module.icon,
            external: external,
        };
    });
}

module.exports = {
    HUB_MODULES: HUB_MODULES,
    getModulesForOffer: getModulesForOffer,
    getHubBaseUrl: hubConfig.getHubBaseUrl,
};
