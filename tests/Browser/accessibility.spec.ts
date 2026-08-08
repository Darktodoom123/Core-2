import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('unauthenticated operations access redirects to an accessible sign-in form', async ({
    page,
}) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in to operations' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
});
