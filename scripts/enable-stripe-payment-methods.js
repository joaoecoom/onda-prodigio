/**
 * Ativa métodos de pagamento relevantes para Portugal no Dashboard Stripe.
 * Requer STRIPE_SECRET_KEY válida no ambiente.
 *
 * Uso: STRIPE_SECRET_KEY=sk_live_... node scripts/enable-stripe-payment-methods.js
 */

const Stripe = require('stripe');

const METHODS_TO_ENABLE = [
    'card',
    'link',
    'klarna',
    'mb_way',
    'apple_pay',
    'google_pay',
];

const METHODS_TO_DISABLE = [
    'multibanco',
    'sepa_debit',
];

async function main() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new Error('Define STRIPE_SECRET_KEY antes de correr este script.');
    }

    const stripe = new Stripe(secretKey);
    const configurations = await stripe.paymentMethodConfigurations.list({ limit: 10 });

    if (!configurations.data.length) {
        throw new Error('Não foi encontrada nenhuma configuração de métodos de pagamento.');
    }

    const configuration = configurations.data.find(function (item) {
        return item.id === process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION;
    }) || configurations.data.find(function (item) {
        return item.active && item.is_default && !item.application;
    }) || configurations.data.find(function (item) {
        return item.active;
    }) || configurations.data[0];

    const updatePayload = {};

    METHODS_TO_ENABLE.forEach(function (method) {
        updatePayload[method] = {
            display_preference: {
                preference: 'on',
            },
        };
    });

    METHODS_TO_DISABLE.forEach(function (method) {
        updatePayload[method] = {
            display_preference: {
                preference: 'off',
            },
        };
    });

    const updated = await stripe.paymentMethodConfigurations.update(
        configuration.id,
        updatePayload
    );

    console.log('Configuração atualizada:', updated.id);

    METHODS_TO_ENABLE.concat(METHODS_TO_DISABLE).forEach(function (method) {
        const methodConfig = updated[method];

        if (!methodConfig) {
            console.log('- ' + method + ': indisponível nesta conta');
            return;
        }

        console.log(
            '- ' + method + ': available=' + methodConfig.available +
            ', preference=' + methodConfig.display_preference.value
        );
    });
}

main().catch(function (error) {
    console.error(error.message || error);
    process.exit(1);
});
