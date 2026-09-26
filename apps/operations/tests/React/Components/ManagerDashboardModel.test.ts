import { describe, expect, it } from 'vitest';
import {
    buildManagerQueue,
    countBySource,
    countQueueCategories,
    fleetBucket,
    formatCountdown,
    formatElapsed,
    fuelNextStep,
    nowMarkerPercent,
    partitionTodayJobs,
    scheduleState,
    sortScheduleJobs,
    sourceLabel,
    summarizeAuthorizations,
    summarizeFleet,
    summarizeSafety,
    summarizeSchedule,
    timelineBar,
    timelineWindow,
    upcomingJobs,
    visibleQueueItems,
} from '@/components/dashboards/manager/manager-dashboard-model';
import type {
    FuelLogViewModel,
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
    minutesAgo,
    sos,
} from './manager-dashboard-fixtures';

describe('manager action queue', () => {
    it('orders emergencies, safety blockers, decisions, then fuel', () => {
        const queue = buildManagerQueue(
            {
                activeSosIncidents: [
                    sos('acknowledged', {
                        status: {
                            value: 'acknowledged',
                            label: 'Acknowledged',
                        },
                        received_at: minutesAgo(30),
                        acknowledged_by: {
                            id: 2,
                            name: 'Duty Manager',
                            phone: null,
                        },
                    }),
                    sos('newer', { received_at: minutesAgo(1) }),
                    sos('older', {
                        status: { value: 'escalated', label: 'Escalated' },
                        received_at: minutesAgo(5),
                    }),
                    sos('closed', {
                        status: { value: 'resolved', label: 'Resolved' },
                    }),
                ],
                assets: [asset(1), asset(2, { blocking_work_orders_count: 1 })],
                approvals: [approval(1)],
                fuelRequests: [fuel(1, 'forwarded')],
                capabilities: ALL_FUEL_CAPABILITIES,
            },
            NOW,
        );

        expect(queue.map((item) => item.key)).toEqual([
            'sos-older',
            'sos-newer',
            'sos-acknowledged',
            'asset-2',
            'approval-1',
            'fuel-1',
        ]);
        expect(queue[2].detail).toContain('Acknowledged by Duty Manager');
        expect(countQueueCategories(queue)).toEqual({
            emergency: 3,
            safety: 1,
            approvals: 1,
            fuel: 1,
        });
    });

    it('prioritises decisions the user can make, then priority, then start time', () => {
        const queue = buildManagerQueue(
            {
                activeSosIncidents: [],
                assets: [],
                approvals: [
                    approval(1, {}, { scheduled_start: at(9) }),
                    approval(
                        2,
                        {},
                        {
                            scheduled_start: at(15),
                            priority: {
                                value: 'emergency',
                                label: 'Emergency',
                            },
                        },
                    ),
                    approval(3, {
                        can_decide: false,
                        decision_blocker: 'You requested this change.',
                    }),
                ],
                fuelRequests: [],
                capabilities: ALL_FUEL_CAPABILITIES,
            },
            NOW,
        );

        expect(queue.map((item) => item.key)).toEqual([
            'approval-2',
            'approval-1',
            'approval-3',
        ]);
        expect(queue[0].title).toBe('Activate dispatch DSP-0102');
        expect(queue[2].detail).toBe('You requested this change.');
    });

    it('only lists fuel requests the current capabilities can act on', () => {
        const forwardOnly = {
            forward_fuel: true,
            approve_fuel: false,
            verify_fuel: false,
            record_fuel: false,
        } as WorkspaceCapabilities;

        expect(fuelNextStep(fuel(1, 'submitted'), forwardOnly)).toBe(
            'Forward for review',
        );
        expect(fuelNextStep(fuel(1, 'forwarded'), forwardOnly)).toBeNull();
        expect(fuelNextStep(fuel(1, 'submitted'), ALL_FUEL_CAPABILITIES)).toBe(
            'Approve or reject',
        );
        expect(fuelNextStep(fuel(1, 'approved'), ALL_FUEL_CAPABILITIES)).toBe(
            'Verify allocation',
        );
        expect(
            fuelNextStep(
                fuel(1, 'verified', { logs: [{ id: 1 } as FuelLogViewModel] }),
                ALL_FUEL_CAPABILITIES,
            ),
        ).toBeNull();
        expect(
            fuelNextStep(fuel(1, 'logged'), ALL_FUEL_CAPABILITIES),
        ).toBeNull();

        const queue = buildManagerQueue(
            {
                activeSosIncidents: [],
                assets: [],
                approvals: [],
                fuelRequests: [
                    fuel(1, 'submitted', {
                        urgency: { value: 'normal', label: 'Normal' },
                    }),
                    fuel(2, 'submitted', {
                        urgency: { value: 'critical', label: 'Critical' },
                    }),
                    fuel(3, 'forwarded'),
                ],
                capabilities: forwardOnly,
            },
            NOW,
        );

        expect(queue.map((item) => item.key)).toEqual(['fuel-2', 'fuel-1']);
        expect(queue[0].subjectDetail).toBe('Next step: Forward for review');
        expect(queue[0].title).toBe('180 L diesel for TR-12');
    });

    it('never collapses emergencies behind the preview limit', () => {
        const queue = buildManagerQueue(
            {
                activeSosIncidents: Array.from({ length: 6 }, (_, index) =>
                    sos(`s${index}`, { received_at: minutesAgo(index + 1) }),
                ),
                assets: [asset(1, { blocking_work_orders_count: 1 })],
                approvals: [approval(1)],
                fuelRequests: [],
                capabilities: ALL_FUEL_CAPABILITIES,
            },
            NOW,
        );

        const preview = visibleQueueItems(queue, 'all', false);
        expect(preview.total).toBe(8);
        expect(preview.items).toHaveLength(6);
        expect(
            preview.items.every((item) => item.category === 'emergency'),
        ).toBe(true);

        expect(visibleQueueItems(queue, 'all', true).items).toHaveLength(8);

        const approvalsOnly = visibleQueueItems(queue, 'approvals', false);
        expect(approvalsOnly.total).toBe(1);
        expect(approvalsOnly.items[0].key).toBe('approval-1');
    });

    it('counts only decidable approvals and actionable fuel as authorizations', () => {
        const queue = buildManagerQueue(
            {
                activeSosIncidents: [sos('a')],
                assets: [],
                approvals: [
                    approval(1, { created_at: minutesAgo(90) }),
                    approval(2, { can_decide: false }),
                ],
                fuelRequests: [
                    fuel(1, 'forwarded', { submitted_at: minutesAgo(20) }),
                ],
                capabilities: ALL_FUEL_CAPABILITIES,
            },
            NOW,
        );

        expect(summarizeAuthorizations(queue)).toEqual({
            total: 2,
            approvals: 1,
            fuelRequests: 1,
            oldestWaitingSince: minutesAgo(90),
        });
    });
});

