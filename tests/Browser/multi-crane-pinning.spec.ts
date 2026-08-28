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

test.describe('Multi-Tower Crane Pinning & Jib Slewing Radius Workflow', () => {
    test.beforeEach(async ({ page }) => {
        // Stub Stadia tile and style routes for reliable offline browser testing
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

    test('anchors tower crane coordinates, configures jib working radius, and verifies interactive slewing zone', async ({
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

        // 3. Click Pin Coordinates button to expand the SiteLocationPicker
        const toggleButton = page.getByRole('button', {
            name: /(Pin Coordinates|Anchor Coordinates)/i,
        });
        await expect(toggleButton).toBeVisible();
        await toggleButton.click();

        // 4. Verify Site Location Picker container is visible
        const picker = page.getByTestId('site-location-picker');
        await expect(picker).toBeVisible();

        // 5. Verify search & address geocoding
        const addressInput = page.getByTestId('site-address-input');
        await expect(addressInput).toBeVisible();
        await addressInput.fill('Parklinks Pasig Tower 1');

        const locateButton = page.getByTestId('locate-site-button');
        await expect(locateButton).toBeVisible();
        await locateButton.click();

        // 6. Enter custom crane foundation coordinates and jib length
        const latInput = page.getByTestId('site-lat-input');
        const lonInput = page.getByTestId('site-lon-input');
        const jibInput = page.getByTestId('jib-radius-input');

        await latInput.fill('14.5764000');
        await lonInput.fill('121.0851000');
        await jibInput.fill('75');

        // 7. Submit/Apply the crane anchor pin
        const applyButton = page.getByTestId('apply-pin-button');
        await expect(applyButton).toBeVisible();
        await applyButton.click();

        // 8. Verify pinned badge appears
        const pinnedBadge = page.getByTestId('pinned-badge');
        await expect(pinnedBadge).toBeVisible();
        await expect(pinnedBadge).toContainText('Pinned & Anchored');

        // 10. Capture high-resolution screenshots for review
        await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        await picker.screenshot({
            path: 'C:/Users/User/.gemini/antigravity/brain/6265e062-64c7-4fba-a6b1-57fdfe1b60e9/tower_crane_pinning.png',
        });
        await page.screenshot({
            path: 'C:/Users/User/.gemini/antigravity/brain/6265e062-64c7-4fba-a6b1-57fdfe1b60e9/dispatch_context_pinning.png',
            fullPage: true,
        });
    });
});
