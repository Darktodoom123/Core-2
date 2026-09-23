import { router, usePage } from '@inertiajs/react';
import {
    CalendarRange,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Plus,
    Search,
    Square,
    Wrench,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge, Button, Input, Panel } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    ProjectPhaseViewModel,
    ProjectPlanningViewModel,
    ProjectPlanViewModel,
} from '@/types/workspace';
import { CoverageForm } from './project-planning/coverage';
import {
    AllocationForm,
    PhaseForm,
    ProjectForm,
    ShiftForm,
} from './project-planning/forms';
import { PhasePanel, PlanStatus } from './project-planning/phase-panel';
import {
    localValue,
    shiftIssues,
    shortDate,
    updateContext,
} from './project-planning/shared';
import { timelineWindow } from './project-planning/timeline';

type Scale = 'week' | 'month' | 'quarter';
export type PlanningEditor =
    | { type: 'project' }
    | { type: 'phase'; plan: number; phase?: number }
    | {
          type: 'allocation';
          plan: number;
          phase: number;
          allocation?: number;
          moveDays?: number;
      }
    | { type: 'shifts'; plan: number; phase: number }
    | { type: 'coverage'; plan: number; phase: number; shift: number };

export function DispatchWorkspace({
    planning,
    assets,
    dispatches,
}: {
    planning?: ProjectPlanningViewModel | null;
    assets: AssetViewModel[];
    dispatches: ReactNode;
}) {
    const { url } = usePage();
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const active =
        params.get('dispatch_tab') === 'project-plans' && planning
            ? 'project-plans'
            : 'dispatches';
    const selectTab = (tab: string) => {
        const next = new URLSearchParams(window.location.search);
        next.set('view', 'dispatch');
        next.set('dispatch_tab', tab);
        router.get(
            `/?${next}`,
            {},
            { preserveScroll: true, preserveState: true },
        );
    };

    return (
        <div>
            <nav
                className="flex gap-1 border-b border-line bg-surface px-5 lg:px-7"
                aria-label="Dispatch workspace views"
            >
                {['dispatches', ...(planning ? ['project-plans'] : [])].map(
                    (tab) => (
                        <button
                            key={tab}
                            aria-current={active === tab ? 'page' : undefined}
                            className={cn(
                                'min-h-11 border-b-2 px-4 text-sm font-medium',
                                active === tab
                                    ? 'border-brand-strong text-ink'
                                    : 'border-transparent text-ink-soft hover:text-ink',
                            )}
                            onClick={() => selectTab(tab)}
                        >
                            {tab === 'dispatches'
                                ? 'Dispatches'
                                : 'Resource coverage'}
                        </button>
                    ),
                )}
            </nav>
            {active === 'dispatches' ? (
                dispatches
            ) : (
                <ProjectPlans planning={planning!} assets={assets} />
            )}
        </div>
    );
}

/**
 * Operational resource coverage for work received from Core 1.
 *
 * The API still calls this payload a project plan for compatibility with the
 * existing planning endpoints. The UI deliberately describes what Core 2
 * owns: dates, reservations, shifts, crew coverage, and the approval trail.
 */
export function ResourceCoverageWorkspace({
    planning,
    assets,
}: {
    planning?: ProjectPlanningViewModel | null;
    assets: AssetViewModel[];
}) {
    if (!planning) {
        return (
            <div className="min-h-[calc(100vh-9rem)] bg-surface-subtle/50 p-5 lg:p-7">
                <Panel className="p-8 text-center">
                    <CalendarRange className="mx-auto size-8 text-ink-soft" />
                    <h1 className="mt-3 text-xl font-semibold text-ink">
                        Resource coverage is unavailable
                    </h1>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">
                        Refresh the dispatch workspace to load operational
                        reservations, shifts, and crew coverage.
                    </p>
                    <Button
                        className="mt-5"
                        variant="secondary"
                        onClick={() =>
                            router.reload({
                                only: ['projectPlanning', 'assets'],
                            })
                        }
                    >
                        Refresh resource coverage
                    </Button>
                </Panel>
            </div>
        );
    }

    return <ProjectPlans planning={planning} assets={assets} />;
}

