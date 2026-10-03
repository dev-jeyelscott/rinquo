import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests run against the already running Docker stack
 * (`make up`, or the CI compose stack), not an in-process server, because
 * realtime checks need the real Reverb server.
 */
export default defineConfig({
    testDir: './tests/Browser',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost',
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
