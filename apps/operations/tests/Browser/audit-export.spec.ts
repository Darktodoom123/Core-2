import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

type ExportFormat = 'csv' | 'pdf';

/** Records every 4xx/5xx response so a queued export cannot hide a failed request. */
function trackNetworkErrors(page: Page): { url: string; status: number }[] {
    const errors: { url: string; status: number }[] = [];
    page.on('response', (response) => {
        if (response.status() >= 400) {
            errors.push({ url: response.url(), status: response.status() });
        }
    });

    return errors;
}

async function openAuditTrail(page: Page): Promise<void> {
    await page.goto('/?section=audit');
    // The header banner repeats the section label, so scope to the page body.
    await expect(
        page
            .locator('#workspace-content')
            .getByRole('heading', { name: 'Audit trail', exact: true }),
    ).toBeVisible();
}

async function queueExport(page: Page, format: ExportFormat): Promise<void> {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export the audit trail' });
    await expect(dialog).toBeVisible();

    await dialog.locator(`input[name="format"][value="${format}"]`).check();
    await dialog.getByRole('button', { name: 'Queue export' }).click();

    await expect(page.getByText(/Export task requested/i)).toBeVisible();
}

test.describe('Audit Trail & Report Export Pipeline E2E', () => {
    test.beforeEach(async ({ page }) => {
        const fixtures = browserFixtures();
        await signIn(page, fixtures.users.admin, fixtures.password);
    });

    test('Variant 1: Admin can queue a CSV export of the whole audit trail', async ({
        page,
    }) => {
        const networkErrors = trackNetworkErrors(page);

        await openAuditTrail(page);
        await queueExport(page, 'csv');

        expect(networkErrors).toHaveLength(0);
    });

    test('Variant 2: Admin can queue a PDF export of the whole audit trail', async ({
        page,
    }) => {
        const networkErrors = trackNetworkErrors(page);

        await openAuditTrail(page);
        await queueExport(page, 'pdf');

        expect(networkErrors).toHaveLength(0);
    });

    test('Variant 3: Admin can queue a CSV export for the last 7 days', async ({
        page,
    }) => {
        const networkErrors = trackNetworkErrors(page);

        await openAuditTrail(page);
        await page
            .getByRole('group', { name: 'Date range' })
            .getByRole('button', { name: '7 days', exact: true })
            .click();

        // The dialog starts from the dates chosen on the page.
        await page.getByRole('button', { name: 'Export', exact: true }).click();
        const dialog = page.getByRole('dialog', {
            name: 'Export the audit trail',
        });
        await expect(dialog.getByLabel('Export from date')).not.toHaveValue('');
        await dialog.getByRole('button', { name: 'Cancel' }).click();

        await queueExport(page, 'csv');

        expect(networkErrors).toHaveLength(0);
    });

    test('Variant 4: Admin can queue a PDF export for today', async ({
        page,
    }) => {
        const networkErrors = trackNetworkErrors(page);

        await openAuditTrail(page);
        await page
            .getByRole('group', { name: 'Date range' })
            .getByRole('button', { name: 'Today', exact: true })
            .click();
        await queueExport(page, 'pdf');

        expect(networkErrors).toHaveLength(0);
    });

    test('Variant 5: A queued export appears under Your audit exports', async ({
        page,
    }) => {
        await openAuditTrail(page);
        await queueExport(page, 'csv');

        const exportsPanel = page.getByRole('region', {
            name: 'Your audit exports',
        });
        await exportsPanel
            .getByRole('button', { name: 'Check status' })
            .click();
        await expect(exportsPanel.getByRole('listitem').first()).toBeVisible();
    });

    test('Variant 6: Direct GET /operations/reports/exports redirects gracefully to workspace exports', async ({
        page,
    }) => {
        await page.goto('/operations/reports/exports');
        await expect(page.getByText('404')).not.toBeVisible();
        await expect(page).toHaveURL(/section=exports/);
    });
});
