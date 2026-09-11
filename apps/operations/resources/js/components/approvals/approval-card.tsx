import { useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowUpRight,
    Check,
    Clock,
    FileCheck,
    MapPin,
    RotateCcw,
    ShieldCheck,
    User,
    X,
    Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ApprovalViewModel } from '@/types/workspace';
import { ApprovalGovernancePanel } from './approval-governance-panel';
import { ApprovalResourceDelta } from './approval-resource-delta';

export function ApprovalKindBadge({ kind }: { kind: string }) {
    switch (kind) {
        case 'assignment_override':
            return (
                <span
                    className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong"
                    title="Assignment exception override"
                >
                    <Zap className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>Assignment Override</span>
                </span>
            );
        case 'reassignment_override':
            return (
                <span
                    className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong"
                    title="Mid-flight crew or equipment replacement override"
                >
                    <RotateCcw
                        className="h-3 w-3 shrink-0"
                        aria-hidden="true"
                    />
                    <span>Reassignment Override</span>
                </span>
            );
        case 'plan_approval':
            return (
                <span
                    className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong"
                    title="Initial dispatch plan sign-off"
                >
                    <FileCheck
                        className="h-3 w-3 shrink-0"
                        aria-hidden="true"
                    />
                    <span>Plan Approval Gate</span>
                </span>
            );
        case 'readiness_exception':
            return (
                <span
                    className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger-strong"
                    title="Asset or driver readiness exception"
                >
                    <AlertTriangle
                        className="h-3 w-3 shrink-0"
                        aria-hidden="true"
                    />
                    <span>Readiness Exception</span>
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                    <ShieldCheck
                        className="text-ink-muted h-3 w-3 shrink-0"
                        aria-hidden="true"
                    />
                    <span>{humanize(kind)}</span>
                </span>
            );
    }
}

export function getApprovalExecutiveSummary(
    approval: ApprovalViewModel,
): string {
    const pCount = approval.requested_changes.personnel.length;
    const aCount = approval.requested_changes.assets.length;
    const endPCount = approval.requested_changes.ended_personnel.length;
    const endACount = approval.requested_changes.ended_assets.length;
    const requester = approval.requester.name;
    const jobRef = approval.subject.reference;
    const statusLabel = approval.subject.status?.label ?? 'dispatch';

    if (endPCount > 0 || endACount > 0) {
        const endedText = `${endPCount > 0 ? `${endPCount} personnel` : ''}${endPCount > 0 && endACount > 0 ? ' & ' : ''}${endACount > 0 ? `${endACount} asset` : ''}`;
        const addedText = `${pCount > 0 ? `${pCount} replacement personnel` : ''}${pCount > 0 && aCount > 0 ? ' & ' : ''}${aCount > 0 ? `${aCount} replacement asset` : ''}`;

        return `${requester} requested a reassignment override on ${statusLabel} ${jobRef}: ending ${endedText}${addedText ? ` and allocating ${addedText}` : ''}.`;
    }

    if (pCount > 0 || aCount > 0) {
        const addedText = `${pCount > 0 ? `${pCount} personnel` : ''}${pCount > 0 && aCount > 0 ? ' & ' : ''}${aCount > 0 ? `${aCount} asset` : ''}`;

        return `${requester} requested ${humanize(approval.kind).toLowerCase()} for ${statusLabel} ${jobRef} to assign ${addedText}.`;
    }

    return `${requester} submitted an operational ${humanize(approval.kind).toLowerCase()} for ${statusLabel} ${jobRef}.`;
}

interface ApprovalCardProps {
    approval: ApprovalViewModel;
    canDecide: boolean;
}

