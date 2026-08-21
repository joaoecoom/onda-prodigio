var hubConfig = require('./config');

var HUB_MODULES = [
    {
        id: 'ai-agent',
        label: 'AI Agent',
        description: 'Envia tarefas para o Cursor Agent na VPS — resultados e logs no HUB.',
        href: '/ai-agent',
        status: 'live',
        icon: 'ai',
        internal: true,
    },
    {
        id: 'dashboard',
        label: 'Dashboard',
        description: 'Métricas Stripe, Meta multi-conta, VTurb, ROAS e falhados.',
        href: '/metricas/',
        status: 'live',
        icon: 'chart',
        internal: true,
        embed: true,
    },
    {
        id: 'tracking',
        label: 'Tracking',
        description: 'Pixel, CAPI, GA4, Stape, health checks e snippet para o funil.',
        href: '/tracking',
        status: 'live',
        icon: 'radar',
        internal: true,
    },
    {
        id: 'recupera',
        label: 'Recupera',
        description: 'Email e WhatsApp — pagamentos falhados, nunca entrou, win-back.',
        href: '/recupera',
        status: 'live',
        icon: 'recover',
        internal: true,
    },
    {
        id: 'impulsiona',
        label: 'Impulsiona',
        description: 'Email e WhatsApp pós-venda — upsell, cross-sell, nurture.',
        href: '/impulsiona',
        status: 'live',
        icon: 'boost',
        internal: true,
    },
    {
        id: 'comunidade',
        label: 'Comunidade',
        description: 'Membros, aulas, módulos, comentários e branding por oferta.',
        href: '/adm/',
        status: 'live',
        icon: 'community',
        internal: true,
        embed: true,
    },
    {
        id: 'integracoes',
        label: 'Integrações',
        description: 'Stripe, Supabase, Gmail, WhatsApp, VTurb — credenciais por oferta.',
        href: '/integracoes',
        status: 'live',
        icon: 'plug',
        internal: true,
    },
    {
        id: 'funil',
        label: 'Funil',
        description: 'Funnels, pages e editor visual do Page Engine.',
        href: '/funil',
        status: 'live',
        icon: 'funnel',
        internal: true,
    },
    {
        id: 'dominios',
        label: 'Domínios',
        description: 'Domínio funil, comunidade e URLs públicas desta oferta.',
        href: '/dominios',
        status: 'live',
        icon: 'globe',
        internal: true,
    },
    {
        id: 'definicoes',
        label: 'Definições',
        description: 'Nome, estado, modo e branding da oferta.',
        href: '/definicoes',
        status: 'live',
        icon: 'settings',
        internal: true,
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
            status = module.internal ? 'soon' : status;
        }

        if (isDraft && (module.id === 'dashboard' || module.id === 'comunidade')) {
            status = 'soon';
        }

        if (!isDraft && module.internal) {
            status = 'live';
        }

        if (module.id === 'dashboard' && !isDraft) {
            href = '/metricas/?offer=' + slug + '&embed=1';
            status = 'live';
        }

        if (module.id === 'comunidade' && !isDraft) {
            // Embed no HUB usa o mesmo domínio (iframe). ?offer= resolve o produto na API.
            href = '/adm/?offer=' + slug + '&embed=1&tab=content';
            status = 'live';
        }

        if (module.id === 'funil') {
            href = '/funil?offer=' + slug;
            external = false;
            status = 'live';
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
            internal: Boolean(module.internal),
            embed: Boolean(module.embed),
        };
    });
}

module.exports = {
    HUB_MODULES: HUB_MODULES,
    getModulesForOffer: getModulesForOffer,
    getHubBaseUrl: hubConfig.getHubBaseUrl,
};
