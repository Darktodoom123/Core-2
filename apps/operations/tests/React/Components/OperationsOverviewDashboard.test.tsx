import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationsOverviewDashboard } from '@/components/dashboards/operations-overview-dashboard';
import type {
    AssetViewModel,
    AuditEventViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    GptRecommendationViewModel,
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

    const mockAuditEvents: AuditEventViewModel[] = [
        {
            id: 40,
            action: 'auth.login',
            actor: { id: 1, name: 'Admin User' },
            reason: 'Forensic session established',
            occurred_at: '2026-09-13T11:55:00Z',
        } as unknown as AuditEventViewModel,
    ];

    const mockGptRecommendations: GptRecommendationViewModel[] = [
        {
            id: 50,
            status: 'approved',
            cost_usd: 0.012,
            summary: 'Optimal route recommendation for Job 101',
        } as unknown as GptRecommendationViewModel,
        {
            id: 51,
            status: 'pending',
            cost_usd: 0.008,
            summary: 'Asset reallocation advisory',
        } as unknown as GptRecommendationViewModel,
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

    it('renders system administrator view without AI-slop elements and provides streamlined navigation', async () => {
        mockAuthRole = 'system_administrator';
        mockAuthRoleLabel = 'System Administrator';

        render(
            <OperationsOverviewDashboard
                jobs={mockJobs}
                assets={mockAssets}
                fuelRequests={mockFuelRequests}
                locations={mockLocations}
                approvals={[]}
                users={mockUsers}
                auditEvents={mockAuditEvents}
                gptRecommendations={mockGptRecommendations}
                capabilities={capabilities}
                availableSections={availableSections}
                onSectionChange={mockOnSectionChange}
            />,
        );

        // 1. Dashboard title exists: "Operation Dashboard"
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /operation dashboard/i,
            }),
        ).toBeInTheDocument();

        // 2. Redundant AI-slop badge next to title is absent
        expect(
            screen.queryByText('[System Administrator]'),
        ).not.toBeInTheDocument();

        // 3. Cluttered "ADMIN QUICK ACTIONS:" banner is absent
        expect(
            screen.queryByText(/ADMIN QUICK ACTIONS/i),
        ).not.toBeInTheDocument();

        // 4. Modern command toolbar buttons are present
        const usersBtn = screen.getByRole('button', {
            name: /Users & Credentials/i,
        });
        const auditBtn = screen.getByRole('button', {
            name: /Audit Trail & Diffs/i,
        });
        const gptBtn = screen.getByRole('button', {
            name: /AI Advisory Governance/i,
        });
        const dispatchBtn = screen.getByRole('button', {
            name: /Dispatch Workspace/i,
        });
        const assetsBtn = screen.getByRole('button', {
            name: /Fleet & Telemetry/i,
        });

        expect(usersBtn).toBeInTheDocument();
        expect(auditBtn).toBeInTheDocument();
        expect(gptBtn).toBeInTheDocument();
        expect(dispatchBtn).toBeInTheDocument();
        expect(assetsBtn).toBeInTheDocument();

        // 5. Clicking toolbar buttons navigates to correct sections
        fireEvent.click(usersBtn);
        expect(mockOnSectionChange).toHaveBeenCalledWith('users');

        fireEvent.click(auditBtn);
        expect(mockOnSectionChange).toHaveBeenCalledWith('audit');

        fireEvent.click(gptBtn);
        expect(mockOnSectionChange).toHaveBeenCalledWith('gpt-recommendations');

        fireEvent.click(dispatchBtn);
        expect(mockOnSectionChange).toHaveBeenCalledWith('dispatch');

        fireEvent.click(assetsBtn);
        expect(mockOnSectionChange).toHaveBeenCalledWith('assets');

        // 6. High-density MetricStrip KPIs render cleanly
        expect(screen.getByText('Platform Health')).toBeInTheDocument();
        expect(screen.getByText('Active User Accounts')).toBeInTheDocument();
        expect(screen.getByText('AI Governance & Spend')).toBeInTheDocument();
        expect(screen.getByText('Audit Trail Events')).toBeInTheDocument();

        // 7. Clicking KPI button navigates
        const activeUsersKpi = screen
            .getByText('Active User Accounts')
            .closest('button');
        expect(activeUsersKpi).not.toBeNull();
        fireEvent.click(activeUsersKpi!);
        expect(mockOnSectionChange).toHaveBeenCalledWith('users');

        // 8. Infrastructure diagnostics heading and refresh button exist
        expect(
            screen.getByRole('heading', {
                name: /Infrastructure & Telemetry Subsystems/i,
            }),
        ).toBeInTheDocument();

        const probeRefreshBtn = screen.getByRole('button', {
            name: /Refresh Health/i,
        });
        expect(probeRefreshBtn).toBeInTheDocument();
        await act(async () => {
            fireEvent.click(probeRefreshBtn);
        });
        expect(global.fetch).toHaveBeenCalledWith(
            '/operations/admin/health',
            expect.anything(),
        );

        // 9. Compliance Radar renders cleanly
        expect(
            screen.getByRole('heading', {
                name: /Security & Qualification Compliance Radar/i,
            }),
        ).toBeInTheDocument();
        expect(screen.getByText(/Driver License/i)).toBeInTheDocument();

        // 10. AI Spend Governance renders cleanly
        expect(
            screen.getByRole('heading', {
                name: /AI Advisory & Spend Governance/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Monthly Token Budget Spend/i),
        ).toBeInTheDocument();
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

    it('honestly displays unhealthy platform status with danger indicators and subsystem diagnostics', async () => {
        mockAuthRole = 'system_administrator';
        mockAuthRoleLabel = 'System Administrator';

        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            status: 'unhealthy',
                            services: {
                                database: {
                                    status: 'offline',
                                    latency_ms: null,
                                },
                                cache: {
                                    status: 'offline',
                                    latency_ms: null,
                                },
                                outbox: {
                                    status: 'degraded',
                                    failed: 7,
                                    pending: 3,
                                    delivered: 100,
                                },
                                queues: {
                                    status: 'degraded',
                                    failed_jobs: 4,
                                    pending_jobs: 2,
                                },
                            },
                        }),
                }),
            ),
        );

        render(
            <OperationsOverviewDashboard
                jobs={mockJobs}
                assets={mockAssets}
                fuelRequests={mockFuelRequests}
                locations={mockLocations}
                approvals={[]}
                users={mockUsers}
                auditEvents={mockAuditEvents}
                gptRecommendations={mockGptRecommendations}
                capabilities={capabilities}
                availableSections={availableSections}
                onSectionChange={mockOnSectionChange}
            />,
        );

        // Subsystem health probe should have completed
        expect(await screen.findByText('Unhealthy')).toBeInTheDocument();
        expect(screen.getByText('UNHEALTHY')).toBeInTheDocument();
        expect(screen.getByText('7 Failed')).toBeInTheDocument();
        expect(screen.getByText('4 Failed')).toBeInTheDocument();
        expect(screen.getAllByText('Offline')).toHaveLength(2); // database and cache

        // Verify no fake fallback mock latencies are displayed
        expect(screen.queryByText('12.4 ms')).not.toBeInTheDocument();
        expect(screen.queryByText('1.2 ms')).not.toBeInTheDocument();
    });

    it('handles probe error gracefully without fake metrics and displays honest error state', async () => {
        mockAuthRole = 'system_administrator';
        mockAuthRoleLabel = 'System Administrator';

        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(() =>
                Promise.resolve({
                    ok: false,
                    status: 503,
                }),
            ),
        );

        render(
            <OperationsOverviewDashboard
                jobs={mockJobs}
                assets={mockAssets}
                fuelRequests={mockFuelRequests}
                locations={mockLocations}
                approvals={[]}
                users={mockUsers}
                auditEvents={mockAuditEvents}
                gptRecommendations={mockGptRecommendations}
                capabilities={capabilities}
                availableSections={availableSections}
                onSectionChange={mockOnSectionChange}
            />,
        );

        const unavailableBadges = await screen.findAllByText('Unavailable');
        expect(unavailableBadges.length).toBeGreaterThanOrEqual(1);
        expect(
            screen.getByText(/Health probe returned status 503/i),
        ).toBeInTheDocument();

        // Subsystem cards should show honest unknown/unavailable indicators rather than fake data
        expect(screen.queryByText('12.4 ms')).not.toBeInTheDocument();
        expect(screen.queryByText('1.2 ms')).not.toBeInTheDocument();
    });
});
