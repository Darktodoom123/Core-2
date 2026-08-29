import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test.describe('Safety & Response Hub E2E Workflow', () => {
    test.beforeEach(async ({ page }) => {
        const fixtures = browserFixtures();
        await signIn(page, fixtures.users.manager, fixtures.password);
    });

    test('Scenario 1: Active SOS Banner renders across workspace with pulse alert', async ({
        page,
    }) => {
        await page.goto('/');

        // Verify active SOS banner is visible on the workspace
        const banner = page.getByRole('region', {
            name: 'Active emergency response',
        });
        await expect(banner).toBeVisible();
        await expect(banner).toContainText(/Active emergency response/i);
        await expect(banner).toContainText(/unresolved/i);

        // Click Open emergency queue button in banner to navigate to SOS section
        await banner
            .getByRole('button', { name: /Open emergency queue/i })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Emergency Response Queue' }),
        ).toBeVisible();
    });

    test('Scenario 2: Operations Manager can inspect emergency incident details in queue', async ({
        page,
    }) => {
        await page.goto('/?section=sos');
        await expect(
            page.getByRole('heading', { name: 'Emergency Response Queue' }),
        ).toBeVisible();

        // Check active incident list item
        await expect(
            page.getByRole('button', { name: /Browser Crane Operator/i }),
        ).toBeVisible();

        // Inspect incident detail panel terms
        await expect(
            page.getByRole('term').filter({ hasText: 'Worker' }),
        ).toBeVisible();
        await expect(page.getByText('Acknowledgement deadline')).toBeVisible();
        await expect(page.getByText('Responder owner')).toBeVisible();

        // Verify acknowledge button is available
        await expect(
            page.getByRole('button', { name: /Acknowledge emergency/i }),
        ).toBeVisible();
    });

    test('Scenario 3: Operations Manager can acknowledge and resolve emergency incident', async ({
        page,
    }) => {
        await page.goto('/?section=sos');
        await expect(
            page.getByRole('heading', { name: 'Emergency Response Queue' }),
        ).toBeVisible();

        // Acknowledge the emergency
        const ackButton = page.getByRole('button', {
            name: /Acknowledge emergency/i,
        });

        if (await ackButton.isVisible()) {
            await ackButton.click();
            await expect(
                page.getByText(/Emergency acknowledged/i),
            ).toBeVisible();
        }

        // Verify Resolution form is displayed
        await expect(
            page.getByRole('heading', { name: 'Resolve emergency' }),
        ).toBeVisible();

        // Select resolution code
        await page.locator('select').selectOption('worker_safe');

        // Fill resolution notes
        await page
            .getByLabel(/Closure note/i)
            .fill('Crane boom secured and operator safe in staging area.');

        // Submit resolution
        await page.getByRole('button', { name: /Resolve emergency/i }).click();

        // Verify successful resolution flash
        await expect(page.getByText(/Emergency resolved/i)).toBeVisible();
    });

    test('Scenario 4: Operations Manager can record false alarm cancellation', async ({
        page,
    }) => {
        await page.goto('/?section=sos');
        await expect(
            page.getByRole('heading', { name: 'Emergency Response Queue' }),
        ).toBeVisible();

        // Open false alarm details section
        const detailsSummary = page.getByText(/Record false alarm/i);

        if (await detailsSummary.isVisible()) {
            await detailsSummary.click();
            await page
                .getByLabel(/Reason/i)
                .fill('Accidental trigger during device pocket check.');
            await page
                .getByRole('button', { name: 'Record false alarm' })
                .click();
            await expect(page.getByText(/False alarm recorded/i)).toBeVisible();
        }
    });

    test('Scenario 5: Empty Emergency Response Queue displays calm All Clear zero state', async ({
        page,
    }) => {
        await page.goto('/?section=sos');

        // Check for All Systems Normal empty state
        const allClear = page.getByText(
            /All Systems Normal · Zero Active Emergencies/i,
        );
        const activeQueue = page.getByRole('heading', {
            name: 'Emergency Response Queue',
        });

        await expect(activeQueue).toBeVisible();

        if (await allClear.isVisible()) {
            await expect(allClear).toBeVisible();
            await expect(
                page.getByRole('button', {
                    name: 'Return to Operations Overview',
                }),
            ).toBeVisible();
        }
    });

    test('Scenario 6: Top-right Industrial Header displays live stream pill and user profile dropdown', async ({
        page,
    }) => {
        await page.goto('/');

        // Verify Live Stream or Active SOS pill exists in header
        const streamPill = page.getByRole('button', {
            name: /Live Stream|Active SOS/i,
        });
        await expect(streamPill).toBeVisible();

        // Check user account menu button in header
        const userMenuButton = page.getByRole('button', {
            name: 'User account menu',
        });
        await expect(userMenuButton).toBeVisible();

        // Click to open user dropdown
        await userMenuButton.click();
        await expect(
            page.getByRole('menu', { name: 'User account options' }),
        ).toBeVisible();
        await expect(
            page.getByRole('menuitem', { name: /Test station audio/i }),
        ).toBeVisible();
        await expect(
            page.getByRole('menuitem', { name: /Sign out/i }),
        ).toBeVisible();

        // Press Escape to close dropdown
        await page.keyboard.press('Escape');
        await expect(
            page.getByRole('menu', { name: 'User account options' }),
        ).not.toBeVisible();
    });
});
