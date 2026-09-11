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
            id: 'background',
            type: 'background',
            paint: {
                'background-color': '#f8fafc',
            },
        },
    ],
});

test.describe('Pure Site-Based Location Picker & Pinning Workflow', () => {
    test.beforeEach(async ({ page }) => {
        // Stub Stadia tile and style routes for reliable offline browser testing
        await page.route(
            'https://tiles.stadiamaps.com/data/**',
            async (route) => {
                await route.abort();
            },
        );
        await page.route('https://tiles.stadiamaps.com/styles/**', (route) =>
            route.fulfill({
                contentType: 'application/json',
                body: STADIA_STYLE_FIXTURE,
            }),
        );
    });

    test('opens dispatch job, expands site coordinate picker, locates site, and anchors coordinates', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        // 1. Sign in as operations manager
        await signIn(page, fixtures.users.manager, fixtures.password);

        // 2. Navigate to dispatch job detail and switch to Step 1 (Context & Requirements)
        await page.goto(
            `/operations/dispatch-jobs/${fixtures.job_id}#dispatch-context`,
        );

        const step1Button = page
            .getByRole('button', { name: /(Review context|Step 1|Context)/i })
            .first();

        if (await step1Button.isVisible()) {
            await step1Button.click();
        }

        await expect(page.locator('#dispatch-context')).toBeVisible({
            timeout: 10_000,
        });

        // 3. Click Pin Coordinates button to expand the SiteLocationPicker
        const toggleButton = page.getByRole('button', {
            name: /(Pin Coordinates|Anchor Coordinates)/i,
        });
        await expect(toggleButton).toBeVisible();
        await toggleButton.click();

        // 4. Verify Site Location Picker container is visible
        const picker = page.getByTestId('site-location-picker');
        await expect(picker).toBeVisible();

        // 5. Verify search input is pre-populated or editable
        const addressInput = page.getByTestId('site-address-input');
        await expect(addressInput).toBeVisible();
        await addressInput.fill('BGC Taguig High Street');

        // 6. Click Locate Site to trigger geocoding resolution
        const locateButton = page.getByTestId('locate-site-button');
        await expect(locateButton).toBeVisible();
        await locateButton.click();

        // 7. Verify coordinates auto-populate from the resolved catalog
        const latInput = page.getByTestId('site-lat-input');
        const lonInput = page.getByTestId('site-lon-input');
        await expect(latInput).toHaveValue(/14\./);
        await expect(lonInput).toHaveValue(/121\./);

        // 8. Test custom coordinate refinement (e.g. entering exact mast coordinates)
        await latInput.fill('14.5503000');
        await lonInput.fill('121.0505000');

        // 9. Submit/Apply the pin
        const applyButton = page.getByTestId('apply-pin-button');
        await expect(applyButton).toBeVisible();
        await applyButton.click();

        // 10. Verify pinned badge appears
        const pinnedBadge = page.getByTestId('pinned-badge');
        await expect(pinnedBadge).toBeVisible();
        await expect(pinnedBadge).toContainText('Pinned & Anchored');

        // 11. Verify coordinates overlay displays on map
        const coordOverlay = page.getByTestId('coordinates-overlay');
        await expect(coordOverlay).toBeVisible();
        await expect(coordOverlay).toContainText('14.55030° N, 121.05050° E');
    });
});
