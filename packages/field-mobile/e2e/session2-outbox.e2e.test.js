/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { createDevClientLaunchOptions } = require('./dev-client.cjs');

const acceptanceEnabled = process.env.RUN_NATIVE_ACCEPTANCE === '1';
const fieldUsername = process.env.FIELD_TEST_USERNAME;
const fieldPassword = process.env.FIELD_TEST_PASSWORD;
const assignedJobReference = process.env.ASSIGNED_JOB_REFERENCE;

function runChecked(command, args, failureMessage) {
    const result = spawnSync(command, args, {
        cwd: path.resolve(__dirname, '../../..'),
        env: process.env,
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        throw new Error(failureMessage);
    }

    return result.stdout.trim();
}

function adbPath() {
    const androidHome =
        process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;

    if (!androidHome) {
        throw new Error('Android SDK environment is required.');
    }

    return path.join(androidHome, 'platform-tools', 'adb.exe');
}

function setAirplaneMode(enabled) {
    const adb = adbPath();
    const serial = process.env.ANDROID_SERIAL ?? 'emulator-5554';
    const mode = enabled ? 'enable' : 'disable';
    const direct = spawnSync(
        adb,
        ['-s', serial, 'shell', 'cmd', 'connectivity', 'airplane-mode', mode],
        { encoding: 'utf8' },
    );

    if (direct.status !== 0) {
        runChecked(
            adb,
            [
                '-s',
                serial,
                'shell',
                'settings',
                'put',
                'global',
                'airplane_mode_on',
                enabled ? '1' : '0',
            ],
            'Failed to update Android airplane-mode state.',
        );
        runChecked(
            adb,
            [
                '-s',
                serial,
                'shell',
                'am',
                'broadcast',
                '-a',
                'android.intent.action.AIRPLANE_MODE',
                '--ez',
                'state',
                enabled ? 'true' : 'false',
            ],
            'Failed to broadcast Android airplane-mode state.',
        );
    }
}

function assignmentResponseCommandCount() {
    const database = process.env.DB_DATABASE;

    if (!database || path.basename(database) !== 'session1-native.sqlite') {
        throw new Error(
            'Native command assertions require the dedicated session1-native.sqlite database.',
        );
    }

    const php = [
        '$database = getenv("DB_DATABASE");',
        '$pdo = new PDO("sqlite:".$database);',
        '$statement = $pdo->prepare(',
        '"select count(*) from command_logs where action_name = ?");',
        '$statement->execute(["dispatch.assignment_response"]);',
        'echo (string) $statement->fetchColumn();',
    ].join('');
    const count = Number(
        runChecked(
            'php',
            ['-r', php],
            'Failed to verify the native idempotency command count.',
        ),
    );

    if (!Number.isInteger(count)) {
        throw new Error('Native idempotency command count was not numeric.');
    }

    return count;
}

function assertAssignmentResponseCommandCount(expected) {
    const actual = assignmentResponseCommandCount();

    if (actual !== expected) {
        throw new Error(
            'Expected ' +
                expected +
                ' durable assignment-response command(s), received ' +
                actual +
                '.',
        );
    }
}

async function waitForAssignmentResponseCommandCount(
    expected,
    timeoutMs = 30000,
) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (assignmentResponseCommandCount() === expected) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    assertAssignmentResponseCommandCount(expected);
}

async function signIn() {
    await element(by.id('login-username-input')).replaceText(fieldUsername);
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

describe('Sprint 2 durable outbox acceptance', () => {
    beforeAll(() => {
        if (!acceptanceEnabled) {
            return;
        }

        if (!fieldUsername || !fieldPassword || !assignedJobReference) {
            throw new Error(
                'RUN_NATIVE_ACCEPTANCE=1 requires the Sprint 2 fixture environment variables.',
            );
        }

        setAirplaneMode(false);
    });

    afterAll(() => {
        if (acceptanceEnabled) {
            setAirplaneMode(false);
        }
    });

    (acceptanceEnabled ? it : it.skip)(
        'persists an offline assignment response across process death and replays it once',
        async () => {
            assertAssignmentResponseCommandCount(0);
            await launchFreshApp();
            await signIn();
            await waitFor(element(by.text(assignedJobReference)))
                .toBeVisible()
                .withTimeout(30000);

            setAirplaneMode(true);
            await waitFor(
                element(by.text('Offline — commands stay on this device')),
            )
                .toBeVisible()
                .withTimeout(30000);
            await element(by.text(assignedJobReference)).tap();
            await waitFor(element(by.id('accept-assignment-btn')))
                .toBeVisible()
                .withTimeout(30000);
            await element(by.id('accept-assignment-btn')).tap();
            await element(by.label('Back to assigned jobs list')).tap();
            await waitFor(element(by.text('Queued: 1')))
                .toBeVisible()
                .withTimeout(30000);
            assertAssignmentResponseCommandCount(0);

            await device.terminateApp();
            await device.launchApp(createDevClientLaunchOptions());
            await waitFor(
                element(
                    by.text(
                        'Unable to verify your session. Check your connection and try again.',
                    ),
                ),
            )
                .toBeVisible()
                .withTimeout(30000);

            setAirplaneMode(false);
            await waitFor(element(by.text('Active Field Assignments')))
                .toBeVisible()
                .withTimeout(60000);
            await waitForAssignmentResponseCommandCount(1);
            await waitFor(element(by.text('Queued: 0')))
                .toBeVisible()
                .withTimeout(30000);
            await waitFor(element(by.text('Failed: 0')))
                .toBeVisible()
                .withTimeout(30000);
            await waitFor(element(by.text('Conflicts: 0')))
                .toBeVisible()
                .withTimeout(30000);
            await device.terminateApp();
            await device.launchApp(createDevClientLaunchOptions());
            await waitFor(element(by.text('Active Field Assignments')))
                .toBeVisible()
                .withTimeout(30000);
            assertAssignmentResponseCommandCount(1);
        },
    );
});
