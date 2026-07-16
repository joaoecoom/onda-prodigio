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
    var initialized = false;
    var purchaseEventId = null;
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
                price: 9,
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
                price: 5,
                quantity: 1,
                item_category: 'order_bump',
            });
        });

        return items;
    }

    function buildEcommerce(payload) {
        var value = centsToValue(payload.amountCents || 900);
        var items = buildItems(payload.orderBumps || []);

        return {
            currency: 'EUR',
            value: value,
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

    function pushEvent(eventName, payload) {
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

        if (window.fbq) {
            var metaEventName = META_STANDARD_EVENTS[eventName];
            var metaOptions = { eventID: eventId };

            if (metaEventName) {
                window.fbq('track', metaEventName, {
                    currency: eventPayload.currency,
                    value: eventPayload.value,
                    content_ids: eventPayload.content_ids,
                    contents: eventPayload.contents,
                }, metaOptions);
            } else {
                window.fbq('trackCustom', eventName, eventPayload, metaOptions);
            }
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

    function trackPageView() {
        if (wasTrackedOnce('onda-track-page-view')) {
            return;
        }

        markTrackedOnce('onda-track-page-view');

        pushEvent('page_view', {
            page_title: document.title,
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
            return;
        }

        markTrackedOnce('onda-track-lead');

        pushEvent('lead', payload || {});
    }

    function trackInitiateCheckout(payload) {
        if (wasTrackedOnce('onda-track-initiate-checkout')) {
            return;
        }

        markTrackedOnce('onda-track-initiate-checkout');

        var checkoutPayload = buildCheckoutPayload(payload);
        pushEvent('initiate_checkout', checkoutPayload);
    }

    function trackCheckoutStarted(payload) {
        if (wasTrackedOnce('onda-track-checkout-started')) {
            return;
        }

        markTrackedOnce('onda-track-checkout-started');

        var checkoutPayload = buildCheckoutPayload(payload);
        pushEvent('checkout_started', checkoutPayload);
    }

    function trackCheckoutValueUpdate(payload) {
        var checkoutPayload = buildCheckoutPayload(payload);
        pushEvent('checkout_value_update', checkoutPayload);
    }

    function trackPaymentSubmitted(payload) {
        var checkoutPayload = buildCheckoutPayload(payload);
        pushEvent('payment_submitted', checkoutPayload);
    }

    function trackPaymentFailed(payload) {
        pushEvent('payment_failed', payload || {});
    }

    function trackPaymentSucceeded(payload) {
        var checkoutPayload = buildCheckoutPayload(payload);
        pushEvent('payment_succeeded', checkoutPayload);
    }

    function trackPurchase(payload) {
        if (wasTrackedOnce('onda-track-purchase')) {
            return;
        }

        markTrackedOnce('onda-track-purchase');

        var checkoutPayload = buildCheckoutPayload(payload);
        var eventId = getPurchaseEventId();

        pushEvent('purchase', Object.assign({}, checkoutPayload, {
            event_id: eventId,
            transaction_id: payload && payload.transactionId ? payload.transactionId : '',
        }));
    }

    function trackCtaClick(payload) {
        pushEvent('cta_click', payload || {});
    }

    function trackVslEvent(eventName, payload) {
        pushEvent(eventName, payload || {});
    }

    function getStripeTrackingMetadata() {
        var attribution = getAttribution();

        return Object.assign({
            fbp: getFbp(),
            fbc: getFbc(),
            purchase_event_id: getPurchaseEventId(),
            ga_client_id: getGaClientId(),
        }, attribution);
    }

    function bindLeadTracking() {
        var emailField = document.getElementById('email');

        if (!emailField) {
            return;
        }

        function maybeTrackLead() {
            var email = emailField.value.trim();

            if (!email || email.indexOf('@') === -1) {
                return;
            }

            trackLead({
                email: email,
            });
        }

        emailField.addEventListener('blur', maybeTrackLead);
        emailField.addEventListener('change', maybeTrackLead);
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
            function fireCheckoutEvents() {
                trackInitiateCheckout();
                bindLeadTracking();
            }

            if (window.CheckoutOrderBumps) {
                fireCheckoutEvents();
            } else {
                document.addEventListener('DOMContentLoaded', fireCheckoutEvents);
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

    function loadGa4(measurementId) {
        if (!measurementId) {
            return Promise.resolve();
        }

        return loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId)).then(function () {
            window.gtag = window.gtag || function () {
                window.dataLayer.push(arguments);
            };

            window.gtag('js', new Date());
            window.gtag('config', measurementId, {
                send_page_view: false,
            });
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
            "'https://connect.facebook.net/en_US/fbevents.js');fbq('init','" + pixelId + "');"
        );

        var inline = document.createElement('script');
        inline.text = script;
        document.head.appendChild(inline);

        return Promise.resolve();
    }

    function bootstrap() {
        if (initialized) {
            return Promise.resolve(config);
        }

        initialized = true;
        captureAttribution();
        ensureFbcCookie();

        return fetch(window.location.origin + '/api/tracking-config')
            .then(function (response) {
                return response.json();
            })
            .then(function (trackingConfig) {
                config = trackingConfig || {};

                return Promise.all([
                    loadGtm(config.gtmContainerId, config.stapeGtmUrl || config.serverContainerUrl),
                    loadGa4(config.ga4MeasurementId),
                    loadMetaPixel(config.metaPixelId),
                ]).then(function () {
                    initPageTracking();
                    return config;
                });
            })
            .catch(function () {
                initPageTracking();
                return null;
            });
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
        trackCtaClick: trackCtaClick,
        trackVslEvent: trackVslEvent,
        getStripeTrackingMetadata: getStripeTrackingMetadata,
        getAttribution: getAttribution,
        captureAttribution: captureAttribution,
        pushEvent: pushEvent,
    };

    bootstrap();
})();
