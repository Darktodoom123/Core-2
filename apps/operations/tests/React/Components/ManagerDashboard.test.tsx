import { router } from '@inertiajs/react';
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationsManagerDashboardProps } from '@/components/dashboards/manager/manager-dashboard';
import { OperationsManagerDashboard } from '@/components/dashboards/manager/manager-dashboard';
import type {
    DispatchJobViewModel,
    ScopeRefreshState,
    WorkspaceCapabilities,
} from '@/types/workspace';
import {
    ALL_FUEL_CAPABILITIES,
    NOW,
    approval,
    asset,
    at,
    fuel,
    job,
    sos,
} from './manager-dashboard-fixtures';

vi.mock('@/components/dashboards/live-tracking-preview', () => ({
    LiveTrackingPreview: () => <div data-testid="live-tracking-preview" />,
}));

const ALL_SECTIONS: OperationsManagerDashboardProps['availableSections'] = [
    'overview',
    'dispatch',
    'assets',
    'fuel',
    'sos',
];

const DESK_JOBS_PATH = '/operations/dispatch-desk/jobs';

type DeskResponse =
    | { status: number }
    | { jobs: DispatchJobViewModel[]; total?: number; last_page?: number };

let deskResponses: DeskResponse[] = [];
let fetchMock: ReturnType<typeof vi.fn>;

function deskPage(
    jobs: DispatchJobViewModel[],
    { total = jobs.length, lastPage = 1 } = {},
): DeskResponse {
    return { jobs, total, last_page: lastPage };
}

function deskRequests(): URL[] {
    return fetchMock.mock.calls
        .map(([url]) => new URL(String(url), 'http://localhost'))
        .filter((url) => url.pathname === DESK_JOBS_PATH);
}

function renderDashboard(props: Partial<OperationsManagerDashboardProps> = {}) {
    const onSectionChange = vi.fn();
    const view = render(
        <OperationsManagerDashboard
            jobs={[]}
            assets={[]}
            fuelRequests={[]}
            locations={[]}
            approvals={[]}
            capabilities={ALL_FUEL_CAPABILITIES}
            availableSections={ALL_SECTIONS}
            onSectionChange={onSectionChange}
            {...props}
        />,
    );

    return { ...view, onSectionChange };
}

function queueRegion() {
    return screen.getByRole('region', {
        name: 'Manager action & exception queue',
    });
}

function scheduleRegion() {
    return screen.getByRole('region', {
        name: 'Dispatch overview & schedule',
    });
}

function metricValue(suffix: string | RegExp) {
    return within(screen.getByRole('region', { name: 'Today at a glance' }))
        .getByText(suffix)
        .closest('p');
}

function refreshState(
    overrides: Partial<ScopeRefreshState> = {},
): ScopeRefreshState {
    return {
        status: 'succeeded',
        mode: 'polling',
        refreshed_at: new Date(NOW - 20_000).toISOString(),
        stale_after_seconds: 60,
        last_attempt_at: null,
        last_success_at: null,
        error: null,
        ...overrides,
    };
}

