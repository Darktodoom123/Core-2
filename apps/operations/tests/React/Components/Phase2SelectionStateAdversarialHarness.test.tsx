import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FleetSurface,
    FleetTelemetrySection,
} from '@/components/workspace/fleet';
import { FuelSurface } from '@/components/workspace/fuel/fuel-surface';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import type {
    AssetViewModel,
    FuelRequestViewModel,
    JobReportViewModel,
    LocationUpdateViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

let mockPost = vi.fn();
let mockAuthUser: { id: number; name: string } | null = {
    id: 1,
    name: 'Test Manager',
};
let mockPageErrors: Record<string, string> = {};

vi.mock('@inertiajs/react', () => {
    return {
        usePage: () => ({
            props: {
                auth: mockAuthUser ? { user: mockAuthUser } : undefined,
                flash: {},
                errors: mockPageErrors,
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
            post: (...args: any[]) => mockPost(...args),
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

// Mock lazy LiveTrackingMap with a flag to simulate crashing on demand
let mapShouldThrow = false;
vi.mock('@/components/live-tracking-map', () => ({
    LiveTrackingMap: ({
        locations,
    }: {
        locations: LocationUpdateViewModel[];
    }) => {
        if (mapShouldThrow) {
            throw new Error(
                'Adversarial WebGL context lost & Leaflet tile crash',
            );
        }

        return (
            <div data-testid="live-tracking-map">
                Interactive LiveTrackingMap ({locations?.length ?? 0} markers)
            </div>
        );
    },
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
            label:
                statusValue === 'available'
                    ? 'Available'
                    : statusValue === 'maintenance'
                      ? 'Maintenance'
                      : 'Working',
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

function createLocation(
    assetId: number,
    freshness: 'fresh' | 'delayed' | 'stale' | 'offline',
    overrides: Partial<LocationUpdateViewModel> = {},
): LocationUpdateViewModel {
    return {
        id: 500 + assetId,
        user: { id: 10, name: 'Operator John' },
        asset: {
            id: assetId,
            code: `ASSET-${assetId}`,
            name: `Asset ${assetId}`,
            kind: 'crane',
        },
        job: { id: 99, reference: 'JOB-99', title: 'Port Lift Scope' },
        latitude: 14.5995,
        longitude: 120.9842,
        accuracy_metres: 5,
        speed: 45,
        remarks: null,
        source: 'field_mobile',
        sharing_enabled: true,
        freshness_status: freshness,
        captured_at: '2026-09-07T08:30:00Z',
        received_at: '2026-09-07T08:30:05Z',
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
        reference: `FUEL-${id}`,
        requester: { id: 10 + id, name: `Operator ${id}` },
        job: null,
        asset: {
            id,
            code: `CRN-${id}`,
            name: `Crane Unit ${id}`,
            kind: 'crane',
            meter_type: 'hour_meter',
            meter_value: '2500',
            baseline_burn_rate: '15.0',
            burn_rate_unit: 'L/hr',
        },
        quantity_litres: '150',
        fuel_type: 'diesel',
        purpose: `Field operation ${id}`,
        status: { value: status, label: status.toUpperCase() },
        logs: [],
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

describe('Empirical Adversarial Stress Harness: Selection Invariants & State Isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPost = vi.fn();
        mockPageErrors = {};
        mockAuthUser = { id: 1, name: 'Test Manager' };
        mapShouldThrow = false;
        window.history.replaceState({}, '', '/operations');
    });

    describe('Edge Case 1: Filtering when 0 records match results in null selection and empty state (no zombie detail pane)', () => {
        it('FleetSurface: completely clears detail pane to EmptyState on zero filter matches', () => {
            const assets = [
                createAsset(1, 'CRN-001', 'crane', 'available'),
                createAsset(2, 'TRK-002', 'truck', 'available'),
            ];

            render(
                <FleetSurface
                    assets={assets}
                    locations={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Initially CRN-001 is selected
            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).toBeInTheDocument();

            // Search query with 0 matches
            const searchInput = screen.getByPlaceholderText(
                /search code, name, model/i,
            );
            fireEvent.change(searchInput, {
                target: { value: 'ZERO_MATCH_QUERY_xyz' },
            });

            // Invariant: ZERO zombie detail pane
            expect(
                screen.queryByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole('heading', {
                    level: 2,
                    name: 'Asset TRK-002',
                }),
            ).not.toBeInTheDocument();

            // Queue and detail both show empty state
            expect(screen.getByText('No matching assets')).toBeInTheDocument();
            expect(screen.getByText('Select an asset')).toBeInTheDocument();
            expect(
                screen.getByText(/Choose a crane or transport unit to review/i),
            ).toBeInTheDocument();

            // Category filter with 0 matches (e.g. holds filter when 0 hold assets)
            fireEvent.change(searchInput, { target: { value: '' } });
            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).toBeInTheDocument();

            const holdsFilter = screen.getByRole('button', {
                name: /holds \(0\)/i,
            });
            fireEvent.click(holdsFilter);

            // Invariant: ZERO zombie detail pane on category 0-match
            expect(
                screen.queryByRole('heading', { level: 2, name: /Asset CRN/i }),
            ).not.toBeInTheDocument();
            expect(screen.getByText('Select an asset')).toBeInTheDocument();
        });

        it('FuelSurface: completely clears detail pane to EmptyState on zero search or status matches', () => {
            const requests = [
                createFuelRequest(1, 'submitted'),
                createFuelRequest(2, 'forwarded'),
            ];

            render(
                <FuelSurface
                    requests={requests}
                    capabilities={createCapabilities()}
                    assets={[]}
                />,
            );

            // Initially request 1 is selected
            expect(screen.getByText(/Ref: FUEL-1/i)).toBeInTheDocument();

            // Filter to "Logged (0)"
            const loggedBtn = screen.getByRole('button', {
                name: /logged \(0\)/i,
            });
            fireEvent.click(loggedBtn);

            // Invariant: FUEL-1 must NOT persist as a zombie!
            expect(screen.queryByText(/Ref: FUEL-1/i)).not.toBeInTheDocument();
            expect(
                screen.getByText('No matching fuel requests'),
            ).toBeInTheDocument();

            // Clear search/filter restores selection
            fireEvent.click(
                screen.getByRole('button', { name: /clear filters/i }),
            );
            expect(screen.getByText(/Ref: FUEL-1/i)).toBeInTheDocument();

            // Adversarial query that matches nothing
            const searchInput = screen.getByPlaceholderText(
                /search reference, asset/i,
            );
            fireEvent.change(searchInput, {
                target: { value: 'DOES_NOT_EXIST_9999' },
            });
            expect(screen.queryByText(/Ref: FUEL-1/i)).not.toBeInTheDocument();
            expect(
                screen.getByText('No matching fuel requests'),
            ).toBeInTheDocument();
        });

        it('ReportsSurface: completely clears detail pane to EmptyState on zero filter matches', () => {
            const reports = [
                createReport(1, 'submitted', 'Task Alpha'),
                createReport(2, 'submitted', 'Task Beta'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Initially Report 1 is active
            expect(
                screen.getByRole('link', { name: 'JOB-1001' }),
            ).toBeInTheDocument();

            // Filter to Approved (0)
            const approvedBtn = screen.getByRole('button', {
                name: /approved reports \(0\)/i,
            });
            fireEvent.click(approvedBtn);

            // Invariant: ZERO zombie detail view for Report 1
            expect(
                screen.queryByRole('link', { name: 'JOB-1001' }),
            ).not.toBeInTheDocument();
            expect(screen.getByText('No matching reports')).toBeInTheDocument();
        });
    });

    describe('Edge Case 2: Switching selected records in Job Reports resets draft notes, rejection reasons, and form validation errors', () => {
        it('clears draft rejection note and validation errors when alternating between reports', () => {
            const reports = [
                createReport(
                    10,
                    'submitted',
                    'Erection of mobile tower at Sector 7',
                ),
                createReport(
                    20,
                    'submitted',
                    'Excavation trench backfill at Sector 8',
                ),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Active is Report 10
            expect(
                screen.getByRole('link', { name: 'JOB-1010' }),
            ).toBeInTheDocument();

            const getReasonInput = () =>
                screen.getByPlaceholderText(
                    /review decision notes, quality checks, or rejection reason/i,
                ) as HTMLInputElement;

            // Attempt to reject without reason -> triggers validation error
            const rejectBtn = screen.getByRole('button', {
                name: /reject report/i,
            });
            fireEvent.click(rejectBtn);

            expect(
                screen.getByText(
                    'A reason is required when rejecting a report.',
                ),
            ).toBeInTheDocument();

            // Type a draft note in Report 10
            fireEvent.change(getReasonInput(), {
                target: { value: 'Report 10: Missing operator signoff.' },
            });
            expect(getReasonInput().value).toBe(
                'Report 10: Missing operator signoff.',
            );

            // Now switch to Report 20
            const report20Btn = screen.getByRole('button', {
                name: /Excavation trench backfill at Sector 8/i,
            });
            fireEvent.click(report20Btn);

            // Invariant: Report 20 is active, reason input is PRISTINE EMPTY, and error is GONE
            expect(
                screen.getByRole('link', { name: 'JOB-1020' }),
            ).toBeInTheDocument();
            expect(getReasonInput().value).toBe('');
            expect(
                screen.queryByText(
                    'A reason is required when rejecting a report.',
                ),
            ).not.toBeInTheDocument();

            // Type note for Report 20
            fireEvent.change(getReasonInput(), {
                target: { value: 'Report 20: Incomplete log.' },
            });
            expect(getReasonInput().value).toBe('Report 20: Incomplete log.');

            // Switch back to Report 10 -> fresh mount, input is PRISTINE EMPTY
            const report10Btn = screen.getByRole('button', {
                name: /Erection of mobile tower at Sector 7/i,
            });
            fireEvent.click(report10Btn);
            expect(
                screen.getByRole('link', { name: 'JOB-1010' }),
            ).toBeInTheDocument();
            expect(getReasonInput().value).toBe('');
            expect(
                screen.queryByText(
                    'A reason is required when rejecting a report.',
                ),
            ).not.toBeInTheDocument();
        });

        it('does not leak server validation errors or open global submit drawer when switching reports', () => {
            mockPageErrors = {
                reason: 'The decision reason must not exceed 255 characters.',
            };

            const reports = [
                createReport(1, 'submitted', 'Task 1'),
                createReport(2, 'submitted', 'Task 2'),
            ];

            render(
                <ReportsSurface
                    reports={reports}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Invariant: Global submit modal MUST NOT be opened by review errors
            expect(
                screen.queryByText('Submit Job Completion Report'),
            ).not.toBeInTheDocument();

            // Switching reports keeps submit modal closed
            fireEvent.click(screen.getByRole('button', { name: /Task 2/i }));
            expect(
                screen.queryByText('Submit Job Completion Report'),
            ).not.toBeInTheDocument();
        });
    });

    describe('Edge Case 3: Map failure caught by MapErrorBoundary allows asset queue and detail pane to remain fully interactive', () => {
        it('isolates WebGL / Leaflet runtime crash in FleetTelemetrySection without crashing', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const asset = createAsset(1, 'CRN-555', 'crane');
            const loc = createLocation(1, 'fresh');

            // Force map crash
            mapShouldThrow = true;

            render(<FleetTelemetrySection asset={asset} location={loc} />);

            // Invariant: MapErrorBoundary caught the error! (await Suspense resolution)
            expect(await screen.findByRole('alert')).toBeInTheDocument();
            expect(
                screen.getByText('Asset Map Preview Unavailable'),
            ).toBeInTheDocument();
            expect(
                screen.getByText(/Unable to render map preview for this unit/i),
            ).toBeInTheDocument();

            // CRITICAL INVARIANT: Telemetry coordinates and speed DL are intact
            expect(
                screen.getByText('Coordinates (Lat, Lng)'),
            ).toBeInTheDocument();
            expect(screen.getByText('Current Speed')).toBeInTheDocument();
            expect(
                screen.getAllByText(/45 km\/h/i).length,
            ).toBeGreaterThanOrEqual(1);

            consoleErrorSpy.mockRestore();
        });

        it('isolates map crash in top FleetMapView and allows queue, detail pane, and tabs to remain fully interactive', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const asset = createAsset(1, 'CRN-001', 'crane');
            const loc = createLocation(1, 'fresh');

            mapShouldThrow = true;

            render(
                <FleetSurface
                    assets={[asset]}
                    locations={[loc]}
                    capabilities={createCapabilities()}
                />,
            );

            // MapErrorBoundary in top FleetMapView caught the error (await Suspense resolution)
            expect(await screen.findByRole('alert')).toBeInTheDocument();
            expect(
                screen.getByText('Fleet Map Currently Unavailable'),
            ).toBeInTheDocument();

            // Invariant: Asset registry and detail pane are fully interactive
            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).toBeInTheDocument();

            // Tab switching works
            const specsTab = screen.getByRole('tab', {
                name: /overview & specs/i,
            });
            fireEvent.click(specsTab);
            expect(screen.getByText('Rated Capacity')).toBeInTheDocument();

            // Inspections tab works
            const inspectionsTab = screen.getByRole('tab', {
                name: /inspections/i,
            });
            fireEvent.click(inspectionsTab);
            expect(
                screen.getByRole('button', { name: /record new inspection/i }),
            ).toBeInTheDocument();

            // User can collapse the broken map using the toggle
            const hideMapBtn = screen.getByRole('button', {
                name: /hide map/i,
            });
            fireEvent.click(hideMapBtn);
            expect(
                screen.queryByText('Fleet Map Currently Unavailable'),
            ).not.toBeInTheDocument();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Edge Case 4: Responsive mobile switching works cleanly without horizontal overflow', () => {
        it('FleetSurface: mobile detail toggle cleanly hides queue when detail is open and provides back navigation', () => {
            const assets = [
                createAsset(1, 'CRN-001', 'crane'),
                createAsset(2, 'TRK-002', 'truck'),
            ];

            render(
                <FleetSurface
                    assets={assets}
                    locations={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Click second asset to open detail on mobile
            const asset2RowBtn = screen.getByRole('button', {
                name: /Asset TRK-002/i,
            });
            fireEvent.click(asset2RowBtn);

            // Detail pane is open and contains "Back to fleet list" button
            const backBtn = screen.getByRole('button', {
                name: /back to fleet list/i,
            });
            expect(backBtn).toBeInTheDocument();

            // Click back button -> returns to list
            fireEvent.click(backBtn);

            // Detail can be re-opened by clicking CRN-001
            const asset1RowBtn = screen.getByRole('button', {
                name: /Asset CRN-001/i,
            });
            fireEvent.click(asset1RowBtn);
            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).toBeInTheDocument();
        });

        it('FuelSurface: mobile detail toggle cleanly switches between queue and detail pane', () => {
            const requests = [
                createFuelRequest(1, 'submitted'),
                createFuelRequest(2, 'forwarded'),
            ];

            render(
                <FuelSurface
                    requests={requests}
                    capabilities={createCapabilities()}
                    assets={[]}
                />,
            );

            // Select second request
            fireEvent.click(screen.getByText('FUEL-2'));

            // Mobile back button is visible
            const backBtn = screen.getByRole('button', {
                name: /back to fuel queue/i,
            });
            expect(backBtn).toBeInTheDocument();

            // Click back
            fireEvent.click(backBtn);
        });

        it('ReportsSurface: mobile detail toggle provides clean navigation back to queue', () => {
            const reports = [
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

            // Select Report 2
            fireEvent.click(
                screen.getByRole('button', { name: /Task 2 summary/i }),
            );

            // "Back to reports queue" is present
            const backBtn = screen.getByRole('button', {
                name: /back to reports queue/i,
            });
            expect(backBtn).toBeInTheDocument();

            fireEvent.click(backBtn);
        });
    });
});
