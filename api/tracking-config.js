module.exports = async function handler(_req, res) {
    return res.status(200).json({
        gtmContainerId: process.env.NEXT_PUBLIC_GTM_ID || process.env.GTM_CONTAINER_ID || '',
        gtmServerContainerId: process.env.GTM_SERVER_CONTAINER || '',
        serverContainerUrl: process.env.SERVER_CONTAINER_URL || '',
        stapeGtmUrl: process.env.SERVER_CONTAINER_URL || '',
        ga4MeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.GA4_MEASUREMENT_ID || '',
        metaPixelId: process.env.META_PIXEL_ID || '',
        gtmWebEnabled: process.env.GTM_WEB_ENABLED === 'true',
        stapeCookieExtenderEnabled: process.env.STAPE_COOKIE_EXTENDER_ENABLED === 'true',
        metaReportingCurrency: (process.env.META_REPORTING_CURRENCY || 'EUR').toUpperCase(),
        metaEurToUsdRate: parseFloat(process.env.META_EUR_TO_USD_RATE || '1.09'),
        metaEurToBrlRate: parseFloat(process.env.META_EUR_TO_BRL_RATE || '6.10'),
    });
};
