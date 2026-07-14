module.exports = async function handler(_req, res) {
    return res.status(200).json({
        gtmContainerId: process.env.NEXT_PUBLIC_GTM_ID || process.env.GTM_CONTAINER_ID || '',
        gtmServerContainerId: process.env.GTM_SERVER_CONTAINER || '',
        serverContainerUrl: process.env.SERVER_CONTAINER_URL || '',
        stapeGtmUrl: process.env.SERVER_CONTAINER_URL || '',
        ga4MeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.GA4_MEASUREMENT_ID || '',
        metaPixelId: process.env.META_PIXEL_ID || '',
    });
};
