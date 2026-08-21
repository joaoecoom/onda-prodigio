const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SITE = (process.env.E2E_SITE_URL || 'https://onda-prodigio.vercel.app').replace(/\/$/, '');
const statePath = path.join(__dirname, '..', '.e2e-run-state.json');

test.describe('Production checkout (browser)', function () {
    test('checkout form ready for payment', async function ({ page }) {
        test.skip(!fs.existsSync(statePath), 'Run production-e2e-setup.js first');

        var state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        var url = SITE + '/checkout/?offer=' + encodeURIComponent(state.slugA) +
            '&product_id=' + encodeURIComponent(state.slugA) + '&mode=test';

        await page.goto(url);
        await expect(page.locator('#checkout-title')).toHaveText(/Production E2E/i, { timeout: 20000 });
        await expect(page.locator('#checkout-price')).toHaveText(/1€/);
        await expect(page.locator('#submit-payment')).toBeEnabled();
    });
});