describe('safety summary', () => {
    it('counts unresolved SOS and blocked units and finds the next escalation', () => {
        const soonest = new Date(NOW + 60_000).toISOString();
        const summary = summarizeSafety(
            [
                sos('a', {
                    escalation_due_at: new Date(NOW + 120_000).toISOString(),
                }),
                sos('b', { escalation_due_at: soonest }),
                sos('c', {
                    status: { value: 'escalated', label: 'Escalated' },
                    escalation_due_at: new Date(NOW - 60_000).toISOString(),
                }),
                sos('d', {
                    status: { value: 'cancelled', label: 'Cancelled' },
                }),
                sos('e', {
                    status: { value: 'acknowledged', label: 'Acknowledged' },
                }),
            ],
            [asset(1, { blocking_work_orders_count: 2 }), asset(2)],
            NOW,
        );

        expect(summary).toEqual({
            total: 5,
            openSos: 4,
            unacknowledged: 3,
            blockedUnits: 1,
            nextEscalationAt: soonest,
            escalatedCount: 1,
        });
    });
});

describe('fleet summary', () => {
    it('buckets each unit once, with dispatch-blocking work taking precedence', () => {
        expect(
            fleetBucket(
                asset(1, {
                    status: { value: 'working', label: 'Working' },
                    blocking_work_orders_count: 1,
                }),
            ),
        ).toBe('blocked');
        expect(
            fleetBucket(
                asset(2, { status: { value: 'assigned', label: 'Assigned' } }),
            ),
        ).toBe('on_job');
        expect(
            fleetBucket(
                asset(3, {
                    status: {
                        value: 'awaiting_parts',
                        label: 'Awaiting parts',
                    },
                    is_dispatchable: false,
                }),
            ),
        ).toBe('maintenance');
        expect(fleetBucket(asset(4))).toBe('available');
        expect(fleetBucket(asset(5, { is_dispatchable: false }))).toBe(
            'not_cleared',
        );
    });

    it('reports readiness, categories, DVIRs today, HoS warnings, and partial coverage', () => {
        const summary = summarizeFleet(
            [
                asset(1, {
                    latest_dvir: {
                        completed_at: at(7),
                        critical_defects_count: 0,
                    } as AssetViewModel['latest_dvir'],
                }),
                asset(2, {
                    status: { value: 'working', label: 'Working' },
                    is_dispatchable: false,
                    hos: {
                        dole_warning: true,
                        fatigue_status: 'warning',
                    } as AssetViewModel['hos'],
                    active_operator: {
                        id: 44,
                    } as AssetViewModel['active_operator'],
                }),
                asset(3, {
                    category: 'transport',
                    category_label: 'Transport',
                    blocking_work_orders_count: 1,
                    latest_dvir: {
                        completed_at: at(7, 0, -1),
                        critical_defects_count: 1,
                    } as AssetViewModel['latest_dvir'],
                }),
                asset(4, {
                    category: 'transport',
                    category_label: 'Transport',
                    status: {
                        value: 'under_maintenance',
                        label: 'Under maintenance',
                    },
                    is_dispatchable: false,
                    hos: {
                        dole_warning: false,
                        fatigue_status: 'normal',
                    } as AssetViewModel['hos'],
                }),
            ],
            64,
            NOW,
        );

        expect(summary.counts).toEqual({
            available: 1,
            on_job: 1,
            maintenance: 1,
            blocked: 1,
            not_cleared: 0,
        });
        expect(summary.inService).toBe(2);
        expect(summary.readinessPercent).toBe(50);
        expect(summary.loaded).toBe(4);
        expect(summary.total).toBe(64);
        expect(summary.partial).toBe(true);
        expect(summary.dvirsToday).toBe(1);
        expect(summary.hosWarnings).toBe(1);
        expect(summary.categories).toEqual([
            {
                value: 'mobile_cranes',
                label: 'Mobile cranes',
                total: 2,
                inService: 2,
                available: 1,
            },
            {
                value: 'transport',
                label: 'Transport',
                total: 2,
                inService: 0,
                available: 0,
            },
        ]);
    });

    it('returns no readiness percentage when no units are visible', () => {
        const summary = summarizeFleet([], 0, NOW);

        expect(summary.readinessPercent).toBeNull();
        expect(summary.partial).toBe(false);
    });
});

