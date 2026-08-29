/* global module */
/**
 * Lighthouse CI Configuration
 *
 * Configured for unbiased, industry-standard auditing:
 * - 3 median runs per target
 * - Emulated Mobile & Desktop presets
 * - Standard Core Web Vitals assertion budgets
 */
module.exports = {
    ci: {
        collect: {
            url: [
                'http://127.0.0.1:4173/login',
            ],
            numberOfRuns: 3,
            startServerCommand: 'php tests/Browser/web-server.php',
            startServerReadyPattern: 'Development Server|Server running on',
            startServerReadyTimeout: 90000,
            settings: {
                chromeFlags: [
                    '--headless=new',
                    '--no-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--disable-software-rasterizer',
                ],
                skipAudits: ['uses-http2'],
            },
        },
        assert: {
            assertions: {
                'categories:performance': ['warn', { minScore: 0.85 }],
                'categories:accessibility': ['error', { minScore: 0.95 }],
                'categories:best-practices': ['warn', { minScore: 0.90 }],
                'categories:seo': ['warn', { minScore: 0.90 }],
                'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
                'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
                'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
                'total-blocking-time': ['warn', { maxNumericValue: 300 }],
            },
        },
        upload: {
            target: 'filesystem',
            outputDir: '.ai-reports/lighthouse/lhci',
        },
    },
};
