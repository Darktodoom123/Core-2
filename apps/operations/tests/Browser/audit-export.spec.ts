import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test.describe('Audit Trail & Report Export Pipeline E2E', () => {
    test.beforeEach(async ({ page }) => {
        const fixtures = browserFixtures();
        await signIn(page, fixtures.users.admin, fixtures.password);
    });

    test('Variant 1: Admin can request background server export for CSV without date range', async ({
        page,
    }) => {
        const networkErrors: { url: string; status: number }[] = [];
        page.on('response', (response) => {
            if (response.status() >= 400) {
                networkErrors.push({
                    url: response.url(),
                    status: response.status(),
                });
            }
        });

        await page.goto('/?section=audit');
        await expect(
            page.getByRole('heading', { name: 'Audit trail & compliance log' }),
        ).toBeVisible();

        // Open export modal
        await page
            .getByRole('button', { name: 'Export Audit Dataset' })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Export Audit Dataset' }),
        ).toBeVisible();

        // Select CSV format
        await page.locator('input[name="format"][value="csv"]').check();

        // Request export
        await page
            .getByRole('button', { name: 'Request Server Background Export' })
            .click();

        // Verify success flash and zero network errors
        await expect(page.getByText(/Export task requested/i)).toBeVisible();
        expect(networkErrors).toHaveLength(0);
        await expect(page.getByText('404')).not.toBeVisible();
    });

    test('Variant 2: Admin can request background server export for PDF without date range', async ({
        page,
    }) => {
        const networkErrors: { url: string; status: number }[] = [];
        page.on('response', (response) => {
            if (response.status() >= 400) {
                networkErrors.push({
                    url: response.url(),
                    status: response.status(),
                });
            }
        });

        await page.goto('/?section=audit');
        await expect(
            page.getByRole('heading', { name: 'Audit trail & compliance log' }),
        ).toBeVisible();

        // Open export modal
        await page
            .getByRole('button', { name: 'Export Audit Dataset' })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Export Audit Dataset' }),
        ).toBeVisible();

        // Select PDF format
        await page.locator('input[name="format"][value="pdf"]').check();

        // Request export
        await page
            .getByRole('button', { name: 'Request Server Background Export' })
            .click();

        // Verify success flash and zero network errors
        await expect(page.getByText(/Export task requested/i)).toBeVisible();
        expect(networkErrors).toHaveLength(0);
        await expect(page.getByText('404')).not.toBeVisible();
    });

    test('Variant 3: Admin can request background server export for CSV with date range', async ({
        page,
    }) => {
        const networkErrors: { url: string; status: number }[] = [];
        page.on('response', (response) => {
            if (response.status() >= 400) {
                networkErrors.push({
                    url: response.url(),
                    status: response.status(),
                });
            }
        });

        await page.goto('/?section=audit');
        await expect(
            page.getByRole('heading', { name: 'Audit trail & compliance log' }),
        ).toBeVisible();

        // Set date preset to 7 Days
        const preset7d = page.getByRole('button', { name: '7 Days' });
        await expect(preset7d).toBeVisible();
        await preset7d.click();

        // Open export modal
        await page
            .getByRole('button', { name: 'Export Audit Dataset' })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Export Audit Dataset' }),
        ).toBeVisible();

        // Select CSV format
        await page.locator('input[name="format"][value="csv"]').check();

        // Request export
        await page
            .getByRole('button', { name: 'Request Server Background Export' })
            .click();

        // Verify success flash and zero network errors
        await expect(page.getByText(/Export task requested/i)).toBeVisible();
        expect(networkErrors).toHaveLength(0);
        await expect(page.getByText('404')).not.toBeVisible();
    });

    test('Variant 4: Admin can request background server export for PDF with date range', async ({
        page,
    }) => {
        const networkErrors: { url: string; status: number }[] = [];
        page.on('response', (response) => {
            if (response.status() >= 400) {
                networkErrors.push({
                    url: response.url(),
                    status: response.status(),
                });
            }
        });

        await page.goto('/?section=audit');
        await expect(
            page.getByRole('heading', { name: 'Audit trail & compliance log' }),
        ).toBeVisible();

        // Set date preset to Today
        const presetToday = page.getByRole('button', { name: 'Today' });
        await expect(presetToday).toBeVisible();
        await presetToday.click();

        // Open export modal
        await page
            .getByRole('button', { name: 'Export Audit Dataset' })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Export Audit Dataset' }),
        ).toBeVisible();

        // Select PDF format
        await page.locator('input[name="format"][value="pdf"]').check();

        // Request export
        await page
            .getByRole('button', { name: 'Request Server Background Export' })
            .click();

        // Verify success flash and zero network errors
        await expect(page.getByText(/Export task requested/i)).toBeVisible();
        expect(networkErrors).toHaveLength(0);
        await expect(page.getByText('404')).not.toBeVisible();
    });

    test('Variant 5: Admin can trigger instant filtered CSV client download', async ({
        page,
    }) => {
        await page.goto('/?section=audit');
        await expect(
            page.getByRole('heading', { name: 'Audit trail & compliance log' }),
        ).toBeVisible();

        // Open export modal
        await page
            .getByRole('button', { name: 'Export Audit Dataset' })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Export Audit Dataset' }),
        ).toBeVisible();

        // Trigger direct CSV download
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: /Instant CSV/i }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toContain('core2-audit-trail-');
        expect(download.suggestedFilename()).toMatch(/\.csv$/);
    });

    test('Variant 6: Direct GET /operations/reports/exports redirects gracefully to workspace reports', async ({
        page,
    }) => {
        await page.goto('/operations/reports/exports');
        await expect(page.getByText('404')).not.toBeVisible();
        await expect(page.url()).toContain('section=reports');
    });
});
