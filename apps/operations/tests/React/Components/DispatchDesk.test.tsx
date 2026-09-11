import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DispatchDesk } from '@/components/workspace/dispatch-desk';
import {
    deriveDispatchDeskConflicts,
    jobOverlapsDate,
    jobOverlapsPeriod,
    nextActionForJob,
} from '@/components/workspace/dispatch-desk/dispatch-desk-helpers';
import {
    DispatchResources,
    hasResourceOverlap,
    resourceCommitments,
} from '@/components/workspace/dispatch-desk/dispatch-resources';
import { readDispatchDeskState } from '@/components/workspace/dispatch-desk/use-dispatch-desk-state';
import type {
    ApprovalViewModel,
    DispatchJobViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

function capabilities(
    overrides: Partial<WorkspaceCapabilities> = {},
): WorkspaceCapabilities {
    return {
        create_dispatch: false,
        create_client: false,
        create_service_request: false,
        convert_service_request: false,
        create_rental_dispatch: false,
        create_sales_dispatch: false,
        share_location: false,
        view_tracking: false,
        request_fuel: false,
        forward_fuel: false,
        approve_fuel: false,
        verify_fuel: false,
        record_fuel: false,
        decide_approval: false,
        update_assigned_dispatch_status: false,
        update_asset_status: false,
        safety_lockdown_asset: false,
        inspect_asset: false,
        maintain_asset: false,
        request_gpt_assistance: false,
        decide_gpt_recommendation: false,
        retry_gpt_recommendation: false,
        create_job_report: false,
        attachment_upload: false,
        attachment_policy: {
            owner_type: 'job_report',
            max_bytes: 1,
            max_count: 1,
            accepted_mime_types: [],
        },
        review_job_report: false,
        export_reports: false,
        manage_notifications: false,
        view_archive: false,
        restore_dispatch: false,
        view_sos: false,
        respond_sos: false,
        ...overrides,
    };
}

function job(
    id: number,
    status: DispatchJobViewModel['status']['value'] = 'scheduled',
): DispatchJobViewModel {
    const today = new Date();
    const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        9,
    );
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    return {
        id,
        reference: `DSP-${id}`,
        client: 'Northwind Logistics',
        title: 'Crane delivery',
        site: 'Makati yard',
        site_notes: null,
        source: null,
        priority: { value: 'routine', label: 'Routine' },
        status: { value: status, label: status.replace('_', ' ') },
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        requirements: ['Operator credential'],
        version: 1,
        updated_at: start.toISOString(),
        personnel_assignments: [],
        asset_assignments: [],
    };
}

