/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { createDevClientLaunchOptions } = require('./dev-client.cjs');

const acceptanceEnabled = process.env.RUN_NATIVE_ACCEPTANCE === '1';
const fieldUsername = process.env.FIELD_TEST_USERNAME;
const fieldPassword = process.env.FIELD_TEST_PASSWORD;
const forbiddenJobReference = process.env.FORBIDDEN_JOB_REFERENCE;
const assignedJobReference = process.env.ASSIGNED_JOB_REFERENCE;
const nonFieldUsername = process.env.NON_FIELD_TEST_USERNAME;
const secondFieldUsername = process.env.SECOND_FIELD_TEST_USERNAME;

function mutateLocalFixture(action) {
    const database = process.env.DB_DATABASE;
    const expectedDatabase = path.resolve(
        __dirname,
        '../../../apps/operations/storage/framework/testing/session1-native.sqlite',
    );

    if (!database || path.resolve(database) !== expectedDatabase) {
        throw new Error(
            'Native fixture mutations require the runner-owned Session 1 SQLite database.',
        );
    }

    const statements = {
        suspend:
            "update users set is_active = 0, suspended_at = datetime('now') where username = :username",
        reactivate:
            'update users set is_active = 1, suspended_at = null where username = :username',
        revoke: 'delete from personal_access_tokens where tokenable_id = (select id from users where username = :username)',
    };
    const selectedStatement = statements[action];

    if (!selectedStatement) {
        throw new Error(`Unsupported native fixture mutation: ${action}`);
    }

    if (!fieldUsername) {
        throw new Error(
            'Native fixture mutation requires the configured field account.',
        );
    }

    const php = [
        '$database = getenv("DB_DATABASE");',
        '$pdo = new PDO("sqlite:".$database);',
        '$account = $pdo->prepare("select 1 from users where username = :username");',
        '$account->execute(["username" => getenv("FIELD_TEST_USERNAME")]);',
        'if ($account->fetchColumn() !== 1) { throw new RuntimeException("Fixture account missing."); }',
        `$statement = $pdo->prepare(${JSON.stringify(selectedStatement)});`,
        '$statement->execute(["username" => getenv("FIELD_TEST_USERNAME")]);',
    ].join('');
    const result = spawnSync('php', ['-r', php], {
        cwd: path.resolve(__dirname, '../../..'),
        env: process.env,
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        throw new Error(
            `Native fixture mutation failed without exposing fixture values: ${action}`,
        );
    }
}

async function signIn(username) {
    resetMobileOtp(username);
    await element(by.id('login-username-input')).replaceText(username);
    await element(by.id('login-password-input')).replaceText(fieldPassword);
    await element(by.id('login-submit-button')).tap();

    await waitFor(element(by.id('verification-challenge-form')))
        .toBeVisible()
        .withTimeout(30000);
    const verificationCodeInput = element(by.id('verification-code-input'));
    const verifyButton = element(by.id('verify-code-button'));
    await verificationCodeInput.replaceText(readMobileOtp(username));
    await device.pressBack();
    await waitFor(verifyButton).toBeVisible().withTimeout(5000);
    await verifyButton.tap();
    await waitFor(element(by.id('verification-challenge-form')))
        .not.toExist()
        .withTimeout(30000);
}

function runOtpHelper(action, username) {
    const repositoryRoot = path.resolve(__dirname, '../../..');
    const otpHelper = path.join(
        repositoryRoot,
        'apps/operations/tests/Browser/otp-helper.php',
    );
    const result = spawnSync('php', [otpHelper, action, username], {
        cwd: repositoryRoot,
        env: {
            ...process.env,
            CORE2_E2E_DB_DATABASE: process.env.DB_DATABASE,
        },
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        throw new Error(
            'The isolated native fixture OTP state could not be prepared.',
        );
    }

    return result.stdout.trim();
}

function resetMobileOtp(username) {
    runOtpHelper('reset-user', username);
}

function readMobileOtp(username) {
    const otp = JSON.parse(runOtpHelper('get', username));

    if (typeof otp.code !== 'string' || !/^\d{6}$/.test(otp.code)) {
        throw new Error(
            'The isolated fixture returned an invalid verification code.',
        );
    }

    return otp.code;
}

async function launchFreshApp() {
    await device.launchApp(
        createDevClientLaunchOptions({ resetAppData: true }),
    );
    await waitFor(element(by.id('login-username-input')))
        .toExist()
        .withTimeout(30000);
}

async function openDispatchOrders() {
    const dispatchTile = element(by.id('tile-forms'));

    await waitFor(element(by.id('industrial-tile-grid')))
        .toExist()
        .withTimeout(10000);
    await revealBySwiping({
        targetId: 'tile-documents',
        containerId: 'refresh-control',
        direction: 'up',
        maxSwipes: 8,
        swipeOffset: 0.12,
    });
    await waitFor(dispatchTile)
        .toBeVisible()
        // The tile grid wraps; scroll the home screen, not the grid.
        .whileElement(by.id('refresh-control'))
        .scroll(300, 'down');
    await revealAboveBottomNav();
    await dispatchTile.tap();
    await waitFor(element(by.id('dispatch-orders-screen')))
        .toBeVisible()
        .withTimeout(30000);
}

async function revealBySwiping({
    targetId,
    containerId,
    direction,
    maxSwipes,
    swipeOffset,
}) {
    const target = element(by.id(targetId));
    const container = element(by.id(containerId));

    for (let attempt = 0; attempt <= maxSwipes; attempt += 1) {
        try {
            await waitFor(target).toBeVisible().withTimeout(1000);

            return;
        } catch (error) {
            if (attempt === maxSwipes) {
                throw error;
            }
        }

        await container.swipe(
            direction,
            'slow',
            swipeOffset,
            direction === 'left' ? 0.8 : 0.5,
            direction === 'up' ? 0.8 : 0.5,
        );
    }
}

async function signOutFromProfile() {
    await element(by.id('dispatch-back-btn')).tap();
    await waitFor(element(by.id('industrial-tile-grid')))
        .toExist()
        .withTimeout(10000);
    await element(by.id('bottom-nav-profile')).tap();
    await waitFor(element(by.id('profile-screen')))
        .toExist()
        .withTimeout(10000);
    await element(by.id('tab-settings')).tap();
    await waitFor(element(by.id('btn-sign-out')))
        .toExist()
        .withTimeout(10000);
    await revealBySwiping({
        targetId: 'btn-sign-out',
        containerId: 'profile-screen-content',
        direction: 'up',
        maxSwipes: 8,
        swipeOffset: 0.12,
    });
    await element(by.id('btn-sign-out')).tap();
    await waitFor(element(by.id('confirm-profile-sign-out')))
        .toBeVisible()
        .withTimeout(5000);
    await element(by.id('confirm-profile-sign-out')).tap();
    await waitFor(element(by.id('login-username-input')))
        .toBeVisible()
        .withTimeout(30000);
}

async function revealAboveBottomNav() {
    const target = element(by.id('tile-forms'));
    const scrollView = element(by.id('refresh-control'));
    const bottomNav = element(by.id('bottom-nav-bar'));

    for (let attempt = 0; attempt < 6; attempt += 1) {
        const targetAttributes = await target.getAttributes();
        const navAttributes = await bottomNav.getAttributes();
        const targetFrame = targetAttributes.frame;
        const navFrame = navAttributes.frame;

        if (!targetFrame || !navFrame) {
            throw new Error(
                'Could not measure the dispatch tile and bottom navigation before tapping.',
            );
        }

        if (targetFrame.y + targetFrame.height <= navFrame.y - 8) {
            return;
        }

        await scrollView.swipe('up', 'slow', 0.12, 0.5, 0.8);
    }

    throw new Error(
        'The dispatch tile remained under the bottom navigation after scrolling.',
    );
}

describe('Session 1 authenticated field journey', () => {
    beforeAll(() => {
        if (!acceptanceEnabled) {
            return;
        }

        if (
            !fieldUsername ||
            !fieldPassword ||
            !forbiddenJobReference ||
            !assignedJobReference ||
            !nonFieldUsername ||
            !secondFieldUsername
        ) {
            throw new Error(
                'RUN_NATIVE_ACCEPTANCE=1 requires all Session 1 fixture environment variables.',
            );
        }

        mutateLocalFixture('reactivate');
        mutateLocalFixture('revoke');
    });

    afterAll(() => {
        if (acceptanceEnabled) {
            mutateLocalFixture('reactivate');
            mutateLocalFixture('revoke');
        }
    });

    (acceptanceEnabled ? it : it.skip)(
        'restores a field session, isolates assignments, and logs out',
        async () => {
            await launchFreshApp();

            await signIn(fieldUsername);
            await openDispatchOrders();

            await waitFor(element(by.text(assignedJobReference)))
                .toBeVisible()
                .withTimeout(30000);
            await waitFor(element(by.text(assignedJobReference)))
                .toBeVisible()
                .withTimeout(30000);
            await expect(element(by.text(forbiddenJobReference))).not.toExist();

            await device.terminateApp();
            await device.launchApp(createDevClientLaunchOptions());
            await openDispatchOrders();

            await waitFor(element(by.text(assignedJobReference)))
                .toBeVisible()
                .withTimeout(30000);
            await signOutFromProfile();
        },
    );

    (acceptanceEnabled ? it : it.skip)(
        'rejects non-field roles and revokes their temporary token',
        async () => {
            await launchFreshApp();
            await signIn(nonFieldUsername);

            await waitFor(
                element(
                    by.text(
                        'This account role cannot use the field mobile application.',
                    ),
                ),
            )
                .toBeVisible()
                .withTimeout(30000);
            await expect(element(by.id('login-username-input'))).toBeVisible();
        },
    );

    (acceptanceEnabled ? it : it.skip)(
        'fails closed after suspension and clears the native identity state',
        async () => {
            await launchFreshApp();
            await signIn(fieldUsername);
            await openDispatchOrders();
            await waitFor(element(by.text(assignedJobReference)))
                .toBeVisible()
                .withTimeout(30000);

            mutateLocalFixture('suspend');

            try {
                await device.terminateApp();
                await device.launchApp(createDevClientLaunchOptions());

                await waitFor(element(by.text('Account suspended')))
                    .toBeVisible()
                    .withTimeout(30000);
                await expect(
                    element(by.text(assignedJobReference)),
                ).not.toExist();

                mutateLocalFixture('reactivate');
                await device.terminateApp();
                await device.launchApp(createDevClientLaunchOptions());
                await waitFor(element(by.id('login-username-input')))
                    .toBeVisible()
                    .withTimeout(30000);
            } finally {
                mutateLocalFixture('reactivate');
            }
        },
    );

    (acceptanceEnabled ? it : it.skip)(
        'fails closed after server revocation and isolates a subsequent user',
        async () => {
            await launchFreshApp();
            await signIn(fieldUsername);
            await openDispatchOrders();
            await waitFor(element(by.text(assignedJobReference)))
                .toBeVisible()
                .withTimeout(30000);

            mutateLocalFixture('revoke');
            await device.terminateApp();
            await device.launchApp(createDevClientLaunchOptions());

            await waitFor(
                element(
                    by.text('Your session has expired. Please sign in again.'),
                ),
            )
                .toBeVisible()
                .withTimeout(30000);
            await expect(element(by.id('login-username-input'))).toExist();
            await expect(element(by.text(assignedJobReference))).not.toExist();

            await signIn(secondFieldUsername);
            await openDispatchOrders();
            await waitFor(element(by.text(forbiddenJobReference)))
                .toBeVisible()
                .withTimeout(30000);
            await expect(element(by.text(assignedJobReference))).not.toExist();
            await signOutFromProfile();
        },
    );
});
