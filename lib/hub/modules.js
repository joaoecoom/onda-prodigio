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
        href: '/hub/tracking',
        status: 'soon',
        icon: 'radar',
    },
    {
        id: 'recupera',
        label: 'Recupera',
        description: 'Email e WhatsApp — pagamentos falhados, nunca entrou, win-back.',
        href: '/hub/recupera',
        status: 'soon',
        icon: 'recover',
    },
    {
        id: 'impulsiona',
        label: 'Impulsiona',
        description: 'Email e WhatsApp pós-venda — upsell, cross-sell, nurture.',
        href: '/hub/impulsiona',
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
        href: '/hub/integracoes',
        status: 'soon',
        icon: 'plug',
    },
    {
        id: 'funil',
        label: 'Funil',
        description: 'Checkouts, páginas, deploy e links — fase 2.',
        href: '/hub/funil',
        status: 'later',
        icon: 'funnel',
    },
];

function getModulesForOffer(offer) {
    return HUB_MODULES.map(function (module) {
        var href = module.href;

        if (module.id === 'dashboard') {
            href = '/metricas/?offer=' + encodeURIComponent(offer.slug);
        }

        if (module.id === 'comunidade') {
            href = '/adm/?offer=' + encodeURIComponent(offer.slug);
        }

        if (module.href.indexOf('/hub/') === 0) {
            href = module.href + '?offer=' + encodeURIComponent(offer.slug);
        }

        return {
            id: module.id,
            label: module.label,
            description: module.description,
            href: href,
            status: module.status,
            icon: module.icon,
        };
    });
}

module.exports = {
    HUB_MODULES: HUB_MODULES,
    getModulesForOffer: getModulesForOffer,
};
