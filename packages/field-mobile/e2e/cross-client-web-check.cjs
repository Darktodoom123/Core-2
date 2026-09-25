'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const repositoryRoot = path.resolve(__dirname, '../../..');
const otpHelper = path.join(
    repositoryRoot,
    'apps/operations/tests/Browser/otp-helper.php',
);

function assignmentSnapshot() {
    const php = [
        '$database = getenv("DB_DATABASE");',
        '$pdo = new PDO("sqlite:".$database);',
        '$statement = $pdo->prepare(',
        '"select jobs.id as job_id, jobs.reference, jobs.status as job_status, jobs.version, assignments.id as assignment_id, assignments.response_status, asset_assignments.operational_asset_id as asset_id, operational_assets.code as asset_code, operational_assets.name as asset_name from dispatch_jobs jobs join dispatch_personnel_assignments assignments on assignments.dispatch_job_id = jobs.id join users on users.id = assignments.user_id left join dispatch_asset_assignments asset_assignments on asset_assignments.dispatch_job_id = jobs.id and asset_assignments.active_until is null left join operational_assets on operational_assets.id = asset_assignments.operational_asset_id where jobs.reference = ? and users.username = ? and assignments.active_until is null order by assignments.id desc limit 1");',
        '$statement->execute([getenv("CROSS_CLIENT_JOB_REFERENCE"), getenv("CROSS_CLIENT_FIELD_USERNAME")]);',
        '$record = $statement->fetch(PDO::FETCH_ASSOC);',
        'echo json_encode($record === false ? null : $record, JSON_THROW_ON_ERROR);',
    ].join('');
    const output = execFileSync('php', ['-r', php], {
        cwd: repositoryRoot,
        env: process.env,
        encoding: 'utf8',
    });
    const record = JSON.parse(output);

    assert.ok(
        record,
        'The shared dispatch fixture must exist in the test database.',
    );
    assert.ok(
        record.asset_id && record.asset_code && record.asset_name,
        'The shared dispatch fixture must include one active assigned unit.',
    );

    return record;
}

