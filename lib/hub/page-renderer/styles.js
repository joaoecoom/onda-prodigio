var ALLOWED_STYLE_KEYS = {
    color: true,
    background: true,
    backgroundColor: true,
    fontSize: true,
    fontWeight: true,
    textAlign: true,
    margin: true,
    marginTop: true,
    marginBottom: true,
    padding: true,
    paddingTop: true,
    paddingBottom: true,
    width: true,
    maxWidth: true,
    borderRadius: true,
    display: true,
    lineHeight: true,
    letterSpacing: true,
};

var DANGEROUS_STYLE_PATTERN = /expression\s*\(|javascript:|url\s*\(\s*['"]?\s*javascript/i;

function camelToKebab(key) {
    return String(key).replace(/[A-Z]/g, function (match) {
        return '-' + match.toLowerCase();
    });
}

function buildInlineStyles(styles, extra) {
    var merged = Object.assign({}, styles || {}, extra || {});
    var parts = [];

    Object.keys(merged).forEach(function (key) {
        if (!ALLOWED_STYLE_KEYS[key]) {
            return;
        }

        var value = String(merged[key] || '').trim();

        if (!value || DANGEROUS_STYLE_PATTERN.test(value)) {
            return;
        }

        parts.push(camelToKebab(key) + ':' + value);
    });

    return parts.join(';');
}

function buildClassList(classes) {
    if (!Array.isArray(classes)) {
        return '';
    }

    return classes.filter(Boolean).join(' ');
}

module.exports = {
    ALLOWED_STYLE_KEYS: ALLOWED_STYLE_KEYS,
    buildInlineStyles: buildInlineStyles,
    buildClassList: buildClassList,
};
