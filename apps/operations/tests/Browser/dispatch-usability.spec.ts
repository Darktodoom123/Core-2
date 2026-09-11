import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { signIn } from './browser-fixtures';

const directory = resolve('.impeccable/review');
mkdirSync(directory, { recursive: true });

test('history searches beyond 100 records and restores mobile selection, focus and scroll', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto(
        '/?view=dispatch&dispatch_view=history&dispatch_q=DESK-HISTORY',
    );
    await expect(
        page.getByText('102 dispatches found · Page 1 of 5'),
    ).toBeVisible();
    const list = page.getByRole('complementary', { name: 'Dispatch list' });
    await expect(list.getByRole('button')).toHaveCount(25);
    const row = list.getByRole('button').nth(12);
    await row.scrollIntoViewIfNeeded();
    const rowId = await row.getAttribute('id');
    const originalScroll = await page.evaluate(() => window.scrollY);
    await row.press('Enter');
    await expect(list).toBeHidden();
    await expect(
        page.getByRole('button', { name: 'Back to results' }),
    ).toBeVisible();
    await page.screenshot({
        path: resolve(directory, 'dispatch-focused-mobile.png'),
        fullPage: true,
    });
    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect(list).toBeVisible();
    await expect(page.locator(`#${rowId}`)).toBeFocused();
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeCloseTo(originalScroll, 0);

    // The same return path survives visiting the separate detail page.
    await page.locator(`#${rowId}`).press('Enter');
    await page
        .getByRole('link', { name: 'View dispatch context', exact: true })
        .click();
    await page
        .getByRole('link', { name: 'Back to dispatch workspace' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Back to results' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect(page.locator(`#${rowId}`)).toBeFocused();
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeCloseTo(originalScroll, 0);
    await expect(page.getByLabel('Search dispatches')).toHaveValue(
        'DESK-HISTORY',
    );

    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(
        page.getByText('102 dispatches found · Page 2 of 5'),
    ).toBeVisible();
    await page.getByLabel('Search dispatches').fill('DESK-HISTORY-OLDEST');
    await expect(
        page.getByText('1 dispatch found · Page 1 of 1'),
    ).toBeVisible();
    await expect(
        list.getByRole('button', { name: /DESK-HISTORY-OLDEST/ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/dispatch_page=1/);
    expect(
        (
            await new AxeBuilder({ page })
                .include('.workspace-width-contained')
                .analyze()
        ).violations,
    ).toEqual([]);
});

test('resource inspection preserves desktop context and search recovers from failure', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
    await page.goto(
        '/?view=dispatch&dispatch_view=history&dispatch_q=DESK-HISTORY-OLDEST',
    );
    await expect(
        page.getByText('1 dispatch found · Page 1 of 1'),
    ).toBeVisible();
    const navigation = page.getByRole('navigation', {
        name: 'Dispatch work views',
    });
    const before = await navigation.boundingBox();
    await page
        .getByRole('button', { name: 'People & assets', exact: true })
        .click();
    await expect(
        page.getByRole('region', { name: 'People & assets' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', {
            name: 'Completed equipment delivery',
            exact: true,
        }),
    ).toBeVisible();
    expect((await navigation.boundingBox())?.y).toBe(before?.y);
    await page.screenshot({
        path: resolve(directory, 'dispatch-context-desktop.png'),
        fullPage: true,
    });
    await page.getByRole('button', { name: 'Close people and assets' }).click();
    await expect(
        page.getByRole('button', { name: 'People & assets', exact: true }),
    ).toBeFocused();
    await page.route('**/operations/dispatch-desk/jobs?**', (route) =>
        route.fulfill({ status: 503, body: '{}' }),
    );
    await page.getByLabel('Search dispatches').fill('no match');
    await expect(
        page.getByText(
            'Dispatch search could not load. Retry to get complete results.',
        ),
    ).toBeVisible();
    await page.unroute('**/operations/dispatch-desk/jobs?**');
    await page.getByRole('button', { name: 'Retry search' }).click();
    await expect(
        page.getByText('0 dispatches found · Page 1 of 1'),
    ).toBeVisible();
    await expect(
        page.getByText('No dispatches match', { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 640, height: 800 });
    const size = await page
        .locator('.workspace-width-contained')
        .evaluate((node) => ({
            width: node.clientWidth,
            scroll: node.scrollWidth,
        }));
    expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
});
