const { defineConfig } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

var tokenFile = path.join(__dirname, '.e2e-hub-token.local');

if (!process.env.E2E_HUB_TOKEN && fs.existsSync(tokenFile)) {
    process.env.E2E_HUB_TOKEN = fs.readFileSync(tokenFile, 'utf8').trim();
}

if (!process.env.E2E_BASE_URL) {
    process.env.E2E_BASE_URL = 'https://hub-dr-ecoom.vercel.app';
}

if (!process.env.E2E_SITE_URL) {
    process.env.E2E_SITE_URL = 'https://onda-prodigio.vercel.app';
}

module.exports = defineConfig({
    testDir: './e2e',
    testIgnore: ['**/._*', '**/.DS_Store'],
    timeout: 60000,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['list']],
    use: {
        headless: true,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
});
