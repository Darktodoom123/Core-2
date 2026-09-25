/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const {
    assertWebAssignmentResponse,
    assignmentSnapshot,
    waitForAssignmentResponse,
    waitForLocationAssociation,
} = require('./cross-client-web-check.cjs');
const { createDevClientLaunchOptions } = require('./dev-client.cjs');

const acceptanceEnabled = process.env.RUN_NATIVE_ACCEPTANCE === '1';

function readMobileOtp() {
    const repositoryRoot = path.resolve(__dirname, '../../..');
    const otpHelper = path.join(
        repositoryRoot,
        'apps/operations/tests/Browser/otp-helper.php',
    );
    const result = spawnSync(
        'php',
        [otpHelper, 'get', process.env.CROSS_CLIENT_FIELD_USERNAME],
        {
            cwd: repositoryRoot,
            env: {
                ...process.env,
                CORE2_E2E_DB_DATABASE: process.env.DB_DATABASE,
            },
            encoding: 'utf8',
        },
    );

    if (result.status !== 0) {
        throw new Error(
            'The native fixture verification code could not be read from the isolated test database.',
        );
    }

    const otp = JSON.parse(result.stdout.trim());

    assert.match(otp.code, /^\d{6}$/);

    return otp.code;
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

async function revealAboveBottomNav(targetId, scrollViewId, bottomNavId) {
    const target = element(by.id(targetId));
    const scrollView = element(by.id(scrollViewId));
    const bottomNav = element(by.id(bottomNavId));
    let lastGeometry;

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

        lastGeometry = { targetFrame, navFrame };

        if (targetFrame.y + targetFrame.height <= navFrame.y - 8) {
            console.info(
                '[cross-client] Dispatch tile is clear of the bottom navigation.',
            );

            return;
        }

        await scrollView.swipe('up', 'slow', 0.12, 0.5, 0.8);
    }

    throw new Error(
        `The dispatch tile remained under the bottom navigation after scrolling: ${JSON.stringify(lastGeometry)}.`,
    );
}

async function collectNativeScreenMarkers() {
    const candidates = [
        'login-screen',
        'verification-challenge-form',
        'suspended-screen',
        'restricted-role-screen',
        'refresh-control',
        'dispatch-orders-screen',
        'profile-screen',
    ];
    const found = [];

    for (const testID of candidates) {
        try {
            await waitFor(element(by.id(testID)))
                .toExist()
                .withTimeout(500);
            found.push(testID);
        } catch {
            // Only report stable screen IDs; never record form values.
        }
    }

    return found;
}

async function signInFieldOperator() {
    await device.launchApp(
        createDevClientLaunchOptions({ resetAppData: true }),
    );
    await waitFor(element(by.id('login-username-input')))
        .toExist()
        .withTimeout(30000);

    await element(by.id('login-username-input')).replaceText(
        process.env.CROSS_CLIENT_FIELD_USERNAME,
    );
    await element(by.id('login-password-input')).replaceText(
        process.env.FIELD_TEST_PASSWORD,
    );
    await element(by.id('login-submit-button')).tap();

    await waitFor(element(by.id('verification-challenge-form')))
        .toBeVisible()
        .withTimeout(30000);
    const verificationCodeInput = element(by.id('verification-code-input'));
    const verifyButton = element(by.id('verify-code-button'));
    await verificationCodeInput.replaceText(readMobileOtp());
    await device.pressBack();
    await waitFor(verifyButton).toBeVisible().withTimeout(5000);
    const verifyButtonAttributes = await verifyButton.getAttributes();

    if (!verifyButtonAttributes.enabled) {
        throw new Error(
            'The native verification button stayed disabled after the 6-digit code was entered.',
        );
    }

    await verifyButton.tap();

    try {
        await waitFor(element(by.id('verification-challenge-form')))
            .not.toExist()
            .withTimeout(30000);
    } catch (error) {
        const markers = await collectNativeScreenMarkers();
        console.info(
            `[cross-client] Native UI markers after verification: ${markers.join(', ') || 'none'}.`,
        );

        throw error;
    }

    try {
        await waitFor(element(by.id('refresh-control')))
            .toBeVisible()
            .withTimeout(30000);
        await waitFor(element(by.id('tile-forms')))
            .toExist()
            .withTimeout(30000);
    } catch (error) {
        const markers = await collectNativeScreenMarkers();
        console.info(
            `[cross-client] Native UI markers after OTP submission: ${markers.join(', ') || 'none'}.`,
        );

        throw error;
    }

    console.info('[cross-client] Native sign-in completed.');
    await waitFor(element(by.id('industrial-tile-grid')))
        .toExist()
        .withTimeout(5000);
    await revealBySwiping({
        targetId: 'tile-documents',
        containerId: 'refresh-control',
        direction: 'up',
        maxSwipes: 8,
        swipeOffset: 0.12,
    });
    await waitFor(element(by.id('tile-forms')))
        .toBeVisible()
        .whileElement(by.id('industrial-tile-grid'))
        .scroll(300, 'right');
    console.info('[cross-client] Dispatch tile is visible.');
    const tileScreenshot = await device.takeScreenshot(
        'cross-client-dispatch-tile-before-nav-clearance',
    );
    console.info(
        `[cross-client] Initial tile screenshot saved: ${path.basename(tileScreenshot)}`,
    );
    await revealAboveBottomNav(
        'tile-forms',
        'refresh-control',
        'bottom-nav-bar',
    );
    const readyScreenshot = await device.takeScreenshot(
        'cross-client-dispatch-tile-ready-to-tap',
    );
    console.info(
        `[cross-client] Clear-tile screenshot saved: ${path.basename(readyScreenshot)}`,
    );
    await element(by.id('tile-forms')).tap();
    const dispatchScreenshot = await device.takeScreenshot(
        'cross-client-dispatch-after-tile-tap',
    );
    console.info(
        `[cross-client] Post-tap screenshot saved: ${path.basename(dispatchScreenshot)}`,
    );
    await waitFor(element(by.id('dispatch-orders-screen')))
        .toBeVisible()
        .withTimeout(30000);
}

