/* eslint-disable @typescript-eslint/no-require-imports */
const { createDevClientLaunchOptions } = require('./dev-client.cjs');

describe('Session 1 field mobile smoke', () => {
    beforeAll(async () => {
        await device.launchApp(
            createDevClientLaunchOptions({ resetAppData: true }),
        );
        await waitFor(element(by.id('login-username-input')))
            .toExist()
            .withTimeout(30000);
    });

    it('boots to the secure sign-in surface', async () => {
        await expect(element(by.id('login-username-input'))).toBeVisible();
        await expect(element(by.id('login-password-input'))).toBeVisible();
        await expect(element(by.id('login-submit-button'))).toBeVisible();
    });
});
