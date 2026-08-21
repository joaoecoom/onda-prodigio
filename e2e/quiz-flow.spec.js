/**
 * Quiz funnel flow — preview → answers → result → checkout
 */

const { test, expect } = require('@playwright/test');

const SITE_URL = (process.env.E2E_SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
const OFFER = process.env.E2E_QUIZ_OFFER || 'fruta-da-epoca';
const FUNNEL = process.env.E2E_QUIZ_FUNNEL || 'quiz-fruta';
const PAGE = process.env.E2E_QUIZ_PAGE || 'quiz';

test.describe('Quiz public flow', function () {
    test('quiz preview loads and reaches checkout CTA', async function ({ page }) {
        const previewUrl = SITE_URL + '/preview/' + encodeURIComponent(OFFER) + '/' +
            encodeURIComponent(FUNNEL) + '/' + encodeURIComponent(PAGE) + '?preview=1';

        const response = await page.goto(previewUrl);

        if (response && response.status() === 404) {
            test.skip(true, 'Quiz funnel not provisioned yet');
        }

        await expect(page.locator('[data-quiz-start]')).toBeVisible({ timeout: 20000 });
        await page.click('[data-quiz-start]');

        for (var step = 0; step < 5; step += 1) {
            var next = page.locator('[data-quiz-next]');

            if (!(await next.isVisible({ timeout: 5000 }).catch(function () { return false; }))) {
                break;
            }

            var option = page.locator('.quiz-option input').first();

            if (await option.isVisible().catch(function () { return false; })) {
                await option.check({ force: true });
            }

            var textInput = page.locator('[data-quiz-input]');

            if (await textInput.isVisible().catch(function () { return false; })) {
                await textInput.fill('test@example.com');
            }

            await next.click();
        }

        var cta = page.locator('[data-quiz-cta]');
        await expect(cta).toBeVisible({ timeout: 20000 });

        await cta.click();
        await expect(page).toHaveURL(/checkout/, { timeout: 20000 });
        await expect(page.locator('#checkout-form')).toBeVisible({ timeout: 20000 });
    });
});
