import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
    testDir: './tests/Browser',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command: 'php artisan serve --host=127.0.0.1 --port=4173',
              url: baseURL,
              reuseExistingServer: !process.env.CI,
              timeout: 30_000,
          },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
