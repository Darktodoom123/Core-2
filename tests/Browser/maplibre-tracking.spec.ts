import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

const EMPTY_MAPLIBRE_STYLE = JSON.stringify({
    version: 8,
    sources: {},
    layers: [],
});

async function stubStadiaStyle(page: Page) {
    await page.route('https://tiles.stadiamaps.com/styles/**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: EMPTY_MAPLIBRE_STYLE,
        }),
    );
}

async function openTracking(page: Page) {
    const fixtures = browserFixtures();

    await signIn(page, fixtures.users.dispatcher, fixtures.password);
    await page.goto('/?view=tracking');
}

test('loads the configured MapLibre surface with attribution and accessible controls', async ({
    page,
}) => {
    await stubStadiaStyle(page);
    await openTracking(page);

    await expect(page.getByTestId('live-tracking-map')).toBeVisible();
    await expect(
        page.getByRole('application', {
            name: /Interactive live field location map/i,
        }),
    ).toBeVisible();
    await expect(
        page.getByText('Stadia Maps', { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Fit all locations on map' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Mapped locations' }),
    ).toBeVisible();
});

test('keeps the synchronized list available when the style fails', async ({
    page,
}) => {
    await page.route('https://tiles.stadiamaps.com/styles/**', (route) =>
        route.abort(),
    );
    await openTracking(page);

    await expect(page.getByRole('alert')).toContainText('Map unavailable');
    await expect(
        page.getByRole('heading', { name: 'Mapped locations' }),
    ).toBeVisible();
});

test('keeps the synchronized list available when WebGL is unavailable', async ({
    page,
}) => {
    await stubStadiaStyle(page);
    await page.addInitScript(() => {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;

        HTMLCanvasElement.prototype.getContext = function (contextId, ...args) {
            if (contextId === 'webgl' || contextId === 'webgl2') {
                return null;
            }

            return originalGetContext.call(this, contextId, ...args);
        };
    });
    await openTracking(page);

    await expect(page.getByRole('alert')).toContainText('Map unavailable');
    await expect(
        page.getByRole('heading', { name: 'Mapped locations' }),
    ).toBeVisible();
});

test('keeps controls usable at a 390px viewport with reduced motion', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stubStadiaStyle(page);
    await openTracking(page);

    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await page.getByRole('button', { name: 'Zoom in' }).focus();
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeFocused();
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
});
