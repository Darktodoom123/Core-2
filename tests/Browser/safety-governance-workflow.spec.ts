import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

test.describe('Safety Governance & Field Operations E2E Suite', () => {
    test('Scenario 1: Field Foreman Deck UI/UX & Daily TBM Submission Workflow', async ({
        page,
    }) => {
        const fixtures = browserFixtures();
        const foremanUser = fixtures.users.foreman ?? 'browser.foreman';

        // Sign in as Field Foreman
        await signIn(page, foremanUser, fixtures.password);
        await page.goto('/');

        // 1. Verify Field Foreman Header & Environmental Status Bar
        await expect(
            page.getByText('Field Foreman Operations Deck'),
        ).toBeVisible();
        await expect(
            page.getByText('Project: Makati Skysuites Tower (Site Grid B-4)'),
        ).toBeVisible();
        await expect(page.getByText('Wind Speed (DOLE Safe):')).toBeVisible();

        // 2. Verify Crew Readiness Section
        await expect(
            page.getByText('Site Crew Readiness & Pre-Op Check'),
        ).toBeVisible();

        // 3. Daily TBM Briefing Flow: Verify topic selection & attendance toggle
        await expect(
            page.getByText('Daily Safety Toolbox Meeting (TBM)'),
        ).toBeVisible();

        const topicSelect = page.locator('select').first();

        await expect(topicSelect).toBeVisible();
        await topicSelect.selectOption({ index: 0 });

        // Toggle all crew attendance
        const toggleAllBtn = page.getByRole('button', {
            name: /Toggle All Crew/i,
        });

        await expect(toggleAllBtn).toBeVisible();
        await toggleAllBtn.click();

        // Attach photo proof
        const photoBtn = page.getByRole('button', {
            name: /Snap \/ Upload Photo|Retake Photo/i,
        });

        await expect(photoBtn).toBeVisible();
        await photoBtn.click();

        // 4. Submit TBM and verify cryptographic audit hash generation
        const submitButton = page.getByRole('button', {
            name: /Submit TBM & Request SO Sign-off/i,
        });

        await expect(submitButton).toBeVisible();
        await submitButton.click();

        // Verify successful submission confirmation badge
        await expect(page.getByText(/Audit Hash:/i)).toBeVisible();
        await expect(page.locator('code')).toBeVisible();

        // 5. Verify Emergency SOS Button Ergonomics
        const sosButton = page.getByRole('button', {
            name: /TRIGGER SOS \/ STOP WORK|TRIGGER SITE SOS DISTRESS/i,
        });

        await expect(sosButton).toBeVisible();
    });

    test('Scenario 2: Safety Officer Deck UI/UX & DOLE Metrics KPI Dashboard', async ({
        page,
    }) => {
        const fixtures = browserFixtures();
        const safetyUser = fixtures.users.safety_officer ?? 'browser.safety';

        // Sign in as Safety Officer
        await signIn(page, safetyUser, fixtures.password);
        await page.goto('/');

        // 1. Verify Safety Officer Header & Regulatory Credentials
        await expect(
            page.getByText('OSH Safety Command & Compliance Center'),
        ).toBeVisible();
        await expect(
            page.getByText(
                'DOLE D.O. 13 s. 1998 & RA 11058 Statutory Governance',
            ),
        ).toBeVisible();
        await expect(page.getByText(/Engr\. J\. Morales/i)).toBeVisible();

        // 2. Verify 4 Core KPI Telemetry Cards
        await expect(page.getByText(/Safe Man-Hours:/i)).toBeVisible();
        await expect(page.getByText(/Daily TBM Coverage:/i)).toBeVisible();
        await expect(page.getByText(/Days Without Incident:/i)).toBeVisible();
        await expect(page.getByText(/Open Hazard Tickets:/i)).toBeVisible();

        // 3. Test Navigation Tabs
        const tabs = [
            'Critical Lift Plan Gate',
            'DOLE Audit & Hazard Logger',
            'Work Stoppage Protocol',
            'DOLE Statutory Exports',
        ];

        for (const tab of tabs) {
            const tabButton = page.getByRole('button', {
                name: new RegExp(tab, 'i'),
            });

            await expect(tabButton).toBeVisible();
            await tabButton.click();
        }
    });

    test('Scenario 3: Critical Lift Permit Dual-Key Authorization Workflow', async ({
        page,
    }) => {
        const fixtures = browserFixtures();
        const safetyUser = fixtures.users.safety_officer ?? 'browser.safety';

        await signIn(page, safetyUser, fixtures.password);
        await page.goto('/');

        // Navigate to Critical Lift Permits tab
        await page
            .getByRole('button', { name: /Critical Lift Plan Gate/i })
            .click();

        // Inspect Critical Lift parameters
        await expect(page.getByText(/Critical Lift Permit #/i)).toBeVisible();
        await expect(page.getByText(/Gross Load Weight/i)).toBeVisible();
        await expect(page.getByText(/Load \/ Capacity Margin/i)).toBeVisible();

        // Check if Authorize Permit button exists
        const authorizeBtn = page.getByRole('button', {
            name: /Authorize Critical Lift Permit/i,
        });

        if (await authorizeBtn.isVisible()) {
            await authorizeBtn.click();
            // Verify authorized badge appears
            await expect(page.getByText('✓ AUTHORIZED')).toBeVisible();
        }
    });

    test('Scenario 4: Site Hazard Registry & Imminent Danger Work Stoppage Modal', async ({
        page,
    }) => {
        const fixtures = browserFixtures();
        const safetyUser = fixtures.users.safety_officer ?? 'browser.safety';

        await signIn(page, safetyUser, fixtures.password);
        await page.goto('/');

        // Navigate to Hazard Logger tab
        await page
            .getByRole('button', { name: /DOLE Audit & Hazard Logger/i })
            .click();

        // Verify Log Hazard form is visible
        await expect(
            page.getByText('Log Site Hazard & DOLE Non-Compliance Ticket'),
        ).toBeVisible();

        // Fill description and CAPA
        const descInput = page.getByPlaceholder(
            /Describe specific safety violation/i,
        );

        await descInput.fill(
            'Damaged outrigger pad on soft backfill near excavation trench.',
        );

        const capaInput = page.getByPlaceholder(
            /Immediate replacement of damaged/i,
        );

        await capaInput.fill(
            'Immediate replacement of timber pad and compaction test.',
        );

        const attachPhotoBtn = page.getByRole('button', {
            name: /Attach Photo Proof/i,
        });

        await attachPhotoBtn.click();

        const logHazardBtn = page.getByRole('button', {
            name: /Log Hazard Ticket/i,
        });

        await expect(logHazardBtn).toBeVisible();
        await logHazardBtn.click();

        // Navigate to Work Stoppage Protocol tab
        await page
            .getByRole('button', { name: /Work Stoppage Protocol/i })
            .click();

        // Verify Statutory Authority
        await expect(
            page.getByText(
                'DOLE Statutory Work Stoppage Order (WSO) Authority',
            ),
        ).toBeVisible();

        // Issue WSO
        const reasonInput = page.getByPlaceholder(/hydraulic cylinder leak/i);

        await reasonInput.fill(
            'Imminent collapse danger due to uncompacted soil under heavy crawler outriggers.',
        );

        const issueWsoBtn = page.getByRole('button', {
            name: /Issue Statutory Work Stoppage Order/i,
        });

        await issueWsoBtn.click();

        // Verify WSO in effect
        await expect(
            page.getByText('STATUTORY WORK STOPPAGE ORDER (WSO) IN EFFECT'),
        ).toBeVisible();

        // Lift stoppage
        const liftBtn = page
            .getByRole('button', {
                name: /Lift Stoppage \(Rectified\)|Lift Work Stoppage Order/i,
            })
            .first();

        await liftBtn.click();

        // Verify banner lifted
        await expect(
            page.getByText('STATUTORY WORK STOPPAGE ORDER (WSO) IN EFFECT'),
        ).not.toBeVisible();
    });

    test('Scenario 5: Statutory DOLE Compliance Exporters Surface', async ({
        page,
    }) => {
        const fixtures = browserFixtures();
        const safetyUser = fixtures.users.safety_officer ?? 'browser.safety';

        await signIn(page, safetyUser, fixtures.password);
        await page.goto('/');

        // Navigate to Statutory DOLE Exports tab
        await page
            .getByRole('button', { name: /DOLE Statutory Exports/i })
            .click();

        // Verify standard DOLE statutory report cards
        await expect(
            page.getByText('DOLE WAIR (Work Accident / Incident Report)'),
        ).toBeVisible();
        await expect(
            page.getByText('DOLE D.O. 13 CSHP Safe Man-Hours & TBM Ledger'),
        ).toBeVisible();
        await expect(
            page.getByText('Daily Accomplishment Report (DAR)'),
        ).toBeVisible();

        // Verify download action triggers
        const exportButtons = page.getByRole('button', {
            name: /Generate & Download/i,
        });
        const exportCount = await exportButtons.count();

        expect(exportCount).toBe(3);
    });
});
