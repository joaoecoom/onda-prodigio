/**
 * Page Builder login → editor shell
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = (process.env.E2E_BASE_URL || 'https://hub-dr-ecoom.vercel.app').replace(/\/$/, '');
const HUB_TOKEN = process.env.E2E_HUB_TOKEN || '';
const HAS_AUTH = Boolean(HUB_TOKEN);

test.describe('Page Builder auth', function () {
    test.skip(!HAS_AUTH, 'Set E2E_HUB_TOKEN');

    test('login opens editor for fruta-da-epoca sales page', async function ({ page }) {
        const editorUrl = BASE_URL + '/editor/fruta-da-epoca/vendas/sales';

        await page.goto(editorUrl);
        await expect(page.locator('#peb-login')).toBeVisible();

        await page.fill('#peb-password', HUB_TOKEN);
        await page.click('#peb-login-form button[type="submit"]');

        await expect(page.locator('#peb-app')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('#peb-login')).toBeHidden();
        await expect(page.locator('#peb-tree')).toBeVisible();
        await expect(page.locator('#peb-page-name')).not.toHaveText('Page');
    });
});
