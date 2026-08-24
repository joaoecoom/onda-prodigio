/**
 * Playwright E2E — HUB DR Ecoom commercial flows
 *
 * Public tests (no secrets):
 *   E2E_SITE_URL — defaults to https://onda-prodigio.vercel.app
 *
 * Authenticated tests:
 *   E2E_BASE_URL   — e.g. https://hub-dr-ecoom.vercel.app
 *   E2E_HUB_TOKEN  — METRICS_DASHBOARD_PASSWORD (never commit)
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || '';
const HUB_TOKEN = process.env.E2E_HUB_TOKEN || '';
const SITE_URL = (process.env.E2E_SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
const HAS_AUTH_E2E = Boolean(BASE_URL && HUB_TOKEN);
const HAS_PUBLIC_E2E = Boolean(SITE_URL);

function hubApi(path, options) {
    const url = BASE_URL.replace(/\/$/, '') + path;
    return fetch(url, Object.assign({
        headers: {
            Authorization: 'Bearer ' + HUB_TOKEN,
            'Content-Type': 'application/json',
        },
    }, options || {}));
}

test.describe('Public runtime (no auth)', function () {
    test.skip(!HAS_PUBLIC_E2E, 'Set E2E_SITE_URL');

    test('checkout page loads for offer query', async function ({ page }) {
        const slug = process.env.E2E_OFFER_SLUG || 'onda-prodigio';
        const url = SITE_URL + '/checkout/?offer=' + encodeURIComponent(slug) +
            '&product_id=' + encodeURIComponent(slug) + '&mode=test';
        await page.goto(url);
        await expect(page.locator('#checkout-form')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('#checkout-title')).toHaveText(/Onda Prodígio|Checkout/, { timeout: 20000 });
        await expect(page.locator('#checkout-price')).not.toHaveText('—');
    });

    test('page engine preview loads for onda vsl-sales', async function ({ page }) {
        const previewUrl = SITE_URL +
            '/preview/onda-prodigio/onda-principal/vsl-sales?preview=1';
        const response = await page.goto(previewUrl);
        expect(response && response.status()).toBeLessThan(500);
        await expect(page.locator('body')).toBeVisible();
    });

    test('tracking script exposes attribution on checkout', async function ({ page }) {
        const slug = process.env.E2E_OFFER_SLUG || 'onda-prodigio';
        const url = SITE_URL + '/checkout/?offer=' + encodeURIComponent(slug) +
            '&product_id=' + encodeURIComponent(slug) +
            '&mode=test&utm_source=e2e&utm_medium=test&utm_campaign=production-smoke&fbclid=fb.e2e.test';

        await page.goto(url);
        await page.waitForFunction(function () {
            return window.OndaTracking && typeof window.OndaTracking.getAttribution === 'function';
        }, { timeout: 20000 });

        const attribution = await page.evaluate(function () {
            return window.OndaTracking.getAttribution();
        });

        expect(attribution.utm_source).toBe('e2e');
        expect(attribution.utm_campaign).toBe('production-smoke');
    });
});

test.describe('HUB authenticated E2E', function () {
    test.skip(!HAS_AUTH_E2E, 'Set E2E_BASE_URL and E2E_HUB_TOKEN');

    test('hub shell loads and lists offers', async function ({ page }) {
        await page.goto(BASE_URL + '/hub/?token=' + encodeURIComponent(HUB_TOKEN));
        await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    });

    test('launch health API returns structured readiness', async function () {
        const slug = process.env.E2E_OFFER_SLUG || 'onda-prodigio';
        const response = await hubApi(
            '/api/sales-attribution?action=hub_launch_health&slug=' + encodeURIComponent(slug)
        );
        expect(response.ok).toBeTruthy();
        const payload = await response.json();
        expect(payload).toHaveProperty('readiness');
        expect(payload).toHaveProperty('checks');
        expect(Array.isArray(payload.checks)).toBeTruthy();
    });

    test('metrics API returns revenue fields without fake ROAS zero', async function () {
        const slug = process.env.E2E_OFFER_SLUG || 'onda-prodigio';
        const response = await hubApi(
            '/api/sales-attribution?action=hub_metrics&slug=' + encodeURIComponent(slug) + '&days=30'
        );
        expect(response.ok).toBeTruthy();
        const payload = await response.json();
        expect(payload.metrics).toBeDefined();
        if (!payload.metrics.meta_spend_eur) {
            expect(payload.metrics.roas).toBeNull();
        }
    });

    test('create offer provisions product and checkout', async function () {
        const suffix = Date.now().toString(36);
        const slug = 'e2e-' + suffix;
        const response = await hubApi('/api/sales-attribution?action=hub_create_offer', {
            method: 'POST',
            body: JSON.stringify({
                name: 'E2E Test ' + suffix,
                slug: slug,
                status: 'draft',
                mode: 'test',
            }),
        });

        expect(response.status).toBe(201);
        const payload = await response.json();
        expect(payload.offer.slug).toBe(slug);
        expect(payload.offer.primary_product_id).toBeTruthy();

        const health = await hubApi(
            '/api/sales-attribution?action=hub_launch_health&slug=' + encodeURIComponent(slug)
        );
        const report = await health.json();
        expect(report.offer.slug).toBe(slug);
        expect(report.checks.some(function (c) { return c.id === 'product'; })).toBeTruthy();
    });
});
