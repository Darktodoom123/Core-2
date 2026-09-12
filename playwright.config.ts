import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const operationsRoot = path.join(workspaceRoot, 'apps', 'operations');
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
    testDir: path.join(operationsRoot, 'tests', 'Browser'),
    timeout: 60_000,
    expect: {
        timeout: 15_000,
    },
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI
        ? [
              ['html', { open: 'never' }],
              ['github'],
              [
                  'junit',
                  {
                      outputFile:
                          process.env.PLAYWRIGHT_JUNIT_OUTPUT ??
                          'test-results/junit-e2e.xml',
                  },
              ],
          ]
        : 'list',
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command: 'php tests/Browser/web-server.php',
              cwd: operationsRoot,
              url: baseURL,
              reuseExistingServer: false,
              timeout: 120_000,
              stdout: 'pipe',
              stderr: 'pipe',
          },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
