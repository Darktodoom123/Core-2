import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FleetDetailPane,
    FleetMapFailureFallback,
    FleetQueue,
    FleetSurface,
    FleetTelemetrySection,
    MapErrorBoundary,
    SafetyLockoutBanner,
} from '@/components/workspace/fleet';
import type {
    AssetViewModel,
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
                setDefaults: vi.fn(),
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

// Mock lazy-loaded LiveTrackingMap to avoid canvas/leaflet issues in jsdom
vi.mock('@/components/live-tracking-map', () => ({
    LiveTrackingMap: ({
        locations,
        selectedLocationId,
        onCollapse,
    }: {
        locations: LocationUpdateViewModel[];
        selectedLocationId?: number | null;
        onCollapse?: () => void;
    }) => (
        <>
            <div
                data-testid="live-tracking-map"
                data-selected-location-id={selectedLocationId ?? ''}
            >
                LiveTrackingMap Mock ({locations?.length ?? 0} markers)
            </div>
            {onCollapse && (
                <button type="button" onClick={onCollapse}>
                    Collapse fleet map
                </button>
            )}
        </>
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
        inspections_count: 0,
        dvir_inspections_count: 0,
        maintenance_work_orders_count: 0,
        documents_count: 0,
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
        user: { id: 10, name: 'John Crane Operator' },
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

describe('FleetSurface & Modular Fleet Components', () => {
    beforeEach(() => {
        mockPost = vi.fn();
    });

    describe('Calm Operate-Mode Interface & Elimination of Bulky KPI Strip', () => {
        it('renders calm Operate-mode header and eliminates the bulky 4-card KPI strip', () => {
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
            // Calm Operate-mode title
            expect(
                screen.getByRole('heading', {
                    level: 1,
                    name: 'Fleet Management',
                }),
            ).toBeInTheDocument();

            // VERIFICATION OF TASK 3: No bulky 4-card KPI strip titles
            expect(screen.queryByText('Total Fleet')).not.toBeInTheDocument();
            expect(
                screen.queryByText('Ready to Deploy'),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Active on Jobs'),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Maintenance Holds'),
            ).not.toBeInTheDocument();

            // Category filters are grouped behind a compact, labelled menu.
            const categoryFilterTrigger = screen.getByRole('button', {
                name: /filter assets: all assets/i,
            });
            expect(categoryFilterTrigger).toBeInTheDocument();
            fireEvent.click(categoryFilterTrigger);
            const categoryMenu = screen.getByRole('menu', {
                name: 'Fleet asset category filters',
            });
            expect(
                within(categoryMenu).getByRole('menuitemradio', {
                    name: /all assets \(2\)/i,
                }),
            ).toBeInTheDocument();
            expect(
                within(categoryMenu).getByRole('menuitemradio', {
                    name: /cranes \(1\)/i,
                }),
            ).toBeInTheDocument();
            expect(
                within(categoryMenu).getByRole('menuitemradio', {
                    name: /transport \(1\)/i,
                }),
            ).toBeInTheDocument();
            expect(
                within(categoryMenu).getByRole('menuitemradio', {
                    name: /ready \(2\)/i,
                }),
            ).toBeInTheDocument();
            expect(
                within(categoryMenu).getByRole('menuitemradio', {
                    name: /holds \(0\)/i,
                }),
            ).toBeInTheDocument();
        });

        it('renders live fleet map on top and keeps asset registry and detail pane synchronized', () => {
            const assets = [
                createAsset(1, 'CRN-001', 'crane'),
                createAsset(2, 'TRK-002', 'truck'),
            ];
            const locations = [
                createLocation(1, 'fresh'),
                createLocation(2, 'fresh'),
            ];

            render(
                <FleetSurface
                    assets={assets}
                    locations={locations}
                    capabilities={createCapabilities()}
                />,
            );

            // Fleet map is prominently rendered on top by default
            expect(screen.getByText('Fleet map')).toBeInTheDocument();
            expect(screen.getAllByText(/2 mapped/).length).toBeGreaterThan(0);

            // Both map and registry are simultaneously present
            expect(
                screen.getAllByText('CRN-001').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).toBeInTheDocument();

            // Initial selectedLocationId on map corresponds to first selected asset (asset 1 -> location id 501)
            const mapMock = screen.getByTestId('live-tracking-map');
            expect(mapMock).toHaveAttribute('data-selected-location-id', '501');

            // Select second asset in queue
            const secondAssetRow = screen.getByText('TRK-002');
            fireEvent.click(secondAssetRow);

            // Map selection immediately syncs to second asset (asset 2 -> location id 502)
            expect(mapMock).toHaveAttribute('data-selected-location-id', '502');
            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset TRK-002',
                }),
            ).toBeInTheDocument();

            // Map toolbar has a collapsible toggle
            const collapseMapBtn = screen.getByRole('button', {
                name: /collapse fleet map/i,
            });
            fireEvent.click(collapseMapBtn);
            expect(
                screen.queryByTestId('live-tracking-map'),
            ).not.toBeInTheDocument();

            const showMapBtn = screen.getByRole('button', {
                name: /show map/i,
            });
            fireEvent.click(showMapBtn);
            expect(screen.getByTestId('live-tracking-map')).toBeInTheDocument();
        });

        it('explains when an available asset still needs an inspection before dispatch', () => {
            const asset = createAsset(1, 'TRK-201', 'truck', 'available', {
                is_dispatchable: false,
                inspections: [],
                latest_dvir: null,
            });

            render(
                <FleetSurface
                    assets={[asset]}
                    locations={[]}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.getAllByText('Inspection required before dispatch'),
            ).toHaveLength(2);
            expect(
                screen.queryByText('Non-dispatchable'),
            ).not.toBeInTheDocument();
        });
    });

    describe('Stable Selection Across Registry Filters', () => {
        it('keeps the selected detail asset stable when a registry filter excludes it', () => {
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

            // Filter to "Transport" (excludes CRN-001)
            fireEvent.click(
                screen.getByRole('button', {
                    name: /filter assets: all assets/i,
                }),
            );
            fireEvent.click(
                screen.getByRole('menuitemradio', {
                    name: /transport \(1\)/i,
                }),
            );

            // The detail pane remains anchored to the selected asset while the
            // registry list narrows.
            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).toBeInTheDocument();

            // The filtered registry still displays TRK-002.
            expect(
                within(
                    screen.getByRole('list', { name: 'Fleet assets' }),
                ).getByText('TRK-002'),
            ).toBeInTheDocument();
        });

        it('clears detail pane to EmptyState when search excludes all records', () => {
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

            const searchInput = screen.getByPlaceholderText(
                /search code, name, model/i,
            );
            fireEvent.change(searchInput, {
                target: { value: 'nonexistent-unit-xyz' },
            });

            // Queue shows empty state with Clear filters action
            expect(screen.getByText('No matching assets')).toBeInTheDocument();

            // Detail pane keeps the selected asset rather than silently
            // switching to another record.
            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).toBeInTheDocument();

            // Clicking Clear filters restores view
            const clearBtn = screen.getByRole('button', {
                name: /clear filters/i,
            });
            fireEvent.click(clearBtn);

            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).toBeInTheDocument();
        });
    });

    describe('Truthful GPS Freshness & Telemetry Truth', () => {
        it('separates operational status from truthful location freshness', () => {
            const assets = [
                createAsset(1, 'CRN-001', 'crane'),
                createAsset(2, 'TRK-002', 'truck'),
                createAsset(3, 'TRK-003', 'truck'),
                createAsset(4, 'TRK-004', 'truck'),
                createAsset(5, 'TRK-005', 'truck', 'available', {
                    location: null,
                }),
            ];

            const locations = [
                createLocation(1, 'fresh', { speed: 30 }),
                createLocation(2, 'delayed'),
                createLocation(3, 'stale'),
                createLocation(4, 'offline'),
            ];

            render(
                <FleetSurface
                    assets={assets}
                    locations={locations}
                    capabilities={createCapabilities()}
                />,
            );

            // Fresh positions are distinct from retained/non-current positions;
            // stale data is never presented as live GPS.
            expect(
                screen.getByText(/Fresh location \(30 km\/h\)/i),
            ).toBeInTheDocument();
            expect(
                screen.getAllByText('Last known location').length,
            ).toBeGreaterThanOrEqual(3);
            expect(
                screen.queryByText(/GPS Live|GPS Delayed|Telemetry Offline/i),
            ).not.toBeInTheDocument();

            // Asset 5 with null coordinates: "Location not recorded" (never "Base Yard")
            expect(
                screen.getByText('Location not recorded'),
            ).toBeInTheDocument();
        });

        it('displays "Speed not recorded" when speed is null and does not fabricate units for capacity', () => {
            const assetWithNullUnit = createAsset(
                1,
                'CRN-001',
                'crane',
                'available',
                {
                    rated_capacity: 55,
                    capacity_unit: null,
                },
            );

            const locationWithNullSpeed = createLocation(1, 'fresh', {
                speed: null,
            });

            render(
                <FleetDetailPane
                    asset={assetWithNullUnit}
                    assetLocation={locationWithNullSpeed}
                    capabilities={createCapabilities()}
                />,
            );

            // Rated capacity renders "55" without fabricated "MT" or "Tons"
            const capacityDt = screen.getByText(/rated capacity/i);
            const capacityDd = capacityDt.nextElementSibling;
            expect(capacityDd?.textContent?.trim()).toBe('55');

            // Detail pane eliminates the individual telemetry tab
            expect(
                screen.queryByRole('tab', { name: /live telemetry/i }),
            ).not.toBeInTheDocument();

            // Renders FleetTelemetrySection directly to verify speed display truth
            render(
                <FleetTelemetrySection
                    asset={assetWithNullUnit}
                    location={locationWithNullSpeed}
                />,
            );
            expect(screen.getByText('Speed not recorded')).toBeInTheDocument();
        });

        it('renders the Current operation empty states and both inspection summaries', () => {
            const asset = createAsset(1, 'CRN-001', 'crane', 'available', {
                latest_dvir: {
                    id: 21,
                    type: 'pre_trip',
                    status: 'passed',
                    has_defects: false,
                    critical_defects_count: 0,
                    completed_at: '2026-09-07T07:00:00Z',
                    inspector_name: 'Mobile operator',
                    photos: [],
                },
                inspections: [
                    {
                        id: 22,
                        type: 'safety',
                        result: 'conditional',
                        checklist: {},
                        findings: 'Monitor hydraulic pressure',
                        completed_at: '2026-09-07T08:00:00Z',
                    },
                ],
            });

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Current operation' }),
            ).toBeInTheDocument();
            expect(
                screen.queryByText('Operational snapshot'),
            ).not.toBeInTheDocument();
            expect(screen.getByText('No active operator')).toBeInTheDocument();
            expect(screen.getByText('No active duty')).toBeInTheDocument();
            expect(screen.getByText('Passed')).toBeInTheDocument();
            expect(screen.getByText('Conditional')).toBeInTheDocument();

            fireEvent.click(
                screen.getByRole('button', { name: /view inspections/i }),
            );
            expect(
                screen.getByRole('tab', { name: /inspections/i }),
            ).toHaveAttribute('aria-selected', 'true');
        });
    });

    describe('Prominent Safety Lockout Alerts & Lockdown Enforcement', () => {
        it('renders prominent safety lockout alert banner when equipment is locked out', () => {
            const lockedAsset = createAsset(
                1,
                'CRN-001',
                'crane',
                'maintenance',
                {
                    blocking_work_orders_count: 1,
                    lockout: {
                        is_locked_out: true,
                        lockout_reason:
                            'Hydraulic boom cylinder leak detected in DVIR',
                        locked_at: '2026-09-07T06:00:00Z',
                        critical_defects_count: 1,
                        can_override: false,
                    },
                    maintenance_work_orders: [
                        {
                            id: 101,
                            defect: 'Hydraulic boom cylinder leak',
                            status: 'open',
                            dispatch_blocking: true,
                            scheduled_at: null,
                            next_due_at: null,
                            remarks: 'Safety hold',
                            work_performed: [],
                            parts: [],
                            released_at: null,
                        },
                    ],
                },
            );

            render(
                <FleetSurface
                    assets={[lockedAsset]}
                    locations={[]}
                    capabilities={createCapabilities()}
                />,
            );

            // In queue: blocker visible
            expect(screen.getAllByText('1 blocking work order')).toHaveLength(
                2,
            );

            // Lockout reason visible in both queue row badge and detail pane banner
            const lockoutReasons = screen.getAllByText(
                'Hydraulic boom cylinder leak detected in DVIR',
            );
            expect(lockoutReasons.length).toBe(2);

            // In detail pane: Safety Lockout Active banner
            expect(
                screen.getByText('DISPATCH SAFETY LOCKOUT ACTIVE'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/Safety hold.*Non-dispatchable/),
            ).not.toBeInTheDocument();
        });

        it('opens safety lockdown modal and enforces mandatory reason', () => {
            const asset = createAsset(1, 'CRN-001', 'crane', 'available');

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({
                        safety_lockdown_asset: true,
                    })}
                />,
            );

            // Click Safety Lockdown button
            const lockdownBtn = screen.getByRole('button', {
                name: /safety lockdown/i,
            });
            fireEvent.click(lockdownBtn);

            // Modal dialog opens
            expect(
                screen.getByRole('heading', {
                    level: 3,
                    name: 'Fleet Safety Recall Lockdown',
                }),
            ).toBeInTheDocument();

            const textarea = screen.getByLabelText(
                /mandatory safety recall reason/i,
            );
            fireEvent.change(textarea, {
                target: { value: 'Critical hairline crack in outrigger weld' },
            });

            const enforceBtn = screen.getByRole('button', {
                name: /enforce safety lockdown/i,
            });
            fireEvent.click(enforceBtn);

            expect(mockPost).toHaveBeenCalledWith(
                '/operations/admin/assets/1/safety-lockdown',
                expect.any(Object),
            );
        });
    });

    describe('Map Resiliency & Error Boundary', () => {
        it('keeps the synchronized location list actionable when the map fails', () => {
            const onSelectedLocationChange = vi.fn();

            render(
                <FleetMapFailureFallback
                    locations={[createLocation(1, 'stale')]}
                    selectedLocationId={null}
                    onSelectedLocationChange={onSelectedLocationChange}
                    onRetry={vi.fn()}
                    compact
                />,
            );

            expect(screen.getByRole('alert')).toHaveTextContent(
                'Map unavailable',
            );
            const locationList = screen.getByRole('complementary', {
                name: 'Synchronized mapped location list',
            });
            expect(
                within(locationList).getByRole('heading', {
                    name: 'Asset locations',
                }),
            ).toBeInTheDocument();
            expect(
                within(locationList).getByText(/Last known location/),
            ).toBeInTheDocument();

            fireEvent.click(
                within(locationList).getByRole('button', {
                    name: /asset-1/i,
                }),
            );
            expect(onSelectedLocationChange).toHaveBeenCalledWith(501);
        });

        it('catches map rendering failure without crashing the surrounding interface', () => {
            // A faulty map component that throws an error
            const FaultyMap = () => {
                throw new Error('Tile load failure / WebGL context lost');
            };

            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            render(
                <div>
                    <div data-testid="external-header">Operations Header</div>
                    <MapErrorBoundary
                        fallbackTitle="Map Error Caught"
                        fallbackMessage="Map crashed but workspace remains safe."
                    >
                        <FaultyMap />
                    </MapErrorBoundary>
                    <div data-testid="external-queue">
                        Asset Queue Remains Alive
                    </div>
                </div>,
            );

            // Error Boundary caught the error and rendered fallback
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('Map Error Caught')).toBeInTheDocument();
            expect(
                screen.getByText('Map crashed but workspace remains safe.'),
            ).toBeInTheDocument();

            // Surrounding UI elements remain mounted and interactive
            expect(screen.getByTestId('external-header')).toBeInTheDocument();
            expect(screen.getByTestId('external-queue')).toBeInTheDocument();

            consoleErrorSpy.mockRestore();
        });

        it('supports retry via onReset callback', () => {
            const onResetMock = vi.fn();
            const onCollapseMock = vi.fn();
            let shouldThrow = true;
            const FlakyMap = () => {
                if (shouldThrow) {
                    throw new Error('Temporary tile timeout');
                }

                return <div>Map Recovered</div>;
            };

            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            render(
                <MapErrorBoundary
                    onReset={onResetMock}
                    onCollapse={onCollapseMock}
                >
                    <FlakyMap />
                </MapErrorBoundary>,
            );

            expect(
                screen.getByText('Live Map Unavailable'),
            ).toBeInTheDocument();

            fireEvent.click(
                screen.getByRole('button', { name: /collapse fleet map/i }),
            );
            expect(onCollapseMock).toHaveBeenCalledTimes(1);

            shouldThrow = false;
            const retryBtn = screen.getByRole('button', {
                name: /retry loading map/i,
            });
            fireEvent.click(retryBtn);

            expect(onResetMock).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Map Recovered')).toBeInTheDocument();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Inspections, Maintenance & Status Transitions in Detail Pane', () => {
        it('supports arrow-key selection across detail tabs', () => {
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities()}
                />,
            );

            const overviewTab = screen.getByRole('tab', {
                name: /overview & specs/i,
            });
            const statusTab = screen.getByRole('tab', {
                name: /readiness & status/i,
            });

            overviewTab.focus();
            fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });

            expect(statusTab).toHaveAttribute('aria-selected', 'true');
            expect(document.activeElement).toBe(statusTab);

            fireEvent.keyDown(statusTab, { key: 'End' });

            expect(
                screen.getByRole('tab', { name: /permits & docs/i }),
            ).toHaveAttribute('aria-selected', 'true');
        });

        it('keeps unfinished inspection form data while reviewing another tab', () => {
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({ inspect_asset: true })}
                />,
            );

            fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));
            fireEvent.click(
                screen.getByRole('button', {
                    name: /record workshop inspection/i,
                }),
            );

            const findings = screen.getByLabelText(/findings \/ remarks/i);
            fireEvent.change(findings, {
                target: { value: 'Keep this draft while checking status.' },
            });

            expect(
                screen.getByRole('dialog', {
                    name: /record workshop inspection/i,
                }),
            ).toBeInTheDocument();

            fireEvent.click(
                screen.getByRole('button', {
                    name: /close inspection dialog/i,
                }),
            );

            fireEvent.click(
                screen.getByRole('tab', { name: /overview & specs/i }),
            );
            fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));

            fireEvent.click(
                screen.getByRole('button', {
                    name: /record workshop inspection/i,
                }),
            );

            expect(screen.getByLabelText(/findings \/ remarks/i)).toHaveValue(
                'Keep this draft while checking status.',
            );
        });

        it('requires an explicit inspection type and result before submission', () => {
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({ inspect_asset: true })}
                />,
            );

            fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));
            fireEvent.click(
                screen.getByRole('button', {
                    name: /record workshop inspection/i,
                }),
            );

            expect(screen.getByLabelText('Inspection type')).toHaveValue('');
            expect(screen.getByLabelText(/result \*/i)).toHaveValue('');
            expect(
                screen.getByRole('button', {
                    name: /save inspection record/i,
                }),
            ).toBeDisabled();
            expect(mockPost).not.toHaveBeenCalled();
        });

        it('explains the backend-provided reason when an asset is not dispatchable', () => {
            const asset = createAsset(1, 'CRN-001', 'crane', 'available', {
                is_dispatchable: false,
                dispatchability: {
                    is_dispatchable: false,
                    blockers: [
                        {
                            code: 'maintenance',
                            label: 'Dispatch-blocking maintenance is open',
                            detail: '1 open maintenance order(s) block dispatch.',
                        },
                    ],
                },
            });

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities()}
                />,
            );

            fireEvent.click(
                screen.getByRole('tab', { name: /readiness & status/i }),
            );

            expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
            expect(
                screen.getAllByText('Not dispatchable').length,
            ).toBeGreaterThan(0);
            expect(
                screen.getByText('1 open maintenance order(s) block dispatch.'),
            ).toBeInTheDocument();
        });

        it('allows recording a new safety inspection', () => {
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({ inspect_asset: true })}
                />,
            );

            // Switch to Inspections tab
            const inspectionsTab = screen.getByRole('tab', {
                name: /inspections/i,
            });
            fireEvent.click(inspectionsTab);

            expect(
                screen.getByText('No inspections recorded for this asset yet.'),
            ).toBeInTheDocument();

            // Click Record workshop inspection
            const openFormBtn = screen.getByRole('button', {
                name: /record workshop inspection/i,
            });
            fireEvent.click(openFormBtn);

            expect(
                screen.getByRole('dialog', {
                    name: /record workshop inspection/i,
                }),
            ).toBeInTheDocument();

            expect(
                screen.getByText('Workshop / Post-Repair Verification'),
            ).toBeInTheDocument();

            expect(
                screen.queryByRole('option', { name: 'Pre-operation' }),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole('option', { name: 'Post-operation' }),
            ).not.toBeInTheDocument();
            fireEvent.change(screen.getByLabelText('Inspection type'), {
                target: { value: 'post_repair' },
            });
            expect(screen.getByLabelText('Inspection type')).toHaveValue(
                'post_repair',
            );
            fireEvent.change(screen.getByLabelText(/result \*/i), {
                target: { value: 'passed' },
            });

            const remarksInput = screen.getByLabelText(/findings \/ remarks/i);
            fireEvent.change(remarksInput, {
                target: { value: 'Brake pads worn to 20%' },
            });

            const submitBtn = screen.getByRole('button', {
                name: /save inspection record/i,
            });
            fireEvent.click(submitBtn);

            expect(mockPost).toHaveBeenCalledWith(
                '/operations/assets/1/inspections',
                expect.any(Object),
            );
        });

        it('focuses workshop checks when field DVIR history is empty', () => {
            const asset = createAsset(1, 'CRN-001', 'crane', 'available', {
                inspections: [
                    {
                        id: 12,
                        type: 'safety',
                        result: 'passed',
                        checklist: { brakes: true },
                        findings: 'Quarterly safety sign-off',
                        completed_at: '2026-09-05T10:00:00Z',
                    },
                ],
                inspections_count: 1,
                dvir_inspections_count: 0,
            });

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities()}
                />,
            );

            fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));

            expect(
                screen.getByRole('tab', { name: /workshop checks/i }),
            ).toHaveAttribute('aria-selected', 'true');
            expect(
                screen.getByText('Quarterly safety sign-off'),
            ).toBeInTheDocument();

            fireEvent.click(screen.getByRole('tab', { name: /field dvirs/i }));

            expect(
                screen.getByRole('tab', { name: /field dvirs/i }),
            ).toHaveAttribute('aria-selected', 'true');
            expect(
                screen.getByText(
                    'No field DVIR reports have been accepted for this asset yet.',
                ),
            ).toBeInTheDocument();
        });

        it('renders pre-trip and post-trip DVIR compliance log and opens photo viewer from inspection row', () => {
            const asset: AssetViewModel = {
                ...createAsset(1, 'CRN-001', 'crane'),
                dvir_inspections: [
                    {
                        id: 101,
                        reference: 'DVIR-000101',
                        type: 'post_trip',
                        status: 'defect_flagged',
                        has_defects: true,
                        critical_defects_count: 0,
                        completed_at: '2026-09-07T09:30:00Z',
                        inspector_name: 'Carlos Operator',
                        starting_odometer_km: 45100,
                        ending_odometer_km: 45350,
                        engine_hours: 1208.5,
                        remarks: 'Air brake line hiss noticed',
                        photos: [
                            {
                                id: 501,
                                angle: 'front',
                                url: 'https://cdn.example.com/front.jpg',
                                file_name: 'front.jpg',
                            },
                        ],
                        defects: [
                            {
                                id: 1,
                                category: 'Brakes',
                                label: 'Air Lines',
                                status: 'attention',
                                notes: 'Slight hiss',
                            },
                        ],
                    },
                    {
                        id: 100,
                        reference: 'DVIR-000100',
                        type: 'pre_trip',
                        status: 'passed',
                        has_defects: false,
                        critical_defects_count: 0,
                        completed_at: '2026-09-07T06:00:00Z',
                        inspector_name: 'Carlos Operator',
                        starting_odometer_km: 45100,
                        engine_hours: 1200.0,
                        photos: [],
                    },
                ],
                inspections: [
                    {
                        id: 1,
                        type: 'safety',
                        result: 'passed',
                        checklist: { brakes: true },
                        findings: 'Quarterly safety sign-off',
                        completed_at: '2026-09-05T10:00:00Z',
                    },
                ],
                inspections_count: 1,
                dvir_inspections_count: 2,
            };

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({ inspect_asset: true })}
                />,
            );

            // Tab badge shows combined count: 2 DVIRs + 1 shop inspection = 3
            const inspectionsTab = screen.getByRole('tab', {
                name: /inspections/i,
            });
            expect(inspectionsTab).toHaveTextContent('3');

            // Switch to Inspections tab
            fireEvent.click(inspectionsTab);

            // Assert DVIR pre-trip and post-trip entries are rendered
            expect(screen.getByText('DVIR-000101')).toBeInTheDocument();
            expect(screen.getByText('DVIR-000100')).toBeInTheDocument();
            expect(screen.getAllByText(/post-trip/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/pre-trip/i).length).toBeGreaterThan(0);
            fireEvent.click(
                screen.getByRole('button', { name: /DVIR-000101/i }),
            );
            expect(
                screen.getAllByText('Carlos Operator').length,
            ).toBeGreaterThan(0);
            expect(
                screen.getByText(/45,100 km → 45,350 km/),
            ).toBeInTheDocument();
            expect(screen.getByText(/1208.5 hrs/)).toBeInTheDocument();
            expect(
                screen.getByText(/air brake line hiss noticed/i),
            ).toBeInTheDocument();
            expect(screen.getByText(/Brakes: Air Lines/)).toBeInTheDocument();

            // Assert shop inspection is also displayed
            expect(
                screen.getByText('Quarterly safety sign-off'),
            ).toBeInTheDocument();

            // Click Walkaround Photos on the DVIR entry
            const photosBtn = screen.getByRole('button', {
                name: /walkaround photos \(1\)/i,
            });
            fireEvent.click(photosBtn);

            // Opens DvirWalkaroundModal with DVIR-000101 details
            expect(
                screen.getByText('DVIR Walkaround Inspection'),
            ).toBeInTheDocument();
            expect(
                screen.getAllByText('DVIR-000101').length,
            ).toBeGreaterThanOrEqual(2);
        });

        it('uses authoritative backend totals instead of loaded detail rows for tab counts', () => {
            const asset = createAsset(1, 'CRN-001', 'crane', 'available', {
                inspections_count: 12,
                dvir_inspections_count: 16,
                maintenance_work_orders_count: 14,
                documents_count: 7,
            });

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities()}
                />,
            );

            expect(
                screen.getByRole('tab', { name: /inspections/i }),
            ).toHaveTextContent('28');
            expect(
                screen.getByRole('tab', { name: /work orders/i }),
            ).toHaveTextContent('14');
            expect(
                screen.getByRole('tab', { name: /permits & docs/i }),
            ).toHaveTextContent('7');

            fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));
            expect(screen.getByText('16 total records')).toBeInTheDocument();
            expect(screen.getByText('12 total records')).toBeInTheDocument();
        });

        it('allows opening a maintenance work order', () => {
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({ maintain_asset: true })}
                />,
            );

            // Switch to Work Orders tab
            const workOrdersTab = screen.getByRole('tab', {
                name: /work orders/i,
            });
            fireEvent.click(workOrdersTab);

            expect(
                screen.getByText(
                    'No maintenance work orders recorded for this asset.',
                ),
            ).toBeInTheDocument();

            // Click Open maintenance work order
            const openOrderBtn = screen.getByRole('button', {
                name: /open maintenance work order/i,
            });
            fireEvent.click(openOrderBtn);

            const dialog = screen.getByRole('dialog', {
                name: /open maintenance work order/i,
            });
            expect(
                within(dialog).getByText('Describe the maintenance issue'),
            ).toBeInTheDocument();

            const defectInput =
                within(dialog).getByLabelText(/defect description/i);
            fireEvent.change(defectInput, {
                target: { value: 'Hydraulic oil leakage' },
            });

            const createBtn = within(dialog).getByRole('button', {
                name: /create work order/i,
            });
            fireEvent.click(createBtn);

            expect(mockPost).toHaveBeenCalledWith(
                '/operations/assets/1/maintenance',
                expect.any(Object),
            );
        });

        it('keeps an unfinished maintenance work-order draft when the dialog is closed', async () => {
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({ maintain_asset: true })}
                />,
            );

            fireEvent.click(screen.getByRole('tab', { name: /work orders/i }));
            fireEvent.click(
                screen.getByRole('button', {
                    name: /open maintenance work order/i,
                }),
            );

            const dialog = screen.getByRole('dialog', {
                name: /open maintenance work order/i,
            });
            fireEvent.change(
                within(dialog).getByLabelText(/defect description/i),
                { target: { value: 'Hydraulic oil leakage' } },
            );
            fireEvent.click(
                within(dialog).getByRole('button', {
                    name: /close work order dialog/i,
                }),
            );

            await waitFor(() =>
                expect(
                    screen.queryByRole('dialog', {
                        name: /open maintenance work order/i,
                    }),
                ).not.toBeInTheDocument(),
            );

            fireEvent.click(
                screen.getByRole('button', {
                    name: /open maintenance work order/i,
                }),
            );

            expect(
                within(
                    screen.getByRole('dialog', {
                        name: /open maintenance work order/i,
                    }),
                ).getByLabelText(/defect description/i),
            ).toHaveValue('Hydraulic oil leakage');
        });

        it('allows updating asset status with mandatory reason', () => {
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({
                        update_asset_status: true,
                    })}
                />,
            );

            // Switch to Readiness & Status tab
            const statusTab = screen.getByRole('tab', {
                name: /readiness & status/i,
            });
            fireEvent.click(statusTab);

            expect(screen.getByText(/transitioning to/i)).toBeInTheDocument();

            const reasonInput = screen.getByLabelText(
                /reason for status change/i,
            );
            fireEvent.change(reasonInput, {
                target: { value: 'Periodic maintenance completed' },
            });

            const updateBtn = screen.getByRole('button', {
                name: /update asset status/i,
            });
            fireEvent.click(updateBtn);

            expect(mockPost).toHaveBeenCalledWith(
                '/operations/assets/1/status',
                expect.any(Object),
            );
        });

        it('keeps status mutations on the same asset and tab with inline success feedback', () => {
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({
                        update_asset_status: true,
                    })}
                />,
            );

            const statusTab = screen.getByRole('tab', {
                name: /readiness & status/i,
            });
            fireEvent.click(statusTab);
            fireEvent.change(
                screen.getByLabelText(/reason for status change/i),
                { target: { value: 'Routine availability check' } },
            );
            fireEvent.click(
                screen.getByRole('button', { name: /update asset status/i }),
            );

            const [, options] = mockPost.mock.calls.at(-1) as [
                string,
                {
                    onSuccess?: () => void;
                    preserveScroll?: boolean;
                    preserveState?: boolean;
                },
            ];
            expect(options.preserveScroll).toBe(true);
            expect(options.preserveState).toBe(true);

            act(() => options.onSuccess?.());

            expect(statusTab).toHaveAttribute('aria-selected', 'true');
            expect(
                screen.getByText('Status updated to Available.'),
            ).toBeInTheDocument();
            expect(
                screen.queryByText('Operations overview'),
            ).not.toBeInTheDocument();
        });

        it('keeps unauthorized detail tabs read-only while preserving their records', () => {
            const asset = createAsset(1, 'CRN-001', 'crane', 'available', {
                documents: [
                    {
                        id: 1,
                        category: 'road_permits',
                        category_label: 'Road Transit Permit',
                        title: 'Transit permit',
                        status: 'active',
                        validity_status: 'valid',
                        is_expired: false,
                        expires_soon: false,
                    },
                ],
            });

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities({
                        update_asset_status: false,
                        inspect_asset: false,
                        maintain_asset: false,
                    })}
                />,
            );

            fireEvent.click(
                screen.getByRole('tab', { name: /readiness & status/i }),
            );
            expect(
                screen.getByText(
                    /does not have authorization to update status/i,
                ),
            ).toBeInTheDocument();

            fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));
            expect(
                screen.queryByRole('button', {
                    name: /record workshop inspection/i,
                }),
            ).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('tab', { name: /work orders/i }));
            expect(
                screen.queryByRole('button', {
                    name: /open maintenance work order/i,
                }),
            ).not.toBeInTheDocument();

            fireEvent.click(
                screen.getByRole('tab', { name: /permits & docs/i }),
            );
            expect(screen.queryByText('Add Document')).not.toBeInTheDocument();
            expect(screen.getByText('Transit permit')).toBeInTheDocument();
        });
    });

    it('resets the detail pane to Overview only when the selected asset changes', () => {
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

        const statusTab = screen.getByRole('tab', {
            name: /readiness & status/i,
        });
        fireEvent.click(statusTab);
        expect(statusTab).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(screen.getByText('TRK-002'));

        expect(
            screen.getByRole('heading', { name: 'Asset TRK-002' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('tab', { name: /overview & specs/i }),
        ).toHaveAttribute('aria-selected', 'true');
        expect(
            screen.getByRole('tab', { name: /readiness & status/i }),
        ).not.toHaveAttribute('aria-selected', 'true');
    });

    describe('Responsive Navigation & Mobile Touch Ergonomics', () => {
        it('provides Back to fleet list button when onBackToList is provided', () => {
            const asset = createAsset(1, 'CRN-001', 'crane');
            const onBackMock = vi.fn();

            render(
                <FleetDetailPane
                    asset={asset}
                    capabilities={createCapabilities()}
                    onBackToList={onBackMock}
                />,
            );

            const backBtn = screen.getByRole('button', {
                name: /back to fleet list/i,
            });
            expect(backBtn).toBeInTheDocument();

            fireEvent.click(backBtn);
            expect(onBackMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('Phase 1 & Phase 2 Fleet Redesign Features', () => {
        it('SafetyLockoutBanner submits lockout release to /operations/maintenance/:id/release endpoint', () => {
            const lockout = {
                is_locked_out: true,
                lockout_reason: 'Hydraulic boom cylinder fault',
                locked_at: '2026-09-07T08:00:00Z',
                critical_defects_count: 1,
                can_override: true,
            };
            const workOrders = [
                {
                    id: 303,
                    defect: 'Hydraulic boom cylinder fault',
                    status: 'open',
                    dispatch_blocking: true,
                    scheduled_at: null,
                    next_due_at: null,
                    remarks: 'Safety hold',
                    work_performed: [],
                    parts: [],
                    released_at: null,
                },
            ];

            render(
                <SafetyLockoutBanner
                    lockout={lockout}
                    assetId={1}
                    assetCode="CRN-001"
                    maintenanceWorkOrders={workOrders}
                />,
            );

            const resolveBtn = screen.getByRole('button', {
                name: /resolve & clear lockout/i,
            });
            fireEvent.click(resolveBtn);

            expect(
                screen.getByRole('heading', {
                    level: 3,
                    name: 'Safety Lockout Resolution',
                }),
            ).toBeInTheDocument();

            const reasonInput = screen.getByLabelText(
                /managerial justification/i,
            );
            fireEvent.change(reasonInput, {
                target: { value: 'Hydraulics pressure tested at 250 bar' },
            });

            const submitBtn = screen.getByRole('button', {
                name: /sign off & return to service/i,
            });
            fireEvent.click(submitBtn);

            expect(mockPost).toHaveBeenCalledWith(
                '/operations/maintenance/303/release',
                expect.any(Object),
            );
        });

        it('deduplicates FleetQueue items by delegating to FleetAssetCard with interactive selection', () => {
            const onSelectMock = vi.fn();
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetQueue
                    assets={[asset]}
                    selectedAssetId={null}
                    onSelectAsset={onSelectMock}
                    locations={[]}
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

            // Asset item rendered via FleetAssetCard
            const assetBtn = screen.getByRole('button', { name: /crn-001/i });
            expect(assetBtn).toBeInTheDocument();
            fireEvent.click(assetBtn);

            expect(onSelectMock).toHaveBeenCalledWith(1);
        });

        it('supports 1-click exception filtering for lockouts, blocking orders, DVIR defects, and stale GPS in FleetSurface', () => {
            const asset1 = createAsset(1, 'CRN-001', 'crane', 'available');
            const asset2 = createAsset(2, 'CRN-002', 'crane', 'maintenance', {
                blocking_work_orders_count: 0,
                lockout: {
                    is_locked_out: true,
                    lockout_reason: 'Cable fray',
                    locked_at: '2026-09-07T08:00:00Z',
                    critical_defects_count: 1,
                    can_override: false,
                },
            });
            const asset3 = createAsset(3, 'TRK-003', 'truck', 'maintenance', {
                blocking_work_orders_count: 2,
            });
            const asset4 = createAsset(4, 'TRK-004', 'truck', 'available', {
                latest_dvir: {
                    id: 401,
                    status: 'critical_defect',
                    has_defects: true,
                    critical_defects_count: 1,
                    type: 'pre_trip',
                    completed_at: '2026-09-07T07:00:00Z',
                    inspector_name: 'Inspector',
                    photos: [
                        {
                            id: 1,
                            angle: 'front',
                            url: '/photos/defect.jpg',
                            file_name: 'defect.jpg',
                        },
                    ],
                },
            });
            const asset5 = createAsset(5, 'TRK-005', 'truck', 'available');

            const locations = [
                createLocation(1, 'fresh'),
                createLocation(5, 'stale'),
            ];

            render(
                <FleetSurface
                    assets={[asset1, asset2, asset3, asset4, asset5]}
                    locations={locations}
                    capabilities={createCapabilities()}
                />,
            );
            const fleetList = () =>
                screen.getByRole('list', { name: 'Fleet assets' });

            // Compact registry filter renders with the accurate unique-asset count
            expect(
                screen.getByRole('button', {
                    name: /needs attention \(4\)/i,
                }),
            ).toBeInTheDocument();

            const openTriageMenu = () => {
                const trigger = screen.getByRole('button', {
                    name: /needs attention \(4\)/i,
                });

                if (trigger.getAttribute('aria-expanded') !== 'true') {
                    fireEvent.click(trigger);
                }
            };

            // 1. Filter by Lockouts
            openTriageMenu();
            fireEvent.click(
                screen.getByRole('menuitemcheckbox', {
                    name: /lockouts \(1\)/i,
                }),
            );
            expect(
                screen.getAllByText('CRN-002').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                within(fleetList()).queryByText('CRN-001'),
            ).not.toBeInTheDocument();
            expect(
                within(fleetList()).queryByText('TRK-003'),
            ).not.toBeInTheDocument();

            // 2. Filter by Blocking Orders
            openTriageMenu();
            fireEvent.click(
                screen.getByRole('menuitemcheckbox', {
                    name: /blocking orders \(1\)/i,
                }),
            );
            expect(
                screen.getAllByText('TRK-003').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                within(fleetList()).queryByText('CRN-001'),
            ).not.toBeInTheDocument();

            // 3. Filter by DVIR Defects
            openTriageMenu();
            fireEvent.click(
                screen.getByRole('menuitemcheckbox', {
                    name: /dvir defects \(1\)/i,
                }),
            );
            expect(
                screen.getAllByText('TRK-004').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                within(fleetList()).queryByText('CRN-001'),
            ).not.toBeInTheDocument();

            // 4. Filter by Stale GPS
            openTriageMenu();
            fireEvent.click(
                screen.getByRole('menuitemcheckbox', {
                    name: /stale gps \(1\)/i,
                }),
            );
            expect(
                screen.getAllByText('TRK-005').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                within(fleetList()).queryByText('CRN-001'),
            ).not.toBeInTheDocument();

            // Clear the active triage filter from the compact menu
            openTriageMenu();
            fireEvent.click(
                screen.getByRole('menuitem', {
                    name: /clear exception filter/i,
                }),
            );
            expect(
                screen.getAllByText('CRN-001').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByText('CRN-002').length,
            ).toBeGreaterThanOrEqual(1);
        });

        it('renders contextual quick-action toolbar in FleetDetailPane and supports 1-click workflows', () => {
            const assetWithPhotos = createAsset(
                1,
                'CRN-001',
                'crane',
                'available',
                {
                    latest_dvir: {
                        id: 401,
                        status: 'pre_trip_passed',
                        has_defects: false,
                        critical_defects_count: 0,
                        type: 'pre_trip',
                        completed_at: '2026-09-07T07:00:00Z',
                        inspector_name: 'Inspector',
                        photos: [
                            {
                                id: 10,
                                angle: 'front',
                                url: '/photos/front.jpg',
                                file_name: 'front.jpg',
                            },
                            {
                                id: 11,
                                angle: 'rear',
                                url: '/photos/rear.jpg',
                                file_name: 'rear.jpg',
                            },
                        ],
                    },
                },
            );
            const location = createLocation(1, 'fresh');
            const onViewFullTrackingMock = vi.fn();

            render(
                <FleetDetailPane
                    asset={assetWithPhotos}
                    assetLocation={location}
                    capabilities={createCapabilities({
                        update_asset_status: true,
                        inspect_asset: true,
                        maintain_asset: true,
                        safety_lockdown_asset: true,
                    })}
                    onViewFullTracking={onViewFullTrackingMock}
                />,
            );

            // Contextual quick-action toolbar is present
            const toolbar = screen.getByRole('toolbar', {
                name: /asset quick actions/i,
            });
            expect(toolbar).toBeInTheDocument();

            // Asset actions belong to the selected-asset header, not tab content.
            const detailContent = screen.getByRole('region', {
                name: 'Asset detail content',
            });
            expect(
                within(detailContent).queryByRole('toolbar', {
                    name: /asset quick actions/i,
                }),
            ).not.toBeInTheDocument();

            // Quick action: Track on Map
            const trackBtn = screen.getByRole('button', {
                name: /track on map/i,
            });
            fireEvent.click(trackBtn);
            expect(onViewFullTrackingMock).toHaveBeenCalledTimes(1);

            // Redundant quick action buttons are removed from toolbar (except safety lockdown)
            expect(
                screen.queryByRole('button', { name: /update status/i }),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: /record inspection/i }),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: /open work order/i }),
            ).not.toBeInTheDocument();

            // Tab switching occurs directly via standard tabs
            const statusTab = screen.getByRole('tab', {
                name: /readiness & status/i,
            });
            fireEvent.click(statusTab);
            expect(screen.getByText(/transitioning to/i)).toBeInTheDocument();

            const inspectTab = screen.getByRole('tab', {
                name: /inspections/i,
            });
            fireEvent.click(inspectTab);
            expect(inspectTab).toHaveAttribute('aria-selected', 'true');

            const maintainTab = screen.getByRole('tab', {
                name: /work orders/i,
            });
            fireEvent.click(maintainTab);
            expect(maintainTab).toHaveAttribute('aria-selected', 'true');

            // Quick action: Walkaround Photos opens DVIR modal
            const photosActionBtn = screen.getByRole('button', {
                name: /walkaround photos \(2\)/i,
            });
            fireEvent.click(photosActionBtn);
            expect(
                screen.getByText('DVIR Walkaround Inspection'),
            ).toBeInTheDocument();
        });

        it('SafetyLockoutBanner prevents empty submission and displays validation errors', () => {
            const lockout = {
                is_locked_out: true,
                lockout_reason: 'Hydraulic failure',
                locked_at: '2026-09-07T08:00:00Z',
                critical_defects_count: 1,
                can_override: true,
            };
            const workOrders = [
                {
                    id: 304,
                    defect: 'Hydraulic line rupture',
                    status: 'open',
                    dispatch_blocking: true,
                    scheduled_at: null,
                    next_due_at: null,
                    remarks: 'Safety hold',
                    work_performed: ['Replaced high-pressure hose'],
                    parts: ['Hose #3'],
                    released_at: null,
                },
            ];

            render(
                <SafetyLockoutBanner
                    lockout={lockout}
                    assetCode="CRN-001"
                    maintenanceWorkOrders={workOrders}
                />,
            );

            // Open modal
            fireEvent.click(
                screen.getByRole('button', {
                    name: /resolve & clear lockout/i,
                }),
            );
            expect(
                screen.getByText('Safety Lockout Resolution'),
            ).toBeInTheDocument();

            // Submit button clicked without filling required override_reason
            const submitBtn = screen.getByRole('button', {
                name: /sign off & return to service/i,
            });
            fireEvent.click(submitBtn);

            // Should NOT have called mockPost because reason is empty
            expect(mockPost).not.toHaveBeenCalled();

            // Validation error message rendered
            expect(
                screen.getByText(/managerial justification is required/i),
            ).toBeInTheDocument();
        });

        it('SafetyLockoutBanner resolves using lockout.blocking_work_order_id when work orders array is empty', () => {
            const lockoutWithId = {
                is_locked_out: true,
                lockout_reason: 'Weld crack',
                locked_at: '2026-09-07T08:00:00Z',
                critical_defects_count: 1,
                can_override: true,
                blocking_work_order_id: 888,
            };

            render(
                <SafetyLockoutBanner
                    lockout={lockoutWithId}
                    assetCode="TRK-009"
                    maintenanceWorkOrders={[]}
                />,
            );

            // Button should still appear because blocking_work_order_id is available
            const resolveBtn = screen.getByRole('button', {
                name: /resolve & clear lockout/i,
            });
            expect(resolveBtn).toBeInTheDocument();
            fireEvent.click(resolveBtn);

            expect(screen.getByText(/work order #888/i)).toBeInTheDocument();

            const reasonInput = screen.getByLabelText(
                /managerial justification/i,
            );
            fireEvent.change(reasonInput, {
                target: { value: 'Weld ultrasound test passed' },
            });

            const submitBtn = screen.getByRole('button', {
                name: /sign off & return to service/i,
            });
            fireEvent.click(submitBtn);

            expect(mockPost).toHaveBeenCalledWith(
                '/operations/maintenance/888/release',
                expect.any(Object),
            );
        });

        it('supports multi-facet combination filtering (triage + category + search) with empty state recovery', () => {
            const asset1 = createAsset(1, 'CRN-001', 'crane', 'available');
            const asset2 = createAsset(2, 'CRN-002', 'crane', 'maintenance', {
                blocking_work_orders_count: 1,
            });
            const asset3 = createAsset(3, 'TRK-003', 'truck', 'maintenance', {
                blocking_work_orders_count: 1,
            });

            render(
                <FleetSurface
                    assets={[asset1, asset2, asset3]}
                    locations={[]}
                    capabilities={createCapabilities()}
                />,
            );
            const fleetList = () =>
                screen.getByRole('list', { name: 'Fleet assets' });

            // 1. Activate blocking_orders triage filter -> excludes CRN-001
            fireEvent.click(
                screen.getByRole('button', {
                    name: /needs attention \(2\)/i,
                }),
            );
            fireEvent.click(
                screen.getByRole('menuitemcheckbox', {
                    name: /blocking orders \(2\)/i,
                }),
            );
            expect(
                within(fleetList()).queryByText('CRN-001'),
            ).not.toBeInTheDocument();
            expect(
                screen.getAllByText('CRN-002').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByText('TRK-003').length,
            ).toBeGreaterThanOrEqual(1);

            // 2. Further filter to "Transport" category -> excludes CRN-002
            fireEvent.click(
                screen.getByRole('button', {
                    name: /filter assets: all assets/i,
                }),
            );
            fireEvent.click(
                screen.getByRole('menuitemradio', {
                    name: /transport \(1\)/i,
                }),
            );
            expect(
                within(fleetList()).queryByText('CRN-002'),
            ).not.toBeInTheDocument();
            expect(
                screen.getAllByText('TRK-003').length,
            ).toBeGreaterThanOrEqual(1);

            // 3. Search query that matches nothing -> empty state
            const searchInput = screen.getByPlaceholderText(
                /search code, name, model/i,
            );
            fireEvent.change(searchInput, {
                target: { value: 'nonexistent-unit' },
            });
            expect(screen.getByText('No matching assets')).toBeInTheDocument();
            expect(
                screen.getByRole('heading', {
                    level: 2,
                    name: 'Asset CRN-001',
                }),
            ).toBeInTheDocument();

            // 4. Clear filters button restores everything
            fireEvent.click(
                screen.getByRole('button', { name: /clear filters/i }),
            );
            expect(
                screen.getAllByText('CRN-001').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByText('CRN-002').length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByText('TRK-003').length,
            ).toBeGreaterThanOrEqual(1);
        });

        it('FleetQuickActionToolbar hides Track on Map when view_tracking capability is false', () => {
            const asset = createAsset(1, 'CRN-001', 'crane');
            const location = createLocation(1, 'fresh');

            render(
                <FleetDetailPane
                    asset={asset}
                    assetLocation={location}
                    capabilities={createCapabilities({
                        view_tracking: false,
                    })}
                    onViewFullTracking={vi.fn()}
                />,
            );

            expect(
                screen.queryByRole('button', { name: /track on map/i }),
            ).not.toBeInTheDocument();
        });

        it('FleetQuickActionToolbar supports DVIR without photos with fallback label', () => {
            const assetNoPhotos = createAsset(
                1,
                'CRN-001',
                'crane',
                'available',
                {
                    latest_dvir: {
                        id: 405,
                        status: 'critical_defect',
                        has_defects: true,
                        critical_defects_count: 1,
                        type: 'pre_trip',
                        completed_at: '2026-09-07T07:00:00Z',
                        inspector_name: 'Inspector',
                        photos: [],
                    },
                },
            );

            render(
                <FleetDetailPane
                    asset={assetNoPhotos}
                    capabilities={createCapabilities()}
                />,
            );

            // Scoped to quick action toolbar
            const toolbar = screen.getByRole('toolbar', {
                name: /asset quick actions/i,
            });
            const dvirBtn = within(toolbar).getByRole('button', {
                name: /walkaround photos/i,
            });
            expect(dvirBtn).toBeInTheDocument();
            fireEvent.click(dvirBtn);

            expect(
                screen.getByText('DVIR Walkaround Inspection'),
            ).toBeInTheDocument();
            expect(
                screen.getByText(
                    'No walkaround photos attached to this inspection',
                ),
            ).toBeInTheDocument();
        });

        it('FleetAssetCard supports keyboard selection via Enter and Space keys', () => {
            const onSelectMock = vi.fn();
            const asset = createAsset(1, 'CRN-001', 'crane');

            render(
                <FleetQueue
                    assets={[asset]}
                    selectedAssetId={null}
                    onSelectAsset={onSelectMock}
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

            const card = screen.getByRole('button', { name: /crn-001/i });
            fireEvent.keyDown(card, { key: 'Enter' });
            expect(onSelectMock).toHaveBeenCalledWith(1);

            fireEvent.keyDown(card, { key: ' ' });
            expect(onSelectMock).toHaveBeenCalledWith(1);
        });

        it('FleetSurface does not infer stale GPS from operator duty activity when tracking is missing', () => {
            const assetWithStaleOperator = createAsset(
                1,
                'CRN-001',
                'crane',
                'available',
                {
                    active_operator: {
                        id: 99,
                        name: 'Bob Operator',
                        hours_elapsed: 4.5,
                        shift_started_at: '2026-09-07T04:00:00Z',
                        telemetry_status: 'stale',
                    },
                },
            );

            render(
                <FleetSurface
                    assets={[assetWithStaleOperator]}
                    locations={[]}
                    capabilities={createCapabilities()}
                />,
            );

            const needsAttention = screen.getByRole('button', {
                name: /needs attention \(0\)/i,
            });
            expect(needsAttention).toBeInTheDocument();

            fireEvent.click(needsAttention);
            expect(
                screen.queryByRole('menuitemcheckbox', {
                    name: /stale gps/i,
                }),
            ).not.toBeInTheDocument();
        });
    });
});
