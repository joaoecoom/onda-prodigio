/**
 * Regista um domínio na Stripe para Link, Apple Pay e Google Pay.
 * Requer chave secreta completa (sk_live_...) — RAK não tem permissão.
 *
 * Uso:
 * STRIPE_SECRET_KEY=sk_live_... node scripts/register-stripe-domain.js onda-prodigio.vercel.app
 */

const Stripe = require('stripe');

async function main() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const domainName = process.argv[2] || 'onda-prodigio.vercel.app';

    if (!secretKey) {
        throw new Error('Define STRIPE_SECRET_KEY antes de correr este script.');
    }

    if (!secretKey.startsWith('sk_')) {
        throw new Error('Esta operação precisa de uma chave secreta completa (sk_live_...), não de uma RAK.');
    }

    const stripe = new Stripe(secretKey);
    const existing = await stripe.paymentMethodDomains.list({ limit: 100 });
    const found = existing.data.find(function (item) {
        return item.domain_name === domainName;
    });

    if (found) {
        console.log('Domínio já registado:', found.domain_name, found.id);
        console.log('Apple Pay:', found.apple_pay?.status);
        console.log('Google Pay:', found.google_pay?.status);
        console.log('Link:', found.link?.status);
        return;
    }

    const created = await stripe.paymentMethodDomains.create({
        domain_name: domainName,
    });

    console.log('Domínio registado:', created.domain_name, created.id);
    console.log('Apple Pay:', created.apple_pay?.status);
    console.log('Google Pay:', created.google_pay?.status);
    console.log('Link:', created.link?.status);
}

main().catch(function (error) {
    console.error(error.message || error);
    process.exit(1);
});