describe('OperationsManagerDashboard', () => {
    beforeEach(() => {
        // Only Date is faked so the schedule fetch and timers still run.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        deskResponses = [deskPage([])];
        fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost');

            if (url.pathname !== DESK_JOBS_PATH) {
                return Promise.resolve(new Response('{}', { status: 404 }));
            }

            const next =
                deskResponses.length > 1
                    ? deskResponses.shift()!
                    : deskResponses[0];

            return Promise.resolve(
                'status' in next
                    ? new Response('{}', { status: next.status })
                    : new Response(JSON.stringify(next), { status: 200 }),
            );
        });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('ranks the action queue by urgency and offers only supported actions', async () => {
        const { onSectionChange } = renderDashboard({
            activeSosIncidents: [sos('a')],
            assets: [asset(1, { blocking_work_orders_count: 1 })],
            approvals: [
                approval(2, {
                    can_decide: false,
                    decision_blocker:
                        'Only the requester’s manager can decide.',
                }),
                approval(1),
            ],
            fuelRequests: [fuel(7, 'submitted')],
        });

        const queue = queueRegion();
        const rows = within(queue).getAllByRole('listitem');

        expect(rows.map((row) => row.textContent)).toEqual([
            expect.stringContaining('Site accident reported by Operator a'),
            expect.stringContaining('A-1 blocked from dispatch'),
            expect.stringContaining('Activate dispatch DSP-0101'),
            expect.stringContaining('Activate dispatch DSP-0102'),
            expect.stringContaining('for TR-12'),
        ]);
        expect(
            screen.getByText('5 items need action', { exact: false }),
        ).toBeInTheDocument();

        // Emergency: acknowledge posts to the SOS endpoint, escalation shown live.
        fireEvent.click(
            within(rows[0]).getByRole('button', {
                name: 'Acknowledge emergency',
            }),
        );
        expect(router.post).toHaveBeenCalledWith(
            '/operations/sos-incidents/a/acknowledge',
            {},
            expect.any(Object),
        );
        expect(
            screen.getByText(/SOS escalates to emergency contacts in 1:48/),
        ).toBeInTheDocument();

        // Approvals deep-link to the dispatch detail page, which enforces the decision.
        expect(
            within(rows[2]).getByRole('link', {
                name: 'Review approval for DSP-0101',
            }),
        ).toHaveAttribute(
            'href',
            '/operations/dispatch-jobs/101?return_to=%2F%3Fview%3Doverview',
        );
        expect(
            within(rows[3]).getByRole('link', {
                name: 'View dispatch DSP-0102',
            }),
        ).toBeInTheDocument();
        expect(rows[3]).toHaveTextContent(
            'Only the requester’s manager can decide.',
        );

        fireEvent.click(
            within(rows[1]).getByRole('button', {
                name: 'Review blocked unit A-1',
            }),
        );
        expect(onSectionChange).toHaveBeenLastCalledWith('assets');

        fireEvent.click(
            within(rows[4]).getByRole('button', {
                name: 'Review fuel request FR-7',
            }),
        );
        expect(onSectionChange).toHaveBeenLastCalledWith('fuel');

        await screen.findByText("No dispatches on today's schedule");
    });

    it('filters the queue with pressed toggles and from the metric chips', async () => {
        renderDashboard({
            activeSosIncidents: [sos('a')],
            approvals: [approval(1), approval(2)],
            fuelRequests: [fuel(7, 'submitted')],
        });

        const queue = queueRegion();
        const all = within(queue).getByRole('button', { name: 'All (4)' });
        const approvals = within(queue).getByRole('button', {
            name: 'Approvals (2)',
        });

        expect(all).toHaveAttribute('aria-pressed', 'true');
        expect(approvals).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(approvals);

        expect(approvals).toHaveAttribute('aria-pressed', 'true');
        expect(all).toHaveAttribute('aria-pressed', 'false');
        expect(within(queue).getAllByRole('listitem')).toHaveLength(2);

        fireEvent.click(
            within(queue).getByRole('button', { name: 'Safety (0)' }),
        );
        expect(within(queue).getByText('No safety items')).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Show 1 fuel request in the action queue',
            }),
        );
        expect(
            within(queue).getByRole('button', { name: 'Fuel (1)' }),
        ).toHaveAttribute('aria-pressed', 'true');
        expect(within(queue).getAllByRole('listitem')).toHaveLength(1);
        expect(
            screen.getByRole('heading', {
                name: 'Manager action & exception queue',
            }),
        ).toHaveFocus();

        await screen.findByText("No dispatches on today's schedule");
    });

    it('hides actions for sections and capabilities the role does not have', async () => {
        renderDashboard({
            availableSections: ['overview'],
            capabilities: {} as WorkspaceCapabilities,
            activeSosIncidents: [sos('a', { can_acknowledge: false })],
            assets: [asset(1, { blocking_work_orders_count: 1 })],
            approvals: [approval(1)],
            fuelRequests: [fuel(7, 'submitted')],
        });

        const queue = queueRegion();

        expect(within(queue).getAllByRole('listitem')).toHaveLength(3);
        expect(within(queue).queryByText(/for TR-12/)).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Acknowledge emergency' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /Review blocked unit/ }),
        ).not.toBeInTheDocument();
        expect(
            within(queue).getByRole('link', {
                name: 'Review approval for DSP-0101',
            }),
        ).toBeInTheDocument();

        // Fuel is not counted without a fuel capability.
        expect(metricValue('waiting for you')).toHaveTextContent(
            /^1\s*waiting for you$/,
        );
        expect(
            screen.queryByRole('button', { name: 'Open dispatch workspace' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Open Fleet & Equipment' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Open schedule' }),
        ).not.toBeInTheDocument();
        expect(screen.queryByTestId('live-tracking-preview')).toBeNull();

        await screen.findByText("No dispatches on today's schedule");
    });

    it('shows useful empty states when nothing needs attention', async () => {
        renderDashboard({
            jobs: [
                job(301, 'scheduled', {
                    scheduled_start: at(9, 0, 1),
                    scheduled_end: at(11, 0, 1),
                }),
                job(302, 'completed'),
            ],
        });

        expect(
            within(queueRegion()).getByText('Nothing needs your decision'),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('group', { name: 'Filter action queue' }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText('All field requests clear'),
        ).toBeInTheDocument();
        expect(screen.getByText('No open emergencies')).toBeInTheDocument();
        expect(screen.getByText('No fleet units visible')).toBeInTheDocument();

        const schedule = scheduleRegion();

        expect(
            await within(schedule).findByText(
                "No dispatches on today's schedule",
            ),
        ).toBeInTheDocument();
        expect(
            within(schedule).queryByRole('group', {
                name: 'Filter schedule by source',
            }),
        ).not.toBeInTheDocument();
        expect(
            within(schedule).getByRole('link', { name: 'DSP-301' }),
        ).toBeInTheDocument();
        expect(
            within(schedule).queryByRole('link', { name: 'DSP-302' }),
        ).not.toBeInTheDocument();
        expect(metricValue("on today's schedule")).toHaveTextContent(
            /^0\s*on today's schedule$/,
        );
    });

    it("counts today's dispatches from every page of the permission-scoped schedule", async () => {
        deskResponses = [
            deskPage(
                [
                    job(2, 'scheduled', {
                        scheduled_start: at(13),
                        scheduled_end: at(15),
                    }),
                    job(1, 'working'),
                ],
                { total: 4, lastPage: 2 },
            ),
            deskPage(
                [
                    job(3, 'pending_approval', {
                        scheduled_start: at(14),
                        scheduled_end: at(16),
                        source: {
                            type: 'rental_reservation',
                            label: 'Rental',
                            reference: null,
                            status: null,
                            fulfillment_mode: null,
                            location: null,
                        },
                    }),
                    job(4, 'draft', {
                        scheduled_start: null,
                        scheduled_end: null,
                    }),
                ],
                { total: 4, lastPage: 2 },
            ),
        ];

        const { onSectionChange } = renderDashboard({
            assets: [
                asset(1),
                asset(2, { status: { value: 'assigned', label: 'Assigned' } }),
                asset(3, {
                    status: {
                        value: 'under_maintenance',
                        label: 'Under maintenance',
                    },
                    is_dispatchable: false,
                }),
                asset(4, { blocking_work_orders_count: 1 }),
            ],
            assetsTotal: 64,
        });

        const schedule = scheduleRegion();
        await within(schedule).findByRole('link', { name: 'DSP-1' });

        const requests = deskRequests();
        expect(requests.map((url) => url.searchParams.get('page'))).toEqual([
            '1',
            '2',
        ]);
        expect(requests[0].searchParams.get('view')).toBe('schedule');
        expect(requests[0].searchParams.get('ends_after')).toBe(
            new Date(2026, 8, 26).toISOString(),
        );
        expect(requests[0].searchParams.get('starts_before')).toBe(
            new Date(2026, 8, 27).toISOString(),
        );

        // Undated drafts are listed separately, not counted on today's timeline.
        expect(metricValue("on today's schedule")).toHaveTextContent(
            /^3\s*on today's schedule$/,
        );
        expect(screen.getByText('3 dispatches today')).toBeInTheDocument();
        expect(
            within(schedule)
                .getAllByRole('listitem')
                .map((row) => within(row).getByRole('link').textContent),
        ).toEqual(['DSP-1', 'DSP-2', 'DSP-3']);

        fireEvent.click(
            within(schedule).getByRole('button', { name: 'Rental (1)' }),
        );
        expect(
            within(schedule)
                .getAllByRole('listitem')
                .map((row) => within(row).getByRole('link').textContent),
        ).toEqual(['DSP-3']);

        fireEvent.click(
            within(schedule).getByRole('button', {
                name: 'Open 1 unscheduled draft in the dispatch workspace',
            }),
        );
        expect(onSectionChange).toHaveBeenLastCalledWith('dispatch');

        // Fleet: available + on job are in service; the sample is labelled partial.
        expect(metricValue(/units in service/)).toHaveTextContent(
            /^50%\s*2 of 4 units in service$/,
        );
        expect(screen.getByText(/first 4 of 64 units/)).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'Show 1 blocked unit in the action queue',
            }),
        ).toBeInTheDocument();
    });

    it('explains when the schedule is forbidden without hiding the rest', async () => {
        deskResponses = [{ status: 403 }];

        renderDashboard({ approvals: [approval(1)] });

        expect(
            await within(scheduleRegion()).findByText('Schedule not available'),
        ).toBeInTheDocument();
        expect(
            screen.getAllByText('Your role cannot view the dispatch schedule.'),
        ).toHaveLength(2);
        expect(within(queueRegion()).getAllByRole('listitem')).toHaveLength(1);
    });

    it('recovers from a failed schedule load with Retry', async () => {
        deskResponses = [{ status: 500 }, deskPage([job(1, 'working')])];

        renderDashboard();

        const schedule = scheduleRegion();
        expect(
            await within(schedule).findByText(
                "Today's schedule could not be loaded. Other dashboard data is unaffected.",
            ),
        ).toBeInTheDocument();

        fireEvent.click(
            within(schedule).getByRole('button', { name: 'Retry' }),
        );

        expect(
            await within(schedule).findByRole('link', { name: 'DSP-1' }),
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(metricValue("on today's schedule")).toHaveTextContent(
                /^1\s*on today's schedule$/,
            ),
        );
    });

    it("marks today's count as partial when the schedule exceeds the page limit", async () => {
        // Five pages exist but only TODAY_SCHEDULE_MAX_PAGES (4) are fetched.
        deskResponses = [1, 2, 3, 4].map((page) =>
            deskPage(
                [
                    job(page, 'scheduled', {
                        scheduled_start: at(8 + page),
                        scheduled_end: at(9 + page),
                    }),
                ],
                { total: 101, lastPage: 5 },
            ),
        );

        renderDashboard();

        const schedule = scheduleRegion();
        await within(schedule).findByRole('link', { name: 'DSP-4' });

        expect(
            deskRequests().map((url) => url.searchParams.get('page')),
        ).toEqual(['1', '2', '3', '4']);
        expect(metricValue("on today's schedule")).toHaveTextContent(
            /^4\+\s*on today's schedule$/,
        );
        expect(screen.getByText('4+ dispatches today')).toBeInTheDocument();
        expect(
            screen.getByText(/Partial count · open the schedule/),
        ).toBeInTheDocument();
        expect(
            within(schedule).getByText(/first 100 loaded/),
        ).toBeInTheDocument();
    });

    it('refreshes the schedule in the background when workspace data changes', async () => {
        deskResponses = [deskPage([job(1, 'working')])];
        const props = {
            jobs: [],
            assets: [],
            fuelRequests: [],
            locations: [],
            approvals: [],
            capabilities: ALL_FUEL_CAPABILITIES,
            availableSections: ALL_SECTIONS,
            onSectionChange: vi.fn(),
        };
        const { rerender } = render(
            <OperationsManagerDashboard
                {...props}
                workspaceRefresh={refreshState()}
            />,
        );
        const schedule = scheduleRegion();
        await within(schedule).findByRole('link', { name: 'DSP-1' });

        deskResponses = [
            deskPage([
                job(1, 'working'),
                job(2, 'scheduled', {
                    scheduled_start: at(13),
                    scheduled_end: at(15),
                }),
            ]),
        ];
        rerender(
            <OperationsManagerDashboard
                {...props}
                workspaceRefresh={refreshState({
                    refreshed_at: new Date(NOW).toISOString(),
                })}
            />,
        );

        // Existing rows stay on screen instead of dropping back to a skeleton.
        expect(
            within(schedule).queryByRole('status', {
                name: "Loading today's schedule",
            }),
        ).not.toBeInTheDocument();
        expect(
            await within(schedule).findByRole('link', { name: 'DSP-2' }),
        ).toBeInTheDocument();
        expect(deskRequests()).toHaveLength(2);
    });

    it('reports the live connection separately from the age of the data', async () => {
        const { rerender } = renderDashboard({
            realtimeConnected: false,
            workspaceRefresh: refreshState(),
        });

        expect(
            screen.getByText('Live updates offline · checking every 15 s'),
        ).toBeInTheDocument();
        expect(screen.getByText(/Data refreshed 20 s ago/)).toBeInTheDocument();

        rerender(
            <OperationsManagerDashboard
                jobs={[]}
                assets={[]}
                fuelRequests={[]}
                locations={[]}
                approvals={[]}
                capabilities={ALL_FUEL_CAPABILITIES}
                availableSections={ALL_SECTIONS}
                onSectionChange={vi.fn()}
                realtimeConnected
                workspaceRefresh={refreshState({ status: 'failed' })}
            />,
        );

        expect(screen.getByText('Live updates connected')).toBeInTheDocument();
        expect(
            screen.getByText(/Refresh failed · showing data from/),
        ).toBeInTheDocument();

        await screen.findByText("No dispatches on today's schedule");
    });
});
