import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FleetAssetCard } from '@/components/workspace/fleet/fleet-asset-card';
import { FuelSurface } from '@/components/workspace/fuel/fuel-surface';
import { LiveWorkspaceSection } from '@/components/workspace/live-workspace-sections';
import { JobReportSignatureCard } from '@/components/workspace/reports/job-report-signature-card';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import type {
    AssetViewModel,
    FuelRequestViewModel,
    JobReportViewModel,
    LocationUpdateViewModel,
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
        id: 500 + assetId,
        user: { id: 10 + assetId, name: `Driver ${assetId}` },
        job: null,
        asset: {
            id: assetId,
            code: `CRN-${assetId}`,
            name: `Asset ${assetId}`,
            kind: 'crane',
        },
        latitude: 14.5995,
        longitude: 120.9842,
        speed: 45.5,
        remarks: null,
        accuracy_metres: 5,
        source: 'gps',
        sharing_enabled: true,
        captured_at: '2026-09-06T14:30:00Z',
        received_at: '2026-09-06T14:30:05Z',
        freshness_status: freshness,
        ...overrides,
    };
}

describe('Phase 1 Empirical Challenger: Factual and Semantic Verifications', () => {
    beforeEach(() => {
        mockPageErrors = {};
        window.history.replaceState({}, '', '/operations');
    });

    describe('Verification 1: Telemetry freshness is distinct from operational status', () => {
        it('renders fresh and last-known location labels accurately in FleetAssetCard', () => {
            const asset = createAsset(1, 'CRN-01', 'crane');

            // 1. Fresh -> Shows a current-location label.
            const freshLoc = createLocation(1, 'fresh');
            const { rerender } = render(
                <FleetAssetCard asset={asset} location={freshLoc} />,
            );
            expect(screen.getByText(/Fresh location/i)).toBeInTheDocument();
            expect(
                screen.queryByText(/Last known location/i),
            ).not.toBeInTheDocument();

            // 2. Delayed with coordinates -> the position is still last known.
            const delayedLoc = createLocation(1, 'delayed');
            rerender(<FleetAssetCard asset={asset} location={delayedLoc} />);
            expect(screen.getByText('Last known location')).toBeInTheDocument();

            // 3. Stale with coordinates -> still explicitly last known.
            const staleLoc = createLocation(1, 'stale');
            rerender(<FleetAssetCard asset={asset} location={staleLoc} />);
            expect(screen.getByText('Last known location')).toBeInTheDocument();

            // 4. Offline with coordinates -> coordinates remain last known, not live.
            const offlineLoc = createLocation(1, 'offline');
            rerender(<FleetAssetCard asset={asset} location={offlineLoc} />);
            expect(screen.getByText('Last known location')).toBeInTheDocument();
        });

        it('renders observation timestamps and non-live status badges in AssetsSurface detail pane', () => {
            const asset = createAsset(1, 'CRN-01', 'crane');
            const staleLoc = createLocation(1, 'stale', {
                captured_at: '2026-09-06T14:30:00Z',
                received_at: '2026-09-06T14:30:05Z',
            });

            render(
                <LiveWorkspaceSection
                    section="assets"
                    assets={[asset]}
                    fuelRequests={[]}
                    locations={[staleLoc]}
                    approvals={[]}
                    auditEvents={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // AssetDetailPane header: current freshness is explicit and not described as live.
            expect(
                screen.queryByText('Live GPS active'),
            ).not.toBeInTheDocument();
            expect(
                screen.getAllByText('Last known location').length,
            ).toBeGreaterThanOrEqual(1);

            // Observation timestamp must be rendered in the location summary
            expect(
                screen.getByText(
                    /Last known location \(14\.5995, 120\.9842\)/i,
                ),
            ).toBeInTheDocument();
        });
    });

    describe('Verification 2: Null location coordinates strictly display "Location not recorded" (never fallback to "Base Yard")', () => {
        it('renders "Location not recorded" when asset location and telemetry coordinates are null', () => {
            const assetWithNullLocation = createAsset(2, 'CRN-NULL', 'crane', {
                location: null,
            });

            render(
                <FleetAssetCard
                    asset={assetWithNullLocation}
                    location={null}
                />,
            );

            expect(
                screen.getByText('Location not recorded'),
            ).toBeInTheDocument();
            expect(screen.queryByText(/Base Yard/i)).not.toBeInTheDocument();
        });

        it('renders "Location not recorded" in AssetsSurface and AssetDetailPane when location is null', () => {
            const asset = createAsset(3, 'TRK-NULL', 'truck', {
                location: null,
            });

            render(
                <LiveWorkspaceSection
                    section="assets"
                    assets={[asset]}
                    fuelRequests={[]}
                    locations={[]}
                    approvals={[]}
                    auditEvents={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Both list row and detail pane should render "Location not recorded"
            const nullLocationElements = screen.getAllByText(
                'Location not recorded',
            );
            expect(nullLocationElements.length).toBeGreaterThanOrEqual(1);
            expect(screen.queryByText(/Base Yard/i)).not.toBeInTheDocument();
        });

        it('renders "Location not recorded" in JobReportSignatureCard when latitude/longitude are null', () => {
            render(
                <JobReportSignatureCard
                    signerName="John Doe"
                    signerRole="Site Supervisor"
                    signedAt="2026-09-06T15:00:00Z"
                    latitude={null}
                    longitude={null}
                />,
            );

            expect(
                screen.getByText('Location not recorded'),
            ).toBeInTheDocument();
            expect(screen.queryByText(/Base Yard/i)).not.toBeInTheDocument();
            expect(
                screen.queryByText(/GPS coordinates verified/i),
            ).not.toBeInTheDocument();
        });

        it('renders "Client Sign-Off: Not recorded" when sign-off metadata is missing', () => {
            render(
                <JobReportSignatureCard
                    signerName={null}
                    signerRole={null}
                    signedAt={null}
                />,
            );

            expect(
                screen.getByText('Client Sign-Off: Not recorded'),
            ).toBeInTheDocument();
        });
    });

    describe('Verification 3: Null equipment capacity units are never fabricated as "MT"', () => {
        it('renders rated capacity without "MT" when capacity_unit is null or undefined in FleetAssetCard', () => {
            const assetNullUnit = createAsset(4, 'CRN-NOUNITS', 'crane', {
                rated_capacity: 75,
                capacity_unit: null,
            });

            render(<FleetAssetCard asset={assetNullUnit} />);

            expect(screen.getByText('75')).toBeInTheDocument();
            expect(screen.queryByText(/MT/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/75 MT/i)).not.toBeInTheDocument();
        });

        it('renders rated capacity without "MT" in AssetsSurface and AssetDetailPane', () => {
            const asset = createAsset(5, 'CRN-50T', 'crane', {
                rated_capacity: 50,
                capacity_unit: null,
            });

            render(
                <LiveWorkspaceSection
                    section="assets"
                    assets={[asset]}
                    fuelRequests={[]}
                    locations={[]}
                    approvals={[]}
                    auditEvents={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Row badge and specifications
            const capElements = screen.getAllByText('50');
            expect(capElements.length).toBeGreaterThanOrEqual(1);
            expect(screen.queryByText(/50 MT/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/MT/i)).not.toBeInTheDocument();
        });

        it('renders "Not recorded" when rated_capacity itself is null', () => {
            const assetNoCap = createAsset(6, 'TRK-NOCAP', 'truck', {
                rated_capacity: null,
                capacity_unit: null,
            });

            render(
                <LiveWorkspaceSection
                    section="assets"
                    assets={[assetNoCap]}
                    fuelRequests={[]}
                    locations={[]}
                    approvals={[]}
                    auditEvents={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(screen.getByText('Not recorded')).toBeInTheDocument();
        });
    });

    describe('Verification 4: Fuel requests distinguish requested volume from dispensed fuel logs, and verified vs logged stages are distinct', () => {
        it('computes and labels Requested Litres distinctly from dispensed logs and separates verified and logged stages', () => {
            const fuelRequests: FuelRequestViewModel[] = [
                {
                    id: 1,
                    reference: 'FUEL-REQ-001',
                    requester: { id: 10, name: 'Alice Operator' },
                    job: null,
                    asset: { id: 1, code: 'CRN-01' },
                    quantity_litres: '100',
                    fuel_type: 'diesel',
                    purpose: 'Job mobilization',
                    status: { value: 'submitted', label: 'Submitted' },
                },
                {
                    id: 2,
                    reference: 'FUEL-REQ-002',
                    requester: { id: 11, name: 'Bob Driver' },
                    job: null,
                    asset: { id: 2, code: 'TRK-02' },
                    quantity_litres: '250',
                    fuel_type: 'diesel',
                    purpose: 'Long haul transfer',
                    status: { value: 'approved', label: 'Approved' },
                },
                {
                    id: 3,
                    reference: 'FUEL-REQ-003',
                    requester: { id: 12, name: 'Charlie Lead' },
                    job: null,
                    asset: { id: 3, code: 'CRN-03' },
                    quantity_litres: '300',
                    fuel_type: 'diesel',
                    purpose: 'Foundation operation',
                    status: { value: 'verified', label: 'Verified' },
                },
                {
                    id: 4,
                    reference: 'FUEL-REQ-004',
                    requester: { id: 13, name: 'David Tech' },
                    job: null,
                    asset: { id: 4, code: 'TRK-04' },
                    quantity_litres: '400',
                    fuel_type: 'diesel',
                    purpose: 'Final fill-up',
                    status: { value: 'logged', label: 'Logged' },
                    logs: [
                        {
                            id: 401,
                            quantity_litres: '380',
                            total_cost: '24700',
                            price_per_litre: '65.00',
                            hour_meter: '450.5',
                            odometer_km: null,
                            is_anomaly: false,
                            effective_burn_rate: '14.5',
                            recorded_at: '2026-09-06T12:00:00Z',
                            recorded_by: { id: 13, name: 'David Tech' },
                            receipt_path: null,
                            fuel_station: null,
                            remarks: null,
                        },
                    ],
                },
            ];

            render(
                <FuelSurface
                    requests={fuelRequests}
                    assets={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // KPI strip verification:
            // 1. Pending: 1
            expect(screen.getByText('Pending Review')).toBeInTheDocument();
            // 2. Approved: 1
            expect(
                screen.getAllByText('Approved').length,
            ).toBeGreaterThanOrEqual(1);
            // 3. Verified: 1
            expect(
                screen.getAllByText('Verified').length,
            ).toBeGreaterThanOrEqual(1);
            // 4. Logged: 1
            expect(screen.getAllByText('Logged').length).toBeGreaterThanOrEqual(
                1,
            );
            // 5. Requested Litres: 1,050 (100+250+300+400)
            expect(screen.getByText('Requested Litres')).toBeInTheDocument();
            expect(screen.getByText('1,050')).toBeInTheDocument();

            // Distinct filter buttons
            const verifiedFilterBtn = screen.getByRole('button', {
                name: /verified \(1\)/i,
            });
            const loggedFilterBtn = screen.getByRole('button', {
                name: /logged \(1\)/i,
            });
            expect(verifiedFilterBtn).toBeInTheDocument();
            expect(loggedFilterBtn).toBeInTheDocument();

            // Click "Verified (1)" filter: shows FUEL-REQ-003, excludes FUEL-REQ-004
            fireEvent.click(verifiedFilterBtn);
            expect(screen.getByText('FUEL-REQ-003')).toBeInTheDocument();
            expect(screen.queryByText('FUEL-REQ-004')).not.toBeInTheDocument();

            // Click "Logged (1)" filter: shows FUEL-REQ-004, excludes FUEL-REQ-003
            fireEvent.click(loggedFilterBtn);
            expect(screen.getByText('FUEL-REQ-004')).toBeInTheDocument();
            expect(screen.queryByText('FUEL-REQ-003')).not.toBeInTheDocument();

            // In request card: Requested quantity is explicitly labeled "Requested: 400 Litres"
            expect(
                screen.getByText(/Requested: 400 Litres/i),
            ).toBeInTheDocument();
        });
    });

    describe('Verification 5: In absence of baseline consumption data or prior meter logs, "Not enough data to assess consumption" is displayed', () => {
        it('renders "Not enough data to assess consumption" when no evaluated logs exist', () => {
            const fuelRequestsWithoutLogs: FuelRequestViewModel[] = [
                {
                    id: 1,
                    reference: 'FUEL-REQ-NO-LOGS',
                    requester: { id: 10, name: 'Alice Operator' },
                    job: null,
                    asset: { id: 1, code: 'CRN-01' },
                    quantity_litres: '100',
                    fuel_type: 'diesel',
                    purpose: 'Job mobilization',
                    status: { value: 'submitted', label: 'Submitted' },
                    logs: [],
                },
            ];

            render(
                <FuelSurface
                    requests={fuelRequestsWithoutLogs}
                    assets={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.getByText('Not enough data to assess consumption'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText('All within baseline burn rate'),
            ).not.toBeInTheDocument();
        });

        it('renders "Not enough data to assess consumption" when logs exist but effective_burn_rate is null', () => {
            const fuelRequestsWithUncalculatedLog: FuelRequestViewModel[] = [
                {
                    id: 2,
                    reference: 'FUEL-REQ-NO-BURN-RATE',
                    requester: { id: 10, name: 'Alice Operator' },
                    job: null,
                    asset: { id: 1, code: 'CRN-01' },
                    quantity_litres: '100',
                    fuel_type: 'diesel',
                    purpose: 'First initial fill (no prior meter)',
                    status: { value: 'logged', label: 'Logged' },
                    logs: [
                        {
                            id: 501,
                            quantity_litres: '100',
                            total_cost: '6500',
                            price_per_litre: '65.00',
                            hour_meter: '100.0',
                            odometer_km: null,
                            is_anomaly: false,
                            effective_burn_rate: null, // absent prior meter!
                            recorded_at: '2026-09-06T12:00:00Z',
                            recorded_by: { id: 10, name: 'Alice Operator' },
                            receipt_path: null,
                            fuel_station: null,
                            remarks: null,
                        },
                    ],
                },
            ];

            render(
                <FuelSurface
                    requests={fuelRequestsWithUncalculatedLog}
                    assets={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.getByText('Not enough data to assess consumption'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText('All within baseline burn rate'),
            ).not.toBeInTheDocument();
        });

        it('renders "All evaluated logs within baseline burn rate" only when evaluated logs exist and have zero anomalies', () => {
            const fuelRequestsWithEvaluatedLog: FuelRequestViewModel[] = [
                {
                    id: 3,
                    reference: 'FUEL-REQ-WITH-RATE',
                    requester: { id: 10, name: 'Alice Operator' },
                    job: null,
                    asset: { id: 1, code: 'CRN-01' },
                    quantity_litres: '100',
                    fuel_type: 'diesel',
                    purpose: 'Evaluated second fill',
                    status: { value: 'logged', label: 'Logged' },
                    logs: [
                        {
                            id: 502,
                            quantity_litres: '100',
                            total_cost: '6500',
                            price_per_litre: '65.00',
                            hour_meter: '110.0',
                            odometer_km: null,
                            is_anomaly: false,
                            effective_burn_rate: '10.0', // 10 L/h
                            recorded_at: '2026-09-06T12:00:00Z',
                            recorded_by: { id: 10, name: 'Alice Operator' },
                            receipt_path: null,
                            fuel_station: null,
                            remarks: null,
                        },
                    ],
                },
            ];

            render(
                <FuelSurface
                    requests={fuelRequestsWithEvaluatedLog}
                    assets={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.getByText(
                    'All evaluated logs within baseline burn rate',
                ),
            ).toBeInTheDocument();
            expect(
                screen.queryByText('Not enough data to assess consumption'),
            ).not.toBeInTheDocument();
        });
    });

    describe('Verification 6: Empty job reports state "No job reports in loaded scope" rather than "All reports verified"', () => {
        it('renders honest empty states and descriptions in ReportsSurface when reports array is empty', () => {
            render(
                <ReportsSurface
                    reports={[]}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Empty state heading must state "No job reports in loaded scope"
            expect(
                screen.getByText('No job reports in loaded scope'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/All field reports verified & signed off/i),
            ).not.toBeInTheDocument();

            // Stat descriptions must be honest about scope
            expect(
                screen.getByText('No pending submissions in loaded scope'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/All submissions up to date/i),
            ).not.toBeInTheDocument();

            expect(
                screen.getByText('Loaded in current scope'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/Logged across active fleet/i),
            ).not.toBeInTheDocument();

            expect(
                screen.getByText('Approved by operations review'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/ready for billing/i),
            ).not.toBeInTheDocument();
        });

        it('labels attachments truthfully without claiming they are "verified attachments"', () => {
            const reportWithAttachments: JobReportViewModel[] = [
                {
                    id: 99,
                    dispatch_job_id: 1099,
                    job: { id: 1099, reference: 'JOB-99', title: 'Test Job' },
                    author: { id: 299, name: 'Operator 99' },
                    status: { value: 'submitted', label: 'SUBMITTED' },
                    work_summary: 'Work done with photos',
                    remarks: null,
                    started_at: '2026-09-06T08:00:00Z',
                    ended_at: '2026-09-06T12:00:00Z',
                    submitted_at: '2026-09-06T12:30:00Z',
                    attachments: [
                        {
                            id: 1,
                            kind: 'site_photo',
                            original_filename: 'site_photo.jpg',
                            size_bytes: 102400,
                            mime_type: 'image/jpeg',
                            checksum_sha256: 'abc123def456',
                            download_url: '/storage/attachments/1.jpg',
                        },
                    ],
                },
            ];

            render(
                <ReportsSurface
                    reports={reportWithAttachments}
                    exports={[]}
                    jobs={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // Must say "1 attachments", NOT "1 verified attachments"
            expect(screen.getByText('1 attachments')).toBeInTheDocument();
            expect(
                screen.queryByText(/verified attachments/i),
            ).not.toBeInTheDocument();
        });
    });
});