function ProjectPlans({
    planning,
    assets,
}: {
    planning: ProjectPlanningViewModel;
    assets: AssetViewModel[];
}) {
    const initial = new URLSearchParams(
        typeof window === 'undefined' ? '' : window.location.search,
    );
    const [scale, setScale] = useState<Scale>(
        ['week', 'month', 'quarter'].includes(initial.get('scale') ?? '')
            ? (initial.get('scale') as Scale)
            : 'month',
    );
    const [closed, setClosed] = useState(new Set<number>());
    const [phaseId, setPhaseId] = useState(
        Number(initial.get('phase')) || null,
    );
    const [editor, setEditor] = useState<PlanningEditor | null>(null);
    const dragged = useRef<{
        x: number;
        plan: number;
        phase: number;
        allocation: number;
    } | null>(null);
    const [search, setSearch] = useState(initial.get('planning_search') ?? '');
    const earliest = planning.projects.flatMap((p) =>
        p.phases.map((phase) => new Date(phase.starts_at).getTime()),
    );
    const fallback = localValue(
        new Date(earliest.length ? Math.min(...earliest) : planning.as_of),
    ).slice(0, 10);
    const [date, setDate] = useState(
        initial.get('timeline_start')?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ??
            fallback,
    );
    const { start, end, ticks } = timelineWindow(date, scale);
    const days = (end - start) / 86400000;
    const selectedPlan = planning.projects.find((p) =>
        p.phases.some((phase) => phase.id === phaseId),
    );
    const selectedPhase = selectedPlan?.phases.find(
        (phase) => phase.id === phaseId,
    );
    const editPlan =
        editor && 'plan' in editor
            ? planning.projects.find((p) => p.id === editor.plan)
            : undefined;
    const editPhase =
        editPlan && editor && 'phase' in editor
            ? editPlan.phases.find((p) => p.id === editor.phase)
            : undefined;
    const select = (
        plan: ProjectPlanViewModel,
        phase: ProjectPhaseViewModel,
    ) => {
        setPhaseId(phase.id);
        updateContext({
            project: String(plan.id),
            phase: String(phase.id),
            timeline_start: date,
            scale,
        });
    };
    const changeDate = (value: string) => {
        if (!value) {
            return;
        }

        setDate(value);
        updateContext({ timeline_start: value });
    };
    const navigate = (page = 1) => {
        const next = new URLSearchParams(window.location.search);
        next.set('planning_search', search);
        next.set('planning_page', String(page));
        router.get(
            `/?${next}`,
            {},
            {
                preserveState: true,
                preserveScroll: true,
                only: ['projectPlanning'],
            },
        );
    };

    return (
        <div className="min-h-[calc(100vh-9rem)] bg-surface-subtle/50">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-5 py-5 lg:px-7">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-ink">
                        Resource coverage
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                        Schedule operational coverage for Core 1 work. Reserve
                        equipment, generate shifts, and fill the crew required
                        for safe activation.
                    </p>
                    <p className="mt-2 text-xs text-ink-soft">
                        Core 1 remains the project owner. This workspace records
                        Core 2 operational coverage only.
                    </p>
                </div>
                {planning.can_edit && (
                    <Button
                        variant="primary"
                        onClick={() => setEditor({ type: 'project' })}
                    >
                        <Plus className="size-4" />
                        Add coverage record
                    </Button>
                )}
            </header>
            <div className="p-4 lg:p-7">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            navigate();
                        }}
                        className="relative w-full sm:w-72"
                    >
                        <label>
                            <span className="sr-only">
                                Search coverage record or Core 1 reference
                            </span>
                            <Search className="absolute top-3.5 left-3 size-4 text-ink-soft" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                                placeholder="Search coverage or Core 1 reference"
                            />
                        </label>
                    </form>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            size="iconSm"
                            aria-label="Previous date range"
                            onClick={() =>
                                changeDate(
                                    localValue(
                                        new Date(start - days * 86400000),
                                    ).slice(0, 10),
                                )
                            }
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <label>
                            <span className="sr-only">Timeline start date</span>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => changeDate(e.target.value)}
                            />
                        </label>
                        <Button
                            size="iconSm"
                            aria-label="Next date range"
                            onClick={() =>
                                changeDate(
                                    localValue(new Date(end)).slice(0, 10),
                                )
                            }
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                        <div
                            className="flex rounded-lg border border-line bg-surface p-1"
                            aria-label="Timeline scale"
                        >
                            {(['week', 'month', 'quarter'] as const).map(
                                (value) => (
                                    <button
                                        key={value}
                                        aria-pressed={scale === value}
                                        className={cn(
                                            'min-h-9 rounded-md px-3 text-xs font-medium capitalize',
                                            scale === value
                                                ? 'bg-ink text-surface'
                                                : 'text-ink-soft',
                                        )}
                                        onClick={() => {
                                            setScale(value);
                                            updateContext({ scale: value });
                                        }}
                                    >
                                        {value}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>
                </div>
                <Panel className="overflow-hidden">
                    <div
                        className="overflow-x-auto"
                        onDragOver={(event) => {
                            if (dragged.current) {
                                event.preventDefault();
                            }
                        }}
                        onDrop={(event) => {
                            const drag = dragged.current;

                            if (!drag) {
                                return;
                            }

                            event.preventDefault();
                            const width =
                                (event.currentTarget.firstElementChild?.getBoundingClientRect()
                                    .width ?? 760) - 320;
                            const moveDays = Math.round(
                                ((event.clientX - drag.x) / width) * days,
                            );

                            if (moveDays !== 0) {
                                setEditor({
                                    type: 'allocation',
                                    plan: drag.plan,
                                    phase: drag.phase,
                                    allocation: drag.allocation,
                                    moveDays,
                                });
                            }

                            dragged.current = null;
                        }}
                        tabIndex={0}
                        aria-label="Project planning timeline"
                    >
                        <div className="min-w-[760px]">
                            <div className="grid grid-cols-[20rem_1fr] border-b border-line bg-surface-subtle text-xs font-medium text-ink-soft">
                                <div className="p-3">
                                    Coverage / phase / asset
                                </div>
                                <div className="relative border-l border-line">
                                    {ticks.slice(0, -1).map((tick) => (
                                        <span
                                            key={tick}
                                            className="absolute top-3 pl-2 whitespace-nowrap"
                                            style={{
                                                left: `${((tick - start) / (end - start)) * 100}%`,
                                            }}
                                        >
                                            {shortDate(new Date(tick))}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {!planning.projects.length && (
                                <div className="p-12 text-center">
                                    <CalendarRange className="mx-auto size-8 text-ink-soft" />
                                    <h2 className="mt-3 font-semibold text-ink">
                                        {search
                                            ? 'No matching coverage records'
                                            : 'Start resource coverage'}
                                    </h2>
                                    <p className="mt-1 text-sm text-ink-soft">
                                        {search
                                            ? 'Try another coverage name or Core 1 reference.'
                                            : 'Record the Core 1 reference when available, set an operating phase, and reserve its on-site equipment.'}
                                    </p>
                                </div>
                            )}
                            {planning.projects.map((plan) => (
                                <section
                                    key={plan.id}
                                    className="border-b border-line last:border-0"
                                    aria-label={plan.name}
                                >
                                    <div className="grid min-h-16 grid-cols-[20rem_1fr] bg-surface">
                                        <div className="flex items-center gap-2 p-3">
                                            <button
                                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                                aria-expanded={
                                                    !closed.has(plan.id)
                                                }
                                                onClick={() =>
                                                    setClosed((old) => {
                                                        const next = new Set(
                                                            old,
                                                        );

                                                        if (next.has(plan.id)) {
                                                            next.delete(
                                                                plan.id,
                                                            );
                                                        } else {
                                                            next.add(plan.id);
                                                        }

                                                        return next;
                                                    })
                                                }
                                            >
                                                {closed.has(plan.id) ? (
                                                    <ChevronRight className="size-4 shrink-0" />
                                                ) : (
                                                    <ChevronDown className="size-4 shrink-0" />
                                                )}
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold">
                                                        {plan.name}
                                                    </span>
                                                    <span className="block truncate text-xs text-ink-soft">
                                                        Work reference:{' '}
                                                        {plan.source_reference}{' '}
                                                        · {plan.site}
                                                    </span>
                                                </span>
                                            </button>
                                            <PlanStatus plan={plan} />
                                        </div>
                                        <div className="flex items-center justify-end gap-2 border-l border-line px-3">
                                            <span className="mr-auto text-xs text-ink-soft">
                                                {plan.phases.length} operating
                                                phases
                                            </span>
                                            {planning.can_edit && (
                                                <Button
                                                    size="sm"
                                                    variant="quiet"
                                                    onClick={() =>
                                                        setEditor({
                                                            type: 'phase',
                                                            plan: plan.id,
                                                        })
                                                    }
                                                >
                                                    <Plus className="size-4" />
                                                    Add operating phase
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {!closed.has(plan.id) &&
                                        !plan.phases.length && (
                                            <p className="border-t border-line px-10 py-4 text-sm text-ink-soft">
                                                Add an operating phase to set
                                                dates, equipment reservations,
                                                and crew requirements.
                                            </p>
                                        )}
                                    {!closed.has(plan.id) &&
                                        plan.phases.map((phase) => (
                                            <div key={phase.id}>
                                                <button
                                                    className={cn(
                                                        'grid min-h-14 w-full grid-cols-[20rem_1fr] border-t border-line text-left focus-visible:outline-2 focus-visible:outline-brand',
                                                        phaseId === phase.id
                                                            ? 'bg-brand-soft'
                                                            : 'bg-surface hover:bg-surface-subtle',
                                                    )}
                                                    onClick={() =>
                                                        select(plan, phase)
                                                    }
                                                >
                                                    <span className="flex items-center gap-2 px-3 pl-10">
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-medium">
                                                                {phase.name}
                                                            </span>
                                                            <span className="block text-xs text-ink-soft">
                                                                {
                                                                    phase.shifts
                                                                        .length
                                                                }{' '}
                                                                shifts ·{' '}
                                                                {phase.kind}
                                                            </span>
                                                        </span>
                                                        <Badge
                                                            variant={
                                                                phase.shifts.some(
                                                                    (s) =>
                                                                        shiftIssues(
                                                                            plan,
                                                                            phase,
                                                                            s,
                                                                        )
                                                                            .length,
                                                                )
                                                                    ? 'warning'
                                                                    : 'outline'
                                                            }
                                                        >
                                                            {
                                                                phase.shifts.filter(
                                                                    (s) =>
                                                                        shiftIssues(
                                                                            plan,
                                                                            phase,
                                                                            s,
                                                                        )
                                                                            .length,
                                                                ).length
                                                            }{' '}
                                                            need action
                                                        </Badge>
                                                    </span>
                                                    <TimelineLane
                                                        ticks={ticks}
                                                        start={start}
                                                        end={end}
                                                        from={phase.starts_at}
                                                        to={phase.ends_at}
                                                        label={phase.name}
                                                    />
                                                </button>
                                                {phase.allocations.map(
                                                    (allocation) => (
                                                        <button
                                                            key={allocation.id}
                                                            draggable={
                                                                planning.can_edit
                                                            }
                                                            onDragStart={(
                                                                event,
                                                            ) => {
                                                                dragged.current =
                                                                    {
                                                                        x: event.clientX,
                                                                        plan: plan.id,
                                                                        phase: phase.id,
                                                                        allocation:
                                                                            allocation.id,
                                                                    };
                                                                event.dataTransfer.effectAllowed =
                                                                    'move';
                                                                event.dataTransfer.setData(
                                                                    'text/plain',
                                                                    allocation.code,
                                                                );
                                                            }}
                                                            onDragEnd={() => {
                                                                dragged.current =
                                                                    null;
                                                            }}
                                                            className="grid min-h-10 w-full grid-cols-[20rem_1fr] border-t border-line/60 bg-surface text-left hover:bg-surface-subtle"
                                                            onClick={() => {
                                                                select(
                                                                    plan,
                                                                    phase,
                                                                );

                                                                if (
                                                                    planning.can_edit
                                                                ) {
                                                                    setEditor({
                                                                        type: 'allocation',
                                                                        plan: plan.id,
                                                                        phase: phase.id,
                                                                        allocation:
                                                                            allocation.id,
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <span className="flex items-center gap-2 px-3 pl-12 text-xs text-ink-soft">
                                                                {allocation.kind ===
                                                                'maintenance' ? (
                                                                    <Wrench className="size-3.5" />
                                                                ) : (
                                                                    <span className="size-2 rounded-full bg-success" />
                                                                )}
                                                                <span className="truncate">
                                                                    {
                                                                        allocation.code
                                                                    }{' '}
                                                                    ·{' '}
                                                                    {allocation.kind ===
                                                                    'maintenance'
                                                                        ? 'Maintenance'
                                                                        : 'Reserved'}
                                                                </span>
                                                                {![
                                                                    'available',
                                                                    'assigned',
                                                                ].includes(
                                                                    allocation.status,
                                                                ) && (
                                                                    <Badge variant="danger">
                                                                        {
                                                                            allocation.status
                                                                        }
                                                                    </Badge>
                                                                )}
                                                            </span>
                                                            <TimelineLane
                                                                ticks={ticks}
                                                                start={start}
                                                                end={end}
                                                                from={
                                                                    allocation.starts_at
                                                                }
                                                                to={
                                                                    allocation.ends_at
                                                                }
                                                                label={`${allocation.code} ${allocation.kind}`}
                                                                maintenance={
                                                                    allocation.kind ===
                                                                    'maintenance'
                                                                }
                                                                resource
                                                            />
                                                        </button>
                                                    ),
                                                )}
                                            </div>
                                        ))}
                                </section>
                            ))}
                        </div>
                    </div>
                </Panel>
                <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
                    <div className="flex gap-4">
                        <span className="inline-flex items-center gap-1">
                            <Square className="size-3 fill-brand text-brand-strong" />
                            Phase
                        </span>
                        <span className="text-success-strong">
                            <Square className="mr-1 inline size-3 fill-success text-success" />
                            Reserved equipment
                        </span>
                        <span className="text-warning-strong">
                            <Wrench className="mr-1 inline size-3" />
                            Maintenance / unavailable
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>
                            {planning.total} coverage records · page{' '}
                            {planning.page} of {planning.last_page}
                        </span>
                        {planning.last_page > 1 && (
                            <>
                                <Button
                                    size="sm"
                                    disabled={planning.page <= 1}
                                    onClick={() => navigate(planning.page - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={
                                        planning.page >= planning.last_page
                                    }
                                    onClick={() => navigate(planning.page + 1)}
                                >
                                    Next
                                </Button>
                            </>
                        )}
                    </div>
                </footer>
            </div>
            {selectedPlan && selectedPhase && (
                <PhasePanel
                    key={selectedPhase.id}
                    plan={selectedPlan}
                    phase={selectedPhase}
                    canEdit={planning.can_edit}
                    onClose={() => {
                        setPhaseId(null);
                        updateContext({ phase: null });
                    }}
                    edit={setEditor}
                />
            )}
            {editor?.type === 'project' && (
                <ProjectForm onClose={() => setEditor(null)} />
            )}
            {editor?.type === 'phase' && editPlan && (
                <PhaseForm
                    plan={editPlan}
                    phase={editPhase}
                    onClose={() => setEditor(null)}
                />
            )}
            {editor?.type === 'allocation' && editPlan && editPhase && (
                <AllocationForm
                    plan={editPlan}
                    phase={editPhase}
                    allocation={editPhase.allocations.find(
                        (a) => a.id === editor.allocation,
                    )}
                    assets={assets}
                    moveDays={editor.moveDays}
                    onClose={() => setEditor(null)}
                />
            )}
            {editor?.type === 'shifts' && editPlan && editPhase && (
                <ShiftForm
                    plan={editPlan}
                    phase={editPhase}
                    onClose={() => setEditor(null)}
                />
            )}
            {editor?.type === 'coverage' &&
                editPlan &&
                editPhase &&
                editPhase.shifts.some((s) => s.id === editor.shift) && (
                    <CoverageForm
                        plan={editPlan}
                        phase={editPhase}
                        shift={editPhase.shifts.find(
                            (s) => s.id === editor.shift,
                        )!}
                        onClose={() => setEditor(null)}
                    />
                )}
        </div>
    );
}

function TimelineLane({
    start,
    end,
    ticks,
    from,
    to,
    label,
    maintenance = false,
    resource = false,
}: {
    start: number;
    end: number;
    ticks: number[];
    from: string;
    to: string;
    label: string;
    maintenance?: boolean;
    resource?: boolean;
}) {
    const left = Math.max(
        0,
        ((new Date(from).getTime() - start) / (end - start)) * 100,
    );
    const right = Math.max(
        0,
        ((end - new Date(to).getTime()) / (end - start)) * 100,
    );

    return (
        <span className="relative block border-l border-line">
            {ticks.slice(1, -1).map((tick) => (
                <span
                    key={tick}
                    aria-hidden="true"
                    className="absolute inset-y-0 border-l border-line"
                    style={{
                        left: `${((tick - start) / (end - start)) * 100}%`,
                    }}
                />
            ))}
            {left + right < 100 && (
                <span
                    title={`${label}: ${shortDate(from)} – ${shortDate(to)}`}
                    className={cn(
                        'absolute inset-y-2 block min-w-1 overflow-hidden rounded-sm px-2 text-xs leading-6',
                        maintenance
                            ? 'bg-warning-soft text-warning-strong ring-1 ring-warning/50'
                            : resource
                              ? 'bg-success-soft text-success-strong'
                              : 'bg-brand text-brand-contrast',
                    )}
                    style={{ left: `${left}%`, right: `${right}%` }}
                >
                    {label}
                </span>
            )}
        </span>
    );
}
