/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');
const { createDevClientLaunchOptions } = require('./dev-client.cjs');

const acceptanceEnabled = process.env.RUN_NATIVE_ACCEPTANCE === '1';
const repositoryRoot = path.resolve(__dirname, '../../..');
const otpHelper = path.join(
    repositoryRoot,
    'apps/operations/tests/Browser/otp-helper.php',
);

function runOtpHelper(action, username) {
    const result = spawnSync('php', [otpHelper, action, username], {
        cwd: repositoryRoot,
        env: {
            ...process.env,
            CORE2_E2E_DB_DATABASE: process.env.DB_DATABASE,
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (result.status !== 0) {
        throw new Error('The isolated fuel fixture OTP operation failed.');
    }

    return result.stdout.trim();
}

function readOtp(username) {
    const otp = JSON.parse(runOtpHelper('get', username));
    assert.match(otp.code, /^\d{6}$/);

    return otp.code;
}

function runFuelQuery(query, purpose = '') {
    const php = [
        '$pdo = new PDO("sqlite:".getenv("DB_DATABASE"));',
        '$statement = $pdo->prepare(getenv("FUEL_E2E_QUERY"));',
        '$statement->execute(json_decode(getenv("FUEL_E2E_PARAMETERS"), true, 512, JSON_THROW_ON_ERROR));',
        '$result = $statement->fetchColumn();',
        'echo is_string($result) ? $result : json_encode($result, JSON_THROW_ON_ERROR);',
    ].join('');
    const result = spawnSync('php', ['-r', php], {
        cwd: repositoryRoot,
        env: {
            ...process.env,
            FUEL_E2E_QUERY: query,
            FUEL_E2E_PARAMETERS: JSON.stringify(
                purpose
                    ? [process.env.FIELD_TEST_USERNAME, purpose]
                    : [process.env.FIELD_TEST_USERNAME],
            ),
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (result.status !== 0) {
        throw new Error('The isolated fuel fixture could not be inspected.');
    }

    return result.stdout.trim();
}

function fuelRequestCount() {
    return Number(
        runFuelQuery(
            'select count(*) from fuel_requests requests join users on users.id = requests.requester_id where users.username = ?',
        ),
    );
}

function fuelRequestSnapshot(purpose) {
    const result = runFuelQuery(
        'select json_object("id", requests.id, "reference", requests.reference, "status", requests.status, "quantity_litres", requests.quantity_litres, "purpose", requests.purpose, "log_count", count(logs.id), "actual_litres", max(logs.quantity_litres)) from fuel_requests requests join users on users.id = requests.requester_id left join fuel_logs logs on logs.fuel_request_id = requests.id where users.username = ? and requests.purpose = ? group by requests.id order by requests.id desc limit 1',
        purpose,
    );

    return result ? JSON.parse(result) : null;
}

async function waitForFuelRequest(purpose, predicate, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const record = fuelRequestSnapshot(purpose);

        if (record && predicate(record)) {
            return record;
        }

        await new Promise((resolve) => setTimeout(resolve, 400));
    }

    throw new Error('The fuel request did not reach the expected saved state.');
}

async function signInOnMobile(username, password) {
    runOtpHelper('reset-user', username);
    await device.launchApp(
        createDevClientLaunchOptions({ resetAppData: true }),
    );
    await waitFor(element(by.id('login-username-input')))
        .toBeVisible()
        .withTimeout(30000);
    await element(by.id('login-username-input')).replaceText(username);
    await element(by.id('login-password-input')).replaceText(password);
    await element(by.id('login-submit-button')).tap();
    await waitFor(element(by.id('verification-challenge-form')))
        .toBeVisible()
        .withTimeout(30000);
    await element(by.id('verification-code-input')).replaceText(
        readOtp(username),
    );
    await device.pressBack();
    await element(by.id('verify-code-button')).tap();
    await waitFor(element(by.id('verification-challenge-form')))
        .not.toExist()
        .withTimeout(30000);
    await waitFor(element(by.id('industrial-tile-grid')))
        .toExist()
        .withTimeout(30000);
}

async function openFuelManagement() {
    const tile = element(by.id('tile-fuel'));
    await waitFor(tile)
        .toBeVisible()
        .whileElement(by.id('industrial-tile-grid'))
        .scroll(500, 'right');
    await tile.tap();
    await waitFor(element(by.id('fuel-management-screen')))
        .toBeVisible()
        .withTimeout(30000);
}

async function signInOnWeb(page, username, password) {
    runOtpHelper('reset-user', username);
    await page.goto(new URL('/login', process.env.APP_URL).toString());
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(
        (url) => url.pathname === '/login/challenge' || url.pathname === '/',
        { timeout: 30000 },
    );

    if (new URL(page.url()).pathname === '/login/challenge') {
        const trustDevice = page.getByLabel(/Trust this device for 30 days/i);
        if (await trustDevice.isVisible()) {
            await trustDevice.check();
        }
        await page.getByPlaceholder('000000').fill(readOtp(username));
        await page.getByRole('button', { name: 'Verify and sign in' }).click();
        await page.waitForURL((url) => url.pathname === '/', {
            timeout: 30000,
        });
    }
}

async function advanceFuelRequestOnWeb(page, request) {
    await page.goto(new URL('/?view=fuel', process.env.APP_URL).toString());
    await page
        .getByRole('heading', { name: 'Fuel Management' })
        .waitFor({ state: 'visible', timeout: 30000 });
    await page.getByText(request.reference, { exact: true }).waitFor({
        state: 'visible',
        timeout: 30000,
    });

    const card = () =>
        page.getByRole('listitem').filter({ hasText: request.reference });

    await card().getByRole('button', { name: 'Forward for Review' }).click();
    await card().getByRole('button', { name: 'Review Decision' }).waitFor({
        state: 'visible',
        timeout: 30000,
    });
    await card().getByRole('button', { name: 'Review Decision' }).click();
    await card().getByRole('button', { name: 'Approve Request' }).click();
    await card().getByRole('button', { name: 'Verify Allocation' }).waitFor({
        state: 'visible',
        timeout: 30000,
    });
    await card().getByRole('button', { name: 'Verify Allocation' }).click();
}

describe('mobile Fuel Management to Operations workflow', () => {
    beforeAll(() => {
        if (!acceptanceEnabled) {
            return;
        }

        if (
            !process.env.FIELD_TEST_USERNAME ||
            !process.env.NON_FIELD_TEST_USERNAME ||
            !process.env.FIELD_TEST_PASSWORD ||
            !process.env.DB_DATABASE ||
            !process.env.APP_URL
        ) {
            throw new Error(
                'The isolated native runner did not provide the fuel workflow fixture settings.',
            );
        }
    });

    (acceptanceEnabled ? it : it.skip)(
        'submits on mobile, completes office approval, and records one shared fuel log',
        async () => {
            const fieldUsername = process.env.FIELD_TEST_USERNAME;
            const managerUsername = process.env.NON_FIELD_TEST_USERNAME;
            const password = process.env.FIELD_TEST_PASSWORD;
            const purpose = `Native fuel E2E ${Date.now()}`;
            const countBefore = fuelRequestCount();
            const browser = await chromium.launch({ headless: true });

            try {
                await signInOnMobile(fieldUsername, password);
                await openFuelManagement();
                await waitFor(element(by.label('Request fuel')))
                    .toBeEnabled()
                    .withTimeout(30000);
                await element(by.label('Request fuel')).tap();
                await element(
                    by.label('Requested quantity (liters)'),
                ).replaceText('42.5');
                await element(by.label('Purpose')).replaceText(purpose);
                await device.pressBack();
                await element(by.id('fuel-submit-request-button')).tap();
                await waitFor(element(by.id('fuel-notice')))
                    .toBeVisible()
                    .withTimeout(30000);

                let request = await waitForFuelRequest(
                    purpose,
                    (record) => record.status === 'submitted',
                );
                assert.equal(fuelRequestCount(), countBefore + 1);

                const page = await browser.newPage();
                await signInOnWeb(page, managerUsername, password);
                await advanceFuelRequestOnWeb(page, request);
                request = await waitForFuelRequest(
                    purpose,
                    (record) => record.status === 'verified',
                );

                await element(by.label('Back to requests')).tap();
                await element(by.label('Refresh')).tap();
                await waitFor(element(by.id(`fuel-view-request-${request.id}`)))
                    .toBeVisible()
                    .withTimeout(30000);
                await element(by.id(`fuel-view-request-${request.id}`)).tap();
                await waitFor(element(by.label('Record refueling')))
                    .toBeVisible()
                    .withTimeout(30000);
                await element(by.label('Record refueling')).tap();
                await element(by.label('Actual quantity (liters)')).replaceText(
                    '40',
                );
                await element(
                    by.label('Total cost (PHP, optional)'),
                ).replaceText('2750');
                await element(
                    by.label('Fuel station or source (optional)'),
                ).replaceText('Native E2E station');
                await device.pressBack();
                await element(by.id('fuel-save-log-button')).tap();
                await waitFor(
                    element(by.text('Refueling saved to Fuel Management.')),
                )
                    .toBeVisible()
                    .withTimeout(30000);

                request = await waitForFuelRequest(
                    purpose,
                    (record) =>
                        record.status === 'logged' &&
                        Number(record.log_count) === 1,
                );
                assert.equal(Number(request.actual_litres), 40);
                assert.equal(fuelRequestCount(), countBefore + 1);

                await page.goto(
                    new URL('/?view=fuel', process.env.APP_URL).toString(),
                );
                await page.getByRole('button', { name: 'Fuel Logs' }).click();
                const logRecords = page.getByRole('list', {
                    name: 'Fuel log records',
                });
                await logRecords.getByText(request.reference).waitFor({
                    state: 'visible',
                    timeout: 30000,
                });
                await logRecords.getByText('Native E2E station').waitFor({
                    state: 'visible',
                    timeout: 30000,
                });
            } finally {
                await browser.close();
            }
        },
    );
});
