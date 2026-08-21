const { defineConfig } = require('@playwright/test');

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
