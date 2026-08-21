(function () {
    var BUMP_CATALOG = {
        'tardes-sem-brigas': {
            item_id: 'tardes-sem-brigas',
            item_name: 'A Fábrica das Tardes Tranquilas',
        },
        'caixa-super-truques': {
            item_id: 'caixa-super-truques',
            item_name: 'A Caixa dos Super Truques do Génio',
        },
        'grandes-mentes': {
            item_id: 'grandes-mentes',
            item_name: 'Grandes Mentes',
        },
    };

    var MAIN_ITEM = {
        item_id: 'onda-prodigio',
        item_name: 'Onda Prodígio',
    };

    var META_STANDARD_EVENTS = {
        page_view: 'PageView',
        view_content: 'ViewContent',
        lead: 'Lead',
        initiate_checkout: 'InitiateCheckout',
        purchase: 'Purchase',
    };

    var config = null;
    var bootstrapPromise = null;
    var purchaseEventId = null;
    var checkoutPaymentIntentId = '';
    var metaAdvancedMatchingPayload = null;
    var ATTRIBUTION_STORAGE_KEY = 'onda-attribution';

    var ATTRIBUTION_QUERY_KEYS = [
        'ad_name',
        'ad_id',
        'adset_id',
        'adset_name',
        'campaign_id',
        'campaign_name',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'fbclid',
        'vtid',
    ];

    window.dataLayer = window.dataLayer || [];

    function getPageType() {
        return document.documentElement.getAttribute('data-page-type') || 'page';
    }

    function getPagePath() {
        return window.location.pathname || '/';
    }

    function centsToValue(cents) {
        return Number((Number(cents || 0) / 100).toFixed(2));
    }

    function getReportingCurrency() {
        return config && config.metaReportingCurrency ? config.metaReportingCurrency : 'EUR';
    }

    function getReportingRate() {
        if (!config) {
            return 1;
        }

        if (getReportingCurrency() === 'USD') {
            return Number(config.metaEurToUsdRate || 1.09);
        }

        if (getReportingCurrency() === 'BRL') {
            return Number(config.metaEurToBrlRate || 6.1);
        }

        return 1;
    }

    function convertValueForMetaReporting(valueEur) {
        var reportingCurrency = getReportingCurrency();

        if (reportingCurrency === 'EUR') {
            return {
                currency: 'EUR',
                value: Number(Number(valueEur || 0).toFixed(2)),
            };
        }

        return {
            currency: reportingCurrency,
            value: Number((Number(valueEur || 0) * getReportingRate()).toFixed(2)),
        };
    }

    function normalizeMetaName(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z]/g, '');
    }

    function normalizePhoneForMetaHash(phone, countryCode) {
        var digits = String(phone || '').replace(/\D/g, '');

        if (!digits) {
            return '';
        }

        var dialCodes = {
            PT: '351',
            LU: '352',
            FR: '33',
            BE: '32',
            CH: '41',
            DE: '49',
            ES: '34',
            IT: '39',
            NL: '31',
            GB: '44',
            IE: '353',
            AT: '43',
            US: '1',
            CA: '1',
            BR: '55',
        };
        var dial = dialCodes[String(countryCode || 'PT').toUpperCase()] || '351';

        if (digits.indexOf(dial) === 0 && digits.length > dial.length + 5) {
            return digits;
        }

        return dial + digits;
    }

    function sha256Hex(value) {
        if (!value || !window.crypto || !window.crypto.subtle) {
            return Promise.resolve('');
        }

        return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(function (buffer) {
            return Array.from(new Uint8Array(buffer)).map(function (byte) {
                return byte.toString(16).padStart(2, '0');
            }).join('');
        });
    }

    function applyMetaAdvancedMatching() {
        if (!window.fbq || !config || !config.metaPixelId || !metaAdvancedMatchingPayload) {
            return;
        }

        window.fbq('init', config.metaPixelId, metaAdvancedMatchingPayload, { autoConfig: false });
    }

    function setMetaAdvancedMatching(data) {
        data = data || {};

        var email = String(data.email || '').trim().toLowerCase();
        var phoneDigits = normalizePhoneForMetaHash(data.phone, data.phoneCountry || data.country || 'PT');
        var firstName = normalizeMetaName(data.firstName || data.full_name || '');
        var lastName = normalizeMetaName(data.lastName || '');

        if (!data.lastName && data.full_name) {
            var parts = String(data.full_name || '').trim().split(/\s+/).filter(Boolean);

            if (parts.length > 1) {
                firstName = normalizeMetaName(parts[0]);
                lastName = normalizeMetaName(parts.slice(1).join(' '));
            }
        }

        var country = String(data.country || data.phoneCountry || 'PT').trim().toLowerCase().slice(0, 2);
        var tasks = [];

        if (email) {
            tasks.push(sha256Hex(email).then(function (hash) {
                return { key: 'em', value: hash };
            }));
        }

        if (phoneDigits) {
            tasks.push(sha256Hex(phoneDigits).then(function (hash) {
                return { key: 'ph', value: hash };
            }));
        }

        if (firstName) {
            tasks.push(sha256Hex(firstName).then(function (hash) {
                return { key: 'fn', value: hash };
            }));
        }

        if (lastName) {
            tasks.push(sha256Hex(lastName).then(function (hash) {
                return { key: 'ln', value: hash };
            }));
        }

        return Promise.all(tasks).then(function (entries) {
            metaAdvancedMatchingPayload = {};

            entries.forEach(function (entry) {
                if (entry && entry.key && entry.value) {
                    metaAdvancedMatchingPayload[entry.key] = entry.value;
                }
            });

            if (country) {
                metaAdvancedMatchingPayload.country = country;
            }

            applyMetaAdvancedMatching();
            return metaAdvancedMatchingPayload;
        });
    }

    function getCheckoutPaymentIntentId() {
        return checkoutPaymentIntentId || '';
    }

    function setCheckoutPaymentIntentId(paymentIntentId) {
        if (paymentIntentId && paymentIntentId.indexOf('pi_') === 0) {
            checkoutPaymentIntentId = paymentIntentId;
        }
    }

    function randomSuffix() {
        return Math.random().toString(36).slice(2, 10);
    }

    function getCookie(name) {
        var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
        var match = document.cookie.match(pattern);
        return match ? decodeURIComponent(match[1]) : '';
    }

    function getGaClientId() {
        var gaCookie = getCookie('_ga');

        if (!gaCookie) {
            return '';
        }

        var parts = gaCookie.split('.');

        if (parts.length >= 4) {
            return parts[2] + '.' + parts[3];
        }

        return '';
    }

    function getFbp() {
        return getCookie('_fbp');
    }

    function getFbc() {
        ensureFbcCookie();
        return getCookie('_fbc');
    }

    function ensureFbcCookie() {
        var existing = getCookie('_fbc');

        if (existing) {
            return existing;
        }

        var params = new URLSearchParams(window.location.search);
        var fbclid = params.get('fbclid');

        if (!fbclid) {
            return '';
        }

        var fbc = 'fb.1.' + Date.now() + '.' + fbclid;
        var maxAge = 60 * 60 * 24 * 90;
        document.cookie = '_fbc=' + encodeURIComponent(fbc) + '; path=/; max-age=' + maxAge + '; SameSite=Lax';

        return fbc;
    }

    function readAttributionFromUrl() {
        var params = new URLSearchParams(window.location.search);
        var data = {};

        ATTRIBUTION_QUERY_KEYS.forEach(function (key) {
            var value = params.get(key);

            if (value) {
                data[key] = value.trim();
            }
        });

        if (data.vtid && data.vtid.indexOf('v3_') !== 0) {
            delete data.vtid;
        }

        if (data.fbclid && !data.ad_platform) {
            data.ad_platform = 'facebook';
        }

        return data;
    }

    function inferAdPlatformFromFbc(fbc) {
        if (!fbc) {
            return '';
        }

        if (fbc.indexOf('Y2xj') !== -1) {
            return 'instagram';
        }

        return 'facebook';
    }

    function captureAttribution() {
        var incoming = readAttributionFromUrl();
        var stored = {};
        var merged = {};

        if (window.sessionStorage) {
            try {
                stored = JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY) || '{}') || {};
            } catch (error) {
                stored = {};
            }
        }

        merged = Object.assign({}, stored, incoming);

        if (!merged.ad_platform) {
            merged.ad_platform = inferAdPlatformFromFbc(getFbc()) || stored.ad_platform || '';
        }

        if (window.sessionStorage) {
            window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(merged));
        }

        return merged;
    }

    function getAttribution() {
        if (window.sessionStorage) {
            try {
                return JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY) || '{}') || {};
            } catch (error) {
                return {};
            }
        }

        return captureAttribution();
    }

    function getPurchaseEventId() {
        if (purchaseEventId) {
            return purchaseEventId;
        }

        var storageKey = 'onda-purchase-event-id';

        if (window.sessionStorage) {
            var stored = window.sessionStorage.getItem(storageKey);

            if (stored) {
                purchaseEventId = stored;
                return purchaseEventId;
            }
        }

        purchaseEventId = 'purchase_' + Date.now() + '_' + randomSuffix();

        if (window.sessionStorage) {
            window.sessionStorage.setItem(storageKey, purchaseEventId);
        }

        return purchaseEventId;
    }

    function getEventTimeSeconds() {
        return Math.floor(Date.now() / 1000);
    }

    function buildItems(selectedBumpIds) {
        var items = [
            {
                item_id: MAIN_ITEM.item_id,
                item_name: MAIN_ITEM.item_name,
                price: convertValueForMetaReporting(9).value,
                quantity: 1,
                item_category: 'produto_principal',
            },
        ];

        (selectedBumpIds || []).forEach(function (bumpId) {
            var bump = BUMP_CATALOG[bumpId];

            if (!bump) {
                return;
            }

            items.push({
                item_id: bump.item_id,
                item_name: bump.item_name,
                price: convertValueForMetaReporting(5).value,
                quantity: 1,
                item_category: 'order_bump',
            });
        });

        return items;
    }

    function buildEcommerce(payload) {
        var valueInfo = convertValueForMetaReporting(centsToValue(payload.amountCents || 900));
        var items = buildItems(payload.orderBumps || []);

        return {
            currency: valueInfo.currency,
            value: valueInfo.value,
            items: items,
        };
    }

    function wasTrackedOnce(key) {
        if (!window.sessionStorage) {
            return false;
        }

        return window.sessionStorage.getItem(key) === '1';
    }

    function markTrackedOnce(key) {
        if (window.sessionStorage) {
            window.sessionStorage.setItem(key, '1');
        }
    }

    function getTrackingOnceKey(name) {
        return name + ':' + getPagePath();
    }

    function pushEvent(eventName, payload, options) {
        options = options || {};

        var sendToMeta = options.meta !== false && Boolean(META_STANDARD_EVENTS[eventName]);
        var sendToAnalytics = options.analytics !== false;
        var eventId = (payload && payload.event_id) || (eventName + '_' + Date.now() + '_' + randomSuffix());
        var eventPayload = {
            event: eventName,
            event_id: eventId,
            event_time: getEventTimeSeconds(),
            page_type: getPageType(),
            page_path: getPagePath(),
            fbp: getFbp(),
            fbc: getFbc(),
            ga_client_id: getGaClientId(),
            purchase_event_id: getPurchaseEventId(),
        };

        if (payload) {
            Object.keys(payload).forEach(function (key) {
                eventPayload[key] = payload[key];
            });
        }

        if (sendToAnalytics) {
            window.dataLayer.push(eventPayload);

            if (window.gtag && config && config.ga4MeasurementId) {
                window.gtag('event', eventName, {
                    send_to: config.ga4MeasurementId,
                    event_id: eventId,
                    currency: eventPayload.currency,
                    value: eventPayload.value,
                    transaction_id: eventPayload.transaction_id,
                    items: eventPayload.items,
                });
            }
        }

        if (sendToMeta && window.fbq) {
            var metaEventName = META_STANDARD_EVENTS[eventName];

            window.fbq('track', metaEventName, {
                currency: eventPayload.currency,
                value: eventPayload.value,
                content_ids: eventPayload.content_ids,
                contents: eventPayload.contents,
            }, { eventID: eventId });
        }

        return eventId;
    }

    function buildCheckoutPayload(extra) {
        var payload = {
            currency: 'EUR',
            amountCents: 900,
            orderBumps: [],
        };

        if (window.CheckoutOrderBumps) {
            payload.amountCents = window.CheckoutOrderBumps.getTotalCents();
            payload.orderBumps = window.CheckoutOrderBumps.getSelectedBumpIds();
        }

        if (extra) {
            Object.keys(extra).forEach(function (key) {
                payload[key] = extra[key];
            });
        }

        var ecommerce = buildEcommerce(payload);

        payload.value = ecommerce.value;
        payload.items = ecommerce.items;
        payload.content_ids = ecommerce.items.map(function (item) {
            return item.item_id;
        });
        payload.contents = ecommerce.items.map(function (item) {
            return {
                id: item.item_id,
                quantity: item.quantity,
                item_price: item.price,
            };
        });
        payload.ecommerce = ecommerce;

        return payload;
    }

    function getPageLoadOnceKey(name) {
        if (!window.__ondaPageLoadId) {
            window.__ondaPageLoadId = String(Date.now()) + '_' + randomSuffix();
        }

        return name + ':' + getPagePath() + ':' + window.__ondaPageLoadId;
    }

    function trackPageView() {
        var onceKey = getPageLoadOnceKey('onda-track-page-view');

        if (wasTrackedOnce(onceKey)) {
            return;
        }

        markTrackedOnce(onceKey);

        // Meta PageView só na VSL — 1.º contacto anúncio → funil. Outras páginas usam eventos próprios.
        pushEvent('page_view', {
            page_title: document.title,
        }, {
            meta: getPageType() === 'vsl',
        });
    }

    function trackViewContent(payload) {
        if (wasTrackedOnce('onda-track-view-content')) {
            return;
        }

        markTrackedOnce('onda-track-view-content');

        var ecommerce = buildEcommerce(payload || {});
        pushEvent('view_content', {
            currency: ecommerce.currency,
            value: ecommerce.value,
            content_ids: ecommerce.items.map(function (item) {
                return item.item_id;
            }),
            contents: ecommerce.items.map(function (item) {
                return {
                    id: item.item_id,
                    quantity: item.quantity,
                    item_price: item.price,
                };
            }),
            ecommerce: ecommerce,
        });
    }

    function trackLead(payload) {
        if (wasTrackedOnce('onda-track-lead')) {
            return Promise.resolve(false);
        }

        markTrackedOnce('onda-track-lead');

        var leadPayload = Object.assign({}, payload || {});
        var paymentIntentId = getCheckoutPaymentIntentId();

        if (paymentIntentId && !leadPayload.event_id) {
            leadPayload.event_id = 'lead_' + paymentIntentId;
        }

        var advancedMatchingPromise = setMetaAdvancedMatching(leadPayload).catch(function () {
            return null;
        });

        return advancedMatchingPromise.then(function () {
            pushEvent('lead', leadPayload);

            if (paymentIntentId) {
                trackInitiateCheckout({
                    event_id: 'initiate_checkout_' + paymentIntentId,
                });
            }

            return true;
        });
    }

    function trackInitiateCheckout(payload) {
        var onceKey = getTrackingOnceKey('onda-track-initiate-checkout');

        if (wasTrackedOnce(onceKey)) {
            return;
        }

        markTrackedOnce(onceKey);

        var checkoutPayload = buildCheckoutPayload(payload || {});
        var eventPayload = Object.assign({}, checkoutPayload, payload || {});

        if (!eventPayload.event_id) {
            var paymentIntentId = getCheckoutPaymentIntentId();

            if (paymentIntentId) {
                eventPayload.event_id = 'initiate_checkout_' + paymentIntentId;
            }
        }

        pushEvent('initiate_checkout', eventPayload);
    }

    function trackCheckoutStarted(payload) {
        if (wasTrackedOnce('onda-track-checkout-started')) {
            return;
        }

        markTrackedOnce('onda-track-checkout-started');

        var checkoutPayload = buildCheckoutPayload(payload);
        pushEvent('checkout_started', checkoutPayload, { meta: false });
    }

    function trackCheckoutValueUpdate(payload) {
        var checkoutPayload = buildCheckoutPayload(payload);
        pushEvent('checkout_value_update', checkoutPayload, { meta: false });
    }

    function trackPaymentSubmitted(payload) {
        var checkoutPayload = buildCheckoutPayload(payload);
        pushEvent('payment_submitted', checkoutPayload, { meta: false });
    }

    function trackPaymentFailed(payload) {
        pushEvent('payment_failed', payload || {}, { meta: false });
    }

    function trackPaymentSucceeded(payload) {
        var checkoutPayload = buildCheckoutPayload(payload);
        pushEvent('payment_succeeded', checkoutPayload, { meta: false });
    }

    function waitForTrackingFlush(ms) {
        var delay = typeof ms === 'number' ? ms : 400;

        return new Promise(function (resolve) {
            window.setTimeout(resolve, delay);
        });
    }

    function getPurchaseOnceKey(transactionId) {
        return 'onda-track-purchase:' + (transactionId || 'unknown');
    }

    function trackPurchase(payload) {
        var onceKey = getPurchaseOnceKey(payload && payload.transactionId);

        if (wasTrackedOnce(onceKey)) {
            return false;
        }

        if (!window.fbq) {
            return false;
        }

        markTrackedOnce(onceKey);

        var checkoutPayload = buildCheckoutPayload(payload);
        var eventId = payload && payload.transactionId
            ? ('purchase_' + payload.transactionId)
            : getPurchaseEventId();

        pushEvent('purchase', Object.assign({}, checkoutPayload, {
            event_id: eventId,
            transaction_id: payload && payload.transactionId ? payload.transactionId : '',
        }));

        return true;
    }

    function waitForFbq(maxMs) {
        var timeout = typeof maxMs === 'number' ? maxMs : 5000;

        return new Promise(function (resolve) {
            if (window.fbq) {
                resolve(true);
                return;
            }

            var elapsed = 0;

            var timer = window.setInterval(function () {
                elapsed += 100;

                if (window.fbq) {
                    window.clearInterval(timer);
                    resolve(true);
                    return;
                }

                if (elapsed >= timeout) {
                    window.clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    }

    function wasPurchaseTracked(transactionId) {
        return wasTrackedOnce(getPurchaseOnceKey(transactionId));
    }

    function trackPurchaseAsync(payload) {
        return bootstrap()
            .then(function () {
                return waitForFbq(5000);
            })
            .then(function () {
                if (trackPurchase(payload)) {
                    return waitForTrackingFlush(450);
                }

                return waitForFbq(3000).then(function () {
                    trackPurchase(payload);
                    return waitForTrackingFlush(450);
                });
            });
    }

    function trackCtaClick(payload) {
        pushEvent('cta_click', payload || {}, { meta: false });
    }

    function trackVslEvent(eventName, payload) {
        pushEvent(eventName, payload || {}, { meta: false });
    }

    function getTrackingConfigUrl() {
        var slug = document.documentElement.getAttribute('data-offer-slug');

        if (slug) {
            return window.location.origin + '/api/tracking-config?offer=' + encodeURIComponent(slug);
        }

        return window.location.origin + '/api/tracking-config';
    }

    function getStripeTrackingMetadata() {
        var attribution = getAttribution();
        var payload = Object.assign({
            fbp: getFbp(),
            fbc: getFbc(),
            purchase_event_id: getPurchaseEventId(),
            ga_client_id: getGaClientId(),
        }, attribution);

        if (config && config.offer_id) {
            payload.offer_id = config.offer_id;
        }

        if (config && config.offer_slug) {
            payload.offer_slug = config.offer_slug;
        }

        return payload;
    }

    function bindLeadTracking() {
        var emailField = document.getElementById('email');
        var form = document.getElementById('checkout-form');
        var fullNameField = form && form.full_name ? form.full_name : document.querySelector('[name="full_name"]');
        var phoneField = form && form.phone ? form.phone : document.getElementById('phone');
        var countryField = document.getElementById('country');
        var phoneCountryField = form && form.phone_country ? form.phone_country : document.querySelector('[name="phone_country"]');

        if (!emailField) {
            return;
        }

        function getLeadPayload() {
            return {
                email: emailField.value.trim(),
                full_name: fullNameField ? fullNameField.value.trim() : '',
                phone: phoneField ? phoneField.value.trim() : '',
                country: countryField ? countryField.value.trim() : '',
                phoneCountry: phoneCountryField ? phoneCountryField.value.trim() : '',
            };
        }

        function maybeTrackLead() {
            var payload = getLeadPayload();
            var email = payload.email;

            if (!email || email.indexOf('@') === -1) {
                return;
            }

            trackLead(payload);
        }

        emailField.addEventListener('blur', maybeTrackLead);
        emailField.addEventListener('change', maybeTrackLead);
    }

    function bindCheckoutPaymentIntentTracking() {
        document.addEventListener('checkout:payment-intent-ready', function (event) {
            if (!event.detail || !event.detail.paymentIntentId) {
                return;
            }

            setCheckoutPaymentIntentId(event.detail.paymentIntentId);
        });
    }

    function bindCtaTracking() {
        document.addEventListener('click', function (event) {
            var target = event.target;

            if (!target || typeof target.closest !== 'function') {
                return;
            }

            var clickable = target.closest('a, button, [role="button"]');

            if (!clickable) {
                return;
            }

            var href = clickable.getAttribute('href') || '';
            var className = clickable.className || '';
            var elementId = clickable.id || '';
            var isVturbCta = className.indexOf('smartplayer-click-event') !== -1 ||
                elementId.indexOf('smartplayer-click-event') === 0;
            var isCheckoutLink = href.indexOf('checkout') !== -1;

            if (!isVturbCta && !isCheckoutLink) {
                return;
            }

            trackCtaClick({
                cta_text: (clickable.textContent || '').trim().slice(0, 120),
                cta_href: href,
                cta_id: elementId,
            });
        }, true);
    }

    function initPageTracking() {
        var pageType = getPageType();

        trackPageView();

        if (pageType === 'vsl') {
            trackViewContent({
                amountCents: 900,
            });
            bindCtaTracking();
        }

        if (pageType === 'checkout') {
            bindCheckoutPaymentIntentTracking();

            function fireCheckoutEvents() {
                bindLeadTracking();
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', fireCheckoutEvents);
            } else {
                fireCheckoutEvents();
            }

            document.addEventListener('checkout:total-change', function (event) {
                if (!event.detail) {
                    return;
                }

                trackCheckoutValueUpdate({
                    amountCents: event.detail.amountCents,
                    orderBumps: event.detail.orderBumps,
                });
            });
        }
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.async = true;
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function loadGtm(containerId, loaderUrl) {
        if (!containerId) {
            return Promise.resolve();
        }

        window.dataLayer.push({
            'gtm.start': new Date().getTime(),
            event: 'gtm.js',
        });

        var baseUrl = loaderUrl || 'https://www.googletagmanager.com';
        var src = baseUrl.replace(/\/$/, '') + '/gtm.js?id=' + encodeURIComponent(containerId);

        return loadScript(src);
    }

    function loadGa4(measurementId, serverContainerUrl) {
        if (!measurementId) {
            return Promise.resolve();
        }

        return loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId)).then(function () {
            window.gtag = window.gtag || function () {
                window.dataLayer.push(arguments);
            };

            var gaConfig = {
                send_page_view: false,
            };

            if (serverContainerUrl) {
                gaConfig.transport_url = serverContainerUrl;
                gaConfig.server_container_url = serverContainerUrl;
            }

            window.gtag('js', new Date());
            window.gtag('config', measurementId, gaConfig);
        });
    }

    function loadMetaPixel(pixelId) {
        if (!pixelId || window.fbq) {
            return Promise.resolve();
        }

        var script = (
            "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?" +
            "n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;" +
            "n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;" +
            "t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script'," +
            "'https://connect.facebook.net/en_US/fbevents.js');fbq('init','" + pixelId + "',{}, {autoConfig:false});"
        );

        var inline = document.createElement('script');
        inline.text = script;
        document.head.appendChild(inline);

        return Promise.resolve();
    }

    function bootstrap() {
        if (bootstrapPromise) {
            return bootstrapPromise;
        }

        captureAttribution();
        ensureFbcCookie();

        bootstrapPromise = fetch(getTrackingConfigUrl())
            .then(function (response) {
                return response.json();
            })
            .then(function (trackingConfig) {
                config = trackingConfig || {};

                return loadMetaPixel(config.metaPixelId).then(function () {
                    applyMetaAdvancedMatching();
                    initPageTracking();

                    var loaderTasks = [loadGa4(config.ga4MeasurementId, config.serverContainerUrl)];

                    if (config.gtmWebEnabled && config.gtmContainerId) {
                        loaderTasks.push(loadGtm(config.gtmContainerId, config.stapeGtmUrl || config.serverContainerUrl));
                    } else if (config.stapeCookieExtenderEnabled && config.gtmContainerId && config.stapeGtmUrl) {
                        loaderTasks.push(loadGtm(config.gtmContainerId, config.stapeGtmUrl));
                    }

                    Promise.allSettled(loaderTasks);

                    return config;
                });
            })
            .catch(function () {
                initPageTracking();
                return null;
            });

        return bootstrapPromise;
    }

    window.OndaTracking = {
        bootstrap: bootstrap,
        trackPageView: trackPageView,
        trackViewContent: trackViewContent,
        trackLead: trackLead,
        trackInitiateCheckout: trackInitiateCheckout,
        trackCheckoutStarted: trackCheckoutStarted,
        trackCheckoutValueUpdate: trackCheckoutValueUpdate,
        trackPaymentSubmitted: trackPaymentSubmitted,
        trackPaymentFailed: trackPaymentFailed,
        trackPaymentSucceeded: trackPaymentSucceeded,
        trackPurchase: trackPurchase,
        trackPurchaseAsync: trackPurchaseAsync,
        wasPurchaseTracked: wasPurchaseTracked,
        waitForTrackingFlush: waitForTrackingFlush,
        trackCtaClick: trackCtaClick,
        trackVslEvent: trackVslEvent,
        getStripeTrackingMetadata: getStripeTrackingMetadata,
        collectPayload: getStripeTrackingMetadata,
        getAttribution: getAttribution,
        captureAttribution: captureAttribution,
        setMetaAdvancedMatching: setMetaAdvancedMatching,
        applyMetaAdvancedMatching: applyMetaAdvancedMatching,
        pushEvent: pushEvent,
    };

    bootstrap();
})();
