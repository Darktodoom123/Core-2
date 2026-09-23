import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test('shows accepted HOS duty history with location snapshots', async ({
    page,
}) => {
    const fixtures = browserFixtures();

    await signIn(page, fixtures.users.manager, fixtures.password);
    await page.goto('/?view=assets');
    await expect(
        page.getByRole('region', { name: 'assets section loading' }),
    ).toBeHidden({ timeout: 20_000 });

    const detail = page.getByRole('region', {
        name: 'Asset detail content',
    });

    await expect(
        detail.getByRole('heading', { name: 'Duty history' }),
    ).toBeVisible();
    await expect(
        detail.getByText('Server-accepted transitions only.'),
    ).toBeVisible();
    await expect(detail).toContainText('Manila Port Terminal');
    await expect(detail).toContainText('Last known location');
    await expect(
        detail.getByRole('heading', { name: 'Equipment time' }),
    ).toBeVisible();
});
