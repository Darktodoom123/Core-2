import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

const browserFixturePath = resolve(
    'storage/framework/testing/browser-fixtures.json',
);

const viewports = [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 840, height: 900 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
] as const;

type Surface = {
    id: string;
    url: string;
    prepare?: (page: Page) => Promise<void>;
};

const surfaces: Surface[] = [
    { id: 'overview', url: '/?view=overview' },
    { id: 'dispatch-list', url: '/?view=dispatch' },
    {
        id: 'operational-attention',
        url: '/?view=dispatch',
        prepare: async (page) => {
            await page
                .getByRole('button', { name: /Operational attention/ })
                .click();
        },
    },
    {
        id: 'day-schedule',
        url: '/?view=dispatch',
        prepare: async (page) => {
            await page
                .getByRole('button', { name: 'Schedule board', exact: true })
                .click();
        },
    },
    {
        id: 'week-schedule',
        url: '/?view=dispatch',
        prepare: async (page) => {
            await page
                .getByRole('button', { name: 'Schedule board', exact: true })
                .click();
            await page
                .getByRole('button', { name: 'week', exact: true })
                .click();
        },
    },
    {
        id: 'month-schedule',
        url: '/?view=dispatch',
        prepare: async (page) => {
            await page
                .getByRole('button', { name: 'Schedule board', exact: true })
                .click();
            await page
                .getByRole('button', { name: 'month', exact: true })
                .click();
        },
    },
    { id: 'assets-tracking', url: '/?view=tracking' },
    { id: 'fuel', url: '/?view=fuel' },
    { id: 'reports-and-exports', url: '/?view=reports' },
    { id: 'notifications', url: '/?view=notifications' },
    {
        id: 'notification-popover',
        url: '/?view=overview',
        prepare: async (page) => {
            await page
                .locator('button[aria-controls="notification-center-popover"]')
                .click();
        },
    },
];

test.setTimeout(600_000);

test.describe('responsive operations workspace contract', () => {
    test.beforeEach(async ({ page }) => {
        if (!existsSync(browserFixturePath)) {
            test.skip(true, 'browser-fixtures.json is not available');

            return;
        }

        const fixtures = browserFixtures();
        await signIn(page, fixtures.users.manager, fixtures.password);
    });

    test('keeps every routed workspace surface contained across the exact viewport matrix', async ({
        page,
    }) => {
        const visitedSurfaces: string[] = [];

        for (const viewport of viewports) {
            await page.setViewportSize(viewport);

            for (const surface of surfaces) {
                const response = await page.goto(surface.url, {
                    waitUntil: 'domcontentloaded',
                });
                expect(response?.status()).toBeLessThan(400);
                await expect(page.locator('#workspace-content')).toBeVisible();

                if (surface.prepare) {
                    await surface.prepare(page);
                }

                await assertResponsiveContract(page, surface, viewport);
                visitedSurfaces.push(`${surface.id}@${viewport.width}`);
            }
        }

        expect(visitedSurfaces).toHaveLength(
            viewports.length * surfaces.length,
        );
    });

    test('keeps the navigation drawer focus-safe and switches atomically at 840px', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/?view=overview', { waitUntil: 'domcontentloaded' });

        const navigation = page.locator('#workspace-navigation');
        const openTrigger = page.getByRole('button', {
            name: 'Open navigation',
        });

        await expect(openTrigger).toBeVisible();
        await openTrigger.click();
        await expect(navigation).toHaveAttribute('role', 'dialog');
        await expect(
            navigation.getByRole('button', { name: 'Close navigation' }),
        ).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(openTrigger).toBeFocused();
        await expect(navigation).not.toHaveAttribute('role', 'dialog');

        await page.setViewportSize({ width: 840, height: 900 });
        await page.waitForTimeout(50);
        await expect(openTrigger).toBeHidden();
        await expect(
            page.getByRole('button', {
                name: /Collapse navigation|Expand navigation/,
            }),
        ).toBeVisible();
        await expect(navigation).toHaveClass(/min-\[840px\]:sticky/);
    });

    test('keeps operational attention tabs roving and status text available', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/?view=dispatch', { waitUntil: 'domcontentloaded' });
        await page
            .getByRole('button', { name: /Operational attention/ })
            .click();

        const all = page.getByRole('tab', { name: /All attention/ });
        const overlaps = page.getByRole('tab', { name: /Overlaps/ });
        const advisories = page.getByRole('tab', { name: /Advisories/ });

        await all.focus();
        await page.keyboard.press('ArrowRight');
        await expect(overlaps).toBeFocused();
        await page.keyboard.press('End');
        await expect(advisories).toBeFocused();
        await expect(
            page.getByLabel('Operational attention status'),
        ).toContainText('operational attention');
    });

    test('passes representative mobile and desktop Axe checks with reduced motion', async ({
        page,
    }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });

        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/?view=overview', { waitUntil: 'domcontentloaded' });
        await expect(
            page.locator('#workspace-content').getByRole('heading', {
                name: 'Operations overview',
            }),
        ).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.matchMedia('(prefers-reduced-motion: reduce)')
                            .matches,
                ),
            )
            .toBe(true);
        const mobileResults = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(mobileResults.violations).toEqual([]);

        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/?view=dispatch', { waitUntil: 'domcontentloaded' });
        await page
            .getByRole('button', { name: /Operational attention/ })
            .click();
        await expect(
            page.getByLabel('Operational attention status'),
        ).toBeAttached();
        const desktopResults = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(desktopResults.violations).toEqual([]);
    });
});

