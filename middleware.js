var HUB_HOST = 'hub-dr-ecoom.vercel.app';
var HUB_SPA_PATHS = ['/', '/tracking', '/recupera', '/impulsiona', '/integracoes', '/funil'];

function normalizeHost(value) {
    return String(value || '').split(':')[0].trim().toLowerCase();
}

function isHubPath(pathname) {
    if (HUB_SPA_PATHS.indexOf(pathname) !== -1) {
        return true;
    }

    return pathname === '/hub' || pathname.indexOf('/hub/') === 0;
}

export default function middleware(request) {
    var host = normalizeHost(request.headers.get('host'));

    if (host !== HUB_HOST) {
        return;
    }

    var url = new URL(request.url);

    if (!isHubPath(url.pathname)) {
        return;
    }

    url.pathname = '/hub/index.html';
    return Response.rewrite(url);
}

export const config = {
    matcher: [
        '/',
        '/hub',
        '/hub/:path*',
        '/tracking',
        '/recupera',
        '/impulsiona',
        '/integracoes',
        '/funil',
    ],
};
