function visibilityClasses(visibility) {
    var vis = visibility || {};
    var classes = ['pe-vis'];

    if (vis.desktop === false) {
        classes.push('pe-hide-desktop');
    }

    if (vis.tablet === false) {
        classes.push('pe-hide-tablet');
    }

    if (vis.mobile === false) {
        classes.push('pe-hide-mobile');
    }

    return classes.join(' ');
}

function baseVisibilityCss() {
    return [
        '.pe-vis{display:block}',
        '@media (min-width:768px){.pe-hide-desktop{display:none!important}}',
        '@media (min-width:480px) and (max-width:767px){.pe-hide-tablet{display:none!important}}',
        '@media (max-width:479px){.pe-hide-mobile{display:none!important}}',
    ].join('');
}

module.exports = {
    visibilityClasses: visibilityClasses,
    baseVisibilityCss: baseVisibilityCss,
};