function readLatestOtp(username) {
    const output = execFileSync('php', [otpHelper, 'get', username], {
        cwd: repositoryRoot,
        env: {
            ...process.env,
            CORE2_E2E_DB_DATABASE: process.env.DB_DATABASE,
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    const result = JSON.parse(output.trim());

    assert.match(result.code, /^\d{6}$/);

    return result.code;
}

async function waitForAssignmentResponse(expectedResponse, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const record = assignmentSnapshot();

        if (record.response_status === expectedResponse) {
            return record;
        }

        await new Promise((resolve) => setTimeout(resolve, 400));
    }

    const actual = assignmentSnapshot().response_status;

    throw new Error(
        `The dispatch response did not become ${expectedResponse} (received ${actual}).`,
    );
}

function locationSnapshot(jobId) {
    const php = [
        '$database = getenv("CORE2_E2E_TRACKING_DB_DATABASE");',
        '$pdo = new PDO("sqlite:".$database);',
        '$statement = $pdo->prepare(',
        '"select dispatch_job_id, operational_asset_id, sharing_enabled, latitude, longitude from location_samples where dispatch_job_id = ? and sharing_enabled = 1 order by received_at desc, id desc limit 1");',
        '$statement->execute([(int) getenv("CROSS_CLIENT_JOB_ID")]);',
        '$record = $statement->fetch(PDO::FETCH_ASSOC);',
        'echo json_encode($record === false ? null : $record, JSON_THROW_ON_ERROR);',
    ].join('');
    const output = execFileSync('php', ['-r', php], {
        cwd: repositoryRoot,
        env: { ...process.env, CROSS_CLIENT_JOB_ID: String(jobId) },
        encoding: 'utf8',
    });

    return JSON.parse(output);
}

async function waitForLocationAssociation(expected, timeoutMs = 45000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const record = locationSnapshot(expected.job_id);

        if (
            record &&
            Number(record.operational_asset_id) === expected.asset_id &&
            Number(record.dispatch_job_id) === expected.job_id
        ) {
            return record;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const record = locationSnapshot(expected.job_id);

    throw new Error(
        `Native telemetry did not reach the Tracking service with the dispatched job and unit association (record ${record ? 'received with a different association' : 'not received'}).`,
    );
}

async function assertWebAssignmentResponse(
    expectedResponse,
    expectedTrackingAssetCode = null,
) {
    const baseUrl = process.env.APP_URL;
    const managerUsername = process.env.CROSS_CLIENT_MANAGER_USERNAME;
    const password = process.env.SESSION1_NATIVE_PASSWORD;
    const record = assignmentSnapshot();
    const expectedLabel =
        expectedResponse === 'accepted' ? 'Accepted' : 'Pending response';

    assert.ok(
        baseUrl,
        'APP_URL must point to the isolated Laravel web server.',
    );
    assert.ok(managerUsername, 'A seeded manager username is required.');
    assert.ok(password, 'The process-only fixture password is required.');

    const browser = await chromium.launch({ headless: true });

    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        const browserErrorNames = [];

        page.on('pageerror', (error) => browserErrorNames.push(error.name));

        await page.goto(new URL('/login', baseUrl).toString());
        await page.getByLabel('Username').fill(managerUsername);
        await page.getByLabel('Password', { exact: true }).fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForURL(
            (url) =>
                url.pathname === '/login/challenge' || url.pathname === '/',
            { timeout: 30000 },
        );

        if (new URL(page.url()).pathname === '/login/challenge') {
            const trustDevice = page.getByLabel(
                /Trust this device for 30 days/i,
            );

            if (await trustDevice.isVisible()) {
                await trustDevice.check();
            }

            await page
                .getByPlaceholder('000000')
                .fill(readLatestOtp(managerUsername));
            await page
                .getByRole('button', { name: 'Verify and sign in' })
                .click();
            await page.waitForURL((url) => url.pathname === '/', {
                timeout: 30000,
            });
        }

        const dispatchResponse = await page.goto(
            new URL(
                `/operations/dispatch-jobs/${record.job_id}`,
                baseUrl,
            ).toString(),
        );

        try {
            await page
                .getByText(record.reference)
                .waitFor({ state: 'visible', timeout: 30000 });
        } catch (error) {
            const diagnostics = await page.evaluate(() => {
                const serializedPage = document
                    .querySelector('#app')
                    ?.getAttribute('data-page');
                let component = null;

                try {
                    component = serializedPage
                        ? JSON.parse(serializedPage).component
                        : null;
                } catch {
                    component = 'invalid-page-payload';
                }

                return {
                    pathname: window.location.pathname,
                    component,
                    hasDispatchMain: Boolean(
                        document.querySelector('#dispatch-detail-main'),
                    ),
                    hasAssignmentHeading: [
                        ...document.querySelectorAll('h1, h2'),
                    ].some(
                        (heading) =>
                            heading.textContent?.trim() ===
                            'Assigned employees and assets',
                    ),
                };
            });

            console.info(
                '[cross-client-web] Dispatch detail was not visible: ' +
                    JSON.stringify({
                        httpStatus: dispatchResponse?.status() ?? null,
                        ...diagnostics,
                        browserErrorNames,
                    }),
            );

            throw error;
        }

        if (record.asset_code) {
            await page
                .getByText(record.asset_code)
                .first()
                .waitFor({ state: 'visible', timeout: 30000 });
        }

        await page
            .getByRole('heading', {
                name: 'Assigned employees and assets',
            })
            .waitFor({ state: 'visible', timeout: 30000 });
        await page
            .getByText(expectedLabel, { exact: true })
            .waitFor({ state: 'visible', timeout: 30000 });

        if (expectedTrackingAssetCode) {
            await page
                .getByRole('heading', { name: 'Site and location evidence' })
                .waitFor({ state: 'visible', timeout: 30000 });
            await page
                .getByText(`Source: ${expectedTrackingAssetCode}`)
                .waitFor({ state: 'visible', timeout: 30000 });
        }

        assert.equal(
            assignmentSnapshot().response_status,
            expectedResponse,
            'The web UI must reflect the same persisted assignment response.',
        );
    } finally {
        await browser.close();
    }
}

module.exports = {
    assertWebAssignmentResponse,
    assignmentSnapshot,
    locationSnapshot,
    waitForAssignmentResponse,
    waitForLocationAssociation,
};