async function acceptLocationPermissionIfPrompted() {
    const allowWhileUsing = element(by.text('While using the app'));

    try {
        await waitFor(allowWhileUsing).toBeVisible().withTimeout(2500);
        await allowWhileUsing.tap();
        console.info('[cross-client] Android location permission was granted.');
    } catch {
        // The permission may already be granted on the isolated emulator.
    }
}

describe('web → native field → web assignment round trip', () => {
    beforeAll(() => {
        if (!acceptanceEnabled) {
            return;
        }

        if (
            !process.env.CROSS_CLIENT_FIELD_USERNAME ||
            !process.env.CROSS_CLIENT_MANAGER_USERNAME ||
            !process.env.FIELD_TEST_PASSWORD ||
            !process.env.DB_DATABASE ||
            !process.env.CORE2_E2E_TRACKING_DB_DATABASE ||
            !process.env.APP_URL
        ) {
            throw new Error(
                'The isolated cross-client runner did not provide all fixture settings.',
            );
        }
    });

    (acceptanceEnabled ? it : it.skip)(
        'accepts a web dispatch, starts on-site telemetry on Android, and shows the same assigned unit on the web',
        async () => {
            const initial = assignmentSnapshot();

            assert.equal(initial.response_status, 'pending');
            await assertWebAssignmentResponse('pending');
            console.info(
                '[cross-client] Manager confirms the assignment is pending.',
            );

            await signInFieldOperator();
            console.info(
                '[cross-client] Field operator opened dispatch intake.',
            );
            await waitFor(
                element(by.id(`dispatch-intake-job-${initial.job_id}`)),
            )
                .toBeVisible()
                .withTimeout(30000);
            const assignedAssetLabel = element(
                by.text(`${initial.asset_code} · ${initial.asset_name}`),
            );
            await expect(assignedAssetLabel).toExist();
            await revealBySwiping({
                targetId: 'accept-assignment-btn',
                containerId: 'dispatch-orders-list',
                direction: 'up',
                maxSwipes: 6,
                swipeOffset: 0.25,
            });
            await element(by.id('accept-assignment-btn')).tap();

            const accepted = await waitForAssignmentResponse('accepted');
            console.info(
                '[cross-client] Server persisted the operator acceptance.',
            );

            assert.equal(accepted.job_id, initial.job_id);
            assert.equal(accepted.assignment_id, initial.assignment_id);
            assert.equal(accepted.asset_id, initial.asset_id);
            assert.equal(accepted.asset_code, initial.asset_code);
            assert.ok(
                accepted.version >= initial.version,
                'The accepted response must be recorded against the same dispatch version lineage.',
            );

            await assertWebAssignmentResponse('accepted');
            console.info(
                '[cross-client] Manager web view confirms the accepted response.',
            );

            await element(by.id('intake-tab-all')).tap();
            const selectedJobCard = element(
                by.id(`job-card-${initial.job_id}`),
            );
            await waitFor(selectedJobCard).toBeVisible().withTimeout(15000);
            await selectedJobCard.tap();
            await element(by.id('dispatch-back-btn')).tap();
            await waitFor(element(by.id('refresh-control')))
                .toBeVisible()
                .withTimeout(15000);
            await revealBySwiping({
                targetId: 'start-unit-on-site-btn',
                containerId: 'refresh-control',
                direction: 'up',
                maxSwipes: 8,
                swipeOffset: 0.12,
            });
            await element(by.id('start-unit-on-site-btn')).tap();
            await waitFor(element(by.id('on-site-confirmation-modal')))
                .toBeVisible()
                .withTimeout(5000);
            await element(by.id('confirm-on-site-btn')).tap();
            await acceptLocationPermissionIfPrompted();
            const onSiteScreenshot = await device.takeScreenshot(
                'cross-client-after-on-site-confirm',
            );
            console.info(
                `[cross-client] Post-confirmation screenshot saved: ${path.basename(onSiteScreenshot)}`,
            );
            await waitFor(element(by.id('dvir-pending-banner')))
                .toExist()
                .withTimeout(15000);
            await revealBySwiping({
                targetId: 'start-pre-trip-dvir-btn',
                containerId: 'refresh-control',
                direction: 'up',
                maxSwipes: 6,
                swipeOffset: 0.12,
            });
            await waitFor(element(by.id('start-pre-trip-dvir-btn')))
                .toBeVisible()
                .withTimeout(8000);

            let location;

            try {
                location = await waitForLocationAssociation({
                    job_id: initial.job_id,
                    asset_id: initial.asset_id,
                });
            } catch (error) {
                const locationError = element(by.id('location-tracking-error'));
                await device.takeScreenshot('cross-client-telemetry-failure');

                try {
                    const attributes = await locationError.getAttributes();
                    console.info(
                        `[cross-client] Location guidance visible: ${JSON.stringify(attributes)}`,
                    );
                } catch {
                    console.info(
                        '[cross-client] No in-app location guidance banner was present after the telemetry timeout.',
                    );
                }

                throw error;
            }

            assert.equal(Number(location.sharing_enabled), 1);
            console.info(
                '[cross-client] Android telemetry reached the assigned web dispatch with the same unit association.',
            );
            await assertWebAssignmentResponse('accepted', initial.asset_code);
            console.info(
                '[cross-client] Manager web view shows the field unit as the source of shared location.',
            );
            await device.terminateApp();
        },
        300000,
    );
});
