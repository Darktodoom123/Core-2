import { expect, test } from '@playwright/test';
import {
    browserFixtures,
    clearOtpCooldown,
    countTrustedDevices,
    getLatestOtp,
    resetTestUser,
} from './browser-fixtures';

test.describe('Web new-device sign-in flow and device trust handoff', () => {
    test.beforeEach(async () => {
        resetTestUser('browser.manager');
    });

    test.afterAll(async () => {
        resetTestUser('browser.manager');
    });

    test('untrusted sign-in triggers OTP challenge, resend cooldown, invalidation, trust handoff, and trusted bypass', async ({
        page,
        context,
    }) => {
        const fixtures = browserFixtures();
        const username = fixtures.users.manager;
        const password = fixtures.password;

        // Install Playwright clock on context before navigation to control cooldown deterministically
        await context.clock.install();

        // 1. Initial State: Clean browser context, no device trust cookie, 0 trusted devices in DB
        expect(countTrustedDevices(username)).toBe(0);
        const initialCookies = await context.cookies();
        expect(
            initialCookies.find((c) => c.name === 'core2_device_trust'),
        ).toBeUndefined();

        // 2. Password sign-in from an untrusted device
        await page.goto('/login');
        await page.getByLabel('Username').fill(username);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();

        // 3. Confirm redirection to the OTP challenge
        await page.waitForURL(/\/login\/challenge$/);
        await expect(
            page.getByRole('heading', { name: 'Enter verification code' }),
        ).toBeVisible();
        await expect(page.getByText('Security Verification')).toBeVisible();
        await expect(
            page.getByText(/A 6-digit code has been sent to/i),
        ).toBeVisible();
        await expect(page.getByText(/br.*r@example\.com/)).toBeVisible();

        const codeInput = page.getByPlaceholder('000000');
        await expect(codeInput).toBeVisible();

        const verifyButton = page.getByRole('button', {
            name: 'Verify and sign in',
        });
        await expect(verifyButton).toBeDisabled();

        const trustCheckbox = page.getByLabel(/Trust this device for 30 days/i);
        await expect(trustCheckbox).toBeVisible();
        await expect(trustCheckbox).not.toBeChecked();

        // 4. Inspect initial OTP challenge in DB
        const initialOtp = getLatestOtp(username);
        expect(initialOtp.code).toMatch(/^\d{6}$/);
        expect(initialOtp.attempts).toBe(0);
        expect(initialOtp.resend_count).toBe(0);

        // 5. Verify resend cooldown behavior
        const resendButton = page.getByRole('button', { name: /Resend/i });
        await expect(resendButton).toBeDisabled();
        await expect(resendButton).toHaveText(/Resend in \d+s/);

        // Deterministically advance browser timer by 15 seconds to verify active countdown reduction
        await context.clock.runFor(15_000);
        await expect(resendButton).toBeDisabled();
        await expect(resendButton).toHaveText(/Resend in (?:2\d|30)s/);

        // Advance remaining seconds to complete the 45-second cooldown
        await context.clock.runFor(32_000);

        // Cooldown is now elapsed; resend button must be enabled
        await expect(resendButton).toBeEnabled();
        await expect(resendButton).toHaveText('Resend code');

        // Clear server-side throttle to mirror the passage of time on the server
        clearOtpCooldown(username);

        // 6. Request code resend
        await resendButton.click();

        // Status notification confirming code dispatched
        await expect(page.getByRole('status')).toHaveText(
            'A new verification code has been sent to your email.',
        );

        // Resend cooldown immediately re-engages and disables button
        await expect(resendButton).toBeDisabled();
        await expect(resendButton).toHaveText(/Resend in \d+s/);

        // 7. Verify code invalidation rules:
        // The old code must be purged/invalidated and cannot complete verification
        const resentOtp = getLatestOtp(username);
        expect(resentOtp.code).toMatch(/^\d{6}$/);
        expect(resentOtp.code).not.toBe(initialOtp.code);
        expect(resentOtp.resend_count).toBe(1);

        // Attempt sign-in with the invalidated initial code
        await codeInput.fill(initialOtp.code);
        await expect(verifyButton).toBeEnabled();
        await verifyButton.click();

        // Verification must be rejected, keeping user on challenge page with error
        await expect(page).toHaveURL(/\/login\/challenge$/);
        const errorAlert = page
            .locator('span[role="alert"], p[role="alert"]')
            .first();
        await expect(errorAlert).toBeVisible();
        await expect(errorAlert).toContainText(/incorrect|invalid|not found/i);

        // 8. Successful verification and trusted-device handoff
        await trustCheckbox.check();
        await expect(trustCheckbox).toBeChecked();

        await codeInput.fill(resentOtp.code);
        await verifyButton.click();

        // User is redirected to home dashboard
        await page.waitForURL(/\/$/);
        await expect(
            page.getByRole('navigation', {
                name: 'Available operations modules',
            }),
        ).toBeVisible();

        // Verify cryptographic device trust cookie is issued with ~30 days duration
        const authenticatedCookies = await context.cookies();
        const trustCookie = authenticatedCookies.find(
            (c) => c.name === 'core2_device_trust',
        );
        expect(trustCookie).toBeDefined();
        expect(trustCookie?.value).toBeTruthy();
        expect(trustCookie?.httpOnly).toBe(true);
        expect(trustCookie?.expires).toBeGreaterThan(
            Math.floor(Date.now() / 1000) + 28 * 86400,
        );

        // Verify trusted device record exists in database
        expect(countTrustedDevices(username)).toBe(1);

        // 9. Sign out
        await page.getByRole('button', { name: 'User account menu' }).click();
        await page.getByRole('menuitem', { name: 'Sign out' }).click();
        await page.waitForURL(/\/login$/);

        // Confirm trusted device cookie persists in this browser context across logout
        const postLogoutCookies = await context.cookies();
        expect(
            postLogoutCookies.find((c) => c.name === 'core2_device_trust'),
        ).toBeDefined();

        // 10. Sign in again in the SAME browser context
        await page.getByLabel('Username').fill(username);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();

        // Confirm NO further OTP challenge is prompted; browser is trusted and enters dashboard directly
        await page.waitForURL(/\/$/);
        expect(page.url()).not.toContain('/login/challenge');
        await expect(
            page.getByRole('navigation', {
                name: 'Available operations modules',
            }),
        ).toBeVisible();
    });

    test('unchecking trust_device does not issue trust cookie and requires challenge on next sign-in', async ({
        page,
        context,
    }) => {
        const fixtures = browserFixtures();
        const username = fixtures.users.manager;
        const password = fixtures.password;

        // 1. Password sign-in on untrusted device
        await page.goto('/login');
        await page.getByLabel('Username').fill(username);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();

        // 2. Challenged for OTP
        await page.waitForURL(/\/login\/challenge$/);
        const otp = getLatestOtp(username);

        // Explicitly verify trust_device is NOT checked
        const trustCheckbox = page.getByLabel(/Trust this device for 30 days/i);
        expect(await trustCheckbox.isChecked()).toBe(false);

        // Enter OTP and submit
        await page.getByPlaceholder('000000').fill(otp.code);
        await page.getByRole('button', { name: 'Verify and sign in' }).click();

        // Redirected to dashboard
        await page.waitForURL(/\/$/);

        // Confirm NO device trust cookie was issued
        const cookies = await context.cookies();
        expect(
            cookies.find((c) => c.name === 'core2_device_trust'),
        ).toBeUndefined();
        expect(countTrustedDevices(username)).toBe(0);

        // 3. Sign out
        await page.getByRole('button', { name: 'User account menu' }).click();
        await page.getByRole('menuitem', { name: 'Sign out' }).click();
        await page.waitForURL(/\/login$/);

        // 4. Sign in again in the same browser context
        await page.getByLabel('Username').fill(username);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();

        // Because device was not trusted, user MUST be challenged again
        await page.waitForURL(/\/login\/challenge$/);
        await expect(
            page.getByRole('heading', { name: 'Enter verification code' }),
        ).toBeVisible();
    });
});