describe("today's schedule", () => {
    it('maps lifecycle statuses to exclusive schedule states', () => {
        expect(scheduleState(job(1, 'working'))).toBe('in_progress');
        expect(scheduleState(job(2, 'pending_approval'))).toBe(
            'awaiting_approval',
        );
        expect(scheduleState(job(3, 'draft'))).toBe('needs_resources');
        expect(
            scheduleState(job(4, 'scheduled', { asset_assignments: [] })),
        ).toBe('needs_resources');
        expect(scheduleState(job(5, 'scheduled'))).toBe('scheduled');
    });

    it('keeps jobs that overlap today and separates undated drafts', () => {
        const jobs = [
            job(1, 'working', {
                scheduled_start: at(6, 0, -1),
                scheduled_end: at(8),
            }),
            job(2, 'scheduled', {
                scheduled_start: at(13),
                scheduled_end: at(9, 0, 1),
            }),
            job(3, 'scheduled', {
                scheduled_start: at(9, 0, 1),
                scheduled_end: at(12, 0, 1),
            }),
            job(4, 'draft', { scheduled_start: null, scheduled_end: null }),
        ];

        const { dated, undated } = partitionTodayJobs(jobs, NOW);

        expect(dated.map((item) => item.id)).toEqual([1, 2]);
        expect(undated.map((item) => item.id)).toEqual([4]);
    });

    it('lists active work first, then by start time', () => {
        const sorted = sortScheduleJobs([
            job(1, 'scheduled', { scheduled_start: at(7) }),
            job(2, 'working', { scheduled_start: at(10) }),
            job(3, 'pending_approval', { scheduled_start: at(6) }),
        ]);

        expect(sorted.map((item) => item.id)).toEqual([2, 3, 1]);
    });

    it('summarizes state counts and reported delays for execution work only', () => {
        const delay = { id: 1 } as DispatchJobViewModel['latest_delay'];
        const summary = summarizeSchedule([
            job(1, 'working', { latest_delay: delay }),
            job(2, 'dispatched'),
            job(3, 'pending_approval', { latest_delay: delay }),
            job(4, 'draft'),
            job(5, 'scheduled'),
        ]);

        expect(summary).toEqual({
            total: 5,
            counts: {
                in_progress: 2,
                scheduled: 1,
                awaiting_approval: 1,
                needs_resources: 1,
            },
            delayReported: 1,
        });
    });

    it('groups sources like the dispatch desk, with non-Core 1 work as manual', () => {
        const rental = job(2, 'working', {
            source: {
                type: 'rental_reservation',
                label: 'Rental',
                reference: null,
                status: null,
                fulfillment_mode: null,
                location: null,
            },
        });
        const direct = job(3, 'working', { source: null });

        expect(countBySource([job(1, 'working'), rental, direct])).toEqual({
            all: 3,
            service: 1,
            rental: 1,
            manual: 1,
        });
        expect(sourceLabel(rental)).toBe('Rental');
        expect(sourceLabel(direct)).toBe('Manual');
    });

    it('widens the 07:00–17:00 window to fit work and clamps bars at the edges', () => {
        const early = job(1, 'working', {
            scheduled_start: at(6, 30),
            scheduled_end: at(9),
        });
        const overnight = job(2, 'scheduled', {
            scheduled_start: at(13),
            scheduled_end: at(9, 0, 1),
        });
        const window = timelineWindow([early, overnight], NOW);

        expect(window.hours[0]).toBe(6);
        expect(window.hours.at(-1)).toBe(23);

        const defaultWindow = timelineWindow([job(3, 'scheduled')], NOW);
        expect(defaultWindow.hours).toEqual([
            7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
        ]);

        const bar = timelineBar(overnight, window);
        expect(bar?.endsAfterWindow).toBe(true);
        expect(bar?.startsBeforeWindow).toBe(false);
        expect(bar!.leftPercent + bar!.widthPercent).toBeCloseTo(100);

        expect(nowMarkerPercent(defaultWindow, NOW)).toBeCloseTo(27);
        expect(
            nowMarkerPercent(
                defaultWindow,
                new Date(2026, 8, 26, 20).getTime(),
            ),
        ).toBeNull();
    });

    it('falls back to server-ranked upcoming work without history or duplicates', () => {
        const upcoming = upcomingJobs(
            [
                job(1, 'dispatched'),
                job(2, 'completed'),
                job(3, 'draft'),
                job(4, 'cancelled'),
            ],
            new Set([3]),
        );

        expect(upcoming.map((item) => item.id)).toEqual([1]);
    });
});

describe('time formatting', () => {
    it('formats waiting ages and countdowns', () => {
        expect(formatElapsed(minutesAgo(0.5), NOW)).toBe('<1 m');
        expect(formatElapsed(minutesAgo(0.5), NOW, { precise: true })).toBe(
            '30 s',
        );
        expect(formatElapsed(minutesAgo(72 / 60), NOW, { precise: true })).toBe(
            '1 m 12 s',
        );
        expect(formatElapsed(minutesAgo(24), NOW)).toBe('24 m');
        expect(formatElapsed(minutesAgo(65), NOW)).toBe('1 h 05 m');
        expect(formatElapsed(minutesAgo(3 * 24 * 60), NOW)).toBe('3 d');
        expect(formatElapsed(null, NOW)).toBeNull();
        expect(formatCountdown(108_000)).toBe('1:48');
        expect(formatCountdown(3_723_000)).toBe('1:02:03');
        expect(formatCountdown(-5)).toBe('0:00');
    });
});
