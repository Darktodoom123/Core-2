import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FleetDetailPane } from '@/components/workspace/fleet/fleet-detail-pane';
import { FleetQueue } from '@/components/workspace/fleet/fleet-queue';
import { FuelRequestCard } from '@/components/workspace/fuel/fuel-request-card';
import { FuelSurface } from '@/components/workspace/fuel/fuel-surface';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import type {
    AssetViewModel,
    FuelRequestViewModel,
    JobReportViewModel,
    LocationUpdateViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

let mockAuthUser: { id: number; name: string } | null = {
    id: 1,
    name: 'Manager Alice',
};

vi.mock('@inertiajs/react', () => {
    return {
        usePage: () => ({
            props: {
                auth: mockAuthUser ? { user: mockAuthUser } : undefined,
                flash: {},
                errors: {},
            },
            url: '/operations',
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
                clearErrors: () => setErrors({}),
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

describe('Phase 2 Factual Truth & 5-Stage Machine Challenger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthUser = { id: 1, name: 'Manager Alice' };
    });

    describe('Claim 1: GPS telemetry never claims stale coordinates as live GPS; null location renders "Location not recorded"', () => {
        const asset: AssetViewModel = {
            id: 1,
            code: 'CRN-CHALLENGE',
            name: 'Challenger Crane 100T',
            kind: 'crane',
            subtype: 'all-terrain',
            registration_number: 'REG-CHALLENGE',
            manufacturer: 'Liebherr',
            model: 'LTM-1100',
            rated_capacity: 100,
            capacity_unit: 'Tons',
            meter_type: 'Hours',
            meter_value: 2000,
            baseline_burn_rate: 18,
            burn_rate_unit: 'L/h',
            location: null, // null location!
            specifications: {},
            status: { value: 'available', label: 'Available' },
            blocking_work_orders_count: 0,
            is_dispatchable: true,
            active_operator: null,
            hos: null,
            latest_dvir: null,
            lockout: null,
            inspections: [],
            maintenance_work_orders: [],
        };

        it('never displays "Live GPS active" or "GPS Live" when telemetry is stale, even with valid coordinates', () => {
            const staleLoc: LocationUpdateViewModel = {
                id: 99,
                user: { id: 10, name: 'Driver 10' },
                job: null,
                asset: {
                    id: 1,
                    code: 'CRN-CHALLENGE',
                    name: 'Challenger Crane 100T',
                    kind: 'crane',
                },
                latitude: 14.5995,
                longitude: 120.9842,
                speed: 30,
                remarks: null,
                accuracy_metres: 5,
                source: 'gps',
                sharing_enabled: true,
                captured_at: '2026-09-06T10:00:00Z',
                received_at: '2026-09-06T10:00:05Z',
                freshness_status: 'stale',
            };

            // 1. FleetDetailPane
            const { rerender } = render(
                <FleetDetailPane
                    asset={asset}
                    assetLocation={staleLoc}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.queryByText(/Live GPS active/i),
            ).not.toBeInTheDocument();
            expect(screen.getByText('Last known location')).toBeInTheDocument();

            // 2. FleetQueue
            rerender(
                <FleetQueue
                    assets={[asset]}
                    selectedAssetId={1}
                    onSelectAsset={vi.fn()}
                    locations={[staleLoc]}
                    searchQuery=""
                    onSearchChange={vi.fn()}
                    categoryFilter="all"
                    onCategoryFilterChange={vi.fn()}
                    counts={{
                        total: 1,
                        cranes: 1,
                        trucks: 0,
                        ready: 1,
                        maintenance: 0,
                    }}
                    onClearFilters={vi.fn()}
                />,
            );

            expect(screen.queryByText(/GPS Live/i)).not.toBeInTheDocument();
            expect(screen.getByText('Last known location')).toBeInTheDocument();
        });

        it('renders "Location not recorded" (never "Base Yard") when asset location and telemetry are null', () => {
            render(
                <FleetDetailPane
                    asset={{ ...asset, location: null }}
                    assetLocation={null}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.getByText(/Location: Location not recorded/i),
            ).toBeInTheDocument();
            expect(screen.queryByText(/Base Yard/i)).not.toBeInTheDocument();
        });
    });

    describe('Claim 2: Fuel state machine strictly requires "verified" before logging; "approved" cannot log fuel', () => {
        const approvedRequest: FuelRequestViewModel = {
            id: 201,
            reference: 'FUEL-REQ-201',
            requester: { id: 5, name: 'Requester Bob' },
            job: null,
            asset: { id: 1, code: 'CRN-01' },
            quantity_litres: '250',
            fuel_type: 'diesel',
            purpose: 'Site work',
            status: { value: 'approved', label: 'Approved' },
            logs: [],
        };

        const verifiedRequest: FuelRequestViewModel = {
            ...approvedRequest,
            id: 202,
            reference: 'FUEL-REQ-202',
            status: { value: 'verified', label: 'Verified' },
        };

        it('strictly blocks "Record Fuel Log" on approved request, showing only "Verify Allocation"', () => {
            const onRecordLog = vi.fn();
            const onTransition = vi.fn();

            render(
                <FuelRequestCard
                    request={approvedRequest}
                    capabilities={createCapabilities({
                        verify_fuel: true,
                        record_fuel: true,
                    })}
                    onRecordLog={onRecordLog}
                    onTransition={onTransition}
                />,
            );

            // "Record Fuel Log" MUST NOT BE PRESENT
            expect(
                screen.queryByRole('button', { name: /record fuel log/i }),
            ).not.toBeInTheDocument();

            // "Verify Allocation" MUST BE PRESENT
            const verifyBtn = screen.getByRole('button', {
                name: /verify allocation/i,
            });
            expect(verifyBtn).toBeInTheDocument();

            fireEvent.click(verifyBtn);
            expect(onTransition).toHaveBeenCalledWith(201, 'verified');
        });

        it('enables "Record Fuel Log" ONLY when request transitions to verified', () => {
            const onRecordLog = vi.fn();

            render(
                <FuelRequestCard
                    request={verifiedRequest}
                    capabilities={createCapabilities({ record_fuel: true })}
                    onRecordLog={onRecordLog}
                    onTransition={vi.fn()}
                />,
            );

            const recordBtn = screen.getByRole('button', {
                name: /record fuel log/i,
            });
            expect(recordBtn).toBeInTheDocument();

            fireEvent.click(recordBtn);
            expect(onRecordLog).toHaveBeenCalledWith(verifiedRequest);
        });
    });

    describe('Claim 3: Self-review is strictly blocked when actor is requester', () => {
        const forwardedRequest: FuelRequestViewModel = {
            id: 301,
            reference: 'FUEL-REQ-301',
            requester: { id: 42, name: 'Self Operator' },
            job: null,
            asset: { id: 1, code: 'CRN-01' },
            quantity_litres: '180',
            fuel_type: 'diesel',
            purpose: 'Self-requested fuel',
            status: { value: 'forwarded', label: 'Forwarded' },
            logs: [],
        };

        it('disables approve and reject buttons and displays self-review forbidden warning when currentUserId === requester.id', () => {
            mockAuthUser = { id: 42, name: 'Self Operator' };

            render(
                <FuelRequestCard
                    request={forwardedRequest}
                    capabilities={createCapabilities({ approve_fuel: true })}
                    onRecordLog={vi.fn()}
                    onTransition={vi.fn()}
                    currentUserId={42}
                />,
            );

            // Open decision box
            fireEvent.click(
                screen.getByRole('button', { name: /review decision/i }),
            );

            // Self review forbidden banner
            expect(
                screen.getByText('Self-Review Forbidden'),
            ).toBeInTheDocument();
            expect(
                screen.getByText(
                    /requester cannot approve or reject their own request/i,
                ),
            ).toBeInTheDocument();

            // Both action buttons disabled
            expect(
                screen.getByRole('button', { name: /approve request/i }),
            ).toBeDisabled();
            expect(
                screen.getByRole('button', { name: /reject request/i }),
            ).toBeDisabled();
        });
    });

    describe('Claim 4: Requested vs dispensed fuel quantities are distinguished', () => {
        it('strictly distinguishes requested litres from dispensed logs and flags missing consumption data', () => {
            const requests: FuelRequestViewModel[] = [
                {
                    id: 401,
                    reference: 'REQ-401',
                    requester: { id: 1, name: 'Alice' },
                    job: null,
                    asset: null,
                    quantity_litres: '500',
                    fuel_type: 'diesel',
                    purpose: 'Mobilization',
                    status: { value: 'submitted', label: 'Submitted' },
                    logs: [],
                },
                {
                    id: 402,
                    reference: 'REQ-402',
                    requester: { id: 2, name: 'Bob' },
                    job: null,
                    asset: null,
                    quantity_litres: '300',
                    fuel_type: 'diesel',
                    purpose: 'Haul',
                    status: { value: 'logged', label: 'Logged' },
                    logs: [
                        {
                            id: 901,
                            quantity_litres: '290',
                            total_cost: '18850',
                            price_per_litre: '65.00',
                            hour_meter: null,
                            odometer_km: 12000,
                            is_anomaly: false,
                            effective_burn_rate: null, // no prior meter!
                            recorded_at: '2026-09-06T10:00:00Z',
                            recorded_by: { id: 2, name: 'Bob' },
                            receipt_path: null,
                            fuel_station: null,
                            remarks: null,
                        },
                    ],
                },
            ];

            render(
                <FuelSurface
                    requests={requests}
                    capabilities={createCapabilities()}
                    assets={[]}
                />,
            );

            // Total requested: 500 + 300 = 800
            expect(screen.getByText('Requested Litres')).toBeInTheDocument();
            expect(screen.getByText('800')).toBeInTheDocument();

            // Total dispensed: 290
            expect(screen.getByText('Dispensed Logs:')).toBeInTheDocument();
            expect(screen.getByText('290')).toBeInTheDocument();

            // Missing consumption baseline -> "Not enough data to assess consumption"
            expect(
                screen.getByText('Not enough data to assess consumption'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/All within baseline burn rate/i),
            ).not.toBeInTheDocument();
        });
    });

    describe('Claim 5 & 6: Job report attachments and work intervals truthfulness', () => {
        const report: JobReportViewModel = {
            id: 501,
            dispatch_job_id: 1501,
            job: {
                id: 1501,
                reference: 'JOB-501',
                title: 'Adversarial Report Test',
            },
            author: { id: 88, name: 'Operator Jack' },
            status: { value: 'submitted', label: 'SUBMITTED' },
            work_summary: 'Erected crane section',
            remarks: null,
            started_at: '2026-09-01T08:00:00Z',
            ended_at: '2026-09-01T14:15:00Z',
            submitted_at: '2026-09-01T15:00:00Z',
            ending_meter_value: 4500,
            meter_type: 'engine_hours',
            latitude: null,
            longitude: null,
            signer_name: null,
            signer_role: null,
            signed_at: null,
            delay_logs: [],
            attachments: [
                {
                    id: 1,
                    kind: 'site_photo',
                    original_filename: 'job_site.jpg',
                    size_bytes: 102400,
                    mime_type: 'image/jpeg',
                    checksum_sha256: 'abc123sha256',
                    download_url: '/download/1',
                },
            ],
            cross_references: {},
        };

        it('labels attachments as "attachments" / "field documentation files", never "verified attachments"', () => {
            render(
                <ReportsSurface
                    reports={[report]}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Attachment count
            expect(screen.getByText('1 attachments')).toBeInTheDocument();
            expect(
                screen.queryByText(/verified attachments/i),
            ).not.toBeInTheDocument();

            // Checksum status
            expect(
                screen.getByText('SHA-256 Checksums Recorded'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/SHA-256 Checksums Validated/i),
            ).not.toBeInTheDocument();

            // Client sign-off missing -> "Client Sign-Off: Not recorded"
            expect(
                screen.getByText('Client Sign-Off: Not recorded'),
            ).toBeInTheDocument();
        });

        it('strictly labels duration as "Elapsed Time", not billable or productive hours', () => {
            render(
                <ReportsSurface
                    reports={[report]}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(screen.getByText('Elapsed Time:')).toBeInTheDocument();
            expect(screen.getByText('6h 15m')).toBeInTheDocument();
            expect(
                screen.queryByText(/billable hours/i),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText(/productive hours/i),
            ).not.toBeInTheDocument();
        });
    });
});
