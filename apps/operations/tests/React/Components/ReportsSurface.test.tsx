import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import type {
    AttachmentViewModel,
    DispatchJobViewModel,
    JobReportViewModel,
    ReportExportViewModel,
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
                        setDataState((prev: any) => ({
                            ...prev,
                            [keyOrFn]: val,
                        }));
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
                transform: vi.fn(),
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
        ended_at: '2026-09-01T14:30:00Z',
        submitted_at: '2026-09-01T15:00:00Z',
        ending_meter_value: 4520,
        meter_type: 'engine_hours',
        latitude: 14.5995,
        longitude: 120.9842,
        signer_name: 'Engr. Roberto Silva',
        signer_role: 'Site General Contractor',
        signed_at: '2026-09-01T14:45:00Z',
        delay_logs: [],
        attachments: [],
        cross_references: {},
        ...overrides,
    };
}

describe('ReportsSurface Phase 2 Modernization & Truthfulness Suite', () => {
    beforeEach(() => {
        mockPageErrors = {};
        window.history.replaceState({}, '', '/operations');
        vi.clearAllMocks();
    });

    describe('1. Operate-Mode Review Queue & Filter Modernization', () => {
        it('renders calm Operate-mode header and removes marketing 4-card KPI strip in favor of counted status filters', () => {
            const reports: JobReportViewModel[] = [
                createReport(1, 'submitted', 'Erection of tower crane mast'),
                createReport(2, 'approved', 'Precast wall placement'),
                createReport(3, 'rejected', 'Steel beam tandem lift'),
                createReport(4, 'draft', 'Draft inspection notes'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Title is calm "Job reports" (not marketing "Job reports & field verification")
            expect(
                screen.getByRole('heading', { level: 1, name: 'Job reports' }),
            ).toBeInTheDocument();

            // 4-card KPI template is eliminated; replaced with dense scope summary strip
            expect(
                screen.getByLabelText('Loaded reports scope summary'),
            ).toBeInTheDocument();
            expect(
                screen.getByText('Showing 4 of 4 loaded'),
            ).toBeInTheDocument();

            // Counted status filters are present and display exact counts
            expect(
                screen.getByRole('button', { name: /all reports \(4\)/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /draft reports \(1\)/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /pending.*\(1\)/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /approved reports \(1\)/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', {
                    name: /needs rework reports \(1\)/i,
                }),
            ).toBeInTheDocument();
        });

        it('omits Drafts filter pill when there are 0 draft reports', () => {
            const reports: JobReportViewModel[] = [
                createReport(1, 'submitted', 'Erection of tower crane mast'),
                createReport(2, 'approved', 'Precast wall placement'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.queryByRole('button', { name: /draft reports/i }),
            ).not.toBeInTheDocument();
        });

        it('filters the queue list when status filter pills are clicked', () => {
            const reports: JobReportViewModel[] = [
                createReport(1, 'submitted', 'Submitted report task'),
                createReport(2, 'approved', 'Approved report task'),
                createReport(3, 'rejected', 'Rejected report task'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Click "Approved" filter
            const approvedBtn = screen.getByRole('button', {
                name: /approved reports/i,
            });
            fireEvent.click(approvedBtn);

            // Queue should only show approved report (visible in queue row and active detail pane)
            expect(
                screen.getAllByText('Approved report task').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.queryByText('Submitted report task'),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Rejected report task'),
            ).not.toBeInTheDocument();
            expect(screen.getByText('Report Queue (1)')).toBeInTheDocument();
        });

        it('supports mobile view switching with "Back to reports queue" button', () => {
            const reports: JobReportViewModel[] = [
                createReport(1, 'submitted', 'Task 1 summary'),
                createReport(2, 'submitted', 'Task 2 summary'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Click Report 2 button in queue
            const report2Btn = screen.getByRole('button', {
                name: /Task 2 summary/i,
            });
            fireEvent.click(report2Btn);

            // "Back to reports queue" button should be rendered for mobile layouts
            const backBtn = screen.getByRole('button', {
                name: /back to reports queue/i,
            });
            expect(backBtn).toBeInTheDocument();

            // Clicking back returns to queue
            fireEvent.click(backBtn);
        });
    });

    describe('2. Evidence & Fact Truthfulness', () => {
        it('labels attachments truthfully and never claims they are "verified attachments"', () => {
            const attachments: AttachmentViewModel[] = [
                {
                    id: 501,
                    kind: 'site_photo',
                    original_filename: 'crane_rigging_inspection.jpg',
                    size_bytes: 204800,
                    mime_type: 'image/jpeg',
                    checksum_sha256:
                        '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                    download_url: '/storage/attachments/501.jpg',
                },
            ];

            const reports: JobReportViewModel[] = [
                createReport(1, 'submitted', 'Crane load test completed', {
                    attachments,
                }),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Detail section says "Private Attachments (1)", NOT "verified attachments"
            expect(
                screen.getByText('Private Attachments (1)'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/verified attachments/i),
            ).not.toBeInTheDocument();

            // Checksum status is honestly labeled "SHA-256 Checksums Recorded"
            expect(
                screen.getByText('SHA-256 Checksums Recorded'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/SHA-256 Checksums Validated/i),
            ).not.toBeInTheDocument();

            // Scope strip displays "1 attachments"
            expect(screen.getByText('1 attachments')).toBeInTheDocument();
        });

        it('renders customer digital sign-off as recorded metadata, distinguishing it from office billing approval', () => {
            const reports: JobReportViewModel[] = [
                createReport(1, 'submitted', 'Excavation completed', {
                    signer_name: 'Engr. Maria Santos',
                    signer_role: 'Project Quality Inspector',
                    signed_at: '2026-09-02T16:00:00Z',
                    latitude: 14.58,
                    longitude: 121.0,
                }),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Renders recorded metadata card
            expect(
                screen.getByText('Recorded Client Sign-Off'),
            ).toBeInTheDocument();
            expect(screen.getByText('Engr. Maria Santos')).toBeInTheDocument();
            expect(
                screen.getByText('Project Quality Inspector'),
            ).toBeInTheDocument();
            expect(screen.getByText('Sign-Off Recorded')).toBeInTheDocument();
            expect(
                screen.getByText('Field receipt; distinct from office review'),
            ).toBeInTheDocument();

            // Does not claim billing readiness or unpersisted signature image
            expect(
                screen.queryByText(/signature image stored/i),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText(/ready for billing/i),
            ).not.toBeInTheDocument();
        });

        it('renders "Client Sign-Off: Not recorded" when sign-off metadata is absent', () => {
            const reports: JobReportViewModel[] = [
                createReport(1, 'submitted', 'Paving operations', {
                    signer_name: null,
                    signer_role: null,
                    signed_at: null,
                }),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.getByText('Client Sign-Off: Not recorded'),
            ).toBeInTheDocument();
            expect(
                screen.getByText(
                    /submitted from the field without recorded client sign-off metadata/i,
                ),
            ).toBeInTheDocument();
        });

        it('strictly labels work duration as "Elapsed Time", not billable/productive hours', () => {
            const reports: JobReportViewModel[] = [
                createReport(1, 'submitted', 'Column casting', {
                    started_at: '2026-09-01T08:00:00Z',
                    ended_at: '2026-09-01T14:30:00Z',
                }),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(screen.getByText('Elapsed Time:')).toBeInTheDocument();
            expect(screen.getByText('6h 30m')).toBeInTheDocument();
            expect(
                screen.queryByText(/productive hours/i),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText(/billable hours/i),
            ).not.toBeInTheDocument();
        });

        it('has search placeholder that accurately names all queried backend fields', () => {
            render(
                <ReportsSurface
                    reports={[]}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            const searchInput = screen.getByPlaceholderText(
                'Search by job reference, title, author, or report text…',
            );
            expect(searchInput).toBeInTheDocument();
        });
    });

    describe('3. Record-Level State Isolation & Zombie Prevention', () => {
        it('isolates review notes per report with fresh mounting via key={selectedReport.id}', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Job 101 execution summary'),
                createReport(102, 'submitted', 'Job 102 execution summary'),
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
            const reasonInput = screen.getByPlaceholderText(
                /review decision notes, quality checks, or rejection reason/i,
            ) as HTMLInputElement;
            expect(reasonInput.value).toBe('');

            // Type note for 101
            fireEvent.change(reasonInput, {
                target: { value: 'Missing crane log sheet' },
            });
            expect(reasonInput.value).toBe('Missing crane log sheet');

            // Switch to Report 102
            fireEvent.click(
                screen.getByRole('button', {
                    name: /Job 102 execution summary/i,
                }),
            );

            // Report 102 must have a clean, isolated empty note input
            const reasonInputReport102 = screen.getByPlaceholderText(
                /review decision notes, quality checks, or rejection reason/i,
            ) as HTMLInputElement;
            expect(reasonInputReport102.value).toBe('');
            expect(reasonInputReport102.value).not.toContain(
                'Missing crane log sheet',
            );
        });

        it('clears rejection validation error immediately upon switching reports', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Job 101 execution summary'),
                createReport(102, 'submitted', 'Job 102 execution summary'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Reject without reason triggers client error
            fireEvent.click(
                screen.getByRole('button', { name: /reject report/i }),
            );
            expect(
                screen.getByText(
                    'A reason is required when rejecting a report.',
                ),
            ).toBeInTheDocument();

            // Switch to Report 102 -> Error does not bleed over
            fireEvent.click(
                screen.getByRole('button', {
                    name: /Job 102 execution summary/i,
                }),
            );
            expect(
                screen.queryByText(
                    'A reason is required when rejecting a report.',
                ),
            ).not.toBeInTheDocument();
        });

        it('guarantees zero zombie detail panes when active report is filtered out', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Report 101 is pending'),
                createReport(102, 'approved', 'Report 102 is approved'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.getByRole('link', { name: 'JOB-1101' }),
            ).toBeInTheDocument();

            // Filter to Approved -> Report 101 is excluded
            fireEvent.click(
                screen.getByRole('button', { name: /approved reports/i }),
            );

            // Invariant check: Report 101 detail is immediately cleared/replaced by Report 102
            expect(
                screen.queryByRole('link', { name: 'JOB-1101' }),
            ).not.toBeInTheDocument();
            expect(
                screen.getByRole('link', { name: 'JOB-1102' }),
            ).toBeInTheDocument();
        });
    });

    describe('4. Operational Workflow Preservation', () => {
        it('opens SubmitJobReportForm when "File job report" button is clicked', () => {
            const jobs: DispatchJobViewModel[] = [
                {
                    id: 50,
                    reference: 'DISP-2026-0050',
                    title: 'Bridge Crane Lift',
                    client: 'Metro Rail Authority',
                    status: { value: 'completed', label: 'Completed' },
                } as any,
            ];

            render(
                <ReportsSurface
                    reports={[]}
                    exports={[]}
                    jobs={jobs}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.queryByText('Submit Job Completion Report'),
            ).not.toBeInTheDocument();

            const fileReportBtn = screen.getByRole('button', {
                name: /^file job report$/i,
            });
            fireEvent.click(fileReportBtn);

            expect(
                screen.getByText('Submit Job Completion Report'),
            ).toBeInTheDocument();
            expect(screen.getByText(/Bridge Crane Lift/i)).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /save as draft/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByTestId('submit-job-report-btn'),
            ).toBeInTheDocument();
        });

        it('opens export modal when "Export Records" button is clicked', () => {
            const exportsList: ReportExportViewModel[] = [
                {
                    id: 1,
                    export_type: 'job_reports',
                    status: { value: 'completed', label: 'Ready' },
                    is_expired: false,
                    date_range: 'Past 30 Days',
                    download_url: '/storage/exports/1.csv',
                    row_count: 50,
                    file_size_bytes: 1024,
                    created_at: '2026-09-01T10:00:00Z',
                    expires_at: '2026-09-08T10:00:00Z',
                } as any,
            ];

            render(
                <ReportsSurface
                    reports={[]}
                    exports={exportsList}
                    jobs={[]}
                    capabilities={createCapabilities({ export_reports: true })}
                />,
            );

            const exportBtn = screen.getByRole('button', {
                name: /export records/i,
            });
            fireEvent.click(exportBtn);

            expect(
                screen.getByText('Export Operational Records'),
            ).toBeInTheDocument();
        });

        it('does not open the submit report drawer when review rejection validation fails', () => {
            const reports: JobReportViewModel[] = [
                createReport(101, 'submitted', 'Single report under review'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Attempt to reject with empty reason
            fireEvent.click(
                screen.getByRole('button', { name: /reject report/i }),
            );

            // Review rejection error is present in review section
            expect(
                screen.getByText(
                    'A reason is required when rejecting a report.',
                ),
            ).toBeInTheDocument();

            // Submit form drawer MUST NOT open
            expect(
                screen.queryByText('Submit Job Completion Report'),
            ).not.toBeInTheDocument();
        });
    });
});
