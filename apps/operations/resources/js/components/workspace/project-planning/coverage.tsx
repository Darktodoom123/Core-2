import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    ProjectPhaseViewModel,
    ProjectPlanViewModel,
    ProjectShiftViewModel,
} from '@/types/workspace';
import {
    Dialog,
    Errors,
    Field,
    planningGet,
    roleLabels,
    roles,
    shortDate,
    usePlanningMutation,
} from './shared';
import type { Role } from './shared';

type Candidate = {
    id: number;
    name: string;
    eligible: boolean;
    reasons: string[];
    commitments: Array<{ start: string; end: string; reference: string }>;
};
type CandidatePage = {
    data: Candidate[];
    current_page: number;
    last_page: number;
    total: number;
};
export function CoverageForm({
    plan,
    phase,
    shift,
    onClose,
}: {
    plan: ProjectPlanViewModel;
    phase: ProjectPhaseViewModel;
    shift: ProjectShiftViewModel;
    onClose: () => void;
}) {
    const [roster, setRoster] = useState(
        shift.personnel
            .filter((p) => p.response !== 'rejected')
            .map((p) => ({
                user_id: p.user_id,
                assignment_type: p.assignment_type,
                name: p.name,
            })),
    );
    const [role, setRole] = useState<Role>(
        roles.find((r) => phase.coverage[r] > 0) ?? 'crane_operator',
    );
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [response, setResponse] = useState<{
        key: string;
        page: CandidatePage;
    } | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    const requestKey = `${plan.id}:${shift.id}:${role}:${search}:${page}:${retry}`;
    const result = response?.key === requestKey ? response.page : null;
    const [review, setReview] = useState(false);
    const [reason, setReason] = useState('');
    const command = usePlanningMutation();
    const [expected] = useState({ plan: plan.version, shift: shift.version });
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError('');

            try {
                const query = new URLSearchParams({
                    role,
                    search,
                    page: String(page),
                });
                const candidates = await planningGet<CandidatePage>(
                    `/operations/project-plans/${plan.id}/shifts/${shift.id}/candidates?${query}`,
                    controller.signal,
                );

                if (!controller.signal.aborted) {
                    setResponse({ key: requestKey, page: candidates });
                }
            } catch (caught) {
                if (!controller.signal.aborted) {
                    setError(
                        caught instanceof Error
                            ? caught.message
                            : 'Unable to check availability.',
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }, 250);

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [plan.id, shift.id, role, search, page, requestKey]);
    const counts = Object.fromEntries(
        roles.map((r) => [
            r,
            roster.filter((p) => p.assignment_type === r).length,
        ]),
    ) as Record<Role, number>;
    const complete = roles.every((r) => counts[r] === phase.coverage[r]);
    const added = roster.filter(
        (p) =>
            !shift.personnel.some(
                (old) =>
                    old.user_id === p.user_id &&
                    old.assignment_type === p.assignment_type,
            ),
    );
    const removed = shift.personnel.filter(
        (p) =>
            !roster.some(
                (next) =>
                    next.user_id === p.user_id &&
                    next.assignment_type === p.assignment_type,
            ),
    );

    return (
        <Dialog
            title={`Fill crew coverage · ${shift.reference}`}
            description={`${shortDate(shift.starts_at)} · ${new Date(shift.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${new Date(shift.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Workforce Management owns corporate rosters; Core 2 records operational shift coverage.`}
            onClose={onClose}
        >
            <div className="grid grid-cols-3 gap-2">
                {roles.map((r) => (
                    <button
                        key={r}
                        aria-pressed={role === r}
                        className={cn(
                            'rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-brand',
                            role === r
                                ? 'border-brand bg-brand-soft'
                                : 'border-line',
                        )}
                        onClick={() => {
                            setRole(r);
                            setPage(1);
                        }}
                    >
                        <div className="text-xs text-ink-soft">
                            {roleLabels[r]}
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                            {counts[r]} / {phase.coverage[r]}
                        </div>
                    </button>
                ))}
            </div>
            <h3 className="mt-5 text-sm font-semibold">Selected crew</h3>
            <div className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-lg border border-line p-2">
                {!roster.length && (
                    <p className="p-1 text-sm text-ink-soft">
                        Choose qualified personnel below to fill the required
                        roles.
                    </p>
                )}
                {roster.map((person) => (
                    <button
                        key={person.user_id}
                        aria-label={`Remove ${person.name} from ${roleLabels[person.assignment_type]}`}
                        className="inline-flex items-center gap-2 rounded-md bg-surface-subtle px-3 py-2 text-xs"
                        onClick={() => {
                            setRoster(
                                roster.filter(
                                    (p) => p.user_id !== person.user_id,
                                ),
                            );
                            setReview(false);
                        }}
                    >
                        {person.name} · {roleLabels[person.assignment_type]}
                        <X className="size-3" />
                    </button>
                ))}
            </div>
            <section className="mt-5 border-t border-line pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                        {roleLabels[role]} for this shift
                    </h3>
                    <label className="relative">
                        <Search className="absolute top-3.5 left-3 size-4 text-ink-soft" />
                        <span className="sr-only">Search personnel</span>
                        <Input
                            value={search}
                            className="pl-9"
                            placeholder="Search eligible personnel"
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </label>
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                    Checks recorded availability, qualifications, and
                    overlapping dispatch assignments.
                </p>
                <Errors errors={error ? [error] : []} />
                {error && (
                    <Button size="sm" onClick={() => setRetry(retry + 1)}>
                        Retry availability check
                    </Button>
                )}
                <div
                    className="mt-3 max-h-64 space-y-2 overflow-y-auto"
                    aria-busy={loading || (!result && !error)}
                >
                    {loading || (!result && !error) ? (
                        <p role="status" className="p-4 text-sm text-ink-soft">
                            Checking availability…
                        </p>
                    ) : result?.data.length === 0 ? (
                        <p className="p-4 text-sm text-ink-soft">
                            No personnel match this search and role.
                        </p>
                    ) : (
                        result?.data.map((candidate) => {
                            const selected = roster.some(
                                (p) => p.user_id === candidate.id,
                            );

                            return (
                                <div
                                    key={candidate.id}
                                    className="rounded-lg border border-line p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium">
                                                {candidate.name}
                                            </div>
                                            <p className="mt-1 text-xs text-ink-soft">
                                                {candidate.eligible
                                                    ? 'Available for this shift'
                                                    : candidate.reasons.join(
                                                          ' · ',
                                                      )}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            disabled={
                                                !candidate.eligible ||
                                                selected ||
                                                counts[role] >=
                                                    phase.coverage[role]
                                            }
                                            onClick={() => {
                                                setRoster([
                                                    ...roster,
                                                    {
                                                        user_id: candidate.id,
                                                        name: candidate.name,
                                                        assignment_type: role,
                                                    },
                                                ]);
                                                setReview(false);
                                            }}
                                        >
                                            {selected
                                                ? 'Selected'
                                                : !candidate.eligible
                                                  ? 'Unavailable'
                                                  : 'Assign'}
                                        </Button>
                                    </div>
                                    {candidate.commitments.length > 0 && (
                                        <details className="mt-2 text-xs text-ink-soft">
                                            <summary className="cursor-pointer">
                                                {candidate.commitments.length}{' '}
                                                scheduled commitments
                                            </summary>
                                            <ul className="mt-1 space-y-1">
                                                {candidate.commitments.map(
                                                    (c, i) => (
                                                        <li
                                                            key={`${c.reference}-${i}`}
                                                        >
                                                            <span className="font-medium">
                                                                {c.reference}
                                                            </span>{' '}
                                                            ·{' '}
                                                            {new Date(
                                                                c.start,
                                                            ).toLocaleString()}{' '}
                                                            –{' '}
                                                            {new Date(
                                                                c.end,
                                                            ).toLocaleString()}
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        </details>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
                {result && result.last_page > 1 && (
                    <div className="mt-2 flex items-center justify-between">
                        <Button
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            Previous
                        </Button>
                        <span className="text-xs text-ink-soft">
                            {page} / {result.last_page}
                        </span>
                        <Button
                            size="sm"
                            disabled={page === result.last_page}
                            onClick={() => setPage(page + 1)}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </section>
            <form
                className="mt-4"
                onSubmit={(e) => {
                    e.preventDefault();

                    if (!review) {
                        setReview(true);
                    } else {
                        command.send(
                            `/operations/project-plans/${plan.id}/shifts/${shift.id}/roster`,
                            {
                                version: expected.plan,
                                shift_version: expected.shift,
                                personnel: roster.map(
                                    ({ user_id, assignment_type }) => ({
                                        user_id,
                                        assignment_type,
                                    }),
                                ),
                                reason,
                            },
                            onClose,
                        );
                    }
                }}
            >
                <Field label="Crew change reason">
                    <Textarea
                        required
                        maxLength={2000}
                        value={reason}
                        placeholder="Explain the crew change or replacement"
                        onChange={(e) => {
                            setReason(e.target.value);
                            setReview(false);
                        }}
                    />
                </Field>
                {review && (
                    <section className="mt-4 rounded-lg border border-line bg-surface-subtle p-4 text-sm">
                        <h3 className="font-semibold">
                            Review crew coverage change
                        </h3>
                        <p className="mt-2">
                            Add: {added.map((p) => p.name).join(', ') || 'None'}
                        </p>
                        <p>
                            Remove:{' '}
                            {removed.map((p) => p.name).join(', ') || 'None'}
                        </p>
                        <p className="mt-2">
                            {complete
                                ? 'All required roles are covered.'
                                : 'Coverage remains incomplete. This shift cannot dispatch until all required roles are filled.'}
                        </p>
                        <p className="mt-2">
                            {shift.locked
                                ? '24-hour lock: the current crew remains in place until another approver accepts this exception.'
                                : 'This crew will be confirmed under the approved baseline. Current eligibility is checked again when saving.'}
                        </p>
                    </section>
                )}
                <Errors errors={command.errors} />
                <div className="mt-5 flex justify-end gap-2">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={command.busy || plan.status !== 'approved'}
                    >
                        {review
                            ? shift.locked
                                ? 'Request exception approval'
                                : 'Confirm crew'
                            : 'Review crew coverage change'}
                    </Button>
                </div>
                {plan.status !== 'approved' && (
                    <p className="mt-2 text-right text-xs text-warning-strong">
                        Approve the baseline before assigning the crew.
                    </p>
                )}
            </form>
        </Dialog>
    );
}

export function ApprovalDecision({
    plan,
    shift,
}: {
    plan: ProjectPlanViewModel;
    shift?: ProjectShiftViewModel;
}) {
    const command = usePlanningMutation();
    const [reason, setReason] = useState('');
    const [decision, setDecision] = useState<'approved' | 'rejected'>(
        'approved',
    );

    return (
        <form
            className="mt-3 space-y-3 border-t border-line pt-3"
            onSubmit={(e) => {
                e.preventDefault();
                command.send(
                    `/operations/project-plans/${plan.id}${shift ? `/shifts/${shift.id}` : ''}/decision`,
                    {
                        version: plan.version,
                        ...(shift ? { shift_version: shift.version } : {}),
                        decision,
                        reason,
                    },
                );
            }}
        >
            {shift && (
                <div className="text-xs text-ink-soft">
                    <p>
                        <strong>Current crew:</strong>{' '}
                        {shift.personnel.map((p) => p.name).join(', ') ||
                            'None'}
                    </p>
                    <p className="mt-1">
                        <strong>Proposed crew:</strong>{' '}
                        {shift.pending_roster
                            ?.map(
                                (p) =>
                                    `${p.name ?? `Worker #${p.user_id}`} (${roleLabels[p.assignment_type]})`,
                            )
                            .join(', ') || 'None'}
                    </p>
                    <p className="mt-1">
                        <strong>Requested reason:</strong> {shift.reason}
                    </p>
                </div>
            )}
            <Field label="Approval decision note">
                <Textarea
                    required
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
            </Field>
            <Errors errors={command.errors} />
            <div className="flex gap-2">
                <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    disabled={command.busy}
                    onClick={() => setDecision('approved')}
                >
                    Approve {shift ? 'exception' : 'baseline'}
                </Button>
                <Button
                    type="submit"
                    size="sm"
                    variant="danger"
                    disabled={command.busy}
                    onClick={() => setDecision('rejected')}
                >
                    Reject
                </Button>
            </div>
        </form>
    );
}
