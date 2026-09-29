import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationsOverviewDashboard } from '@/components/dashboards/operations-overview-dashboard';
import type {
    AssetViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    LocationUpdateViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

let mockAuthRole = 'system_administrator';
let mockAuthRoleLabel = 'System Administrator';

vi.mock('@inertiajs/react', () => ({
    Link: ({
        children,
        href,
        ...props
    }: {
        children: React.ReactNode;
        href: string;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
    usePage: () => ({
        props: {
            auth: {
                user: { id: 1, name: 'Admin User' },
                role: mockAuthRole,
                role_label: mockAuthRoleLabel,
            },
            flash: {},
            errors: {},
        },
        url: '/?view=overview',
        component: 'Operations',
        version: null,
    }),
}));

vi.mock('@/components/dashboards/live-tracking-preview', () => ({
    LiveTrackingPreview: ({
        onOpenTracking,
    }: {
        onOpenTracking?: () => void;
    }) => (
        <div data-testid="live-tracking-preview">
            <button onClick={onOpenTracking}>Mock Live Tracking</button>
        </div>
    ),
}));

describe('OperationsOverviewDashboard', () => {
    const mockOnSectionChange = vi.fn();

    const capabilities: WorkspaceCapabilities = {
        manage_dispatch: true,
        view_analytics: true,
        share_location: true,
        approve_requests: true,
        execute_actions: true,
    } as unknown as WorkspaceCapabilities;

    const availableSections: WorkspaceSection[] = [
        'overview',
        'dispatch',
        'assets',
        'fuel',
        'approvals',
        'users',
        'audit',
        'gpt-recommendations',
        'sos',
    ];

    const mockJobs: DispatchJobViewModel[] = [
        {
            id: 1,
            reference: 'JOB-101',
            title: 'Downtown Crane Lift',
            client: 'Metro Builders',
            site: 'Tower 4',
            status: { value: 'dispatched', label: 'Dispatched' },
            priority: { value: 'priority', label: 'Priority' },
            scheduled_start: '2026-09-13T09:00:00Z',
            scheduled_end: '2026-09-13T17:00:00Z',
            personnel_assignments: [],
            asset_assignments: [],
            requirements: [],
            version: 1,
            updated_at: '2026-09-13T08:00:00Z',
        } as unknown as DispatchJobViewModel,
    ];

    const mockAssets: AssetViewModel[] = [
        {
            id: 10,
            code: 'CR-01',
            name: 'Liebherr LTM 1050',
            kind: 'crane',
            status: { value: 'assigned', label: 'Assigned' },
            blocking_work_orders_count: 0,
        } as unknown as AssetViewModel,
    ];

    const mockFuelRequests: FuelRequestViewModel[] = [
        {
            id: 20,
            asset: { id: 10, code: 'CR-01' },
            quantity_litres: '150',
            status: { value: 'submitted', label: 'Submitted' },
        } as unknown as FuelRequestViewModel,
    ];

    const mockLocations: LocationUpdateViewModel[] = [
        {
            id: 30,
            user: { id: 1, name: 'Field Operator' },
            asset: { id: 10, code: 'CR-01', name: 'Crane 01', kind: 'crane' },
            freshness_status: 'fresh',
            recorded_at: '2026-09-13T12:00:00Z',
        } as unknown as LocationUpdateViewModel,
    ];

    const mockUsers: WorkspaceUserViewModel[] = [
        {
            id: 1,
            name: 'Admin User',
            email: 'admin@core2.test',
            role: 'system_administrator',
            role_label: 'System Administrator',
            is_active: true,
            credentials: [
                {
                    id: 101,
                    kind: 'Driver License',
                    credential_type: 'Class A CDL',
                    is_expired: true,
                    expires_soon: false,
                    expires_at: '2026-08-01',
                },
                {
                    id: 102,
                    kind: 'OSHA 30',
                    credential_type: 'Safety Certification',
                    is_expired: false,
                    expires_soon: true,
                    expires_at: '2026-09-20',
                },
            ],
        } as unknown as WorkspaceUserViewModel,
        {
            id: 2,
            name: 'Suspended Operator',
            email: 'operator@core2.test',
            role: 'driver',
            role_label: 'Field Operator',
            is_active: false,
            suspended_at: '2026-09-01T00:00:00Z',
            credentials: [],
        } as unknown as WorkspaceUserViewModel,
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthRole = 'system_administrator';
        mockAuthRoleLabel = 'System Administrator';

        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.includes('/operations/admin/health')) {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                status: 'healthy',
                                services: {
                                    database: {
                                        status: 'Operational',
                                        latency_ms: 1.4,
                                    },
                                    cache: {
                                        status: 'Operational',
                                        latency_ms: 0.8,
                                    },
                                    outbox: {
                                        status: 'Operational',
                                        failed: 0,
                                        pending: 0,
                                        delivered: 12,
                                    },
                                    queues: {
                                        status: 'Operational',
                                        failed_jobs: 0,
                                        pending_jobs: 0,
                                    },
                                },
                            }),
                    });
                }

                if (url.includes('/operations/dispatch-desk/jobs')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () =>
                            Promise.resolve({
                                jobs: [],
                                total: 0,
                                last_page: 1,
                            }),
                    });
                }

                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({}),
                });
            }),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('routes operations managers to the manager dashboard', async () => {
        mockAuthRole = 'operations_manager';
        mockAuthRoleLabel = 'Operations Manager';

        render(
            <OperationsOverviewDashboard
                jobs={mockJobs}
                assets={mockAssets}
                fuelRequests={mockFuelRequests}
                locations={mockLocations}
                approvals={[]}
                users={mockUsers}
                capabilities={capabilities}
                availableSections={availableSections}
                onSectionChange={mockOnSectionChange}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /operation dashboard/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: 'Today at a glance' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', {
                name: 'Manager action & exception queue',
            }),
        ).toBeInTheDocument();
        expect(screen.getByTestId('live-tracking-preview')).toBeInTheDocument();

        // Administrator tooling stays out of the manager view.
        expect(
            screen.queryByRole('button', { name: /Users & Credentials/i }),
        ).not.toBeInTheDocument();

        // Upcoming work from the overview props fills the empty schedule.
        expect(
            await screen.findByText("No dispatches on today's schedule"),
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'JOB-101' })).toHaveAttribute(
            'href',
            '/operations/dispatch-jobs/1?return_to=%2F%3Fview%3Doverview',
        );
    });

    it('renders operator field worker view with calm MetricStrip and shift KPIs', () => {
        mockAuthRole = 'field_worker';
        mockAuthRoleLabel = 'Field Operator';

        render(
            <OperationsOverviewDashboard
                jobs={mockJobs}
                assets={mockAssets}
                fuelRequests={mockFuelRequests}
                locations={mockLocations}
                approvals={[]}
                users={mockUsers}
                capabilities={capabilities}
                availableSections={availableSections}
                onSectionChange={mockOnSectionChange}
            />,
        );

        expect(screen.getByText("Today's Work")).toBeInTheDocument();
        expect(
            screen.getByText('Assigned Vehicles & Assets'),
        ).toBeInTheDocument();
        expect(screen.getByText('Fuel Requests')).toBeInTheDocument();
        expect(screen.getByText('GPS Telemetry Sharing')).toBeInTheDocument();

        const workKpi = screen.getByText("Today's Work").closest('button');
        expect(workKpi).not.toBeNull();
        fireEvent.click(workKpi!);
        expect(mockOnSectionChange).toHaveBeenCalledWith('dispatch');
    });
});
