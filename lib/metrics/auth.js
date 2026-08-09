function getAuthToken(req) {
    var header = req.headers.authorization || '';

    if (header.indexOf('Bearer ') === 0) {
        return header.slice(7).trim();
    }

    return '';
}

function isAuthorized(req) {
    var token = getAuthToken(req);
    var dashboardPassword = process.env.METRICS_DASHBOARD_PASSWORD;
    var bootstrapSecret = process.env.BOOTSTRAP_SECRET;

    if (!token) {
        return false;
    }

    if (dashboardPassword && token === dashboardPassword) {
        return true;
    }

    if (bootstrapSecret && token === bootstrapSecret) {
        return true;
    }

    return false;
}

module.exports = {
    getAuthToken: getAuthToken,
    isAuthorized: isAuthorized,
};
