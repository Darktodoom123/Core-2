import { expect, test } from '@playwright/test';

test.describe('Core 2 login responsive and keyboard behavior', () => {
    test('desktop login remains inside the viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/login');

        const bounds = await page.evaluate(() => {
            const main = document.querySelector('main');
            const columns = main?.firstElementChild;
            const loginPanel = main?.querySelector(
                'section[aria-labelledby="auth-title"]',
            );

            return {
                viewportWidth: window.innerWidth,
                documentWidth: document.documentElement.scrollWidth,
                gridWidth: columns?.getBoundingClientRect().width ?? 0,
                loginPanelWidth: loginPanel?.getBoundingClientRect().width ?? 0,
            };
        });

        expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewportWidth);
        expect(bounds.gridWidth).toBeLessThanOrEqual(bounds.viewportWidth);
        expect(bounds.loginPanelWidth).toBeGreaterThanOrEqual(352);
        await expect(
            page.getByRole('heading', { name: 'Welcome back.' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Sign in' }),
        ).toBeVisible();
    });

    test('a 200% desktop zoom viewport reflows without horizontal overflow', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 720, height: 450 });
        await page.addInitScript(() => {
            Object.defineProperty(window, 'outerWidth', {
                configurable: true,
                get: () => 1440,
            });
        });
        await page.goto('/login');

        const bounds = await page.evaluate(() => ({
            viewportWidth: window.innerWidth,
            outerWidth: window.outerWidth,
            documentWidth: document.documentElement.scrollWidth,
            gridWidth:
                document.querySelector('main > div')?.getBoundingClientRect()
                    .width ?? 0,
        }));

        expect(bounds.outerWidth / bounds.viewportWidth).toBe(2);
        expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewportWidth);
        expect(bounds.gridWidth).toBeLessThanOrEqual(bounds.viewportWidth);
        await expect(page.getByLabel('Username')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Sign in' }),
        ).toBeVisible();
    });

    test('keyboard focus follows the form order and stays visible', async ({
        page,
    }) => {
        await page.goto('/login');

        await expect(page.getByLabel('Username')).toBeFocused();
        const expectedFocusOrder = [
            page.getByRole('textbox', { name: 'Password' }),
            page.getByRole('button', { name: 'Show password' }),
            page.getByRole('link', { name: 'Forgot password?' }),
            page.getByRole('button', { name: 'Sign in' }),
        ];

        for (const control of expectedFocusOrder) {
            await page.keyboard.press('Tab');
            await expect(control).toBeFocused();

            const hasVisibleKeyboardFocus = await page.evaluate(() => {
                const active = document.activeElement;

                return Boolean(
                    active &&
                    active.matches(':focus-visible') &&
                    (getComputedStyle(active).outlineStyle !== 'none' ||
                        getComputedStyle(active).borderColor !==
                            getComputedStyle(document.body).borderColor),
                );
            });

            expect(hasVisibleKeyboardFocus).toBe(true);
        }
    });

    test('login uses the built Vite assets served by the browser fixture', async ({
        page,
    }) => {
        const response = await page.goto('/login');

        expect(response?.ok()).toBe(true);

        const assets = await page
            .locator('script[src], link[rel~="stylesheet"][href]')
            .evaluateAll((elements) =>
                elements.map(
                    (element) =>
                        new URL(
                            element instanceof HTMLScriptElement
                                ? element.src
                                : (element as HTMLLinkElement).href,
                            window.location.href,
                        ).pathname,
                ),
            );

        expect(assets.length).toBeGreaterThan(0);
        expect(
            assets.every((asset) => asset.startsWith('/build/assets/')),
        ).toBe(true);
    });
});
