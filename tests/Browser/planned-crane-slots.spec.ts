import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

const STADIA_ATTRIBUTION =
    '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const STADIA_STYLE_FIXTURE = JSON.stringify({
    version: 8,
    sources: {
        fixture: {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: [],
            },
            attribution: STADIA_ATTRIBUTION,
        },
    },
    layers: [
        {
            id: 'fixture-points',
            type: 'circle',
            source: 'fixture',
            paint: {
                'circle-color': '#cbd5e1',
            },
        },
    ],
});

test.describe('Contract-Driven Crane Slots & Multi-Slot Site Layout Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('https://tiles.stadiamaps.com/data/**', async (route) => {
            await route.abort();
        });
        await page.route('https://tiles.stadiamaps.com/styles/**', (route) =>
            route.fulfill({
                contentType: 'application/json',
                body: STADIA_STYLE_FIXTURE,
            }),
        );
    });

    test('plans multiple crane positions on Step 1, configures jib radiuses, detects slewing overlap, and persists layout', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        // 1. Sign in as operations manager
        await signIn(page, fixtures.users.manager, fixtures.password);

        // 2. Navigate to dispatch job detail
        await page.goto(`/operations/dispatch-jobs/${fixtures.job_id}#dispatch-context`);

        const step1Button = page.getByRole('button', { name: /(Review context|Step 1|Context)/i }).first();

        if (await step1Button.isVisible()) {
            await step1Button.click();
        }

        await expect(page.locator('#dispatch-context')).toBeVisible({ timeout: 10_000 });

        // 3. Expand Site Location Picker
        const toggleButton = page.getByRole('button', {
            name: /(Pin Coordinates|Anchor Coordinates)/i,
        });
        await expect(toggleButton).toBeVisible();
        await toggleButton.click();

        const picker = page.getByTestId('site-location-picker');
        await expect(picker).toBeVisible();

        // 4. Locate project site
        const addressInput = page.getByTestId('site-address-input');
        await expect(addressInput).toBeVisible();
        await addressInput.fill('Parklinks Pasig');

        const locateButton = page.getByTestId('locate-site-button');
        await expect(locateButton).toBeVisible();
        await locateButton.click();

        // 5. Configure Slot 1 (TC-1) coordinates and jib length
        const slot1NameInput = page.getByTestId('slot-name-input');
        const latInput = page.getByTestId('site-lat-input');
        const lonInput = page.getByTestId('site-lon-input');
        const jibInput = page.getByTestId('jib-radius-input');

        await slot1NameInput.fill('North Core Tower Crane');
        await latInput.fill('14.5768200');
        await lonInput.fill('121.0852000');
        await jibInput.fill('75');

        // 6. Click "+ Add Crane Position" to add Slot 2 (TC-2)
        const addSlotButton = page.getByTestId('add-crane-slot-button');
        await expect(addSlotButton).toBeVisible();
        await addSlotButton.click();

        // 7. Configure Slot 2 (TC-2)
        await slot1NameInput.fill('South Podium Tower Crane');
        await latInput.fill('14.5761500');
        await lonInput.fill('121.0849000');
        await jibInput.fill('60');

        // 8. Verify Anti-Collision Warning renders for overlapping radiuses
        const antiCollisionWarning = page.getByTestId('anti-collision-warning');
        await expect(antiCollisionWarning).toBeVisible();
        await expect(antiCollisionWarning).toContainText('Anti-Collision Zone Detected');

        // 9. Apply Pin and Save Site Layout
        const applyButton = page.getByTestId('apply-pin-button');
        await expect(applyButton).toBeVisible();
        await applyButton.click();

        // 10. Verify Pinned status badge
        const pinnedBadge = page.getByTestId('pinned-badge');
        await expect(pinnedBadge).toBeVisible();
        await expect(pinnedBadge).toContainText('Pinned & Anchored');

        // 11. Capture high-resolution screenshots
        await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        const screenshotDir = process.env.CI
            ? 'storage/framework/testing'
            : 'C:/Users/User/.gemini/antigravity/brain/6265e062-64c7-4fba-a6b1-57fdfe1b60e9';
        await picker.screenshot({
            path: `${screenshotDir}/multi_crane_planned_slots.png`,
        });
        await page.screenshot({
            path: `${screenshotDir}/multi_crane_planned_slots_full.png`,
            fullPage: true,
        });
    });
});
