var BUMP_AMOUNT_CENTS = parseInt(process.env.STRIPE_BUMP_AMOUNT_CENTS || '500', 10);
var MAIN_AMOUNT_CENTS = parseInt(process.env.STRIPE_AMOUNT_CENTS || '900', 10);
var CODIGO_AMOUNT_CENTS = parseInt(process.env.STRIPE_CODIGO_AMOUNT_CENTS || '4700', 10);
var CLUBE_DISPLAY_CENTS = parseInt(process.env.STRIPE_CLUBE_DISPLAY_CENTS || '0', 10);

var PRODUCTS = {
    'onda-prodigio': {
        id: 'onda-prodigio',
        name: 'Onda Prodígio',
        sponsorTitle: 'O Método Onda Prodígio — Acesso Completo',
        description: 'O método completo para despertar o potencial do teu filho.',
        image: '/checkout9/assets/banner.png',
        billingType: 'one_time',
        amountCents: MAIN_AMOUNT_CENTS,
        compareAtCents: null,
        discountLabel: null,
    },
    'tardes-sem-brigas': {
        id: 'tardes-sem-brigas',
        name: 'A Fábrica das Tardes Tranquilas',
        sponsorTitle: 'A Fábrica das Tardes Tranquilas',
        description: 'Birras em disciplina automática — tardes sem discussão no quarto.',
        image: '/checkout9/assets/order-bump-tardes.png',
        banner: '/comprar/assets/banners/tardes-sem-brigas.png',
        billingType: 'one_time',
        amountCents: BUMP_AMOUNT_CENTS,
        compareAtCents: 1429,
        discountLabel: '-65%',
    },
    'caixa-super-truques': {
        id: 'caixa-super-truques',
        name: 'A Caixa dos Super Truques do Génio',
        sponsorTitle: 'A Caixa dos Super Truques do Génio',
        description: 'Ferramentas práticas de concentração, autonomia e motivação.',
        image: '/checkout9/assets/order-bump-truques.png',
        banner: '/comprar/assets/banners/caixa-super-truques.png',
        billingType: 'one_time',
        amountCents: BUMP_AMOUNT_CENTS,
        compareAtCents: 1429,
        discountLabel: '-65%',
    },
    'grandes-mentes': {
        id: 'grandes-mentes',
        name: 'Grandes Mentes',
        sponsorTitle: 'Grandes Mentes — Actividades Criativas',
        description: 'Mais de 40 actividades para crescer confiante e emocionalmente saudável.',
        image: '/checkout9/assets/order-bump-mentes.png',
        banner: '/comprar/assets/banners/grandes-mentes.png',
        billingType: 'one_time',
        amountCents: BUMP_AMOUNT_CENTS,
        compareAtCents: 1786,
        discountLabel: '-72%',
    },
    'clube-super-cerebros': {
        id: 'clube-super-cerebros',
        name: 'Clube dos Super Cérebros',
        sponsorTitle: 'Clube dos Super Cérebros — Comunidade Exclusiva',
        description: 'Conteúdo novo todos os meses numa comunidade fechada de pais.',
        image: '/comunidade/assets/products/clube-super-cerebros.png',
        banner: '/comprar/assets/banners/clube-super-cerebros.png',
        billingType: 'subscription',
        amountCents: CLUBE_DISPLAY_CENTS || null,
        compareAtCents: null,
        discountLabel: null,
        billingNote: 'Subscrição mensal',
    },
    'codigo-autoridade': {
        id: 'codigo-autoridade',
        name: 'Código da Autoridade',
        sponsorTitle: 'Código da Autoridade — Autoridade Calma em Casa',
        description: 'Aulas práticas para rotina, autonomia e liderança em casa.',
        image: '/comunidade/assets/products/codigo-autoridade.png',
        banner: '/comprar/assets/banners/codigo-autoridade.png',
        billingType: 'one_time',
        amountCents: CODIGO_AMOUNT_CENTS,
        compareAtCents: null,
        discountLabel: null,
    },
};