export function ApprovalCard({ approval, canDecide }: ApprovalCardProps) {
    const form = useForm<{
        status: 'approved' | 'rejected';
        reason: string;
        approval?: string;
        version?: string;
        personnel?: string;
        assets?: string;
    }>({
        status: 'approved',
        reason: '',
    });

    const [pendingDecision, setPendingDecision] = useState<
        'approved' | 'rejected' | null
    >(null);

    const reasonId = `approval-${approval.id}-reason`;
    const errorId = `${reasonId}-error`;

    const approvalError =
        form.errors.approval ??
        form.errors.version ??
        form.errors.personnel ??
        form.errors.assets ??
        null;

    const decide = (status: 'approved' | 'rejected') => {
        form.transform((data) => ({ ...data, status }));
        form.post(`/operations/approval-requests/${approval.id}/decision`, {
            preserveScroll: true,
            onStart: () => setPendingDecision(status),
            onFinish: () => setPendingDecision(null),
        });
    };

    return (
        <Panel className="flex flex-col overflow-hidden transition-all duration-150 hover:shadow-xs">
            {/* Card Header Ribbon */}
            <div className="border-b border-line bg-surface-subtle/30 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <CanonicalStatusBadge status={approval.status} />
                            <ApprovalKindBadge kind={approval.kind} />
                            {approval.subject.status && (
                                <CanonicalStatusBadge
                                    status={approval.subject.status}
                                />
                            )}
                            {approval.subject.version !== null && (
                                <span className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                                    v{approval.subject.version}
                                </span>
                            )}
                        </div>

                        <h2 className="mt-2.5 text-base font-bold text-ink">
                            {approval.subject.title ??
                                approval.subject.reference}
                        </h2>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                            <span className="font-mono font-semibold text-ink">
                                {approval.subject.reference}
                            </span>
                            {approval.subject.priority &&
                                approval.subject.priority.value !==
                                    'routine' && (
                                    <span
                                        className={cn(
                                            'rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                                            approval.subject.priority.value ===
                                                'emergency'
                                                ? 'bg-danger-soft text-danger-strong ring-1 ring-danger/30'
                                                : 'bg-warning-soft text-warning-strong ring-1 ring-warning/30',
                                        )}
                                    >
                                        [{approval.subject.priority.label}]
                                    </span>
                                )}
                            <span>·</span>
                            <span className="flex items-center gap-1">
                                <User className="h-3 w-3 text-ink-soft" />
                                Requested by{' '}
                                <strong className="font-medium text-ink">
                                    {approval.requester.name}
                                </strong>
                            </span>
                            <span>·</span>
                            <span>{formatDateTime(approval.created_at)}</span>
                        </div>
                    </div>

                    <a
                        href={`/operations/dispatch-jobs/${approval.subject.id}`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                        aria-label={`Open dispatch ${approval.subject.reference}`}
                    >
                        Open dispatch
                        <ArrowUpRight
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                        />
                    </a>
                </div>
            </div>

            <div className="flex-1 space-y-4 px-5 py-4">
                {/* Executive Approval Summary */}
                <div className="flex items-start gap-2.5 rounded-xl border border-brand/20 bg-brand-soft/25 p-3.5 text-xs">
                    <ShieldCheck
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
                        aria-hidden="true"
                    />
                    <p className="leading-relaxed font-medium text-ink">
                        {getApprovalExecutiveSummary(approval)}
                    </p>
                </div>

                {/* Operational Schedule & Site Info */}
                <dl className="grid gap-3 rounded-xl border border-line bg-surface-subtle/40 p-3.5 text-xs sm:grid-cols-2">
                    <div>
                        <dt className="flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                            <Clock className="h-3 w-3" />
                            Execution Schedule
                        </dt>
                        <dd className="mt-1 font-semibold text-ink">
                            {formatDateTime(
                                approval.subject.scheduled_start,
                                'Not recorded',
                            )}{' '}
                            –{' '}
                            {formatDateTime(
                                approval.subject.scheduled_end,
                                'Not recorded',
                            )}
                        </dd>
                    </div>

                    <div>
                        <dt className="flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                            <MapPin className="h-3 w-3 text-brand-strong" />
                            Site Location
                        </dt>
                        <dd className="mt-1 font-semibold text-ink">
                            {approval.subject.site ?? 'Not recorded'}
                        </dd>
                    </div>
                </dl>

                {approval.subject.site_notes?.trim() && (
                    <div className="rounded-xl border border-line bg-surface-subtle/60 p-3 text-xs">
                        <p className="font-bold text-ink">Site Instructions</p>
                        <p className="mt-1 leading-relaxed text-ink-soft">
                            {approval.subject.site_notes}
                        </p>
                    </div>
                )}

                {/* Resource Delta Section */}
                <ApprovalResourceDelta
                    requestedChanges={approval.requested_changes}
                />

                {/* Governance or Action Form Area */}
                {!canDecide ? (
                    <ApprovalGovernancePanel
                        decisionBlocker={approval.decision_blocker}
                    />
                ) : (
                    <div className="border-t border-line pt-4">
                        {approvalError && (
                            <div
                                className="mb-3 rounded-lg border border-danger/40 bg-danger-soft p-3 text-xs font-semibold text-danger-strong"
                                role="alert"
                            >
                                {approvalError}
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <label
                                htmlFor={reasonId}
                                className="text-xs font-bold text-ink"
                            >
                                Mandatory Decision Justification *
                            </label>
                            <span className="text-[11px] text-ink-soft">
                                Becomes permanent audit trail
                            </span>
                        </div>

                        {/* Quick preset chips */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-medium text-ink-soft">
                                Quick presets:
                            </span>
                            {[
                                'Resource availability and site readiness verified',
                                'Schedule conflicts cleared and certified',
                                'Capacity and qualifications confirmed',
                            ].map((preset, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() =>
                                        form.setData('reason', preset)
                                    }
                                    className="rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
                                >
                                    + {preset.slice(0, 32)}…
                                </button>
                            ))}
                        </div>

                        <textarea
                            id={reasonId}
                            value={form.data.reason}
                            onChange={(event) =>
                                form.setData('reason', event.target.value)
                            }
                            placeholder="Enter the operational justification for approving or rejecting this request…"
                            rows={3}
                            required
                            maxLength={2000}
                            aria-invalid={
                                form.errors.reason ? 'true' : undefined
                            }
                            aria-describedby={
                                form.errors.reason ? errorId : undefined
                            }
                            className={cn(
                                'mt-2 w-full resize-y rounded-lg border bg-surface p-2.5 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none',
                                form.errors.reason
                                    ? 'border-danger ring-1 ring-danger'
                                    : 'border-line-strong',
                            )}
                        />
                        {form.errors.reason && (
                            <p
                                id={errorId}
                                className="mt-1 text-xs font-medium text-danger-strong"
                                role="alert"
                            >
                                {form.errors.reason}
                            </p>
                        )}

                        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                                variant="danger"
                                onClick={() => decide('rejected')}
                                disabled={
                                    form.processing ||
                                    form.data.reason.trim().length === 0
                                }
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                {form.processing &&
                                pendingDecision === 'rejected'
                                    ? 'Rejecting…'
                                    : 'Reject request'}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => decide('approved')}
                                disabled={
                                    form.processing ||
                                    form.data.reason.trim().length === 0
                                }
                            >
                                <Check
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                />
                                {form.processing &&
                                pendingDecision === 'approved'
                                    ? 'Approving…'
                                    : 'Approve request'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Panel>
    );
}
