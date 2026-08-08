import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { browserFetch, browserFixtures, signIn } from './browser-fixtures';

test.describe('R6 deterministic authenticated acceptance', () => {
    test('sign-in and role-filtered workspace access are enforced', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await expect(
            page.getByRole('button', { name: 'Job reports' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'GPT AI Advisory' }),
        ).toBeVisible();
        await expect(
            page.getByRole('navigation', {
                name: 'Available operations modules',
            }),
        ).toBeVisible();

        await page.getByRole('button', { name: 'Sign out' }).click();
        await page.waitForURL(/\/login$/);
        await signIn(page, fixtures.users.manager, fixtures.password);
        await page.goto('/?view=reports');
        const exportLinks = page
            .getByRole('link', { name: 'Download' })
            .filter({ has: page.locator('svg') });
        const signedExportUrls = [
            await exportLinks.nth(1).getAttribute('href'),
            await exportLinks.nth(2).getAttribute('href'),
        ];
        expect(signedExportUrls[0]).not.toBeNull();
        expect(signedExportUrls[1]).not.toBeNull();
        await page.getByRole('button', { name: 'Sign out' }).click();
        await page.waitForURL(/\/login$/);
        await signIn(page, fixtures.users.driver, fixtures.password);
        await expect(
            page.getByRole('button', { name: 'Job reports' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'GPT AI Advisory' }),
        ).toHaveCount(0);

        const deniedExport = await browserFetch(
            page,
            signedExportUrls[0] as string,
        );
        const deniedAttachment = await browserFetch(
            page,
            `/operations/attachments/${fixtures.attachment_id}/download`,
        );
        expect(deniedExport.status).toBe(403);
        expect(deniedAttachment.status).toBe(403);
    });

    test('authorized CSV and PDF exports plus attachment download stay private', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.manager, fixtures.password);
        await page.goto('/?view=reports');
        await expect(
            page.getByRole('heading', { name: 'Job reports & attachments' }),
        ).toBeVisible();
        await expect(page.getByRole('link', { name: 'Download' })).toHaveCount(
            3,
        );
        const exportLinks = page
            .getByRole('link', { name: 'Download' })
            .filter({ has: page.locator('svg') });
        const csvUrl = (await exportLinks
            .nth(1)
            .getAttribute('href')) as string;
        const pdfUrl = (await exportLinks
            .nth(2)
            .getAttribute('href')) as string;

        const csv = await browserFetch(page, csvUrl);
        const pdf = await browserFetch(page, pdfUrl);
        const attachment = await browserFetch(
            page,
            `/operations/attachments/${fixtures.attachment_id}/download`,
        );
        expect(csv.status).toBe(200);
        expect(csv.contentType).toContain('text/csv');
        expect(pdf.status).toBe(200);
        expect(pdf.contentType).toContain('application/pdf');
        expect(attachment.status).toBe(200);
        expect(attachment.disposition).toContain('r6-report.txt');
    });

    test('report attachment upload succeeds for an owner and fails closed for an unauthorized driver', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.driver, fixtures.password);
        await page.goto('/?view=reports');
        await page.getByRole('button', { name: 'Submit job report' }).click();
        await page
            .locator('input[type="number"]')
            .fill(String(fixtures.assigned_job_id));
        await page
            .getByPlaceholder('Brief description of work executed')
            .fill('Browser upload acceptance report');
        await page.locator('input[type="file"]').setInputFiles({
            name: 'r6-upload.png',
            mimeType: 'image/png',
            buffer: Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                'base64',
            ),
        });
        const uploadResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith('/operations/job-reports') &&
                response.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Submit report' }).click();
        expect((await uploadResponse).status()).toBeGreaterThanOrEqual(300);
        await expect(page.getByText('r6-upload.png')).toBeVisible();

        await page.getByRole('button', { name: 'Submit job report' }).click();
        await page
            .locator('input[type="number"]')
            .fill(String(fixtures.job_id));
        await page
            .getByPlaceholder('Brief description of work executed')
            .fill('Unauthorized browser upload attempt');
        const deniedUploadResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith('/operations/job-reports') &&
                response.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Submit report' }).click();
        expect((await deniedUploadResponse).status()).toBe(403);
    });

    test('GPT failure, stale, accept, reject, and retry are visible and keyboard safe', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await page.goto('/?view=gpt-recommendations');
        await expect(
            page.getByRole('heading', {
                name: 'GPT AI Advisory & Resource Recommendations',
            }),
        ).toBeVisible();
        await expect(
            page.getByText('GPT generation failed. Please retry.'),
        ).toBeVisible();
        await expect(page.getByText('stale', { exact: true })).toBeVisible();

        const acceptResponse = page.waitForResponse((response) =>
            response
                .url()
                .includes(
                    `/gpt-recommendations/${fixtures.recommendations.pending_accept}/accept`,
                ),
        );
        await page
            .getByRole('button', { name: 'Accept Proposal' })
            .first()
            .click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(
            page.getByRole('dialog').getByRole('button', { name: 'Cancel' }),
        ).toBeFocused();
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Confirm & Apply Resource Plan' })
            .click();
        await (await acceptResponse).finished();

        const rejectResponse = page.waitForResponse((response) =>
            response
                .url()
                .includes(
                    `/gpt-recommendations/${fixtures.recommendations.pending_reject}/reject`,
                ),
        );
        await page.getByRole('button', { name: 'Reject' }).first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(
            page.getByRole('dialog').getByRole('textbox'),
        ).toBeFocused();
        await page
            .getByRole('dialog')
            .getByRole('textbox')
            .fill('Fixture rejection for browser evidence');
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Confirm Rejection' })
            .click();
        await (await rejectResponse).finished();

        await expect(
            page.getByRole('button', { name: 'Retry' }).first(),
        ).toBeVisible();
        const retryResponse = page.waitForResponse((response) =>
            response
                .url()
                .includes(
                    `/gpt-recommendations/${fixtures.recommendations.failed}/retry`,
                ),
        );
        await page
            .locator('tr')
            .filter({
                hasText: `#${fixtures.recommendations.failed}`,
            })
            .getByRole('button', { name: 'Retry' })
            .click();
        await (await retryResponse).finished();
        await expect(
            page.getByText('Recommendation Decision History'),
        ).toBeVisible();
    });

    test('responsive navigation and skip-link focus remain accessible', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await page.setViewportSize({ width: 390, height: 844 });
        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        const openNavigation = page.getByRole('button', {
            name: 'Open navigation',
        });
        await expect(openNavigation).toBeVisible();
        await openNavigation.click();
        await expect(
            page
                .locator('#workspace-navigation')
                .getByRole('button', { name: 'Close navigation' }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Job reports' }).click();
        await expect(
            page.getByRole('heading', { name: 'Job reports & attachments' }),
        ).toBeVisible();

        const skipLink = page.getByRole('link', { name: 'Skip to workspace' });
        await skipLink.focus();
        await expect(skipLink).toBeVisible();
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });
});
