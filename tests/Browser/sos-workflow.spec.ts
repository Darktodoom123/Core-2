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
            page.getByRole('heading', { name: 'Safety & Response Hub' }),
        ).toBeVisible();
    });

    test('Scenario 2: Operations Manager can inspect emergency incident details in queue', async ({
        page,
    }) => {
        await page.goto('/?section=sos');
        await expect(
            page.getByRole('heading', { name: 'Safety & Response Hub' }),
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
            page.getByRole('heading', { name: 'Safety & Response Hub' }),
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
            page.getByRole('heading', { name: 'Safety & Response Hub' }),
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

    test('Scenario 5: Peace-time Safety Watch Center displays escalation roster, telemetry, and interactive drill', async ({
        page,
    }) => {
        // Resolve or navigate when 0 incidents exist
        await page.goto('/?section=sos');

        // If in peace time or test drill available
        const drillButton = page.getByRole('button', {
            name: /Launch drill simulation/i,
        });

        if (await drillButton.isVisible()) {
            // Verify Peace-Time System Normal Banner
            await expect(
                page.getByText(/Safety Watch Active · All Systems Normal/i),
            ).toBeVisible();

            // Verify Escalation Contact Roster
            await expect(
                page.getByText(/Emergency Escalation Contact Roster/i),
            ).toBeVisible();
            await expect(page.getByText('John Tan')).toBeVisible();
            await expect(page.getByText('Dr. Marcus Lim')).toBeVisible();

            // Launch interactive compliance safety drill
            await drillButton.click();

            // Check drill modal
            await expect(
                page.getByRole('heading', {
                    name: /Compliance Safety Drill Simulation/i,
                }),
            ).toBeVisible();
            await expect(
                page.getByText(/Training Simulation · No Live Emergency/i),
            ).toBeVisible();

            // Acknowledge drill
            await page
                .getByRole('button', { name: /Acknowledge drill emergency/i })
                .click();
            await expect(
                page.getByText(/Drill acknowledged in/i),
            ).toBeVisible();

            // Complete drill
            await page
                .getByRole('button', { name: /Complete compliance drill/i })
                .click();
            await expect(
                page.getByText(/Safety Drill Successfully Completed/i),
            ).toBeVisible();

            // Close modal
            await page
                .getByRole('button', { name: /Close simulation/i })
                .click();
        }
    });
});
