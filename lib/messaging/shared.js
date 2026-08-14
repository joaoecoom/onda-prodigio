function getSiteUrl() {
    return String(process.env.SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
}

function firstName(fullName) {
    var parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    return parts[0] || '';
}

function formatProductList(productNames) {
    var names = (productNames || []).filter(Boolean);

    if (!names.length) {
        return '';
    }

    if (names.length === 1) {
        return names[0];
    }

    return names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderProductListHtml(productNames) {
    var names = productNames || [];

    if (!names.length) {
        return '';
    }

    return (
        '<ul style="margin:0.5rem 0 0;padding-left:1.25rem;line-height:1.6;">' +
        names.map(function (name) {
            return '<li>' + escapeHtml(name) + '</li>';
        }).join('') +
        '</ul>'
    );
}

function angelaGreeting(fullName, html) {
    var name = firstName(fullName);
    if (html) {
        return name ? ('Olá ' + escapeHtml(name) + ',') : 'Olá,';
    }

    return name ? ('Olá ' + name + ',') : 'Olá,';
}

function wrapAngelaEmail(bodyHtml) {
    return (
        '<div style="font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;">' +
        bodyHtml +
        '<p style="margin-top:1.25rem;">Com carinho,<br>Angela Campos</p>' +
        '</div>'
    );
}

module.exports = {
    getSiteUrl: getSiteUrl,
    firstName: firstName,
    formatProductList: formatProductList,
    escapeHtml: escapeHtml,
    renderProductListHtml: renderProductListHtml,
    angelaGreeting: angelaGreeting,
    wrapAngelaEmail: wrapAngelaEmail,
};
