import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const STADIA_STYLE = JSON.stringify({
    version: 8,
    sources: {
        fixture: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            attribution:
                '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
    },
    layers: [
        {
            id: 'fixture-points',
            type: 'circle',
            source: 'fixture',
            paint: { 'circle-color': '#cbd5e1' },
        },
    ],
});

const trackingOutage = process.env.CORE2_TRACKING_OUTAGE === 'true';

async function stubMapProvider(page: Page): Promise<void> {
    await page.route('https://tiles.stadiamaps.com/data/**', (route) =>
        route.abort(),
    );
    await page.route('https://tiles.stadiamaps.com/styles/**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: STADIA_STYLE,
        }),
    );
}

async function signInAsBrowserManager(page: Page): Promise<void> {
    await page.goto('/login');
    await page.getByLabel('Username').fill('browser.manager');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/$/);
}

async function openTelemetryWorkspace(page: Page): Promise<void> {
    await stubMapProvider(page);
    await signInAsBrowserManager(page);
    await page.goto('/?view=assets');

    await expect(
        page.getByRole('heading', {
            name: 'Live Fleet Telematics & GIS Map',
            exact: true,
        }),
    ).toBeVisible({ timeout: 30_000 });

    const showMapButton = page.getByRole('button', { name: 'Show Map' });

    if (await showMapButton.isVisible()) {
        await showMapButton.click();
    }

    await expect(page.getByTestId('live-tracking-map')).toBeVisible({
        timeout: 30_000,
    });
    await expect(
        page.getByText(/^\d+ active GPS$/, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('CRN-101', { exact: true })).toBeVisible({
        timeout: 30_000,
    });
}

test('manager login displays live telemetry from the Tracking service', async ({
    page,
}) => {
    test.skip(
        trackingOutage,
        'active service check is run before the outage check',
    );
    await openTelemetryWorkspace(page);
    const craneCard = page
        .getByRole('listitem')
        .filter({ hasText: 'CRN-101' });

    await expect(
        craneCard.getByText(/GPS Live/),
    ).toBeVisible({ timeout: 30_000 });
});

test('manager can use the telemetry workspace during a Tracking outage', async ({
    page,
}) => {
    test.skip(
        !trackingOutage,
        'outage service check is run after stopping Tracking',
    );
    await openTelemetryWorkspace(page);
    const craneCard = page
        .getByRole('listitem')
        .filter({ hasText: 'CRN-101' });

    await expect(
        craneCard.getByText(/GPS Live/),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
        page.getByRole('heading', { name: 'Fleet Management' }).first(),
    ).toBeVisible({ timeout: 30_000 });
});
