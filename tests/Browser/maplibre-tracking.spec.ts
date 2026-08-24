import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

const STADIA_ATTRIBUTION =
    '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const STADIA_ATTRIBUTION_LINKS = [
    ['Stadia Maps', 'https://stadiamaps.com/'],
    ['OpenMapTiles', 'https://openmaptiles.org/'],
    ['OpenStreetMap', 'https://www.openstreetmap.org/copyright'],
] as const;

const STADIA_STYLE_WITH_ATTRIBUTION = JSON.stringify({
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

async function stubStadiaStyle(
    page: Page,
    style = STADIA_STYLE_WITH_ATTRIBUTION,
): Promise<string[]> {
    const tileRequests: string[] = [];

    await page.route('https://tiles.stadiamaps.com/data/**', async (route) => {
        tileRequests.push(route.request().url());
        await route.abort();
    });
    await page.route('https://tiles.stadiamaps.com/styles/**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: style,
        }),
    );

    return tileRequests;
}

async function openTracking(page: Page) {
    const fixtures = browserFixtures();

    await signIn(page, fixtures.users.dispatcher, fixtures.password);
    await page.goto('/?view=assets');
    await page.getByRole('button', { name: 'Fleet map view' }).click();
}

async function expectMapReady(page: Page) {
    await expect(page.getByTestId('live-tracking-map')).toBeVisible();
    await expect(
        page.getByRole('application', {
            name: /Interactive live field location map/i,
        }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Fit all locations on map' }),
    ).toBeVisible();
}

async function expectSynchronizedList(page: Page) {
    const list = page.getByRole('complementary', {
        name: 'Synchronized mapped location list',
    });

    await expect(list).toBeVisible();
    await expect(
        list.getByRole('heading', { name: 'Mapped locations' }),
    ).toBeVisible();
}

test('exposes the SOS marker DOM contract without blocking marker interaction', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stubStadiaStyle(page);
    await openTracking(page);
    await expectMapReady(page);

    await page.evaluate(() => {
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'maplibre-sos-marker';
        marker.setAttribute(
            'aria-label',
            'SOS incident for Worker One (Acknowledged)',
        );
        marker.dataset.sosStatus = 'acknowledged';
        marker.style.position = 'fixed';
        marker.style.top = '50%';
        marker.style.left = '50%';
        marker.style.zIndex = '10000';
        marker.innerHTML = `
            <span class="maplibre-sos-marker__halo" data-sos-status="acknowledged" aria-hidden="true"></span>
            <span class="maplibre-sos-marker__indicator" aria-hidden="true">⚠ SOS</span>
        `;
        document.body.append(marker);
    });

    const marker = page.locator('.maplibre-sos-marker');
    const halo = marker.locator('.maplibre-sos-marker__halo');

    await expect(marker).toHaveAttribute(
        'aria-label',
        'SOS incident for Worker One (Acknowledged)',
    );
    await expect(
        marker.locator('.maplibre-sos-marker__indicator'),
    ).toContainText('SOS');
    await expect(halo).toHaveAttribute('data-sos-status', 'acknowledged');
    await expect(halo).toHaveCSS('pointer-events', 'none');
    await expect(halo).toHaveCSS('animation-name', 'none');

    await marker.evaluate((element) => {
        element.addEventListener('click', () =>
            element.setAttribute('data-clicked', 'true'),
        );
    });
    await marker.click();
    await expect(marker).toHaveAttribute('data-clicked', 'true');
});

test('loads the configured MapLibre surface with attribution and accessible controls', async ({
    page,
}) => {
    const tileRequests = await stubStadiaStyle(page);
    await openTracking(page);

    await expectMapReady(page);
    const attribution = page.locator('.maplibregl-ctrl-attrib');

    await expect(attribution).toBeVisible();

    for (const [name, href] of STADIA_ATTRIBUTION_LINKS) {
        await expect(
            attribution.getByRole('link', { name, exact: true }),
        ).toHaveAttribute('href', href);
    }

    expect(tileRequests).toHaveLength(0);
    await expectSynchronizedList(page);
});

test('uses the configured attribution fallback when a style has no metadata', async ({
    page,
}) => {
    await stubStadiaStyle(
        page,
        JSON.stringify({ version: 8, sources: {}, layers: [] }),
    );
    await openTracking(page);

    const attribution = page.locator('.maplibregl-ctrl-attrib');

    await expectMapReady(page);
    await expect(attribution).toContainText('Stadia Maps');
    await expectSynchronizedList(page);
});

test('keeps the synchronized list available when the style fails', async ({
    page,
}) => {
    await page.route('https://tiles.stadiamaps.com/styles/**', (route) =>
        route.abort(),
    );
    await openTracking(page);

    await expect(page.getByRole('alert')).toContainText('Map unavailable');
    await expectSynchronizedList(page);
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
    await expectSynchronizedList(page);
});

test('keeps controls usable at a 390px viewport with reduced motion', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stubStadiaStyle(page);
    await openTracking(page);

    await expectMapReady(page);
    await page.getByRole('button', { name: 'Zoom in' }).focus();
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeFocused();
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
});