describe('dispatch resources', () => {
    const assignment = {
        id: 1,
        user_id: 21,
        name: 'Casey Rigger',
        type: 'rigger',
        response_status: {
            value: 'pending' as const,
            label: 'Pending response',
        },
        responded_at: null,
        response_reason: null,
    };

    it('keeps undated commitments visible and excludes terminal assignments', () => {
        const active = {
            ...job(1),
            scheduled_start: null,
            scheduled_end: null,
            personnel_assignments: [assignment],
        };
        const completed = {
            ...job(2, 'completed'),
            personnel_assignments: [assignment],
        };
        expect(
            resourceCommitments(
                [active, completed],
                'people',
                21,
                '2026-09-05',
            ),
        ).toEqual([active]);
        expect(
            resourceCommitments([active], 'assets', 21, '2026-09-05'),
        ).toEqual([]);
    });

    it('distinguishes actual overlaps from adjacent assignments', () => {
        const first = job(1);
        const second = job(2);
        expect(hasResourceOverlap([first, second])).toBe(true);
        expect(
            hasResourceOverlap([
                first,
                {
                    ...second,
                    scheduled_start: first.scheduled_end,
                    scheduled_end: new Date(
                        new Date(first.scheduled_end!).getTime() + 3600000,
                    ).toISOString(),
                },
            ]),
        ).toBe(false);
    });

    it('shows personnel availability, searches, and switches to asset records', () => {
        render(
            <DispatchResources
                users={[
                    {
                        id: 21,
                        name: 'Casey Rigger',
                        role: 'rigger',
                        role_label: 'Rigger',
                        is_active: true,
                        suspended_at: null,
                        availability_status: 'on_leave',
                        has_credentials: false,
                    },
                ]}
                assets={[]}
                jobs={[]}
                initialDate="2026-09-05"
                returnTo="/?view=dispatch"
                refreshing={false}
            />,
        );
        expect(screen.getByText('Casey Rigger')).toBeInTheDocument();
        expect(screen.getByText('Availability: on leave')).toBeInTheDocument();
        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search people and assets' }),
            { target: { value: 'missing' } },
        );
        expect(
            screen.getByText(
                'No matches. Try another name, role, or asset code.',
            ),
        ).toBeInTheDocument();
        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search people and assets' }),
            { target: { value: '' } },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Assets' }));
        expect(
            screen.getByText('No asset records are loaded for your access.'),
        ).toBeInTheDocument();
    });

    it('exposes resources independently of job selection and separates assigned crew and equipment', () => {
        window.history.replaceState({}, '', '/?dispatch_view=schedule');
        const assigned = {
            ...job(1),
            personnel_assignments: [assignment],
            asset_assignments: [
                {
                    id: 2,
                    operational_asset_id: 3,
                    code: 'CR-21',
                    name: 'Mobile crane',
                    type: 'crane',
                },
            ],
        };
        render(
            <DispatchDesk
                jobs={[assigned]}
                clients={[]}
                serviceRequests={[]}
                rentalHandoffs={[]}
                salesHandoffs={[]}
                capabilities={capabilities()}
                canCreate={false}
                refreshing={false}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'People & assets' }),
        );
        expect(
            screen.getByRole('heading', { name: 'People & assets' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Assigned personnel' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Assigned equipment' }),
        ).toBeInTheDocument();
        expect(screen.getByText('CR-21 · Mobile crane')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'AI assistance' }),
        ).toHaveAttribute('href', '#dispatch-ai-assistance');
    });
});

describe('dispatch desk URL state', () => {
    it('maps legacy project planning links to resource coverage mode', () => {
        const state = readDispatchDeskState(
            '?dispatch_tab=project-plans&dispatch_job=24&dispatch_date=2026-09-07',
        );

        expect(state.view).toBe('schedule');
        expect(state.mode).toBe('resources');
        expect(state.selectedJobId).toBe(24);
        expect(state.date).toBe('2026-09-07');
    });

    it('opens incoming intake when a service request is supplied', () => {
        const state = readDispatchDeskState('', 42);

        expect(state.view).toBe('incoming');
        expect(state.showIntake).toBe(true);
    });

    it('lets an explicit desk view consume the service request bootstrap context', () => {
        const state = readDispatchDeskState(
            '?serviceRequestId=42&dispatch_view=schedule',
        );

        expect(state.view).toBe('schedule');
        expect(state.showIntake).toBe(false);
    });
});

