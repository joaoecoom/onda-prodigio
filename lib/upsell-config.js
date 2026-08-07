var UPSELLS = {
    'clube-super-cerebros': {
        id: 'clube-super-cerebros',
        name: 'Clube dos Super Cérebros',
        billingType: 'subscription',
        sortOrder: 1,
        path: '/obgd/upsell1',
        nextPath: '/obgd/upsell2',
        image: '/comunidade/assets/products/clube-super-cerebros.png',
        headline: 'Entra no Clube dos Super Cérebros',
        subheadline: 'Comunidade exclusiva de pais com conteúdo novo todos os meses.',
        bullets: [
            'Acesso a uma comunidade fechada de pais comprometidos.',
            'Novos conteúdos e apoio contínuo para acompanhar o teu filho.',
            'Mensalidade — manténs o acesso enquanto a subscrição estiver activa.',
        ],
        billingNote: 'Subscrição mensal. Se deixares de renovar, o acesso ao clube é removido.',
        cta: 'Quero entrar no Clube',
        skip: 'Não, obrigado',
    },
    'codigo-autoridade': {
        id: 'codigo-autoridade',
        name: 'Código da Autoridade',
        billingType: 'one_time',
        sortOrder: 2,
        path: '/obgd/upsell2',
        nextPath: '/obgd/',
        image: '/comunidade/assets/products/codigo-autoridade.png',
        headline: 'Desbloqueia o Código da Autoridade',
        subheadline: 'Aulas práticas para criar rotina, autonomia e liderança em casa.',
        bullets: [
            'Aulas em vídeo para aplicares no dia a dia com o teu filho.',
            'Foco em autoridade calma, acordos claros e autonomia.',
            'Pagamento único — acesso permanente na área de membros.',
        ],
        billingNote: 'Compra única. O acesso fica disponível para sempre na tua conta.',
        cta: 'Sim, quero o Código da Autoridade',
        skip: 'Não, continuar sem esta oferta',
    },
};

function getUpsell(id) {
    return UPSELLS[id] || null;
}

module.exports = {
    UPSELLS: UPSELLS,
    getUpsell: getUpsell,
};
