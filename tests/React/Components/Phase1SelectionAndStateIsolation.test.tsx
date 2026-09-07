import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveWorkspaceSection } from '@/components/workspace/live-workspace-sections';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import type {
    AssetViewModel,
    JobReportViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

let mockPageErrors: Record<string, string> = {};

vi.mock('@inertiajs/react', () => {
    return {
        usePage: () => ({
            props: {
                auth: { user: { id: 1, name: 'Operations Manager' } },
                flash: {},
                errors: mockPageErrors,
            },
            url: window.location.pathname + window.location.search,
            component: 'Operations',
            version: null,
        }),
        useForm: (initialValues: any) => {
            const [data, setDataState] = useState(initialValues);
            const [errors, setErrors] = useState<Record<string, string>>({});
            const [processing, setProcessing] = useState(false);

            return {
                data,
                setData: (keyOrFn: any, val?: any) => {
                    if (typeof keyOrFn === 'function') {
                        setDataState(keyOrFn);
                    } else if (typeof keyOrFn === 'string') {
                        setDataState((prev: any) => ({ ...prev, [keyOrFn]: val }));
                    } else {
                        setDataState(keyOrFn);
                    }
                },
                errors,
                setError: (key: string, message: string) => {
                    setErrors((prev) => ({ ...prev, [key]: message }));
                },
                clearErrors: (...keys: string[]) => {
                    if (keys.length === 0) {
                        setErrors({});
                    } else {
                        setErrors((prev) => {
                            const next = { ...prev };

                            for (const k of keys) {
                                delete next[k];
                            }

                            return next;
                        });
                    }
                },
                reset: () => {
                    setDataState(initialValues);
                    setErrors({});
                },
                processing,
                setProcessing,
                post: vi.fn(),
            };
        },
        router: {
            visit: vi.fn(),
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
            reload: vi.fn(),
            replace: vi.fn(),
        },
        Link: ({ children, href, ...props }: any) =>
            React.createElement('a', { href, ...props }, children),
        Head: ({ children }: any) =>
            React.createElement(React.Fragment, null, children),
    };
});

function createCapabilities(
    overrides: Partial<WorkspaceCapabilities> = {},
): WorkspaceCapabilities {
    return {
        create_dispatch: true,
        create_client: true,
        create_service_request: true,
        convert_service_request: true,
        create_rental_dispatch: true,
        create_sales_dispatch: true,
        share_location: true,
        view_tracking: true,
        request_fuel: true,
        forward_fuel: true,
        approve_fuel: true,
        verify_fuel: true,
        record_fuel: true,
        decide_approval: true,
        update_assigned_dispatch_status: true,
        update_asset_status: true,
        safety_lockdown_asset: true,
        inspect_asset: true,
        maintain_asset: true,
        request_gpt_assistance: false,
        decide_gpt_recommendation: false,
        retry_gpt_recommendation: false,
        create_job_report: true,
        attachment_upload: true,
        attachment_policy: {
            owner_type: 'job_report',
            max_bytes: 10485760,
            max_count: 5,
            accepted_mime_types: ['image/jpeg', 'application/pdf'],
        },
        review_job_report: true,
        export_reports: true,
        manage_notifications: true,
        view_archive: true,
        restore_dispatch: true,
        view_sos: true,
        respond_sos: true,
        ...overrides,
    };
}

function createAsset(
    id: number,
    code: string,
    kind: string,
    statusValue: 'available' | 'maintenance' | 'working' = 'available',
    overrides: Partial<AssetViewModel> = {},
): AssetViewModel {
    return {
        id,
        code,
        name: `Asset ${code}`,
        kind,
        subtype: kind === 'crane' ? 'All Terrain Crane' : 'Prime Mover',
        registration_number: `REG-${id}`,
        manufacturer: 'Liebherr',
        model: 'LTM-1100',
        rated_capacity: 100,
        capacity_unit: 'Tons',
        meter_type: 'Hours',
        meter_value: 1250,
        baseline_burn_rate: 15,
        burn_rate_unit: 'L/h',
        location: 'North Yard',
        specifications: {},
        status: {
            value: statusValue,
            label: statusValue === 'available' ? 'Available' : statusValue === 'maintenance' ? 'Maintenance' : 'Working',
        },
        blocking_work_orders_count: statusValue === 'maintenance' ? 1 : 0,
        is_dispatchable: statusValue === 'available',
        active_operator: null,
        hos: null,
        latest_dvir: null,
        lockout: null,
        inspections: [],
        maintenance_work_orders: [],
        ...overrides,
    };
}

function createReport(
    id: number,
    statusValue: 'submitted' | 'approved' | 'rejected' | 'draft',
    workSummary: string,
    overrides: Partial<JobReportViewModel> = {},
): JobReportViewModel {
    return {
        id,
        dispatch_job_id: 1000 + id,
        job: {
            id: 1000 + id,
            reference: `JOB-${1000 + id}`,
            title: `Job Title ${id}`,
        },
        author: {
            id: 200 + id,
            name: `Operator ${id}`,
        },
        status: {
            value: statusValue,
            label: statusValue.toUpperCase(),
        },
        work_summary: workSummary,
        remarks: `Remarks for ${id}`,
        started_at: '2026-09-01T08:00:00Z',
        ended_at: '2026-09-01T12:00:00Z',
        submitted_at: '2026-09-01T12:30:00Z',
        attachments: [],
        ...overrides,
    };
}

describe('Phase 1 Empirical Challenge: Selection Invariants & State Isolation', () => {
    beforeEach(() => {
        mockPageErrors = {};
        window.history.replaceState({}, '', '/operations');
    });

    describe('Invariant 1: AssetsSurface Selection and Filtering Invariant', () => {
        it('immediately updates detail pane to filtered[0] when category filter excludes the selected asset', () => {
            const assets: AssetViewModel[] = [
                createAsset(1, 'CRN-001', 'crane', 'available'),
                createAsset(2, 'TRK-002', 'truck', 'available'),
                createAsset(3, 'TRK-003', 'truck', 'available'),
            ];

            render(
                <LiveWorkspaceSection
                    section="assets"
                    assets={assets}
                    fuelRequests={[]}
                    locations={[]}
                    approvals={[]}
                    auditEvents={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Initially CRN-001 is selected (first asset)
            expect(screen.getByRole('heading', { level: 2, name: 'Asset CRN-001' })).toBeInTheDocument();

            // Filter by "Transport" (excludes CRN-001)
            const transportFilterBtn = screen.getByRole('button', { name: /transport/i });
            fireEvent.click(transportFilterBtn);

            // Invariant check: selectedAsset MUST NOT be CRN-001 (no zombie detail pane)
            expect(screen.queryByRole('heading', { level: 2, name: 'Asset CRN-001' })).not.toBeInTheDocument();

            // It MUST immediately resolve to filtered[0], which is TRK-002
            expect(screen.getByRole('heading', { level: 2, name: 'Asset TRK-002' })).toBeInTheDocument();
        });

        it('clears detail pane to EmptyState when search excludes all assets', () => {
            const assets: AssetViewModel[] = [
                createAsset(1, 'CRN-001', 'crane', 'available'),
                createAsset(2, 'TRK-002', 'truck', 'available'),
            ];

            render(
                <LiveWorkspaceSection
                    section="assets"
                    assets={assets}
                    fuelRequests={[]}
                    locations={[]}
                    approvals={[]}
                    auditEvents={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(screen.getByRole('heading', { level: 2, name: 'Asset CRN-001' })).toBeInTheDocument();

            // Search for an asset code that does not exist
            const searchInput = screen.getByPlaceholderText(/search code, name, model/i);
            fireEvent.change(searchInput, { target: { value: 'NONEXISTENT-CODE-999' } });

            // Invariant check: ZERO zombie detail panes. Must render EmptyState
            expect(screen.queryByRole('heading', { level: 2, name: /Asset CRN/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('heading', { level: 2, name: /Asset TRK/i })).not.toBeInTheDocument();
            expect(screen.getByText('Select an asset')).toBeInTheDocument();
            expect(screen.getByText(/Choose a crane or transport unit to review/i)).toBeInTheDocument();

            // Clear search restores filtered[0]
            fireEvent.change(searchInput, { target: { value: '' } });
            expect(screen.getByRole('heading', { level: 2, name: 'Asset CRN-001' })).toBeInTheDocument();
        });
    });

    describe('Invariant 2: ReportsSurface Selection and Filtering Invariant', () => {
        it('immediately updates detail pane to filtered[0] when status filter excludes the selected report', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Crane setup at North Pier Alpha'),
                createReport(102, 'approved', 'Foundation concrete pour at Beta Site'),
                createReport(103, 'approved', 'Girder placement at Gamma Site'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Initially Report 101 is selected (first report). Both list and detail show summary.
            expect(screen.getAllByText('Crane setup at North Pier Alpha')).toHaveLength(2);
            expect(screen.getByRole('link', { name: 'JOB-1101' })).toBeInTheDocument();

            // Click "Approved Reports" filter
            const approvedStatBtn = screen.getByRole('button', { name: /approved reports/i });
            fireEvent.click(approvedStatBtn);

            // Invariant check: Report 101 is submitted, so it's excluded from approved filter.
            // There MUST NOT be a zombie detail view for Report 101!
            expect(screen.queryByText('Crane setup at North Pier Alpha')).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'JOB-1101' })).not.toBeInTheDocument();

            // Detail pane MUST update immediately to filtered[0] -> Report 102
            expect(screen.getByRole('link', { name: 'JOB-1102' })).toBeInTheDocument();
            expect(screen.getAllByText('Foundation concrete pour at Beta Site')).toHaveLength(2);
        });

        it('clears detail pane to EmptyState when search query excludes all reports', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Crane setup at North Pier Alpha'),
                createReport(102, 'approved', 'Foundation concrete pour at Beta Site'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(screen.getByRole('link', { name: 'JOB-1101' })).toBeInTheDocument();

            // Type impossible search query
            const searchInput = screen.getByPlaceholderText(/search by job reference, title, author, or report text/i);
            fireEvent.change(searchInput, { target: { value: 'Z_IMPOSSIBLE_QUERY_9999' } });

            // Invariant check: Detail pane clears and renders EmptyState with no matching reports
            expect(screen.queryByRole('link', { name: 'JOB-1101' })).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'JOB-1102' })).not.toBeInTheDocument();
            expect(screen.getByText('No matching reports')).toBeInTheDocument();
            expect(screen.getByText('No job reports match the active filter or search query.')).toBeInTheDocument();

            // Restore search restores filtered[0]
            fireEvent.change(searchInput, { target: { value: '' } });
            expect(screen.getByRole('link', { name: 'JOB-1101' })).toBeInTheDocument();
        });
    });

    describe('State Isolation 1: ReportDetailPane Draft Note and Key-Based Mount', () => {
        it('guarantees Report B mounts cleanly with an empty draft note after typing a rejection note in Report A', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Crane setup at North Pier Alpha'),
                createReport(102, 'submitted', 'Foundation concrete pour at Beta Site'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Report 101 is selected
            expect(screen.getByRole('link', { name: 'JOB-1101' })).toBeInTheDocument();

            // Enter a draft rejection note for Report 101
            const reasonInput = screen.getByPlaceholderText(/review decision notes, quality checks, or rejection reason/i) as HTMLInputElement;
            expect(reasonInput.value).toBe('');
            fireEvent.change(reasonInput, {
                target: { value: 'Report 101 rejected: missing safety officer signature.' },
            });
            expect(reasonInput.value).toBe('Report 101 rejected: missing safety officer signature.');

            // Now select Report 102 from the queue
            const reportBButton = screen.getByRole('button', { name: /Foundation concrete pour at Beta Site/i });
            fireEvent.click(reportBButton);

            // Report 102 is now active in detail pane
            expect(screen.getByRole('link', { name: 'JOB-1102' })).toBeInTheDocument();

            // State Isolation check: Report B MUST have an empty draft note!
            const reasonInputReportB = screen.getByPlaceholderText(/review decision notes, quality checks, or rejection reason/i) as HTMLInputElement;
            expect(reasonInputReportB.value).toBe('');
            expect(reasonInputReportB.value).not.toContain('Report 101 rejected');

            // Entering note for Report B does not bleed back to Report A
            fireEvent.change(reasonInputReportB, {
                target: { value: 'Report 102 note: incomplete log.' },
            });
            expect(reasonInputReportB.value).toBe('Report 102 note: incomplete log.');

            // Switch back to Report A -> mounts cleanly with pristine empty input
            const reportAButton = screen.getByRole('button', { name: /Crane setup at North Pier Alpha/i });
            fireEvent.click(reportAButton);
            const reasonInputReportARemounted = screen.getByPlaceholderText(/review decision notes, quality checks, or rejection reason/i) as HTMLInputElement;
            expect(reasonInputReportARemounted.value).toBe('');
        });

        it('guarantees client-side rejection validation error is cleared when switching reports', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Crane setup at North Pier Alpha'),
                createReport(102, 'submitted', 'Foundation concrete pour at Beta Site'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Attempt to reject Report 101 with empty reason
            const rejectBtn = screen.getByRole('button', { name: /reject report/i });
            fireEvent.click(rejectBtn);

            // Client validation error should appear
            expect(screen.getByText('A reason is required when rejecting a report.')).toBeInTheDocument();

            // Switch to Report 102
            const reportBButton = screen.getByRole('button', { name: /Foundation concrete pour at Beta Site/i });
            fireEvent.click(reportBButton);

            // Error must NOT bleed over to Report 102
            expect(screen.queryByText('A reason is required when rejecting a report.')).not.toBeInTheDocument();
        });
    });

    describe('State Isolation 2: Rejection Validation Errors do NOT Pop Open Submit Modal', () => {
        it('does not open the submit report drawer when client-side rejection validation fails', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Crane setup at North Pier Alpha'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Submit modal should NOT be in the document initially
            expect(screen.queryByText('Submit Job Completion Report')).not.toBeInTheDocument();

            // Trigger rejection error
            const rejectBtn = screen.getByRole('button', { name: /reject report/i });
            fireEvent.click(rejectBtn);

            // Rejection error is present on the detail pane
            expect(screen.getByText('A reason is required when rejecting a report.')).toBeInTheDocument();

            // Invariant check: Submit modal MUST NOT pop open!
            expect(screen.queryByText('Submit Job Completion Report')).not.toBeInTheDocument();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('does not open the submit report drawer when global page errors exist', () => {
            // Simulate global page errors (e.g. returned by server on rejection error)
            mockPageErrors = {
                reason: 'The decision reason must be at least 10 characters.',
                general: 'Failed to process report review action.',
            };

            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Crane setup at North Pier Alpha'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // In the previous buggy code, Object.keys(pageErrors).length > 0 triggered showSubmitModal = true.
            // In the remediated code, pageErrors MUST NOT trigger showSubmitModal!
            expect(screen.queryByText('Submit Job Completion Report')).not.toBeInTheDocument();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });
    describe('Adversarial Stress Harness: Edge Cases & Rapid State Transitions', () => {
        it('handles dynamic prop removal of selected asset without throwing or retaining stale reference', () => {
            const initialAssets: AssetViewModel[] = [
                createAsset(1, 'CRN-001', 'crane', 'available'),
                createAsset(2, 'CRN-002', 'crane', 'available'),
                createAsset(3, 'TRK-003', 'truck', 'available'),
            ];

            const { rerender } = render(
                <LiveWorkspaceSection
                    section="assets"
                    assets={initialAssets}
                    fuelRequests={[]}
                    locations={[]}
                    approvals={[]}
                    auditEvents={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Explicitly select Asset 2 (CRN-002)
            const asset2Btn = screen.getByRole('button', { name: /Asset CRN-002/i });
            fireEvent.click(asset2Btn);
            expect(screen.getByRole('heading', { level: 2, name: 'Asset CRN-002' })).toBeInTheDocument();

            // Simulate realtime websocket update where Asset 2 is deleted / removed from array
            const updatedAssets = [
                createAsset(1, 'CRN-001', 'crane', 'available'),
                createAsset(3, 'TRK-003', 'truck', 'available'),
            ];

            rerender(
                <LiveWorkspaceSection
                    section="assets"
                    assets={updatedAssets}
                    fuelRequests={[]}
                    locations={[]}
                    approvals={[]}
                    auditEvents={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Asset 2 no longer exists. Selection invariant must gracefully fall back to filtered[0] (CRN-001)
            expect(screen.queryByRole('heading', { level: 2, name: 'Asset CRN-002' })).not.toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 2, name: 'Asset CRN-001' })).toBeInTheDocument();
        });

        it('clears rejection validation error as soon as user types into the reason input', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Crane setup at North Pier Alpha'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Attempt reject with empty reason
            const rejectBtn = screen.getByRole('button', { name: /reject report/i });
            fireEvent.click(rejectBtn);
            expect(screen.getByText('A reason is required when rejecting a report.')).toBeInTheDocument();

            // User starts typing reason
            const reasonInput = screen.getByPlaceholderText(/review decision notes, quality checks, or rejection reason/i);
            fireEvent.change(reasonInput, { target: { value: 'Incomplete' } });

            // Error must be cleared immediately
            expect(screen.queryByText('A reason is required when rejecting a report.')).not.toBeInTheDocument();
        });

        it('survives rapid cyclic switching between 4 reports with zero cross-contamination of review notes', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Task 1 summary'),
                createReport(102, 'submitted', 'Task 2 summary'),
                createReport(103, 'submitted', 'Task 3 summary'),
                createReport(104, 'submitted', 'Task 4 summary'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            const getReasonInput = () =>
                screen.getByPlaceholderText(/review decision notes, quality checks, or rejection reason/i) as HTMLInputElement;

            // Report 101 selected -> Type Note 1
            fireEvent.change(getReasonInput(), { target: { value: 'Note for 101' } });
            expect(getReasonInput().value).toBe('Note for 101');

            // Select Report 102 -> Must be empty
            fireEvent.click(screen.getByRole('button', { name: /Task 2 summary/i }));
            expect(getReasonInput().value).toBe('');
            fireEvent.change(getReasonInput(), { target: { value: 'Note for 102' } });

            // Select Report 103 -> Must be empty
            fireEvent.click(screen.getByRole('button', { name: /Task 3 summary/i }));
            expect(getReasonInput().value).toBe('');
            fireEvent.change(getReasonInput(), { target: { value: 'Note for 103' } });

            // Select Report 104 -> Must be empty
            fireEvent.click(screen.getByRole('button', { name: /Task 4 summary/i }));
            expect(getReasonInput().value).toBe('');

            // Cycle back to Report 102 -> Because component remounts via key={report.id}, it mounts fresh
            fireEvent.click(screen.getByRole('button', { name: /Task 2 summary/i }));
            expect(getReasonInput().value).toBe('');
        });

        it('renders graceful initial EmptyState when assets or reports collections are completely empty', () => {
            const { unmount } = render(
                <LiveWorkspaceSection
                    section="assets"
                    assets={[]}
                    fuelRequests={[]}
                    locations={[]}
                    approvals={[]}
                    auditEvents={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(screen.getByText('No assets available')).toBeInTheDocument();
            unmount();

            render(
                <ReportsSurface
                    reports={[]}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(screen.getByText('No job reports in loaded scope')).toBeInTheDocument();
        });

        it('handles combined status filter and disjoint search query without retaining zombie selections', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Pier Alpha lifting operations'),
                createReport(102, 'approved', 'Beta Site heavy rigging'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Filter status to 'submitted' -> Report 101 selected
            const pendingFilterBtn = screen.getByRole('button', { name: /pending sign-off/i });
            fireEvent.click(pendingFilterBtn);
            expect(screen.getByRole('link', { name: 'JOB-1101' })).toBeInTheDocument();

            // Search for 'Beta Site' (which belongs to Report 102, but status is approved so disjoint from submitted filter)
            const searchInput = screen.getByPlaceholderText(/search by job reference, title, author, or report text/i);
            fireEvent.change(searchInput, { target: { value: 'Beta Site' } });

            // Invariant check: ZERO matches. Detail pane must clear to empty state! No zombie Report 101!
            expect(screen.queryByRole('link', { name: 'JOB-1101' })).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'JOB-1102' })).not.toBeInTheDocument();
            expect(screen.getByText('No matching reports')).toBeInTheDocument();
        });
    });
});

