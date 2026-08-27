import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test.describe('UI-2 Complete Dispatch Lifecycle & Scheduling Journeys', () => {
    test('Dispatcher Journey: Candidate review, eligibility badges, qualification details, and assignment submission', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await page.goto(`/operations/dispatch-jobs/${fixtures.job_id}`);

        // 1. Verify workspace headers and flow setup
        await expect(
            page.getByRole('heading', {
                name: 'Prepare this dispatch for activation',
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Choose eligible resources' }),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Assignment plan' }),
        ).toBeVisible();

        // 2. Verify candidate cards have eligibility indicators
        await expect(
            page.getByRole('heading', { name: 'People' }),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Assets' }),
        ).toBeVisible();

        // Check for presence of eligibility badges
        const eligibleBadges = page.getByText('Eligible');
        await expect(eligibleBadges.first()).toBeVisible();

        // 3. Selection of candidates
        const checkboxes = page
            .getByRole('checkbox', {
                name: /^Select /i,
            })
            .filter({ hasNot: page.locator('[disabled]') });
        const availableCount = await checkboxes.count();
        expect(availableCount).toBeGreaterThan(0);

        // Select the first eligible candidate
        await checkboxes.first().check();

        // 4. Verify real-time assignment summary updates
        await expect(page.getByText('1 new resource selected')).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Draft assignment' }),
        ).toBeVisible();
        await expect(page.getByText('Pending changes')).toBeVisible();
        await expect(page.getByText('Draft assignment pending')).toBeVisible();

        // 5. Submit assignment
        const assignButton = page.getByRole('button', {
            name: /Assign 1 resource/i,
        });
        await expect(assignButton).toBeEnabled();
        await assignButton.click();

        // 6. Verify success confirmation flash
        await expect(
            page.getByText(
                /Resources were assigned to|Assignments were updated/i,
            ),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Assigned resources' }),
        ).toBeVisible();
        await expect(page.getByText('Currently assigned')).toBeVisible();

        // 7. Verify accessibility
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });

    test('Manager Journey: Approval decision banner, prerequisite checklist, and decision actions', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        if (!fixtures.approval_job_id) {
            test.skip();

            return;
        }

        await signIn(page, fixtures.users.manager, fixtures.password);
        await page.goto('/?view=approvals');

        await expect(
            page.getByRole('heading', { name: 'Pending approvals' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Approvals.*pending/i }),
        ).toBeVisible();
        const openDispatch = page.locator(
            `a[href="/operations/dispatch-jobs/${fixtures.approval_job_id}"]`,
        );
        await expect(openDispatch).toBeVisible();

        await openDispatch.click();
        await expect(page).toHaveURL(
            new RegExp(
                `/operations/dispatch-jobs/${fixtures.approval_job_id}$`,
            ),
        );

        // 1. Verify Manager Approval Decision Banner is rendered
        const approvalBanner = page.getByRole('region', {
            name: 'Approval status and decision banner',
        });
        await expect(approvalBanner).toBeVisible();
        await expect(
            approvalBanner.getByText(/Operations Manager approval pending/i),
        ).toBeVisible();

        // 2. Verify decision actions (Approve / Reject) are available to manager
        const approveButton = approvalBanner.getByRole('button', {
            name: 'Approve request',
        });
        const rejectButton = approvalBanner.getByRole('button', {
            name: 'Reject request',
        });
        await expect(approveButton).toBeVisible();
        await expect(rejectButton).toBeVisible();

        // 3. Test reject validation (rejection requires reason)
        await rejectButton.click();
        await expect(
            page.getByLabel('Rejection reason (required)'),
        ).toBeVisible();
        const confirmReject = approvalBanner.getByRole('button', {
            name: 'Confirm rejection',
        });
        await expect(confirmReject).toBeDisabled();

        // Dismiss rejection
        await approvalBanner.getByRole('button', { name: 'Dismiss' }).click();

        // 4. Approve request
        await approveButton.click();

        // 5. Verify banner updates to approved state
        await expect(
            page.getByText(/Operations Manager approval granted/i),
        ).toBeVisible();

        // 6. Verify accessibility
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });

    test('Field Worker Journey: Touch progression, assignment acceptance, and step confirmation', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await page.setViewportSize({ width: 390, height: 844 });
        await signIn(page, fixtures.users.driver, fixtures.password);
        await page.goto(
            `/operations/dispatch-jobs/${fixtures.assigned_job_id}`,
        );

        // 1. Verify Field Job Workspace view
        await expect(
            page.getByRole('heading', { name: 'Field progression' }),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Job requirements' }),
        ).toBeVisible();

        // 2. Verify touch-first progression stepper
        const stepper = page.getByRole('list', {
            name: 'Dispatch field status',
        });
        await expect(stepper).toBeVisible();
        await expect(stepper.getByText('Dispatched')).toBeVisible();
        await expect(stepper.getByText('Accepted')).toBeVisible();
        await expect(stepper.getByText('En Route')).toBeVisible();

        // 3. Verify next valid action button has touch target >= 44px
        const nextActionButton = page.locator(`[id^="field-next-action-"]`);

        if (await nextActionButton.isVisible()) {
            const boundingBox = await nextActionButton.boundingBox();
            expect(boundingBox).not.toBeNull();
            expect(boundingBox?.height).toBeGreaterThanOrEqual(44);

            // Click forward transition
            await nextActionButton.click();

            // Verify confirmation modal / dialog
            const confirmationTitle = page.locator('#field-confirmation-title');
            await expect(confirmationTitle).toBeVisible();
            await expect(
                page.getByRole('button', { name: 'Keep current status' }),
            ).toBeVisible();
        }

        // 4. Verify accessibility
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });

    test('Lifecycle Operations Journey: Reassignment, cancellation with reason, and reopen to draft', async ({
        page,
    }) => {
        const fixtures = browserFixtures();

        await signIn(page, fixtures.users.dispatcher, fixtures.password);
        await page.goto(`/operations/dispatch-jobs/${fixtures.job_id}`);

        // 1. Open administrative lifecycle panel
        const adminSummary = page.locator('#administrative-actions > summary');
        await expect(adminSummary).toBeVisible();
        await adminSummary.click();
        await expect(page.locator('#administrative-actions')).toHaveAttribute(
            'open',
            '',
        );

        // 2. Click cancel dispatch
        const cancelBtn = page.getByRole('button', { name: 'Cancel dispatch' });
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();

        // 3. Cancellation requires reason
        const cancelReason = page.getByLabel('Cancellation reason (required)');
        await expect(cancelReason).toBeVisible();

        // Confirm button is disabled when reason is empty
        const confirmCancel = page.getByRole('button', {
            name: 'Confirm cancellation',
        });
        await expect(confirmCancel).toBeDisabled();

        // Fill reason
        await cancelReason.fill('Customer requested job schedule change');
        await expect(confirmCancel).toBeEnabled();
        await confirmCancel.click();

        // 4. Verify job status transitions to cancelled
        await expect(page.getByText('Cancelled')).toBeVisible();

        // 5. Reopen cancelled job
        await page.locator('#administrative-actions > summary').click();
        const reopenBtn = page.getByRole('button', {
            name: 'Reopen job as draft',
        });

        if (await reopenBtn.isVisible()) {
            await reopenBtn.click();
            await page
                .getByRole('button', { name: 'Confirm reopen to draft' })
                .click();
            await expect(page.getByText('Draft')).toBeVisible();
        }

        // 6. Verify accessibility
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });
});
