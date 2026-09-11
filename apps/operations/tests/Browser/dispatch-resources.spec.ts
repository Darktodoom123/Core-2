import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { signIn } from './browser-fixtures';

test('office users inspect people and assets and review AI before applying', async ({
    page,
}) => {
    const directory = resolve('.impeccable/review');
    mkdirSync(directory, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
    const date = new Date();
    date.setDate(date.getDate() + 2);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    await page.goto(
        `/?view=dispatch&dispatch_date=${key}&dispatch_q=R6-BROWSER-006`,
    );
    await expect(
        page.getByRole('heading', { name: 'Assigned personnel' }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
        page.getByRole('heading', { name: 'Assigned equipment' }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'People & assets', exact: true })
        .click();
    const resources = page.getByRole('region', { name: 'People & assets' });
    await expect(
        resources.getByText('Alex Reyes', { exact: true }),
    ).toBeVisible();
    await page.screenshot({
        path: resolve(directory, 'dispatch-people-desktop.png'),
        fullPage: true,
        animations: 'disabled',
    });
    await resources
        .getByRole('button', { name: 'Assets', exact: true })
        .click();
    await expect(
        resources.getByText('CRN-01 · 50T Mobile Crane'),
    ).toBeVisible();
    await resources.getByRole('searchbox').fill('TRK-01');
    await expect(
        resources.getByText(
            'Inspection clearance required · Recorded status: Available',
        ),
    ).toBeVisible();
    await resources.getByRole('searchbox').fill('CRN-01');
    await expect(
        resources.getByText('Recorded status: Available', { exact: true }),
    ).toBeVisible();
    await expect(resources.getByText('TRK-01 · Heavy Rig Truck')).toHaveCount(
        0,
    );
    await page.screenshot({
        path: resolve(directory, 'dispatch-assets-desktop.png'),
        fullPage: true,
        animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
        await resources
            .getByRole('searchbox')
            .evaluate((node) => node.clientWidth),
    ).toBeGreaterThan(300);
    const sizes = await page
        .locator('.workspace-width-contained')
        .evaluate((node) => ({
            width: node.clientWidth,
            scroll: node.scrollWidth,
        }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
    await page.screenshot({
        path: resolve(directory, 'dispatch-resources-mobile.png'),
        fullPage: true,
        animations: 'disabled',
    });
    expect(
        (
            await new AxeBuilder({ page })
                .include('#dispatch-resources')
                .analyze()
        ).violations,
    ).toEqual([]);
    await page
        .getByRole('button', { name: 'People & assets', exact: true })
        .click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
        .getByRole('link', { name: 'AI assistance', exact: true })
        .click();
    const advisory = page.getByRole('region', {
        name: 'AI assistance',
        exact: true,
    });
    await expect(advisory).toBeVisible();
    await expect(
        advisory.getByRole('button', {
            name: /Review (& apply suggestion|advisory)/,
        }),
    ).toBeVisible();
    await advisory
        .getByRole('button', { name: /Review (& apply suggestion|advisory)/ })
        .click();
    await expect(
        page.getByRole('dialog', { name: 'Review crew & equipment' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Confirm & Apply Resource Plan' }),
    ).toBeVisible();
    await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Cancel' })
        .click();
    await page.screenshot({
        path: resolve(directory, 'dispatch-ai-desktop.png'),
        fullPage: true,
        animations: 'disabled',
    });
    expect(
        (
            await new AxeBuilder({ page })
                .include('#dispatch-ai-assistance')
                .analyze()
        ).violations,
    ).toEqual([]);
});
