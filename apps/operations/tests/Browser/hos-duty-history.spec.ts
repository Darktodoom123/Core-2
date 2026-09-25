import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test('renders accepted HOS transitions with fresh and last-known locations', async ({
    page,
}) => {
    const fixtures = browserFixtures();

    await signIn(page, fixtures.users.manager, fixtures.password);
    await page.goto('/?view=assets');

    const detail = page.getByRole('region', {
        name: 'Asset detail content',
    });
    const dutyHistory = detail.getByRole('region', { name: 'Duty history' });

    await expect(dutyHistory).toBeVisible();
    await expect(
        dutyHistory.getByText('Server-accepted transitions only.'),
    ).toBeVisible();

    const transitions = dutyHistory.getByRole('listitem');
    await expect(transitions).toHaveCount(3);

    const freshTransition = transitions.filter({
        hasText: 'Manila Port Terminal',
    });
    await expect(freshTransition).toHaveCount(1);
    await expect(freshTransition).toContainText('On Duty — Driving / Transit');
    await expect(freshTransition).toContainText(
        'On Duty — Standby / Delay (Demurrage)',
    );
    await expect(freshTransition).toContainText('Location observed');

    const lastKnownTransitions = transitions.filter({
        hasText: 'Last known location',
    });
    await expect(lastKnownTransitions).toHaveCount(2);

    const acceptedTransitionDetails = dutyHistory.getByText(
        /Occurred .* · Server accepted .+/,
    );
    await expect(acceptedTransitionDetails).toHaveCount(3);
    await expect(
        detail.getByRole('heading', { name: 'Equipment time' }),
    ).toBeVisible();
});
