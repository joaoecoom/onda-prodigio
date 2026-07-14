module.exports = async function handler(_req, res) {
    var publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
        return res.status(500).json({ error: 'Stripe não configurado.' });
    }

    return res.status(200).json({
        publishableKey: publishableKey,
        amountCents: parseInt(process.env.STRIPE_AMOUNT_CENTS || '900', 10),
        currency: 'eur',
        productName: 'Onda Prodígio',
    });
};
