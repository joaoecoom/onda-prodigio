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
    var isDraft = offer.status === 'draft';

    return HUB_MODULES.map(function (module) {
        var href = module.href;
        var external = Boolean(module.external);
        var slug = encodeURIComponent(offer.slug);
        var status = module.status;

        if (isDraft) {
            status = 'soon';
        }

        if (module.id === 'dashboard' && !isDraft) {
            href = '/metricas/?offer=' + slug;
            status = 'live';
        }

        if (module.id === 'comunidade' && !isDraft) {
            href = '/adm/?offer=' + slug;
            status = 'live';
        }

        if (module.id === 'funil') {
            href = offer.funnel_url || (offer.funnel_domain ? 'https://' + offer.funnel_domain : '');
            external = true;
            status = href && !isDraft ? 'live' : 'soon';
        }

        if (!external && module.href && module.href.indexOf('/') === 0 &&
            module.id !== 'dashboard' && module.id !== 'comunidade') {
            href = module.href + '?offer=' + slug;
        }

        return {
            id: module.id,
            label: module.label,
            description: module.description,
            href: href,
            status: status,
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
