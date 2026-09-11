import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shiftIssues } from '@/components/workspace/project-planning/shared';
import {
    DispatchWorkspace,
    ResourceCoverageWorkspace,
} from '@/components/workspace/project-planning-workspace';
import type { ProjectPlanningViewModel } from '@/types/workspace';

const post = vi.hoisted(() => vi.fn());
vi.mock('@inertiajs/react', () => ({
    router: { post, get: vi.fn() },
    usePage: () => ({
        url: window.location.pathname + window.location.search,
        props: { errors: {} },
    }),
    Link: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

function fixture(): ProjectPlanningViewModel {
    return {
        page: 1,
        last_page: 1,
        total: 1,
        can_edit: true,
        as_of: '2026-09-01T00:00:00Z',
        projects: [
            {
                id: 1,
                name: 'Bridge project',
                source_reference: 'CORE1-100',
                client: 'Contractor',
                site: 'Bridge',
                status: 'approved',
                version: 4,
                approved_version: 3,
                decision_reason: null,
                can_decide: false,
                phases: [
                    {
                        id: 1,
                        name: 'Lifting',
                        kind: 'operations',
                        starts_at: '2026-09-01T00:00:00Z',
                        ends_at: '2026-12-01T00:00:00Z',
                        coverage: { crane_operator: 1, driver: 0, rigger: 0 },
                        allocations: [
                            {
                                id: 1,
                                operational_asset_id: 1,
                                code: 'CR-1',
                                name: 'Crane',
                                kind: 'reservation',
                                status: 'available',
                                starts_at: '2026-09-01T00:00:00Z',
                                ends_at: '2026-12-01T00:00:00Z',
                                notes: null,
                            },
                        ],
                        shifts: [
                            {
                                id: 1,
                                job_id: 1,
                                reference: 'DSP-1',
                                status: 'draft',
                                starts_at: '2026-09-04T07:00:00Z',
                                ends_at: '2026-09-04T15:00:00Z',
                                version: 1,
                                locked: false,
                                confirmed_plan_version: null,
                                personnel: [],
                                pending_roster: null,
                                reason: null,
                                can_decide: false,
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

beforeEach(() => {
    window.history.replaceState(
        {},
        '',
        '/?view=dispatch&dispatch_tab=project-plans&phase=1',
    );
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
        configurable: true,
        value() {
            this.setAttribute('open', '');
        },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
        configurable: true,
        value() {
            this.removeAttribute('open');
        },
    });
    post.mockReset();
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [
                    {
                        id: 2,
                        name: 'Alex Reyes',
                        eligible: true,
                        reasons: [],
                        commitments: [],
                    },
                ],
                current_page: 1,
                last_page: 1,
                total: 1,
            }),
        }),
    );
});

describe('project planning workflow', () => {
    it('presents planning as operational resource coverage with Core 1 context', () => {
        render(<ResourceCoverageWorkspace planning={fixture()} assets={[]} />);

        expect(
            screen.getByRole('heading', { name: 'Resource coverage' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: /Bridge project.*Work reference: CORE1-100/,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /Core 1 remains the project owner.*Core 2 operational coverage only/,
            ),
        ).toBeInTheDocument();
        expect(screen.queryByText('Project plans')).not.toBeInTheDocument();
    });

    it('hides the previous roles candidates immediately during a role switch', async () => {
        const data = fixture();
        data.projects[0].phases[0].coverage.rigger = 1;
        render(
            <DispatchWorkspace
                planning={data}
                assets={[]}
                dispatches={<div>Daily jobs</div>}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Fill crew coverage' }),
        );
        const dialog = screen.getByRole('dialog', {
            name: /Fill crew coverage/,
        });
        expect(
            await within(dialog).findByRole('button', { name: 'Assign' }),
        ).toBeEnabled();
        fireEvent.click(
            within(dialog).getByRole('button', { name: /Riggers/ }),
        );
        expect(
            within(dialog).queryByRole('button', { name: 'Assign' }),
        ).not.toBeInTheDocument();
        expect(
            within(dialog).getByText('Checking availability…'),
        ).toBeInTheDocument();
        expect(
            within(dialog).queryByRole('button', {
                name: 'Remove Alex Reyes from Riggers',
            }),
        ).not.toBeInTheDocument();
    });
    it('lets a coordinator add the first phase to an empty project', () => {
        const data = fixture();
        data.projects[0].phases = [];
        render(
            <DispatchWorkspace
                planning={data}
                assets={[]}
                dispatches={<div>Daily jobs</div>}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Add operating phase' }),
        );
        expect(
            screen.getByRole('dialog', { name: 'Add operating phase' }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Operators per shift')).toHaveValue(1);
    });

    it('preserves an open crew editor across refresh and submits the reviewed versions', async () => {
        const data = fixture();
        const view = render(
            <DispatchWorkspace
                planning={data}
                assets={[]}
                dispatches={<div>Daily jobs</div>}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Fill crew coverage' }),
        );
        const dialog = screen.getByRole('dialog', {
            name: /Fill crew coverage/,
        });
        fireEvent.click(
            await within(dialog).findByRole('button', { name: 'Assign' }),
        );
        fireEvent.change(within(dialog).getByLabelText('Crew change reason'), {
            target: { value: 'Replace absent operator' },
        });
        const refreshed = structuredClone(data);
        refreshed.projects[0].version = 5;
        view.rerender(
            <DispatchWorkspace
                planning={refreshed}
                assets={[]}
                dispatches={<div>Daily jobs</div>}
            />,
        );
        expect(
            within(dialog).getByRole('button', {
                name: 'Remove Alex Reyes from Operators',
            }),
        ).toBeInTheDocument();
        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Review crew coverage change',
            }),
        );
        expect(
            within(dialog).getByText('All required roles are covered.'),
        ).toBeInTheDocument();
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Confirm crew' }),
        );
        expect(post).toHaveBeenCalledWith(
            '/operations/project-plans/1/shifts/1/roster',
            expect.objectContaining({
                version: 4,
                shift_version: 1,
                personnel: [{ user_id: 2, assignment_type: 'crane_operator' }],
            }),
            expect.any(Object),
        );
    });

    it('requires a new preview after allocation input changes', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => ({
                conflicts: [],
                affected_shifts: [{ id: 1, reference: 'DSP-1' }],
                approval: 'Independent approval required.',
            }),
        } as Response);
        render(
            <DispatchWorkspace
                planning={fixture()}
                assets={[]}
                dispatches={<div>Daily jobs</div>}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: /CR-1 · Crane.*Reserved on site/,
            }),
        );
        const dialog = screen.getByRole('dialog', {
            name: /resource coverage/i,
        });
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Review change' }),
        );
        await waitFor(() =>
            expect(
                within(dialog).getByRole('button', {
                    name: 'Confirm resource coverage change',
                }),
            ).toBeEnabled(),
        );
        fireEvent.change(within(dialog).getByLabelText('Notes'), {
            target: { value: 'Changed scope' },
        });
        expect(
            within(dialog).queryByRole('button', {
                name: 'Confirm resource coverage change',
            }),
        ).not.toBeInTheDocument();
        expect(post).not.toHaveBeenCalled();
    });

    it('shows maintenance and rejected personnel as actionable coverage gaps', () => {
        const plan = fixture().projects[0],
            phase = plan.phases[0],
            shift = phase.shifts[0];
        phase.allocations.push({
            ...phase.allocations[0],
            id: 2,
            kind: 'maintenance',
            starts_at: shift.starts_at,
            ends_at: shift.ends_at,
        });
        shift.personnel = [
            {
                user_id: 2,
                name: 'Alex',
                assignment_type: 'crane_operator',
                response: 'rejected',
            },
        ];
        const issues = shiftIssues(plan, phase, shift);
        expect(issues).toContain('Operators 0/1 — fill coverage');
        expect(
            issues.some((issue) => issue.includes('Maintenance interrupts')),
        ).toBe(true);
        shift.status = 'completed';
        expect(shiftIssues(plan, phase, shift)).toEqual([]);
    });
});