describe('dispatch desk derived behavior', () => {
    it('detects overnight interval overlap using the full local day window', () => {
        expect(
            jobOverlapsDate(
                {
                    scheduled_start: '2026-09-03T23:00:00',
                    scheduled_end: '2026-09-04T02:00:00',
                },
                '2026-09-04',
            ),
        ).toBe(true);
    });

    it('scopes calendar periods to their complete week and month intervals', () => {
        expect(
            jobOverlapsPeriod(
                {
                    scheduled_start: '2026-09-13T23:00:00',
                    scheduled_end: '2026-09-14T01:00:00',
                },
                '2026-09-09',
                'week',
            ),
        ).toBe(true);
        expect(
            jobOverlapsPeriod(
                {
                    scheduled_start: '2026-08-31T23:00:00',
                    scheduled_end: '2026-09-01T01:00:00',
                },
                '2026-09-15',
                'month',
            ),
        ).toBe(true);
        expect(
            jobOverlapsPeriod(
                {
                    scheduled_start: '2026-10-01T00:00:00',
                    scheduled_end: '2026-10-01T01:00:00',
                },
                '2026-09-15',
                'month',
            ),
        ).toBe(false);
    });

    it('does not surface terminal assignments as live conflicts and maps both overlap jobs', () => {
        const first = job(1);
        const second = job(2);
        const completed = job(3, 'completed');
        first.personnel_assignments = [
            {
                id: 11,
                user_id: 8,
                name: 'A. Operator',
                type: 'operator',
                response_status: { value: 'accepted', label: 'Accepted' },
                responded_at: null,
                response_reason: null,
            },
        ];
        second.personnel_assignments = [...first.personnel_assignments];
        completed.personnel_assignments = [...first.personnel_assignments];

        const conflicts = deriveDispatchDeskConflicts({
            jobs: [first, second, completed],
            assets: [],
            approvals: [],
            gptRecommendations: [],
        });

        expect(
            conflicts.filter((item) => item.type === 'overlap'),
        ).toHaveLength(2);
        expect(conflicts.some((item) => item.jobId === 1)).toBe(true);
        expect(conflicts.some((item) => item.jobId === 2)).toBe(true);
        expect(conflicts.some((item) => item.jobId === 3)).toBe(false);

        const nonJobApproval = {
            id: 12,
            kind: 'fuel_request',
            status: { value: 'pending', label: 'Pending' },
            subject: {
                id: 1,
                reference: 'Fuel #1',
                title: null,
                site: null,
                site_notes: null,
                scheduled_start: null,
                scheduled_end: null,
                priority: null,
                status: null,
                version: null,
            },
            requester: { id: 8, name: 'Dispatcher' },
            requested_changes: {
                personnel: [],
                assets: [],
                ended_personnel: [],
                ended_assets: [],
            },
            can_decide: false,
            decision_blocker: 'Role cannot decide this request.',
            created_at: null,
        } as ApprovalViewModel;

        const approvalConflicts = deriveDispatchDeskConflicts({
            jobs: [first],
            assets: [],
            approvals: [nonJobApproval],
            gptRecommendations: [],
        });

        expect(approvalConflicts[0]?.jobId).toBeUndefined();
    });

    it('prioritizes a pending approval over draft preparation work', () => {
        const approvalConflict = {
            id: 'approval-1',
            type: 'approval' as const,
            severity: 'warning' as const,
            title: 'Pending approval',
            description: 'Approval is pending.',
            actionRequired: 'Review the approval.',
            jobId: 4,
        };

        expect(
            nextActionForJob(job(4, 'draft'), [approvalConflict]).label,
        ).toBe('Review approval');
        expect(nextActionForJob(job(5, 'pending_approval'), []).label).toBe(
            'Review approval',
        );
    });
});

