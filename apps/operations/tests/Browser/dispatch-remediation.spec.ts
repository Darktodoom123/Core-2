import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test('direct intake records typed crew and equipment quantities', async ({
    page,
}) => {
    const websocketUrls: string[] = [];
    page.on('websocket', (socket) => websocketUrls.push(socket.url()));
    await signIn(page);
    await page.goto('/?view=dispatch');
    await expect(
        page.locator('meta[name="broadcasting-enabled"]'),
    ).toHaveAttribute('content', 'false');
    await page.getByRole('button', { name: /^New dispatch\b/i }).click();
    await page.getByRole('button', { name: 'Create direct dispatch' }).click();

    await page.getByRole('spinbutton', { name: 'Drivers' }).fill('2');
    await page.getByRole('spinbutton', { name: 'Trucks' }).fill('1');
    await expect(
        page.getByText('Minimum plan: 2 crew · 1 equipment'),
    ).toBeVisible();
    await expect(
        page.getByText('2 crew · 1 equipment', { exact: true }),
    ).toBeVisible();
    expect(websocketUrls).toEqual([]);
});

test('unpinned dispatch site does not show invented weather or lift clearance', async ({
    page,
}) => {
    await signIn(page);
    await page.goto(`/operations/dispatch-jobs/${browserFixtures().job_id}`);
    await page
        .getByRole('button', { name: /Step 1 .*Review dispatch/ })
        .click();

    await expect(page.getByText(/Site weather unavailable/)).toBeVisible();
    await expect(page.getByText(/coordinates not recorded/)).toBeVisible();
    await expect(
        page.getByText(/Weather data does not establish ground bearing/),
    ).toBeVisible();
    await expect(
        page.getByText(
            /Live Satellite|No strikes detected|Bearing stable|GO: SAFE LIFT WINDOW/,
        ),
    ).toHaveCount(0);
});

test('inspection clearance is consistent from candidate selection to desk readiness', async ({
    page,
}) => {
    await signIn(page);
    await page.goto(`/operations/dispatch-jobs/${browserFixtures().job_id}`);
    await page
        .getByRole('button', { name: /Step 2 .*Assign resources/ })
        .click();

    const truck = page.getByRole('checkbox', { name: /Select TRK-01/ });
    await expect(truck).toBeDisabled();
    await expect(
        page
            .getByText(
                /A completed passing inspection or DVIR is required before dispatch/,
            )
            .first(),
    ).toBeVisible();

    const crane = page.getByRole('checkbox', { name: /Select CRN-01/ });
    await expect(crane).toBeEnabled();
    await crane.check();
    await page.getByRole('button', { name: /Assign 1 resource/ }).click();
    await expect(
        page.getByText(/Resources were assigned to|Assignments were updated/),
    ).toBeVisible();
    await expect(
        page.getByText(/CRN-01 is not currently safe for dispatch/),
    ).toHaveCount(0);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    await page.goto(
        `/?view=dispatch&dispatch_view=schedule&dispatch_q=R6-BROWSER-001&dispatch_date=${date}`,
    );
    await expect(
        page.getByText('1 dispatch found · Page 1 of 1'),
    ).toBeVisible();
    await page
        .getByRole('complementary', { name: 'Dispatch list' })
        .getByRole('button', { name: /R6-BROWSER-001/ })
        .click();
    await expect(page.getByText('Asset has a dispatch blocker')).toHaveCount(0);
});

test('in-progress and terminal desk actions match what the Operations Manager can do', async ({
    page,
}) => {
    await signIn(page);
    await page.goto(
        '/?view=dispatch&dispatch_view=in-progress&dispatch_q=R6-BROWSER-002',
    );
    await expect(
        page.getByText('1 dispatch found · Page 1 of 1'),
    ).toBeVisible();
    await page
        .getByRole('complementary', { name: 'Dispatch list' })
        .getByRole('button', { name: /R6-BROWSER-002/ })
        .click();
    await expect(
        page.getByRole('link', { name: 'Monitor field acceptance' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Confirm field acceptance' }),
    ).toHaveCount(0);

    await page.goto(
        '/?view=dispatch&dispatch_view=history&dispatch_q=DESK-HISTORY-101',
    );
    await expect(
        page.getByText('1 dispatch found · Page 1 of 1'),
    ).toBeVisible();
    await page
        .getByRole('complementary', { name: 'Dispatch list' })
        .getByRole('button', { name: /DESK-HISTORY-101/ })
        .click();
    await expect(page.getByText(/Completed: /)).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'AI assistance' }),
    ).toHaveCount(0);
    await expect(page.getByText('Waiting for a suggestion')).toHaveCount(0);
    await expect(
        page.getByRole('link', { name: 'Review assignments' }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'People & assets' }).click();
    await expect(page.getByText('Historical dispatch context')).toBeVisible();
    await expect(
        page.getByRole('link', { name: /Assign resources to this job/ }),
    ).toHaveCount(0);
    await page.getByRole('link', { name: 'View dispatch context' }).click();
    await expect(page.getByText('Completed at')).toBeVisible();
});
