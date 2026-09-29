import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

type AccountMutation = {
    data: { id: number };
    temporary_password: string;
};

test.describe('system administrator account management', () => {
    test('creates and manages an account, reveals its temporary password once, and records audit events', async ({
        page,
        context,
    }) => {
        const fixtures = browserFixtures();
        const admin = fixtures.users.admin;

        expect(
            admin,
            'the browser seeder must provide an administrator',
        ).toBeTruthy();
        await signIn(page, admin, fixtures.password);
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        const moduleNavigation = page.getByRole('navigation', {
            name: 'Available operations modules',
        });
        await moduleNavigation
            .getByRole('button', { name: 'Users & access', exact: true })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Account management' }),
        ).toBeVisible();
        await expect(
            page.getByText(/Resolve duplicate privileged roles/),
        ).toHaveCount(0);
        await expect(
            page.getByRole('table', { name: 'User accounts' }),
        ).toBeVisible();

        await page.setViewportSize({ width: 390, height: 844 });
        const mobileAccounts = page.getByRole('list', {
            name: 'User accounts',
        });
        await expect(mobileAccounts).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        window.innerWidth,
                ),
            )
            .toBe(true);

        const accessibility = await new AxeBuilder({ page })
            .include('[data-testid="account-management"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
        expect(accessibility.violations).toEqual([]);

        const selfAccount = mobileAccounts
            .getByRole('listitem')
            .filter({ hasText: admin ?? '' });
        await selfAccount.getByRole('button').click();
        const accountDetails = page.getByTestId('account-management');
        await expect(
            accountDetails.getByText('Two-step sign-in', { exact: true }),
        ).toBeVisible();
        await expect(
            accountDetails.getByText('Email verification code', {
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            accountDetails.getByText(/^(Enabled|Disabled)$/).first(),
        ).toBeVisible();
        const signInActivityHeading = page.getByRole('heading', {
            name: 'Sign-in activity',
        });
        await signInActivityHeading.scrollIntoViewIfNeeded();
        await expect(signInActivityHeading).toBeVisible();
        await expect(
            accountDetails.getByText(/^Signed in/).first(),
        ).toBeVisible();
        await expect(
            accountDetails.getByText(/Device: .* · Desktop/).first(),
        ).toBeVisible();
        await expect(
            accountDetails.getByText('Location:', { exact: true }).first(),
        ).toBeVisible();
        await expect(
            accountDetails.getByText(/IP: 127\.0\.0\.1/).first(),
        ).toBeVisible();
        await expect(
            accountDetails.getByText(
                /Location is approximate from the sign-in IP/,
            ),
        ).toBeVisible();
        await expect(
            page.getByText(/You cannot suspend your own account/i),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Suspend account' }),
        ).toBeDisabled();

        await page.getByRole('button', { name: 'All accounts' }).click();
        const createButton = page.getByRole('button', {
            name: 'Create account',
        });
        await expect(createButton).toBeVisible();
        await createButton.focus();
        await page.keyboard.press('Enter');
        const keyboardDialog = page.getByRole('dialog');
        await expect(keyboardDialog).toBeVisible();
        await expect(
            keyboardDialog.getByRole('button', { name: 'Close dialog' }),
        ).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(
            keyboardDialog.getByRole('textbox', { name: 'Full name' }),
        ).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(
            keyboardDialog.getByRole('button', { name: 'Close dialog' }),
        ).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(
            keyboardDialog.getByRole('button', { name: 'Create account' }),
        ).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(
            keyboardDialog.getByRole('button', { name: 'Close dialog' }),
        ).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(
            keyboardDialog.getByRole('textbox', { name: 'Full name' }),
        ).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(keyboardDialog).toBeHidden();
        await expect(createButton).toBeFocused();
        await page.setViewportSize({ width: 1280, height: 900 });
        const desktopAccounts = page.getByRole('table', {
            name: 'User accounts',
        });
        await expect(desktopAccounts).toBeVisible();
        const farAccountRow = desktopAccounts.getByRole('row').nth(2);
        const farAccountButton = farAccountRow.getByRole('button');
        const farAccountName = (await farAccountButton.innerText()).split(
            '\n',
        )[0];
        await farAccountRow.getByRole('cell').nth(2).click();
        await expect(
            page.getByRole('heading', { name: farAccountName, exact: true }),
        ).toBeVisible();
        await expect(farAccountButton).toHaveAttribute('aria-pressed', 'true');

        const suffix = Date.now().toString();
        const accountName = `Browser E2E Account ${suffix}`;
        const accountUsername = `browser.e2e.${suffix}`;
        const accountEmail = `${accountUsername}@example.test`;

        await createButton.click();
        const createDialog = page.getByRole('dialog');
        await expect(
            createDialog.getByText(/no email invitation is sent/i),
        ).toBeVisible();
        await createDialog
            .getByRole('textbox', { name: 'Full name' })
            .fill(accountName);
        await createDialog
            .getByRole('textbox', { name: 'Username' })
            .fill(accountUsername);
        await createDialog
            .getByRole('textbox', { name: 'Email' })
            .fill(accountEmail);
        await createDialog
            .getByRole('combobox', { name: 'Account role' })
            .selectOption('crane_operator');

        const createResponsePromise = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === '/operations/users' &&
                response.request().method() === 'POST',
        );
        await createDialog
            .getByRole('button', { name: 'Create account' })
            .click();
        const createResponse = await createResponsePromise;
        expect(createResponse.status()).toBe(201);
        const created = (await createResponse.json()) as AccountMutation;

        const createdAccountItem = desktopAccounts
            .getByRole('row')
            .filter({ hasText: accountUsername });
        await expect(createdAccountItem).toBeVisible();
        await expect(
            page.getByRole('heading', { name: accountName, exact: true }),
        ).toBeVisible();

        const passwordReveal = page.getByLabel('Temporary password');
        await expect(passwordReveal).toHaveText(created.temporary_password);
        await page.getByRole('button', { name: 'Copy password' }).click();
        await expect(
            page.getByText('Temporary password copied.', { exact: true }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await expect(passwordReveal).toBeHidden();

        const roleControl = page.getByRole('combobox', {
            name: 'Account role',
        });
        await expect(roleControl).toHaveValue('crane_operator');
        await expect(
            roleControl.locator('option[value="operations_manager"]'),
        ).toBeEnabled();
        await roleControl.selectOption('operations_manager');
        const roleChangePromise = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname ===
                    `/operations/users/${created.data.id}` &&
                response.request().method() === 'PATCH',
        );
        await page.getByRole('button', { name: 'Save role' }).click();
        expect((await roleChangePromise).status()).toBe(200);
        await expect(roleControl).toHaveValue('operations_manager');
        await expect(createdAccountItem).toContainText('Operations Manager');

        await page.getByRole('button', { name: 'Suspend account' }).click();
        await expect(
            page.getByText('Suspend this account?', { exact: true }),
        ).toBeVisible();
        const suspendPromise = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname ===
                    `/operations/users/${created.data.id}` &&
                response.request().method() === 'PATCH',
        );
        await page.getByRole('button', { name: 'Confirm suspension' }).click();
        expect((await suspendPromise).status()).toBe(200);
        await expect(
            page.getByRole('button', { name: 'Reactivate account' }),
        ).toBeVisible();
        await expect(
            createdAccountItem.getByText('Suspended', { exact: true }),
        ).toBeVisible();

        const reactivatePromise = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname ===
                    `/operations/users/${created.data.id}` &&
                response.request().method() === 'PATCH',
        );
        await page.getByRole('button', { name: 'Reactivate account' }).click();
        expect((await reactivatePromise).status()).toBe(200);
        await expect(
            page.getByText('Account reactivated.', { exact: true }),
        ).toBeVisible();
        await expect(
            createdAccountItem.getByText('Active', { exact: true }),
        ).toBeVisible();

        await page.getByRole('button', { name: 'Reset password' }).click();
        await expect(
            page.getByText('Reset this password?', { exact: true }),
        ).toBeVisible();
        const resetPromise = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname ===
                    `/operations/users/${created.data.id}/reset-password` &&
                response.request().method() === 'POST',
        );
        await page
            .getByRole('button', { name: 'Confirm password reset' })
            .click();
        const resetResponse = await resetPromise;
        expect(resetResponse.status()).toBe(200);
        const reset = (await resetResponse.json()) as {
            temporary_password: string;
        };
        expect(reset.temporary_password).not.toBe(created.temporary_password);
        await expect(passwordReveal).toHaveText(reset.temporary_password);
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await expect(passwordReveal).toBeHidden();

        await moduleNavigation
            .getByRole('button', { name: 'Audit trail', exact: true })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Audit trail', exact: true }),
        ).toBeVisible();
        await expect(page).toHaveURL(/view=audit/);
        await page
            .getByRole('group', { name: 'Filter by category' })
            .getByRole('button', { name: /Access & people/ })
            .click();

        // The results table names each recorded action in plain language.
        const auditResults = page.getByRole('region', {
            name: /events|Loading events/,
        });

        for (const action of [
            'Account created',
            'Account access changed',
            'Password reset',
        ]) {
            await expect(
                auditResults.getByText(action, { exact: true }).first(),
            ).toBeVisible();
        }
    });

    test('hides user management from an operations manager and denies all account API actions', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.manager, fixtures.password);
        await page.goto('/?view=users');
        await expect(
            page.getByRole('heading', { name: 'Operation Dashboard' }),
        ).toBeVisible();

        const moduleNavigation = page.getByRole('navigation', {
            name: 'Available operations modules',
        });
        await expect(
            moduleNavigation.getByRole('button', {
                name: 'Users & access',
                exact: true,
            }),
        ).toHaveCount(0);

        const managerId = fixtures.user_ids.manager;
        expect(managerId).toBeGreaterThan(0);

        const csrfToken = await page
            .locator('meta[name="csrf-token"]')
            .getAttribute('content');
        expect(csrfToken).toBeTruthy();
        const headers = {
            Accept: 'application/json',
            ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
        };

        const listResponse = await page.request.get('/operations/users', {
            headers,
        });
        expect(listResponse.status()).toBe(403);

        const suffix = Date.now().toString();
        const createResponse = await page.request.post('/operations/users', {
            headers,
            data: {
                name: 'Blocked Account',
                username: `blocked.${suffix}`,
                email: `blocked.${suffix}@example.test`,
                role: 'crane_operator',
                generate_temp_password: true,
            },
        });
        expect(createResponse.status()).toBe(403);

        const updateResponse = await page.request.patch(
            `/operations/users/${managerId}`,
            {
                headers,
                data: { role: 'operations_manager' },
            },
        );
        expect(updateResponse.status()).toBe(403);

        const resetResponse = await page.request.post(
            `/operations/users/${managerId}/reset-password`,
            { headers },
        );
        expect(resetResponse.status()).toBe(403);

        const signInActivityResponse = await page.request.get(
            `/operations/users/${managerId}/sign-in-activity`,
            { headers },
        );
        expect(signInActivityResponse.status()).toBe(403);
    });
});
