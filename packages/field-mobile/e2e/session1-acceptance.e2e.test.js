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

    if (!database || path.basename(database) !== 'session1-native.sqlite') {
        throw new Error(
            'Native fixture mutations require the dedicated session1-native.sqlite database.',
        );
    }

    const statements = {
        suspend: [
            "update users set is_active = 0, suspended_at = datetime('now') where email = 'driver@example.com'",
        ],
        reactivate: [
            "update users set is_active = 1, suspended_at = null where email = 'driver@example.com'",
        ],
        revoke: [
            "delete from personal_access_tokens where tokenable_id = (select id from users where email = 'driver@example.com')",
        ],
    };
    const selectedStatements = statements[action];

    if (!selectedStatements) {
        throw new Error(`Unsupported native fixture mutation: ${action}`);
    }

    const php = [
        '$database = getenv("DB_DATABASE");',
        '$pdo = new PDO("sqlite:".$database);',
        ...selectedStatements.map(
            (statement) => `$pdo->exec(${JSON.stringify(statement)});`,
        ),
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
    await element(by.id('login-username-input')).replaceText(username);
    await element(by.id('login-password-input')).replaceText(fieldPassword);
    await element(by.id('login-submit-button')).tap();
}

async function launchFreshApp() {
    await device.launchApp(
        createDevClientLaunchOptions({ resetAppData: true }),
    );
    await waitFor(element(by.text('Sign in to your account')))
        .toExist()
        .withTimeout(30000);
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

            await waitFor(element(by.text('Active Field Assignments')))
                .toBeVisible()
                .withTimeout(30000);
            await waitFor(element(by.text(assignedJobReference)))
                .toBeVisible()
                .withTimeout(30000);
            await expect(element(by.text(forbiddenJobReference))).not.toExist();

            await device.terminateApp();
            await device.launchApp(createDevClientLaunchOptions());

            await waitFor(element(by.text('Active Field Assignments')))
                .toBeVisible()
                .withTimeout(30000);
            await element(by.id('logout-button')).tap({ x: 5, y: 5 });
            await waitFor(element(by.id('login-username-input')))
                .toBeVisible()
                .withTimeout(30000);
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
            await waitFor(element(by.text('Active Field Assignments')))
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
            await waitFor(element(by.text(forbiddenJobReference)))
                .toBeVisible()
                .withTimeout(30000);
            await expect(element(by.text(assignedJobReference))).not.toExist();
            await element(by.id('logout-button')).tap({ x: 5, y: 5 });
            await waitFor(element(by.id('login-username-input')))
                .toBeVisible()
                .withTimeout(30000);
        },
    );
});
