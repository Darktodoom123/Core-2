import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarRange,
    ChevronLeft,
    ChevronRight,
    Plus,
    ShieldCheck,
    Users,
    Wrench,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Input } from '@/components/ui';
import type {
    ProjectPhaseViewModel,
    ProjectPlanViewModel,
    ProjectShiftViewModel,
} from '@/types/workspace';
import type { PlanningEditor } from '../project-planning-workspace';
import { ApprovalDecision } from './coverage';
import {
    crewCount,
    Errors,
    localValue,
    roleLabels,
    roles,
    shiftIssues,
    shortDate,
    updateContext,
    usePlanningMutation,
} from './shared';

export function PlanStatus({ plan }: { plan: ProjectPlanViewModel }) {
    return (
        <Badge
            variant={
                plan.status === 'approved'
                    ? 'success'
                    : plan.status === 'pending'
                      ? 'warning'
                      : plan.status === 'rejected'
                        ? 'danger'
                        : 'default'
            }
        >
            {plan.status === 'pending'
                ? 'Approval pending'
                : plan.status === 'approved'
                  ? 'Approved'
                  : plan.status === 'rejected'
                    ? 'Rejected'
                    : 'Draft'}
        </Badge>
    );
}
export function PhasePanel({
    plan,
    phase,
    canEdit,
    onClose,
    edit,
}: {
    plan: ProjectPlanViewModel;
    phase: ProjectPhaseViewModel;
    canEdit: boolean;
    onClose: () => void;
    edit: (editor: PlanningEditor) => void;
}) {
    const panel = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = panel.current;
        const trigger =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        dialog?.showModal();

        return () => {
            dialog?.close();

            if (trigger?.isConnected) {
                trigger.focus();
            }
        };
    }, []);
    const initial = new URLSearchParams(window.location.search);
    const [week, setWeek] = useState(
        initial.get('crew_week') ??
            localValue(
                phase.shifts.find(
                    (s) => !['completed', 'cancelled'].includes(s.status),
                )?.starts_at ?? phase.starts_at,
            ).slice(0, 10),
    );
    const weekStart = new Date(`${week}T00:00:00`).getTime();
    const shifts = phase.shifts
        .filter(
            (s) =>
                new Date(s.starts_at).getTime() >= weekStart &&
                new Date(s.starts_at).getTime() < weekStart + 7 * 86400000,
        )
        .sort(
            (a, b) =>
                new Date(a.starts_at).getTime() -
                new Date(b.starts_at).getTime(),
        );
    const command = usePlanningMutation();
    const chooseWeek = (value: string) => {
        if (!value) {
            return;
        }

        setWeek(value);
        updateContext({ crew_week: value });
    };

    return (
        <dialog
            ref={panel}
            onCancel={onClose}
            className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-full overflow-y-auto border-l border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/20 sm:w-[30rem]"
            aria-label={`${phase.name} phase details`}
        >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-surface p-5">
                <div>
                    <p className="text-xs font-medium text-ink-soft">
                        {plan.name} · Work reference: {plan.source_reference}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                        {phase.name} · operating phase
                    </h2>
                    <p className="mt-1 text-xs text-ink-soft">
                        {shortDate(phase.starts_at)} –{' '}
                        {shortDate(phase.ends_at)}
                    </p>
                </div>
                <Button
                    variant="quiet"
                    size="iconSm"
                    aria-label="Close phase details"
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </div>
            <div className="space-y-5 p-5">
                <section>
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                            Baseline approval
                        </h3>
                        {canEdit && (
                            <Button
                                size="sm"
                                variant="quiet"
                                onClick={() =>
                                    edit({
                                        type: 'phase',
                                        plan: plan.id,
                                        phase: phase.id,
                                    })
                                }
                            >
                                Edit operating phase
                            </Button>
                        )}
                    </div>
                    <div className="mt-2 rounded-lg border border-line bg-surface-subtle p-3">
                        <div className="flex items-center gap-2">
                            <PlanStatus plan={plan} />
                            <span className="text-xs text-ink-soft">
                                Version {plan.version}
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-ink-soft">
                            Phase dates, role requirements, and asset
                            reservations need independent approval. Crew changes
                            within 24 hours need an exception decision.
                        </p>
                        {plan.decision_reason && (
                            <p className="mt-2 text-xs">
                                Last decision: {plan.decision_reason}
                            </p>
                        )}
                        {canEdit &&
                            ['draft', 'rejected'].includes(plan.status) && (
                                <Button
                                    className="mt-3"
                                    size="sm"
                                    variant="primary"
                                    disabled={command.busy}
                                    onClick={() =>
                                        command.send(
                                            `/operations/project-plans/${plan.id}/submit`,
                                            { version: plan.version },
                                        )
                                    }
                                >
                                    <ShieldCheck className="size-4" />
                                    Submit baseline
                                </Button>
                            )}
                        {plan.status === 'pending' && !plan.can_decide && (
                            <p className="mt-2 text-xs text-warning-strong">
                                Awaiting another Operations approver.
                            </p>
                        )}
                        {plan.can_decide && <ApprovalDecision plan={plan} />}
                        <Errors errors={command.errors} />
                    </div>
                </section>
                <section>
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                            Asset reservations
                        </h3>
                        {canEdit && (
                            <Button
                                size="sm"
                                onClick={() =>
                                    edit({
                                        type: 'allocation',
                                        plan: plan.id,
                                        phase: phase.id,
                                    })
                                }
                            >
                                <Plus className="size-4" />
                                Reserve asset
                            </Button>
                        )}
                    </div>
                    {!phase.allocations.length && (
                        <p className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning-strong">
                            Reserve the on-site equipment for this phase.
                        </p>
                    )}
                    <div className="space-y-2">
                        {phase.allocations.map((allocation) => (
                            <button
                                key={allocation.id}
                                disabled={!canEdit}
                                className="flex w-full items-start gap-3 rounded-lg border border-line p-3 text-left enabled:hover:bg-surface-subtle"
                                onClick={() =>
                                    edit({
                                        type: 'allocation',
                                        plan: plan.id,
                                        phase: phase.id,
                                        allocation: allocation.id,
                                    })
                                }
                            >
                                {allocation.kind === 'maintenance' ? (
                                    <Wrench className="mt-1 size-4 shrink-0 text-warning-strong" />
                                ) : (
                                    <CalendarRange className="mt-1 size-4 shrink-0 text-success-strong" />
                                )}
                                <span>
                                    <span className="block text-sm font-medium">
                                        {allocation.code} · {allocation.name}
                                    </span>
                                    <span className="block text-xs text-ink-soft">
                                        {allocation.kind === 'maintenance'
                                            ? 'Maintenance / unavailable'
                                            : 'Reserved on site'}
                                    </span>
                                    <span className="block text-xs text-ink-soft">
                                        {shortDate(allocation.starts_at)} –{' '}
                                        {shortDate(allocation.ends_at)}
                                    </span>
                                    {allocation.notes && (
                                        <span className="mt-1 block text-xs">
                                            {allocation.notes}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
                <section>
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                            Shift coverage
                        </h3>
                        {canEdit && (
                            <Button
                                size="sm"
                                onClick={() =>
                                    edit({
                                        type: 'shifts',
                                        plan: plan.id,
                                        phase: phase.id,
                                    })
                                }
                            >
                                <Plus className="size-4" />
                                Generate shifts
                            </Button>
                        )}
                    </div>
                    <div className="my-3 flex items-center gap-2">
                        <Button
                            size="iconSm"
                            aria-label="Previous crew week"
                            onClick={() =>
                                chooseWeek(
                                    localValue(
                                        new Date(weekStart - 7 * 86400000),
                                    ).slice(0, 10),
                                )
                            }
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <label className="flex-1">
                            <span className="sr-only">Crew week starts</span>
                            <Input
                                type="date"
                                value={week}
                                onChange={(e) => chooseWeek(e.target.value)}
                            />
                        </label>
                        <Button
                            size="iconSm"
                            aria-label="Next crew week"
                            onClick={() =>
                                chooseWeek(
                                    localValue(
                                        new Date(weekStart + 7 * 86400000),
                                    ).slice(0, 10),
                                )
                            }
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                    {!shifts.length && (
                        <p className="rounded-lg border border-line p-4 text-sm text-ink-soft">
                            No shifts in this week. Generate shifts or select a
                            different week.
                        </p>
                    )}
                    <div className="space-y-3">
                        {shifts.map((shift) => (
                            <ShiftCard
                                key={shift.id}
                                plan={plan}
                                phase={phase}
                                shift={shift}
                                canEdit={canEdit}
                                edit={edit}
                            />
                        ))}
                    </div>
                </section>
            </div>
        </dialog>
    );
}
function ShiftCard({
    plan,
    phase,
    shift,
    canEdit,
    edit,
}: {
    plan: ProjectPlanViewModel;
    phase: ProjectPhaseViewModel;
    shift: ProjectShiftViewModel;
    canEdit: boolean;
    edit: (editor: PlanningEditor) => void;
}) {
    const issues = shiftIssues(plan, phase, shift);
    const terminal =
        ['completed', 'cancelled'].includes(shift.status) || shift.archived;

    return (
        <article className="rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h4 className="text-sm font-semibold">{shift.reference}</h4>
                    <p className="mt-1 text-xs text-ink-soft">
                        {new Date(shift.starts_at).toLocaleString()} ·{' '}
                        {shift.locked ? '24-hour lock' : 'Crew editable'}
                    </p>
                </div>
                <Badge
                    variant={
                        terminal
                            ? 'default'
                            : issues.length
                              ? 'warning'
                              : 'success'
                    }
                >
                    {shift.archived
                        ? 'Archived'
                        : terminal
                          ? shift.status
                          : shift.pending_roster
                            ? 'Exception pending'
                            : issues.length
                              ? 'Action needed'
                              : 'Coverage confirmed'}
                </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
                {roles
                    .filter((role) => phase.coverage[role] > 0)
                    .map((role) => (
                        <Badge
                            key={role}
                            variant={
                                crewCount(shift, role) >= phase.coverage[role]
                                    ? 'success'
                                    : 'warning'
                            }
                        >
                            {roleLabels[role]} {crewCount(shift, role)}/
                            {phase.coverage[role]}
                        </Badge>
                    ))}
            </div>
            {issues.length > 0 && !terminal && (
                <ul className="mt-2 space-y-1 text-xs text-warning-strong">
                    {issues.map((issue) => (
                        <li key={issue} className="flex gap-1">
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                            {issue}
                        </li>
                    ))}
                </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
                {canEdit && !terminal && (
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                            edit({
                                type: 'coverage',
                                plan: plan.id,
                                phase: phase.id,
                                shift: shift.id,
                            })
                        }
                    >
                        <Users className="size-4" />
                        Fill crew coverage
                    </Button>
                )}
                {!shift.archived && (
                    <Link
                        className="inline-flex min-h-9 items-center rounded-md border border-line-strong px-3 text-xs font-medium"
                        href={`/operations/dispatch-jobs/${shift.job_id}?return_to=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                    >
                        Open dispatch
                    </Link>
                )}
            </div>
            {shift.can_decide && <ApprovalDecision plan={plan} shift={shift} />}
        </article>
    );
}
