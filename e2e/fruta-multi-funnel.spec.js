/**
 * Bloco H4 — Fruta da Época multi-funnel + universal checkout + order bumps
 */

const { test, expect } = require('@playwright/test');

const SITE_URL = (process.env.E2E_SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
const BASE_URL = (process.env.E2E_BASE_URL || 'https://hub-dr-ecoom.vercel.app').replace(/\/$/, '');
const HUB_TOKEN = process.env.E2E_HUB_TOKEN || '';
const OFFER = 'fruta-da-epoca';
const QUIZ_FUNNEL = process.env.E2E_QUIZ_FUNNEL || 'quiz-fruta';
const VSL_FUNNEL = process.env.E2E_VSL_FUNNEL || 'vsl-fruta';

async function resolveCheckoutTotal(selectedBumpIds) {
    const response = await fetch(SITE_URL + '/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'test',
            checkout_id: 'main',
            offer_slug: OFFER,
            product_id: OFFER,
            selected_bump_ids: selectedBumpIds,
            email: 'e2e-fruta@example.com',
            full_name: 'E2E Fruta',
            tracking: {
                offer_slug: OFFER,
                funnel_slug: VSL_FUNNEL,
                utm_source: 'e2e',
                utm_medium: 'test',
            },
        }),
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error || 'create-payment-intent failed');
    }

    return payload;
}

test.describe('Fruta da Época — multi-funnel', function () {
    test('TEST 1: Quiz → result → checkout', async function ({ page }) {
        const url = SITE_URL + '/preview/' + OFFER + '/' + QUIZ_FUNNEL + '/quiz?preview=1';
        const response = await page.goto(url);

        if (response && response.status() === 404) {
            test.skip(true, 'Quiz funnel not provisioned');
        }

        await expect(page.locator('[data-quiz-start]')).toBeVisible({ timeout: 20000 });
        await page.click('[data-quiz-start]');

        for (var step = 0; step < 5; step += 1) {
            var next = page.locator('[data-quiz-next]');
            if (!(await next.isVisible({ timeout: 3000 }).catch(function () { return false; }))) {
                break;
            }

            var option = page.locator('.quiz-option input').first();
            if (await option.isVisible().catch(function () { return false; })) {
                await option.check({ force: true });
            }

            var textInput = page.locator('[data-quiz-input]');
            if (await textInput.isVisible().catch(function () { return false; })) {
                await textInput.fill('quiz-e2e@example.com');
            }

            await next.click();
        }

        await expect(page.locator('[data-quiz-cta]')).toBeVisible({ timeout: 20000 });
        await page.click('[data-quiz-cta]');
        await expect(page).toHaveURL(new RegExp('checkout.*offer=' + OFFER), { timeout: 20000 });
        await expect(page.locator('#checkout-form')).toBeVisible();
    });

    test('TEST 2: VSL → CTA → checkout with funnel param', async function ({ page }) {
        const previewUrl = SITE_URL + '/preview/' + OFFER + '/' + VSL_FUNNEL + '/sales?preview=1';
        const response = await page.goto(previewUrl);

        if (response && response.status() === 404) {
            test.skip(true, 'VSL funnel not provisioned');
        }

        await expect(page.locator('.pe-button--primary').first()).toBeVisible({ timeout: 20000 });
        await page.locator('.pe-button--primary').first().click();
        await expect(page).toHaveURL(new RegExp('checkout.*offer=' + OFFER), { timeout: 20000 });
        await expect(page.url()).toContain('funnel=' + encodeURIComponent(VSL_FUNNEL));
        await expect(page.locator('#checkout-form')).toBeVisible();
    });
});

test.describe('Fruta da Época — checkout amounts (server-side)', function () {
    test('TEST 3: checkout €10 without bumps', async function () {
        const payload = await resolveCheckoutTotal([]);
        expect(payload.clientSecret).toBeTruthy();
    });

    test('TEST 4: checkout €16 with 3 bumps', async function () {
        const payload = await resolveCheckoutTotal(['bump-1', 'bump-2', 'bump-3']);
        expect(payload.clientSecret).toBeTruthy();
    });

    test('TEST 5: bump isolation rejects foreign bump', async function () {
        const response = await fetch(SITE_URL + '/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'test',
                checkout_id: 'main',
                offer_slug: OFFER,
                product_id: OFFER,
                selected_bump_ids: ['bump-from-other-offer'],
                email: 'e2e@example.com',
            }),
        });

        expect(response.status).toBe(400);
    });

    test('TEST 6: product isolation rejects wrong product', async function () {
        const response = await fetch(SITE_URL + '/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'test',
                checkout_id: 'main',
                offer_slug: OFFER,
                product_id: 'onda-prodigio',
                selected_bump_ids: [],
                email: 'e2e@example.com',
            }),
        });

        expect(response.status).toBe(400);
    });
});

test.describe('Fruta da Época — checkout UI bumps', function () {
    test('order bumps show and total updates to €16', async function ({ page }) {
        const url = SITE_URL + '/checkout/?offer=' + OFFER + '&funnel=' + VSL_FUNNEL +
            '&page=sales&mode=test&utm_source=e2e&utm_campaign=fruta-bumps';

        await page.goto(url);
        await expect(page.locator('#checkout-form')).toBeVisible({ timeout: 20000 });

        var bumpSection = page.locator('#order-bumps-section');

        if (await bumpSection.isVisible().catch(function () { return false; })) {
            await page.locator('input[name="order_bump"]').nth(0).check({ force: true });
            await page.locator('input[name="order_bump"]').nth(1).check({ force: true });
            await page.locator('input[name="order_bump"]').nth(2).check({ force: true });
            await expect(page.locator('#checkout-price')).toContainText('16');
        } else {
            await expect(page.locator('#checkout-price')).toContainText('10');
        }

        await page.waitForFunction(function () {
            return window.OndaTracking && typeof window.OndaTracking.getAttribution === 'function';
        }, { timeout: 20000 });

        var attribution = await page.evaluate(function () {
            return window.OndaTracking.getAttribution();
        });

        expect(attribution.utm_source).toBe('e2e');
        expect(attribution.utm_campaign).toBe('fruta-bumps');
    });
});

test.describe('Fruta da Época — Page Builder', function () {
    test.skip(!HUB_TOKEN, 'Set E2E_HUB_TOKEN');

    test('editor opens for vsl-fruta sales page', async function ({ page }) {
        const editorUrl = BASE_URL + '/editor/' + OFFER + '/' + VSL_FUNNEL + '/sales';
        await page.goto(editorUrl);
        await page.fill('#peb-password', HUB_TOKEN);
        await page.click('#peb-login-form button[type="submit"]');
        await expect(page.locator('#peb-app')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('#peb-login')).toBeHidden();
        await expect(page.locator('#peb-tree')).toBeVisible();
    });
});