async function assertResponsiveContract(
    page: Page,
    surface: Surface,
    viewport: (typeof viewports)[number],
) {
    const metrics = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const visible = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);

            return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none'
            );
        };
        const selector = (element: HTMLElement) => {
            const id = element.id ? `#${element.id}` : '';
            const className =
                typeof element.className === 'string'
                    ? element.className
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 3)
                          .map((name) => `.${name}`)
                          .join('')
                    : '';

            return `${element.tagName.toLowerCase()}${id}${className}`;
        };
        const label = (element: HTMLElement) =>
            element.getAttribute('aria-label') ||
            element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ||
            element.tagName.toLowerCase();
        const allowedScrollContainer = (element: HTMLElement) => {
            const container = element.closest<HTMLElement>(
                '.workspace-scroll-region, .table-responsive-container',
            );

            return container ? selector(container) : null;
        };
        const navigation = document.querySelector<HTMLElement>(
            '#workspace-navigation',
        );
        const closedDrawer =
            navigation &&
            viewportWidth < 840 &&
            getComputedStyle(navigation).position === 'fixed' &&
            !navigation.getAttribute('role');
        const visibleElements = Array.from(
            document.querySelectorAll<HTMLElement>('*'),
        ).filter(visible);
        const candidates = visibleElements.filter((element) =>
            element.matches(
                'main, header, nav, section, form, article, aside, a[href], button, input, select, textarea, [role="region"]',
            ),
        );
        const overflowing = candidates
            .map((element) => ({
                element,
                rect: element.getBoundingClientRect(),
            }))
            .filter(({ element, rect }) => {
                const style = getComputedStyle(element);
                const isFixed = style.position === 'fixed';
                const isClosedDrawerDescendant = Boolean(
                    closedDrawer && element.closest('#workspace-navigation'),
                );

                return (
                    (rect.left < -1 || rect.right > viewportWidth + 1) &&
                    !isFixed &&
                    !isClosedDrawerDescendant
                );
            })
            .map(({ element, rect }) => ({
                selector: selector(element),
                label: label(element),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                containedBy: allowedScrollContainer(element),
            }));
        const scrollRegions = Array.from(
            document.querySelectorAll<HTMLElement>(
                '.workspace-scroll-region, .table-responsive-container',
            ),
        )
            .filter(visible)
            .map((element) => ({
                selector: selector(element),
                label: label(element),
                role: element.getAttribute('role'),
                ariaLabel: element.getAttribute('aria-label'),
                tabIndex: element.tabIndex,
                hasHorizontalContent:
                    element.scrollWidth > element.clientWidth + 1,
            }));
        const undersizedTargets =
            viewportWidth <= 768
                ? candidates
                      .filter((element) =>
                          element.matches(
                              'button, input:not([type="checkbox"]):not([type="radio"]), select, textarea, [role="tab"], [role="button"]',
                          ),
                      )
                      .map((element) => ({
                          element,
                          rect: element.getBoundingClientRect(),
                      }))
                      .filter(({ rect }) => rect.width < 44 || rect.height < 44)
                      .map(({ element, rect }) => ({
                          selector: selector(element),
                          label: label(element),
                          width: Math.round(rect.width),
                          height: Math.round(rect.height),
                      }))
                : [];

        return {
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            viewportWidth,
            overflowing,
            scrollRegions,
            undersizedTargets,
        };
    });

    expect(
        metrics.documentWidth,
        `${surface.id}@${viewport.width}: ${JSON.stringify(metrics.overflowing)}`,
    ).toBeLessThanOrEqual(viewport.width + 50);
    expect(metrics.bodyWidth).toBeLessThanOrEqual(viewport.width + 50);
    expect(
        metrics.overflowing.filter((item) => item.containedBy === null),
    ).toEqual([]);
    expect(metrics.undersizedTargets).toEqual([]);

    for (const region of metrics.scrollRegions) {
        expect(region.role, region.selector).toBe('region');
        expect(region.ariaLabel, region.selector).toBeTruthy();
        expect(region.tabIndex, region.selector).toBe(0);
    }

    if (surface.id.includes('schedule')) {
        const scheduleRegion = page.locator(
            '.workspace-scroll-region[role="region"][aria-label*="schedule" i][tabindex="0"]',
        );
        await expect(scheduleRegion.first()).toBeVisible();
    }

    const navigation = page.locator('#workspace-navigation');
    const openTrigger = page.getByRole('button', { name: 'Open navigation' });
    const collapseControl = page.getByRole('button', {
        name: /Collapse navigation|Expand navigation/,
    });

    if (viewport.width < 840) {
        await expect(openTrigger).toBeVisible();
        await expect(collapseControl).toBeHidden();
        await expect(navigation).toHaveClass(/min-\[840px\]:sticky/);
    } else {
        await expect(openTrigger).toBeHidden();
        await expect(collapseControl).toBeVisible();
        await expect(navigation).toHaveClass(/min-\[840px\]:sticky/);
    }

    const heading = page.locator('#workspace-content h1').first();
    await expect(heading).toBeVisible();
    const headingLayout = await heading.evaluate((element) => {
        let container = element.parentElement;

        while (
            container &&
            (getComputedStyle(container).display !== 'flex' ||
                !container.classList.contains('flex-col'))
        ) {
            container = container.parentElement;
        }

        return container ? getComputedStyle(container).flexDirection : null;
    });

    expect(
        headingLayout,
        `${surface.id}@${viewport.width}: heading layout`,
    ).toBe(viewport.width < 1024 ? 'column' : 'row');
}
