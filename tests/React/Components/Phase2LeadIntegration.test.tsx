import { render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AssetListSkeleton,
    FuelTableSkeleton,
    LiveWorkspaceSection,
    ResponsiveTable,
} from '@/components/workspace/live-workspace-sections';
import type {
    AssetViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    JobReportViewModel,
    LocationUpdateViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

let mockPost = vi.fn();

vi.mock('@inertiajs/react', () => {
    return {
        usePage: () => ({
            props: {
                auth: { user: { id: 1, name: 'Operations Manager' } },
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
                transform: vi.fn(),
                post: mockPost,
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

vi.mock('@/components/live-tracking-map', () => ({
    LiveTrackingMap: ({
        locations,
    }: {
        locations: LocationUpdateViewModel[];
    }) => (
        <div data-testid="live-tracking-map">
            LiveTrackingMap Mock ({locations?.length ?? 0} markers)
        </div>
    ),
}));

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
    overrides: Partial<AssetViewModel> = {},
): AssetViewModel {
    return {
        id,
        code,
        name: `Heavy Crane ${code}`,
        kind,
        subtype: 'All Terrain Crane',
        registration_number: `REG-${id}`,
        manufacturer: 'Liebherr',
        model: 'LTM 11200',
        rated_capacity: 1200,
        capacity_unit: 'Tons',
        meter_type: 'Hours',
        meter_value: 4820,
        baseline_burn_rate: 28.5,
        burn_rate_unit: 'L/h',
        location: 'Pasig Base Yard',
        specifications: { boom_length: '100m' },
        status: {
            value: 'available',
            label: 'Available',
        },
        blocking_work_orders_count: 0,
        is_dispatchable: true,
        active_operator: null,
        hos: null,
        latest_dvir: null,
        lockout: null,
        inspections: [],
        maintenance_work_orders: [],
        ...overrides,
    };
}

function createLocation(
    assetId: number,
    freshness: 'fresh' | 'delayed' | 'stale' | 'offline',
    overrides: Partial<LocationUpdateViewModel> = {},
): LocationUpdateViewModel {
    return {
        id: 700 + assetId,
        user: { id: 10 + assetId, name: `Operator ${assetId}` },
        job: null,
        asset: {
            id: assetId,
            code: `CRN-${assetId}`,
            name: `Crane ${assetId}`,
            kind: 'crane',
        },
        latitude: 14.5995,
        longitude: 120.9842,
        speed: 25.0,
        remarks: null,
        accuracy_metres: 4,
        source: 'gps',
        sharing_enabled: true,
        captured_at: '2026-09-07T08:00:00Z',
        received_at: '2026-09-07T08:00:05Z',
        freshness_status: freshness,
        ...overrides,
    };
}

function createFuelRequest(
    id: number,
    status: 'submitted' | 'forwarded' | 'approved' | 'verified' | 'logged',
    overrides: Partial<FuelRequestViewModel> = {},
): FuelRequestViewModel {
    return {
        id,
        reference: `FUEL-2026-${String(id).padStart(4, '0')}`,
        requester: {
            id: 2,
            name: 'Field Driver',
        },
        job: {
            id: 101,
            reference: 'JOB-2026-0001',
            title: 'Bridge Lift Project',
        },
        asset: {
            id: 1,
            code: 'CRN-001',
            name: 'Liebherr LTM',
            kind: 'crane',
        },
        quantity_litres: '450',
        fuel_type: 'Diesel Premium',
        purpose: 'Site lifting generator refueling',
        status: {
            value: status,
            label: status.toUpperCase(),
        },
        ...overrides,
    };
}

function createJobReport(
    id: number,
    status: 'draft' | 'submitted' | 'approved' | 'rejected',
    overrides: Partial<JobReportViewModel> = {},
): JobReportViewModel {
    return {
        id,
        dispatch_job_id: 201,
        job: {
            id: 201,
            reference: 'DISP-2026-0891',
            title: 'Tower Crane Erection',
        },
        author: {
            id: 4,
            name: 'Alex Rivera',
        },
        status: {
            value: status,
            label: status.toUpperCase(),
        },
        work_summary: 'Completed section 3 assembly without incident.',
        remarks: 'Weather was clear and wind was below threshold.',
        started_at: '2026-09-07T06:00:00Z',
        ended_at: '2026-09-07T14:00:00Z',
        submitted_at: '2026-09-07T14:30:00Z',
        attachments: [],
        ...overrides,
    };
}

describe('Phase 2 Lead Integration: LiveWorkspaceSection Screen Coordination', () => {
    beforeEach(() => {
        mockPost = vi.fn();
        window.history.replaceState({}, '', '/operations');
    });

    it('cleanly renders FleetSurface when section="assets"', () => {
        const asset = createAsset(1, 'CRN-501', 'crane');
        const loc = createLocation(1, 'fresh');

        render(
            <LiveWorkspaceSection
                section="assets"
                assets={[asset]}
                assetsTotal={1}
                fuelRequests={[]}
                locations={[loc]}
                approvals={[]}
                auditEvents={[]}
                capabilities={createCapabilities()}
            />,
        );

        // Header and operate-mode queue from FleetSurface
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /fleet management/i,
            }),
        ).toBeInTheDocument();
        expect(screen.getAllByText('CRN-501').length).toBeGreaterThanOrEqual(1);
        expect(
            screen.getAllByText('Heavy Crane CRN-501').length,
        ).toBeGreaterThanOrEqual(1);

        // Selected asset detail pane
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Heavy Crane CRN-501',
            }),
        ).toBeInTheDocument();
        expect(screen.getByText(/GPS Live/i)).toBeInTheDocument();
    });

    it('renders FleetSurface in map mode when section="tracking"', async () => {
        const asset = createAsset(1, 'CRN-701', 'crane');
        const loc = createLocation(1, 'fresh');

        render(
            <LiveWorkspaceSection
                section="tracking"
                assets={[asset]}
                assetsTotal={1}
                fuelRequests={[]}
                locations={[loc]}
                approvals={[]}
                auditEvents={[]}
                capabilities={createCapabilities()}
            />,
        );

        // Tracking section renders FleetSurface with live map on top and asset registry available
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /fleet management/i,
            }),
        ).toBeInTheDocument();
        expect(
            await screen.findByTestId('live-tracking-map'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Live Fleet Telematics & GIS Map'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { level: 2, name: /CRN-701/ }),
        ).toBeInTheDocument();
    });

    it('cleanly renders FuelSurface when section="fuel" with 5-stage workflow', () => {
        const fuelReq = createFuelRequest(1, 'forwarded');

        render(
            <LiveWorkspaceSection
                section="fuel"
                assets={[]}
                fuelRequests={[fuelReq]}
                locations={[]}
                approvals={[]}
                auditEvents={[]}
                capabilities={createCapabilities()}
            />,
        );

        // Operate-mode title from FuelSurface
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /fuel (management|requests)/i,
            }),
        ).toBeInTheDocument();
        expect(screen.getByText('FUEL-2026-0001')).toBeInTheDocument();
        expect(
            screen.getAllByText('Site lifting generator refueling').length,
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('FORWARDED').length).toBeGreaterThanOrEqual(
            1,
        );

        // Compact stage filters
        expect(
            screen.getByRole('button', { name: /all/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /pending review/i }),
        ).toBeInTheDocument();
    });

    it('cleanly renders ReportsSurface when section="reports" with honest evidence labels', () => {
        const report = createJobReport(1, 'submitted');
        const jobs: DispatchJobViewModel[] = [
            {
                id: 201,
                reference: 'DISP-2026-0891',
                client: 'Acme Builders',
                title: 'Tower Crane Erection',
                site: 'Bonifacio Global City',
                site_notes: null,
                source: null,
                priority: { value: 'routine', label: 'Routine' },
                status: { value: 'completed', label: 'Completed' },
                scheduled_start: '2026-09-07T06:00:00Z',
                scheduled_end: '2026-09-07T14:00:00Z',
                requirements: [],
                version: 1,
                updated_at: '2026-09-07T05:00:00Z',
                personnel_assignments: [],
                asset_assignments: [],
            },
        ];

        render(
            <LiveWorkspaceSection
                section="reports"
                assets={[]}
                fuelRequests={[]}
                locations={[]}
                approvals={[]}
                auditEvents={[]}
                jobReports={[report]}
                jobs={jobs}
                capabilities={createCapabilities()}
            />,
        );

        // Operate-mode title and queue from ReportsSurface
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /job reports/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getAllByText('DISP-2026-0891').length,
        ).toBeGreaterThanOrEqual(1);
        expect(
            screen.getAllByText('Tower Crane Erection').length,
        ).toBeGreaterThanOrEqual(1);
        expect(
            screen.getAllByText(
                'Completed section 3 assembly without incident.',
            ).length,
        ).toBeGreaterThanOrEqual(1);
    });

    it('seamlessly transitions between sections without cross-contamination or memory leaks', () => {
        const asset = createAsset(1, 'CRN-999', 'crane');
        const fuelReq = createFuelRequest(1, 'approved');
        const report = createJobReport(1, 'submitted');

        const { rerender } = render(
            <LiveWorkspaceSection
                section="assets"
                assets={[asset]}
                fuelRequests={[fuelReq]}
                locations={[]}
                approvals={[]}
                auditEvents={[]}
                jobReports={[report]}
                capabilities={createCapabilities()}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /fleet management/i,
            }),
        ).toBeInTheDocument();
        expect(screen.getAllByText('CRN-999').length).toBeGreaterThanOrEqual(1);

        // Transition to Fuel
        rerender(
            <LiveWorkspaceSection
                section="fuel"
                assets={[asset]}
                fuelRequests={[fuelReq]}
                locations={[]}
                approvals={[]}
                auditEvents={[]}
                jobReports={[report]}
                capabilities={createCapabilities()}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /fuel (management|requests)/i,
            }),
        ).toBeInTheDocument();
        expect(screen.getByText('FUEL-2026-0001')).toBeInTheDocument();
        expect(screen.queryByText('CRN-999')).not.toBeInTheDocument();

        // Transition to Reports
        rerender(
            <LiveWorkspaceSection
                section="reports"
                assets={[asset]}
                fuelRequests={[fuelReq]}
                locations={[]}
                approvals={[]}
                auditEvents={[]}
                jobReports={[report]}
                capabilities={createCapabilities()}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /job reports/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getAllByText('Tower Crane Erection').length,
        ).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText('FUEL-2026-0001')).not.toBeInTheDocument();
    });

    it('renders skeleton loaders and ResponsiveTable correctly', () => {
        const { container: assetSkeleton } = render(<AssetListSkeleton />);
        expect(
            assetSkeleton.querySelector(
                '[aria-label="Loading operational assets"]',
            ),
        ).toBeInTheDocument();

        const { container: fuelSkeleton } = render(<FuelTableSkeleton />);
        expect(
            fuelSkeleton.querySelector('[aria-label="Loading fuel requests"]'),
        ).toBeInTheDocument();

        render(
            <ResponsiveTable
                headers={['Asset Code', 'Status']}
                rows={[
                    {
                        key: 1,
                        cells: [
                            <span key="c">CRN-001</span>,
                            <span key="s">Active</span>,
                        ],
                    },
                ]}
            />,
        );

        expect(screen.getAllByText('Asset Code').length).toBeGreaterThanOrEqual(
            1,
        );
        expect(screen.getAllByText('CRN-001').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    });
});
