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
        const csvUrl = (await page
            .locator('tbody tr')
            .filter({ hasText: 'csv' })
            .getByRole('link', { name: 'Download' })
            .getAttribute('href')) as string;
        const pdfUrl = (await page
            .locator('tbody tr')
            .filter({ hasText: 'pdf' })
            .getByRole('link', { name: 'Download' })
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

    test('report attachment validation, count limit, busy state, and focus recovery are visible', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.driver, fixtures.password);
        await page.goto('/?view=reports');
        await page.getByRole('button', { name: 'Submit job report' }).click();

        const jobId = page.locator('input[type="number"]');
        const summary = page.getByPlaceholder(
            'Brief description of work executed',
        );
        await jobId.fill(String(fixtures.assigned_job_id));
        await summary.fill('Browser attachment validation report');

        await page.locator('input[type="file"]').setInputFiles({
            name: 'unsafe.php',
            mimeType: 'text/x-php',
            buffer: Buffer.from('<?php echo "unsafe";'),
        });
        const invalidResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith('/operations/job-reports') &&
                response.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Submit report' }).click();
        expect((await invalidResponse).status()).toBe(302);
        await expect(
            page.getByRole('alert').filter({ hasText: 'We could not submit' }),
        ).toBeVisible();

        await page.locator('input[type="file"]').setInputFiles(
            Array.from({ length: 11 }, (_, index) => ({
                name: `too-many-${index}.pdf`,
                mimeType: 'application/pdf',
                buffer: Buffer.from('%PDF-1.4 fixture'),
            })),
        );
        const countResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith('/operations/job-reports') &&
                response.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Submit report' }).click();
        expect((await countResponse).status()).toBe(302);
        await expect(
            page.getByRole('alert').filter({ hasText: 'We could not submit' }),
        ).toBeVisible();

        await page.locator('input[type="file"]').setInputFiles([]);
        let releaseRequest!: () => void;
        const requestReleased = new Promise<void>((resolve) => {
            releaseRequest = resolve;
        });
        await page.route('**/operations/job-reports', async (route) => {
            await requestReleased;
            await route.continue();
        });

        const submitResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith('/operations/job-reports') &&
                response.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Submit report' }).click();
        await expect(page.locator('form[aria-busy="true"]')).toBeVisible();
        await expect(
            page.locator('#report-submit-form button[type="submit"]'),
        ).toBeDisabled();
        releaseRequest();
        expect((await submitResponse).status()).toBeGreaterThanOrEqual(300);
        await page.unroute('**/operations/job-reports');
        await expect(
            page.getByRole('button', { name: 'Submit job report' }),
        ).toBeFocused();
    });

    test('tracking asset filter supports multiple selections and keyboard close', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await page.goto('/?view=tracking');

        const trigger = page.getByRole('button', {
            name: /Asset type filter:/,
        });
        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute(
            'aria-label',
            'Asset type filter: All Types',
        );
        await trigger.click();

        const menu = page.getByRole('menu', {
            name: 'Asset type filters',
        });
        const trucks = menu.getByRole('menuitemcheckbox', {
            name: /Trucks/,
        });
        const cranes = menu.getByRole('menuitemcheckbox', {
            name: /Cranes/,
        });

        await trucks.click();
        await cranes.click();

        await expect(trucks).toHaveAttribute('aria-checked', 'true');
        await expect(cranes).toHaveAttribute('aria-checked', 'true');
        await expect(
            page.getByRole('button', { name: 'Asset type filter: 2 Types' }),
        ).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        await expect(menu).toBeHidden();
    });

    test('dashboard live tracking preview supports the same asset multi-select', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await expect(
            page.getByRole('heading', { name: 'Live field tracking' }),
        ).toBeVisible();

        const trigger = page.getByRole('button', {
            name: 'Asset type filter: All Types',
        });
        await trigger.click();

        const menu = page.getByRole('menu', {
            name: 'Asset type filters',
        });
        await menu.getByRole('menuitemcheckbox', { name: /Trucks/ }).click();
        await menu.getByRole('menuitemcheckbox', { name: /Personnel/ }).click();

        await expect(
            page.getByRole('button', { name: 'Asset type filter: 2 Types' }),
        ).toBeVisible();
    });

    test('dispatcher overview prioritizes schedule and telemetry exceptions', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await page.setViewportSize({ width: 390, height: 844 });
        await signIn(page, fixtures.users.dispatcher, fixtures.password);

        await expect(
            page.getByRole('heading', { name: 'Dispatch schedule' }),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Telemetry exceptions' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Review units' }),
        ).toBeVisible();
        const scheduleTop = await page
            .getByRole('heading', { name: 'Dispatch schedule' })
            .evaluate((element) => element.getBoundingClientRect().top);
        const trackingTop = await page
            .getByRole('heading', { name: 'Live field tracking' })
            .evaluate((element) => element.getBoundingClientRect().top);
        expect(scheduleTop).toBeLessThan(trackingTop);
        await expect(
            page.getByRole('heading', { name: 'Telemetry summary' }),
        ).toHaveCount(0);
        await expect(page.getByText('Open map')).toHaveCount(0);

        const documentWidth = await page.evaluate(
            () => document.documentElement.scrollWidth,
        );
        expect(documentWidth).toBeLessThanOrEqual(390);
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

    test('selected dispatch details show only its embedded GPT advisory', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await page.goto('/?view=dispatch');
        await page.getByRole('button', { name: /R6-BROWSER-001/ }).click();

        await expect(
            page.getByRole('heading', { name: 'GPT dispatch advisory' }),
        ).toBeVisible();
        await expect(
            page.getByText(/^Recommendation #\d+$/).first(),
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: 'View full advisory' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Accept recommendation' }).first(),
        ).toBeVisible();
    });

    test('responsive navigation and skip-link focus remain accessible', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await page.setViewportSize({ width: 320, height: 844 });
        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        const documentWidth = await page.evaluate(
            () => document.documentElement.scrollWidth,
        );
        expect(documentWidth).toBeLessThanOrEqual(320);

        await page.setViewportSize({ width: 390, height: 844 });
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
        await page.keyboard.press('Escape');
        await expect(page.locator('#workspace-navigation')).not.toHaveAttribute(
            'aria-modal',
            'true',
        );
        await expect(openNavigation).toBeFocused();

        await openNavigation.click();
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

    test('dispatch detail skip link targets the focusable main content', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await page.setViewportSize({ width: 390, height: 844 });
        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await page.goto(`/operations/dispatch-jobs/${fixtures.job_id}`);

        const main = page.locator('#dispatch-detail-main');
        await expect(main).toBeVisible();

        const skipLink = page.getByRole('link', {
            name: 'Skip to main content',
        });
        await skipLink.focus();
        await expect(skipLink).toBeVisible();
        await skipLink.click();
        await expect(main).toBeFocused();
    });

    test('assignment workspace presents a guided setup flow and review rail', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await page.setViewportSize({ width: 390, height: 844 });
        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await page.goto(`/operations/dispatch-jobs/${fixtures.job_id}`);

        await expect(
            page.getByRole('heading', {
                name: 'Prepare this dispatch for activation',
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('navigation', {
                name: 'Dispatch setup progress',
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Assignment plan' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', {
                name: 'Select resources to continue',
            }),
        ).toBeDisabled();
        await expect(page.locator('#dispatch-activation')).toBeVisible();
        await expect(
            page.locator('#dispatch-activation'),
        ).not.toHaveAttribute('open');
        await expect(
            page.locator('#dispatch-activation').getByRole('button', {
                name: 'Activate dispatch',
            }),
        ).toBeHidden();
        await expect(
            page.getByRole('region', {
                name: 'Dispatch setup stage summaries',
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', {
                name: 'Select resources',
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            page.locator('#mobile-assignment-action-bar'),
        ).toBeVisible();
        await expect(page.locator('#administrative-actions')).toBeVisible();
        await expect(
            page.locator('#administrative-actions'),
        ).not.toHaveAttribute('open');

        await page.locator('#dispatch-activation > summary').click();
        await expect(
            page.locator('#dispatch-activation'),
        ).toHaveAttribute('open', '');
        await expect(
            page.locator('#dispatch-activation').getByRole('button', {
                name: 'Activate dispatch',
            }),
        ).toBeVisible();
        await page.locator('#dispatch-activation > summary').click();
        await expect(
            page.locator('#dispatch-activation'),
        ).not.toHaveAttribute('open');

        await page.locator('#administrative-actions > summary').click();
        await expect(
            page.getByRole('button', { name: 'Cancel dispatch' }),
        ).toBeVisible();
        await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight),
        );
        const mobileBottomSafety = await page.evaluate(() => {
            const actionBar = document.querySelector(
                '#mobile-assignment-action-bar',
            );
            const cancelButton = Array.from(
                document.querySelectorAll('button'),
            ).find(
                (button) => button.textContent?.trim() === 'Cancel dispatch',
            );

            if (!actionBar || !cancelButton) {
                return null;
            }

            return {
                actionBarTop: actionBar.getBoundingClientRect().top,
                cancelButtonBottom: cancelButton.getBoundingClientRect().bottom,
            };
        });
        expect(mobileBottomSafety).not.toBeNull();
        expect(mobileBottomSafety?.cancelButtonBottom).toBeLessThanOrEqual(
            mobileBottomSafety?.actionBarTop ?? 0,
        );

        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });

    test('dispatch details hand off to assignment setup with a return path', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await page.goto('/?view=dispatch');
        await page.getByRole('button', { name: /R6-BROWSER-001/ }).click();

        const assignResources = page.getByRole('link', {
            name: 'Assign resources',
        });
        await expect(assignResources).toBeVisible();
        await expect(assignResources).toHaveAttribute(
            'href',
            /return_to=%2F%3Fview%3Ddispatch/,
        );
        await assignResources.click();
        await expect(
            page.getByRole('heading', {
                name: 'Prepare this dispatch for activation',
            }),
        ).toBeVisible();

        await page
            .getByRole('link', { name: 'Back to dispatch workspace' })
            .click();
        await expect(page).toHaveURL(/\/\?view=dispatch$/);
    });

    test('assignment workspace stays usable across mobile, tablet, and desktop widths', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.dispatcher, fixtures.password);

        for (const width of [320, 390, 768, 1280]) {
            await page.setViewportSize({ width, height: 844 });
            await page.goto(`/operations/dispatch-jobs/${fixtures.job_id}`);

            await expect(
                page.getByRole('heading', {
                    name: 'Prepare this dispatch for activation',
                }),
            ).toBeVisible();
            await expect(
                page.locator('#dispatch-activation > summary'),
            ).toBeVisible();

            const documentWidth = await page.evaluate(
                () => document.documentElement.scrollWidth,
            );
            expect(documentWidth).toBeLessThanOrEqual(width);

            if (width < 1280) {
                await expect(
                    page.locator('#mobile-assignment-action-bar'),
                ).toBeVisible();
            } else {
                await expect(
                    page.locator('#mobile-assignment-action-bar'),
                ).toBeHidden();
            }
        }

        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });

    test('existing assignments promote the activation next action', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await page.setViewportSize({ width: 390, height: 844 });
        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await page.goto(
            `/operations/dispatch-jobs/${fixtures.assigned_job_id}`,
        );

        await expect(
            page.locator('#mobile-assignment-action-bar'),
        ).toContainText(/Activate dispatch|Review .*blocker|Review activation/);
        await expect(
            page.getByRole('heading', { name: 'Resources assigned' }),
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: 'Open fleet asset catalog' }),
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: 'Open equipment catalog' }).first(),
        ).toBeVisible();
    });
});