var MODULE_SPONSORS = {
    'onda-prodigio': {
        1: 'tardes-sem-brigas',
        2: 'caixa-super-truques',
        3: 'grandes-mentes',
        4: 'clube-super-cerebros',
        5: 'codigo-autoridade',
    },
    'clube-super-cerebros': {
        1: 'codigo-autoridade',
        2: 'grandes-mentes',
        3: 'tardes-sem-brigas',
        4: 'caixa-super-truques',
    },
    'tardes-sem-brigas': {
        1: 'caixa-super-truques',
    },
    'caixa-super-truques': {
        1: 'grandes-mentes',
    },
    'grandes-mentes': {
        1: 'clube-super-cerebros',
    },
    'codigo-autoridade': {
        1: 'clube-super-cerebros',
    },
};

var DEFAULT_SPONSOR_ORDER = [
    'tardes-sem-brigas',
    'caixa-super-truques',
    'grandes-mentes',
    'clube-super-cerebros',
    'codigo-autoridade',
];

function getProduct(productId) {
    return PRODUCTS[productId] || null;
}

function getPurchasableProductIds() {
    return Object.keys(PRODUCTS).filter(function (id) {
        return id !== 'onda-prodigio';
    });
}

function getSponsorRotation(viewingProductId) {
    return MODULE_SPONSORS[viewingProductId] || {};
}

function getAmountCentsForMode(productId, mode) {
    var product = getProduct(productId);

    if (!product) {
        return null;
    }

    if (product.billingType === 'subscription') {
        return product.amountCents;
    }

    if (productId === 'codigo-autoridade' && mode === 'test') {
        return parseInt(
            process.env.STRIPE_TEST_CODIGO_AMOUNT_CENTS || process.env.STRIPE_CODIGO_AMOUNT_CENTS || String(CODIGO_AMOUNT_CENTS),
            10
        );
    }

    return product.amountCents;
}

function getClubePriceId(mode) {
    return mode === 'test'
        ? process.env.STRIPE_TEST_CLUBE_PRICE_ID
        : process.env.STRIPE_CLUBE_PRICE_ID;
}

function toPublicProduct(product, mode) {
    if (!product) {
        return null;
    }

    return {
        id: product.id,
        name: product.name,
        description: product.description,
        image: product.image,
        banner: product.banner || product.image,
        billingType: product.billingType,
        amountCents: getAmountCentsForMode(product.id, mode),
        compareAtCents: product.compareAtCents,
        discountLabel: product.discountLabel,
        billingNote: product.billingNote || null,
        checkoutPath: '/comprar/' + product.id,
    };
}

function getSponsorAdPayload(productId, mode) {
    var product = getProduct(productId);

    if (!product) {
        return null;
    }

    return {
        product_id: product.id,
        title: product.sponsorTitle || product.name,
        image_url: product.image,
        checkout_url: '/comprar/' + product.id,
        amount_cents: getAmountCentsForMode(product.id, mode),
        billing_type: product.billingType,
        billing_note: product.billingNote || null,
    };
}

function buildCandidateList(viewingProductId, moduleSortOrder) {
    var rotation = getSponsorRotation(viewingProductId);
    var candidates = [];
    var preferred = rotation[moduleSortOrder];

    if (preferred) {
        candidates.push(preferred);
    }

    Object.keys(rotation).sort(function (a, b) {
        return Number(a) - Number(b);
    }).forEach(function (key) {
        var id = rotation[key];

        if (candidates.indexOf(id) === -1) {
            candidates.push(id);
        }
    });

    DEFAULT_SPONSOR_ORDER.forEach(function (id) {
        if (candidates.indexOf(id) === -1) {
            candidates.push(id);
        }
    });

    return candidates;
}

module.exports = {
    PRODUCTS: PRODUCTS,
    MODULE_SPONSORS: MODULE_SPONSORS,
    getProduct: getProduct,
    getPurchasableProductIds: getPurchasableProductIds,
    getSponsorRotation: getSponsorRotation,
    getAmountCentsForMode: getAmountCentsForMode,
    getClubePriceId: getClubePriceId,
    toPublicProduct: toPublicProduct,
    getSponsorAdPayload: getSponsorAdPayload,
    buildCandidateList: buildCandidateList,
};
