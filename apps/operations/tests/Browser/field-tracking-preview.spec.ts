import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test('field tracking keeps filters usable across Map and List at 320px', async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 740 });
    const fixtures = browserFixtures();
    await signIn(page, fixtures.users.manager, fixtures.password);

    const tracking = page.getByRole('region', { name: 'Field tracking' });
    await expect(tracking).toBeVisible();
    const view = tracking.getByRole('group', { name: 'Tracking view' });
    const map = view.getByRole('button', { name: 'Map', exact: true });
    const list = view.getByRole('button', { name: 'List', exact: true });
    const search = tracking.getByRole('searchbox', { name: 'Find a unit' });

    await expect(map).toHaveAttribute('aria-pressed', 'true');
    await search.fill('unit-that-does-not-exist');
    await expect(tracking.getByLabel('Assigned jobsite')).toBeVisible();
    await list.click();
    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await expect(search).toHaveValue('unit-that-does-not-exist');
    await expect(
        tracking.getByRole('button', { name: /^Inspect / }),
    ).toHaveCount(0);

    const assetFilter = tracking.getByRole('button', {
        name: 'Asset type filter: All Types',
    });
    await assetFilter.click();
    const menu = tracking.getByRole('menu', { name: 'Asset type filters' });
    await expect(menu).toBeVisible();
    const menuBounds = await menu.boundingBox();
    expect(menuBounds).not.toBeNull();

    if (!menuBounds) {
        throw new Error('The asset filter menu has no visible bounds.');
    }

    expect(menuBounds.x).toBeGreaterThanOrEqual(0);
    expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(321);
    await page.keyboard.press('Escape');
    await expect(assetFilter).toBeFocused();
    await expect(menu).toBeHidden();

    await map.click();
    await expect(map).toHaveAttribute('aria-pressed', 'true');
    await expect(search).toHaveValue('unit-that-does-not-exist');
    await expect(
        tracking.getByRole('button', { name: /^Needs attention/ }),
    ).toBeVisible();
    const bounds = await tracking.evaluate((element) => {
        const rect = element.getBoundingClientRect();

        return {
            left: rect.left,
            right: rect.right,
            contentWidth: element.scrollWidth,
            width: element.clientWidth,
        };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(320);
    expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.width);

    await tracking.getByRole('button', { name: 'Open full tracking' }).click();
    await expect(page).toHaveURL(/view=assets/);
});
