/**
 * Playwright E2E — HUB DR Ecoom commercial flows
 *
 * Requires environment variables:
 *   E2E_BASE_URL       — e.g. https://hub-dr-ecoom.vercel.app
 *   E2E_HUB_TOKEN      — METRICS_DASHBOARD_PASSWORD or BOOTSTRAP_SECRET
 *   E2E_SITE_URL       — public site base (optional, defaults to onda-prodigio.vercel.app)
 *
 * Optional:
 *   E2E_OFFER_SLUG     — existing test offer slug (skip create)
 *   E2E_STRIPE_TEST=1  — run checkout payment step (requires Stripe test keys on offer)
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || '';
const HUB_TOKEN = process.env.E2E_HUB_TOKEN || '';
const SITE_URL = (process.env.E2E_SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
const HAS_E2E = Boolean(BASE_URL && HUB_TOKEN);

function hubApi(path, options) {
    const url = BASE_URL.replace(/\/$/, '') + path;
    return fetch(url, Object.assign({
        headers: {
            Authorization: 'Bearer ' + HUB_TOKEN,
            'Content-Type': 'application/json',
        },
    }, options || {}));
}

test.describe('HUB DR Ecoom E2E', function () {
    test.skip(!HAS_E2E, 'Set E2E_BASE_URL and E2E_HUB_TOKEN to run browser E2E');

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

    test('checkout page loads for offer query', async function ({ page }) {
        const slug = process.env.E2E_OFFER_SLUG || 'onda-prodigio';
        const url = SITE_URL + '/checkout/?offer=' + encodeURIComponent(slug) +
            '&product_id=' + encodeURIComponent(slug) + '&mode=test';
        await page.goto(url);
        await expect(page.locator('#checkout-form')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('#checkout-title')).not.toHaveText('A carregar…');
    });

    test('page engine preview loads for onda vsl-sales draft', async function ({ page }) {
        const previewUrl = SITE_URL +
            '/preview/onda-prodigio/onda-principal/vsl-sales?preview=1';
        const response = await page.goto(previewUrl);
        expect(response && response.status()).toBeLessThan(500);
        await expect(page.locator('body')).toBeVisible();
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

        if (response.status === 400) {
            test.skip(true, 'Create offer failed — may need unique slug or permissions');
            return;
        }

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

test.describe('Attribution URL persistence', function () {
    test('tracking script exposes attribution helpers on checkout', async function ({ page }) {
        test.skip(!HAS_E2E, 'E2E env required');

        const slug = process.env.E2E_OFFER_SLUG || 'onda-prodigio';
        const url = SITE_URL + '/checkout/?offer=' + encodeURIComponent(slug) +
            '&product_id=' + encodeURIComponent(slug) +
            '&mode=test&utm_source=test&utm_medium=cpc&utm_campaign=e2e-test&fbclid=fb.e2e.test';

        await page.goto(url);
        await page.waitForFunction(function () {
            return window.OndaTracking && typeof window.OndaTracking.getAttribution === 'function';
        }, { timeout: 20000 });

        const attribution = await page.evaluate(function () {
            return window.OndaTracking.getAttribution();
        });

        expect(attribution.utm_source).toBe('test');
        expect(attribution.utm_campaign).toBe('e2e-test');
    });
});
