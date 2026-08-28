import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test.describe('UI-6 WCAG 2.2 AA Accessibility & Responsive Hardening', () => {
    test('unauthenticated operations access redirects to an accessible sign-in form', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole('heading', { name: 'Sign in to operations' })).toBeVisible();
        await expect(page.getByLabel('Username')).toBeFocused();
        await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });

    test('mobile viewport 320px: sign-in form wraps cleanly with no horizontal overflow and zero axe violations', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.goto('/login');
        await expect(page.getByRole('heading', { name: 'Sign in to operations' })).toBeVisible();
        const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(hasHorizontalScroll).toBe(false);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });

    test('mobile viewport 390px: sign-in form wraps cleanly and passes WCAG 2.2 AA', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/login');
        await expect(page.getByRole('heading', { name: 'Sign in to operations' })).toBeVisible();
        const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(hasHorizontalScroll).toBe(false);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });

    test('authenticated operations workspace passes axe accessibility audit', async ({ page }) => {
        const fixtures = browserFixtures();
        await signIn(page, fixtures.users.manager, fixtures.password);
        await page.goto('/');
        await expect(page.locator('#workspace-navigation')).toBeVisible();
        await expect(page.locator('#workspace-content')).toBeVisible();
        const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
        expect(results.violations).toEqual([]);
    });

    test('authenticated dispatch detail workspace passes axe accessibility audit', async ({ page }) => {
        const fixtures = browserFixtures();
        await signIn(page, fixtures.users.manager, fixtures.password);
        await page.goto('/operations/dispatch-jobs/' + fixtures.job_id);
        await expect(page.getByRole('heading', { name: 'Prepare this dispatch for activation' })).toBeVisible();
        const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
        expect(results.violations).toEqual([]);
    });
});
