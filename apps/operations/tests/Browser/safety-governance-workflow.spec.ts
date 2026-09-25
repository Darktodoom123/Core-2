import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test('Operations Manager completes the safety review and stop-work flows in the workspace', async ({
    page,
}) => {
    test.setTimeout(180_000);
    const fixtures = browserFixtures();
    await signIn(page, fixtures.users.manager, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'Safety governance' }).click();

    await expect(page.locator('#safety-governance-title')).toBeVisible();
    await expect(
        page.getByText('Safe work hours', { exact: true }),
    ).toBeVisible({ timeout: 45_000 });
    await expect(
        page.getByText('Days since a recordable incident', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Not available', { exact: true })).toHaveCount(
        2,
    );

    const overviewAccessibility = await new AxeBuilder({ page }).analyze();
    expect(overviewAccessibility.violations).toEqual([]);

    await page.getByRole('tab', { name: 'Hazards' }).click();
    const hazardFormAccessibility = await new AxeBuilder({ page }).analyze();
    expect(hazardFormAccessibility.violations).toEqual([]);
    await page.getByLabel('Project site').fill('Playwright hazard site');
    await page.getByLabel('Location detail').fill('North access platform');
    await page
        .getByLabel('What did you observe?')
        .fill('A guard rail is loose beside the access platform.');
    await page
        .getByLabel('Corrective action needed')
        .fill(
            'Secure the rail and inspect its anchors before reopening access.',
        );
    await page.getByLabel('Photo evidence (optional)').setInputFiles({
        name: 'hazard-evidence.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG8sAAAAASUVORK5CYII=',
            'base64',
        ),
    });
    await page.getByRole('button', { name: 'Save hazard report' }).click();
    await expect(page.getByRole('status')).toContainText('Hazard report saved');
    await expect(
        page.getByText('A guard rail is loose beside the access platform.'),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'View hazard-evidence.png' }),
    ).toBeVisible();

    const reportedHazard = page
        .getByRole('heading', { name: /Playwright hazard site/ })
        .locator('..')
        .locator('..')
        .locator('..');
    await reportedHazard
        .getByLabel('Correction and verification')
        .fill('Rail secured and anchor points checked by the site supervisor.');
    page.once('dialog', (dialog) => dialog.accept());
    await reportedHazard
        .getByRole('button', { name: 'Mark corrective action complete' })
        .click();
    await expect(
        page.getByText(
            'Correction recorded: Rail secured and anchor points checked by the site supervisor.',
        ),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Work stoppages' }).click();
    await page.getByLabel('Project site').fill('Playwright stop-work site');
    await page.getByLabel('Affected area').fill('East lift zone');
    await page
        .getByLabel('Reason work must stop')
        .fill('Crane outrigger is settling into unsupported soil.');
    await page.getByRole('button', { name: 'Issue stop-work order' }).click();
    await expect(page.getByRole('status')).toContainText(
        'Stop-work order issued',
    );
    await expect(page.getByText('Active — work remains paused')).toBeVisible();

    await page
        .getByLabel('Verified correction and lift reason')
        .fill(
            'Engineered mat installed and bearing condition verified by the site supervisor.',
        );
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Lift order' }).click();
    await expect(
        page.getByText(
            'Lift reason: Engineered mat installed and bearing condition verified by the site supervisor.',
        ),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Critical lift plans' }).click();
    const liftCard = page
        .getByRole('heading', { name: /CR-LIFT-BROWSER-001/ })
        .locator('..')
        .locator('..')
        .locator('..');
    await expect(
        liftCard.getByText('Awaiting Operations Manager review'),
    ).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await liftCard.getByRole('button', { name: 'Authorize lift plan' }).click();
    await expect(
        liftCard.getByText('approved · critical', { exact: true }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Toolbox meetings' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Co-sign meeting' }).first().click();
    await expect(page.getByText(/^Co-signed /).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Statutory exports' }).click();
    await expect(
        page.getByText(/DOLE WAIR and CSHP Safe Man-Hours exports/),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Open reports and exports' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Job reports' }),
    ).toBeVisible();
});