describe('DispatchDesk', () => {
    it('renders the task first views and one authoritative review action', () => {
        window.history.replaceState({}, '', '/?view=dispatch');
        render(
            <DispatchDesk
                jobs={[job(7)]}
                clients={[]}
                serviceRequests={[]}
                rentalHandoffs={[]}
                salesHandoffs={[]}
                capabilities={capabilities()}
                canCreate={false}
                refreshing={false}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Dispatch desk' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Incoming work/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Schedule/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /In progress/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /History/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', {
                name: /Review readiness before activation/,
            }),
        ).toHaveAttribute(
            'href',
            expect.stringContaining('/operations/dispatch-jobs/7'),
        );
    });

    it('links draft dispatches with pending approvals to the activation review', () => {
        window.history.replaceState({}, '', '/?dispatch_view=schedule');
        const pendingApproval = {
            id: 91,
            kind: 'dispatch_activation',
            status: { value: 'pending', label: 'Pending' },
            subject: {
                id: 10,
                reference: 'DSP-10',
                title: 'Crane delivery',
                site: 'Makati yard',
                site_notes: null,
                scheduled_start: null,
                scheduled_end: null,
                priority: null,
                status: { value: 'draft', label: 'Draft' },
                version: 1,
            },
            requester: { id: 2, name: 'Operations coordinator' },
            requested_changes: {
                personnel: [],
                assets: [],
                ended_personnel: [],
                ended_assets: [],
            },
            can_decide: true,
            decision_blocker: null,
            created_at: null,
        } as ApprovalViewModel;

        render(
            <DispatchDesk
                jobs={[job(10, 'draft')]}
                clients={[]}
                serviceRequests={[]}
                rentalHandoffs={[]}
                salesHandoffs={[]}
                capabilities={capabilities()}
                canCreate={false}
                refreshing={false}
                approvals={[pendingApproval]}
            />,
        );

        expect(
            screen.getByRole('link', { name: 'Review approval' }),
        ).toHaveAttribute(
            'href',
            expect.stringContaining('#dispatch-activation'),
        );
    });

    it('composes search and attention filters in the URL', () => {
        window.history.replaceState({}, '', '/?view=dispatch');
        render(
            <DispatchDesk
                jobs={[job(8)]}
                clients={[]}
                serviceRequests={[]}
                rentalHandoffs={[]}
                salesHandoffs={[]}
                capabilities={capabilities()}
                canCreate={false}
                refreshing={false}
            />,
        );

        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: 'Makati' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: /Needs attention/ }),
        );

        expect(window.location.search).toContain('dispatch_q=Makati');
        expect(window.location.search).toContain('dispatch_attention=1');
    });

    it('follows browser URL changes without losing the desk view', () => {
        window.history.replaceState({}, '', '/?dispatch_view=schedule');
        render(
            <DispatchDesk
                jobs={[job(9, 'working')]}
                clients={[]}
                serviceRequests={[]}
                rentalHandoffs={[]}
                salesHandoffs={[]}
                capabilities={capabilities()}
                canCreate={false}
                refreshing={false}
            />,
        );

        act(() => {
            window.history.pushState({}, '', '/?dispatch_view=in-progress');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });

        expect(
            screen.getByRole('button', { name: /In progress/ }),
        ).toHaveAttribute('aria-current', 'page');
        expect(screen.getAllByText('Crane delivery').length).toBeGreaterThan(0);
    });

    it('keeps schedule controls available while resource coverage is active', () => {
        window.history.replaceState(
            {},
            '',
            '/?dispatch_view=schedule&dispatch_mode=resources',
        );
        render(
            <DispatchDesk
                jobs={[]}
                clients={[]}
                serviceRequests={[]}
                rentalHandoffs={[]}
                salesHandoffs={[]}
                capabilities={capabilities()}
                canCreate={false}
                refreshing={false}
                resourceCoverage={<div>Coverage surface</div>}
            />,
        );

        expect(
            screen.getByRole('group', { name: 'Schedule display' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'List' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Coverage surface')).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: 'Select a dispatch' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByLabelText('Selected schedule date'),
        ).not.toBeInTheDocument();
    });

    it('does not expose manual intake controls to a read-only user', () => {
        window.history.replaceState(
            {},
            '',
            '/?dispatch_view=incoming&dispatch_intake_mode=manual',
        );
        render(
            <DispatchDesk
                jobs={[]}
                clients={[]}
                serviceRequests={[]}
                rentalHandoffs={[]}
                salesHandoffs={[]}
                capabilities={capabilities()}
                canCreate={false}
                refreshing={false}
            />,
        );

        expect(screen.getByText('Incoming work queue')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /Create direct dispatch/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', {
                name: /Submit|Save draft|Create dispatch/i,
            }),
        ).not.toBeInTheDocument();
        expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });
});
