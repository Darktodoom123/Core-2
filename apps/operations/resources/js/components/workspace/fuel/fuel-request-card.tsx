import { usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    Check,
    CheckCircle2,
    ExternalLink,
    FileText,
    Fuel,
    Info,
    ReceiptText,
    Smartphone,
    Truck,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    FuelRequestViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';
import { FuelVarianceBadge } from './fuel-variance-badge';

export type FuelReviewDecision = 'approved' | 'rejected';

export interface FuelRequestCardProps {
    request: FuelRequestViewModel;
    capabilities: WorkspaceCapabilities;
    onRecordLog: (request: FuelRequestViewModel) => void;
    onTransition: (requestId: number, status: string, reason?: string) => void;
    onReview?: (
        requestId: number,
        decision: FuelReviewDecision,
        reason?: string,
    ) => void;
    onWithdraw?: (requestId: number, reason?: string) => void;
    onReviewReceipt?: (logId: number, note?: string) => void;
    pendingActionId?: string | null;
    currentUserId?: number | null;
    isDetail?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
}

const URGENCY_STYLES: Record<string, string> = {
    critical: 'border-danger/50 bg-danger-soft text-danger-strong',
    urgent: 'border-warning/50 bg-warning-soft text-warning-strong',
};

const REQUEST_STAGES = [
    'Submitted',
    'Forwarded',
    'Approved',
    'Verified',
    'Logged',
] as const;

const STAGE_INDEX: Record<string, number> = {
    submitted: 0,
    forwarded: 1,
    approved: 2,
    verified: 3,
    logged: 4,
};

function formatShortDateTime(value: string): string {
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatPeso(value: string): string {
    return `₱${parseFloat(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/** One labelled fact in the detail grid. */
function Fact({
    label,
    children,
    className,
}: {
    label: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('min-w-0', className)}>
            <dt className="text-[11px] font-medium tracking-wide text-ink-soft uppercase">
                {label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium break-words text-ink">
                {children}
            </dd>
        </div>
    );
}

function SectionTitle({ children }: { children: ReactNode }) {
    return <h3 className="mb-3 text-sm font-semibold text-ink">{children}</h3>;
}

export function FuelRequestCard({
    request,
    capabilities,
    onRecordLog,
    onTransition,
    onReview,
    onWithdraw,
    onReviewReceipt,
    pendingActionId,
    currentUserId,
    isDetail = false,
    isSelected = false,
    onSelect,
}: FuelRequestCardProps) {
    const [decisionReason, setDecisionReason] = useState('');
    const [decisionError, setDecisionError] = useState<string | null>(null);
    const [showDecisionInput, setShowDecisionInput] = useState(false);
    const [showWithdrawInput, setShowWithdrawInput] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(
        null,
    );

    let pageAuth: { user?: { id: number; name?: string } } | undefined;

    try {
        const page = usePage<{
            auth?: { user?: { id: number; name?: string } };
        }>();
        pageAuth = page?.props?.auth;
    } catch {
        // Safe fallback if used outside Inertia context
        pageAuth = undefined;
    }

    useEffect(() => {
        if (!viewingReceiptUrl) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setViewingReceiptUrl(null);
            }
        };

        window.addEventListener('keydown', closeOnEscape);

        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [viewingReceiptUrl]);

    const effectiveUserId = currentUserId ?? pageAuth?.user?.id;
    const isSelfReview = Boolean(
        effectiveUserId &&
        request.requester?.id &&
        effectiveUserId === request.requester.id,
    );

    const asset = request.asset;
    const statusVal = request.status.value;
    const isHourMeter =
        asset?.meter_type === 'hour_meter' ||
        asset?.meter_type === 'engine_hours';
    const meterUnit = isHourMeter ? 'hrs' : 'km';

    const primaryLog =
        request.logs && request.logs.length > 0 ? request.logs[0] : null;
    const hasAnomaly = request.logs?.some((l) => l.is_anomaly);
    const isRejected = statusVal === 'rejected';
    const isWithdrawn = statusVal === 'withdrawn';
    const isClosed = ['logged', 'rejected', 'withdrawn'].includes(statusVal);
    const lastCompletedStage = isRejected
        ? 1
        : isWithdrawn
          ? request.reviewed_at
              ? 1
              : 0
          : STAGE_INDEX[statusVal];
    const currentStage = isRejected ? 2 : isWithdrawn ? -1 : lastCompletedStage;
    const stageDates = [
        request.created_at ?? request.submitted_at,
        request.reviewed_at,
        request.approved_at,
        request.verified_at,
        primaryLog?.recorded_at,
    ];
    const progressSummary = isRejected
        ? 'Declined after review. No further stages will occur.'
        : isWithdrawn
          ? 'Withdrawn by the requester. No further stages will occur.'
          : statusVal === 'submitted'
            ? 'Submitted and awaiting review.'
            : statusVal === 'forwarded'
              ? 'Forwarded and awaiting a decision.'
              : statusVal === 'approved'
                ? 'Approved and awaiting independent verification.'
                : statusVal === 'verified'
                  ? 'Verified and ready to refuel.'
                  : 'Refueling recorded.';
    const dispensedLitres = (request.logs ?? []).reduce(
        (sum, log) => sum + (Number(log.quantity_litres) || 0),
        0,
    );

    const isPendingThisAction = (actionStatus: string) =>
        pendingActionId === `${request.id}:${actionStatus}`;

    // One review step: a manager holding forward + approve decides a submitted
    // request directly; the server still records both audited stages.
    const canDecide =
        (statusVal === 'submitted' &&
            capabilities.forward_fuel &&
            capabilities.approve_fuel) ||
        (statusVal === 'forwarded' && capabilities.approve_fuel);
    const canForwardOnly =
        statusVal === 'submitted' &&
        capabilities.forward_fuel &&
        !capabilities.approve_fuel;
    const canWithdraw =
        Boolean(onWithdraw) &&
        Boolean(effectiveUserId) &&
        effectiveUserId === request.requester?.id &&
        (statusVal === 'submitted' || statusVal === 'forwarded');
    const urgency = request.urgency;
    const urgencyStyle = urgency ? URGENCY_STYLES[urgency.value] : undefined;
    const hasTankLevel =
        request.current_fuel_level_percent !== null &&
        request.current_fuel_level_percent !== undefined;

    const decide = (decision: FuelReviewDecision) => {
        const reason = decisionReason.trim();

        if (decision === 'rejected' && reason === '') {
            setDecisionError(
                'Add a reason so the requester knows why it was declined.',
            );

            return;
        }

        setDecisionError(null);

        if (onReview) {
            onReview(request.id, decision, reason || undefined);
        } else {
            onTransition(request.id, decision, reason || undefined);
        }
    };

    const assetTitle = asset
        ? asset.name
            ? `${asset.code} · ${asset.name}`
            : asset.code
        : 'General request';

    return (
        <li
            onClick={onSelect}
            className={cn(
                'overflow-hidden rounded-xl border bg-surface transition-colors',
                isSelected && !isDetail
                    ? 'border-brand-strong ring-1 ring-brand-strong'
                    : hasAnomaly
                      ? 'border-danger/40'
                      : 'border-line',
                !isDetail && !isSelected && 'hover:border-line-strong',
            )}
        >
            {/* Header: identity, badges, and the one action this stage allows */}
            <div
                className={cn(
                    'flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between',
                    isDetail && 'border-b border-line sm:p-5',
                )}
            >
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-ink-soft tabular-nums">
                            {isDetail
                                ? `Ref: ${request.reference}`
                                : request.reference}
                        </span>
                        <CanonicalStatusBadge status={request.status} />

                        {primaryLog && (
                            <FuelVarianceBadge
                                variancePercentage={
                                    primaryLog.variance_percentage
                                }
                                varianceLitres={primaryLog.variance_litres}
                                isAnomaly={primaryLog.is_anomaly}
                                compact
                            />
                        )}

                        {urgency && urgencyStyle && (
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                                    urgencyStyle,
                                )}
                                data-testid="fuel-urgency-badge"
                            >
                                <AlertTriangle className="h-3 w-3" />
                                {urgency.label}
                            </span>
                        )}

                        {request.submitted_via === 'field_app' && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                                <Smartphone className="h-3 w-3" />
                                Field app
                            </span>
                        )}
                    </div>

                    <div>
                        <p
                            className={cn(
                                'flex items-center gap-2 font-semibold text-ink',
                                isDetail ? 'text-lg' : 'text-sm',
                            )}
                        >
                            <Truck
                                className="h-4 w-4 shrink-0 text-brand-strong"
                                aria-hidden="true"
                            />
                            <span className="min-w-0 truncate">
                                {assetTitle}
                            </span>
                        </p>
                        {request.job && (
                            <p className="mt-0.5 text-sm text-ink-soft">
                                Job {request.job.reference} ·{' '}
                                {request.job.title}
                            </p>
                        )}
                        {!isDetail && (
                            <p className="mt-1 text-sm text-ink-soft">
                                <span className="font-semibold text-ink tabular-nums">
                                    {request.quantity_litres} L
                                </span>{' '}
                                {humanize(request.fuel_type)}
                                {hasTankLevel &&
                                    ` · Tank ${request.current_fuel_level_percent}%`}
                                {request.purpose && ` · ${request.purpose}`}
                            </p>
                        )}
                    </div>
                </div>

                {/* State Transition Actions */}
                <div className="flex flex-wrap items-center gap-2 self-start">
                    {/* Forward only (reviewer without approval authority) */}
                    {canForwardOnly && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTransition(request.id, 'forwarded');
                            }}
                            disabled={Boolean(pendingActionId)}
                        >
                            {isPendingThisAction('forwarded')
                                ? 'Forwarding…'
                                : 'Forward for Review'}
                        </Button>
                    )}

                    {/* Single review step (Submitted/Forwarded -> Approved / Rejected) */}
                    {canDecide && !showDecisionInput && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDecisionInput(true);
                            }}
                            disabled={Boolean(pendingActionId)}
                        >
                            Review Decision
                        </Button>
                    )}

                    {/* Requester withdraws before a decision */}
                    {canWithdraw && !showWithdrawInput && (
                        <Button
                            variant="quiet"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowWithdrawInput(true);
                            }}
                            disabled={Boolean(pendingActionId)}
                        >
                            Withdraw request
                        </Button>
                    )}

                    {/* Verify (Approved -> Verified) */}
                    {statusVal === 'approved' && capabilities.verify_fuel && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTransition(request.id, 'verified');
                            }}
                            disabled={Boolean(pendingActionId)}
                        >
                            {isPendingThisAction('verified')
                                ? 'Verifying…'
                                : 'Verify Allocation'}
                        </Button>
                    )}

                    {/* Record Fuel Log (Verified -> Logged only) */}
                    {statusVal === 'verified' &&
                        capabilities.record_fuel &&
                        !primaryLog && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRecordLog(request);
                                }}
                                disabled={Boolean(pendingActionId)}
                            >
                                <Fuel className="mr-1.5 h-3.5 w-3.5" />
                                Record Fuel Log
                            </Button>
                        )}
                </div>
            </div>

            <div
                className={cn(
                    'space-y-5 px-4 pb-4',
                    isDetail && 'pt-4 sm:px-5 sm:pt-5 sm:pb-5',
                )}
            >
                {isDetail && (
                    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line text-xs">
                        <div className="bg-surface-subtle p-4">
                            <dt className="font-medium text-ink-soft">
                                Requested
                            </dt>
                            <dd className="mt-1 text-2xl font-semibold text-ink tabular-nums">
                                {request.quantity_litres} L
                            </dd>
                            <dd className="text-ink-soft capitalize">
                                {humanize(request.fuel_type)}
                            </dd>
                        </div>
                        <div
                            className={cn(
                                'border-l border-line p-4',
                                request.logs?.length
                                    ? 'bg-success-soft/40'
                                    : 'bg-surface-subtle',
                            )}
                        >
                            <dt className="font-medium text-ink-soft">
                                Actual dispensed
                            </dt>
                            <dd
                                className={cn(
                                    'mt-1 font-semibold tabular-nums',
                                    request.logs?.length
                                        ? 'text-2xl text-ink'
                                        : 'text-base text-ink-soft',
                                )}
                            >
                                {request.logs?.length
                                    ? `${dispensedLitres.toLocaleString()} L`
                                    : 'Not recorded yet'}
                            </dd>
                            <dd className="text-ink-soft">
                                {request.logs?.length
                                    ? 'From recorded fuel logs'
                                    : 'Awaiting a fuel log'}
                            </dd>
                        </div>
                    </dl>
                )}

                {/* Withdraw confirmation (requester only, before a decision) */}
                {canWithdraw && showWithdrawInput && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="space-y-3 rounded-lg border border-line-strong bg-surface-subtle p-3 text-xs"
                        data-testid="withdraw-panel"
                    >
                        <label
                            htmlFor={`fuel-withdraw-reason-${request.id}`}
                            className="font-medium text-ink"
                        >
                            Why are you withdrawing this request? (optional)
                        </label>
                        <input
                            id={`fuel-withdraw-reason-${request.id}`}
                            type="text"
                            value={withdrawReason}
                            onChange={(e) => setWithdrawReason(e.target.value)}
                            placeholder="e.g. Refuelled from the site bowser"
                            className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-soft focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong/30 focus-visible:outline-hidden"
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="quiet"
                                size="sm"
                                onClick={() => setShowWithdrawInput(false)}
                            >
                                Keep request
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() =>
                                    onWithdraw?.(
                                        request.id,
                                        withdrawReason.trim() || undefined,
                                    )
                                }
                                disabled={Boolean(pendingActionId)}
                            >
                                {isPendingThisAction('withdrawn')
                                    ? 'Withdrawing…'
                                    : 'Confirm withdraw'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Decision panel / self-review guard */}
                {canDecide && showDecisionInput && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="space-y-3 rounded-lg border border-brand-strong/40 bg-brand-soft/20 p-4 text-xs"
                    >
                        {isSelfReview ? (
                            <div
                                className="space-y-2"
                                data-testid="self-review-guard"
                            >
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-warning-strong">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>Self-Review Forbidden</span>
                                </div>
                                <p className="text-xs text-ink-soft">
                                    Self-review forbidden: requester cannot
                                    approve or reject their own request
                                    (independent review required).
                                </p>
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="quiet"
                                        size="sm"
                                        onClick={() =>
                                            setShowDecisionInput(false)
                                        }
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="danger"
                                        size="sm"
                                        disabled={true}
                                        title="Requester cannot self-review"
                                    >
                                        Reject Request
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        disabled={true}
                                        title="Requester cannot self-review"
                                    >
                                        Approve Request
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <p className="text-sm font-semibold text-ink">
                                        Review this request
                                    </p>
                                    {statusVal === 'submitted' && (
                                        <p className="mt-0.5 text-[11px] text-ink-soft">
                                            Approving records both the forward
                                            and approval stages in the audit
                                            trail.
                                        </p>
                                    )}
                                </div>
                                <label
                                    htmlFor={`fuel-decision-reason-${request.id}`}
                                    className="block font-medium text-ink"
                                >
                                    Decision note
                                </label>
                                <input
                                    id={`fuel-decision-reason-${request.id}`}
                                    type="text"
                                    value={decisionReason}
                                    onChange={(e) => {
                                        setDecisionReason(e.target.value);
                                        setDecisionError(null);
                                    }}
                                    aria-invalid={decisionError !== null}
                                    aria-describedby={
                                        decisionError
                                            ? `fuel-decision-error-${request.id}`
                                            : undefined
                                    }
                                    placeholder="Add reason or guidance (required to reject, optional to approve)…"
                                    className={cn(
                                        'h-9 w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-xs placeholder:text-ink-soft focus-visible:ring-2 focus-visible:outline-hidden',
                                        decisionError
                                            ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/30'
                                            : 'border-line-strong focus-visible:border-brand-strong focus-visible:ring-brand-strong/30',
                                    )}
                                />
                                {decisionError && (
                                    <p
                                        id={`fuel-decision-error-${request.id}`}
                                        role="alert"
                                        className="flex items-center gap-1 text-xs font-medium text-danger"
                                    >
                                        <AlertTriangle className="h-3 w-3 shrink-0" />
                                        {decisionError}
                                    </p>
                                )}
                                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="quiet"
                                        size="sm"
                                        onClick={() => {
                                            setShowDecisionInput(false);
                                            setDecisionError(null);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="danger"
                                        size="sm"
                                        onClick={() => decide('rejected')}
                                        disabled={Boolean(pendingActionId)}
                                    >
                                        {isPendingThisAction('rejected')
                                            ? 'Rejecting…'
                                            : 'Reject Request'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={() => decide('approved')}
                                        disabled={Boolean(pendingActionId)}
                                    >
                                        {isPendingThisAction('approved')
                                            ? 'Approving…'
                                            : 'Approve Request'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Rejection callout */}
                {isRejected && (
                    <div
                        className="rounded-xl border border-danger/40 bg-danger-soft/30 p-4 text-xs"
                        role="alert"
                        data-testid="rejection-callout"
                    >
                        <div className="flex items-center gap-2 font-semibold text-danger-strong">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="text-sm">
                                Declined by the office
                            </span>
                        </div>
                        <p className="mt-2 text-sm text-ink">
                            {request.decision_reason ? (
                                <>“{request.decision_reason}”</>
                            ) : (
                                <span className="text-ink-soft">
                                    No reason was recorded by the reviewer.
                                </span>
                            )}
                        </p>
                        {request.approved_at && (
                            <p className="mt-1 text-[11px] text-ink-soft tabular-nums">
                                Decided{' '}
                                {formatShortDateTime(request.approved_at)}
                            </p>
                        )}
                    </div>
                )}

                {/* Withdrawn callout */}
                {isWithdrawn && (
                    <div
                        className="rounded-xl border border-line-strong bg-surface-subtle p-4 text-xs"
                        data-testid="withdrawn-callout"
                    >
                        <p className="text-sm font-semibold text-ink">
                            Withdrawn by {request.requester.name}
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                            {request.withdrawal_reason ? (
                                <span className="text-ink">
                                    “{request.withdrawal_reason}”
                                </span>
                            ) : (
                                'No reason given.'
                            )}
                        </p>
                        {request.withdrawn_at && (
                            <p className="mt-1 text-[11px] text-ink-soft tabular-nums">
                                {formatShortDateTime(request.withdrawn_at)}
                            </p>
                        )}
                    </div>
                )}

                {/* Recorded request stages; future stages are not presented as complete. */}
                {isDetail && (
                    <section role="group" aria-label="Fuel request progress">
                        <SectionTitle>Request progress</SectionTitle>
                        <div className="relative">
                            <span
                                aria-hidden="true"
                                className="absolute top-3.5 right-[10%] left-[10%] h-0.5 bg-line-strong"
                            />
                            <span
                                aria-hidden="true"
                                className="absolute top-3.5 left-[10%] h-0.5 bg-brand"
                                style={{
                                    width: `${Math.max(lastCompletedStage, 0) * 20}%`,
                                }}
                            />
                            <ol className="relative grid grid-cols-5">
                                {REQUEST_STAGES.map((stage, index) => {
                                    const declined = isRejected && index === 2;
                                    const completed =
                                        index <= lastCompletedStage;
                                    const current = index === currentStage;
                                    const label = declined ? 'Declined' : stage;
                                    const date = stageDates[index];

                                    return (
                                        <li
                                            key={stage}
                                            aria-current={
                                                current ? 'step' : undefined
                                            }
                                            aria-label={`${label}: ${declined ? 'declined' : completed ? 'complete' : isWithdrawn || isRejected ? 'not reached' : 'upcoming'}${date && (completed || declined) ? `, ${formatShortDateTime(date)}` : ''}`}
                                            className="flex min-w-0 flex-col items-center text-center"
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={cn(
                                                    'flex h-7 w-7 items-center justify-center rounded-full border-2 bg-surface',
                                                    declined
                                                        ? 'border-danger bg-danger text-danger-contrast'
                                                        : current
                                                          ? 'border-brand bg-brand text-brand-contrast'
                                                          : completed
                                                            ? 'border-brand bg-brand-soft text-brand-strong'
                                                            : 'border-line-strong text-ink-soft',
                                                )}
                                            >
                                                {declined ? (
                                                    <X className="h-3.5 w-3.5" />
                                                ) : completed ? (
                                                    <Check className="h-3.5 w-3.5" />
                                                ) : null}
                                            </span>
                                            <span
                                                className={cn(
                                                    'mt-2 text-[11px] leading-tight font-medium sm:text-xs',
                                                    declined
                                                        ? 'text-danger'
                                                        : completed
                                                          ? 'text-ink'
                                                          : 'text-ink-soft',
                                                )}
                                            >
                                                {label}
                                            </span>
                                            {date &&
                                                (completed || declined) && (
                                                    <span className="mt-1 hidden text-[10px] text-ink-soft tabular-nums sm:block">
                                                        {formatShortDateTime(
                                                            date,
                                                        )}
                                                    </span>
                                                )}
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-ink-soft">
                            <Info
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                            />
                            {progressSummary}
                        </p>
                    </section>
                )}

                {/* Request facts: who, where, when, and the equipment's meter context */}
                {isDetail && (
                    <section>
                        <SectionTitle>Request details</SectionTitle>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                            <Fact label="Requested by">
                                {request.requester.name}
                            </Fact>
                            <Fact label="Submitted">
                                {request.created_at
                                    ? formatShortDateTime(request.created_at)
                                    : 'Not recorded'}
                                {request.submitted_via === 'field_app' && (
                                    <span className="block text-xs font-normal text-ink-soft">
                                        via field app
                                    </span>
                                )}
                            </Fact>
                            <Fact label="Job">
                                {request.job ? (
                                    request.job.reference
                                ) : (
                                    <span className="font-normal text-ink-soft">
                                        No job linked
                                    </span>
                                )}
                            </Fact>
                            {request.needed_by && !isClosed && (
                                <Fact label="Needed by">
                                    <span className="tabular-nums">
                                        {formatShortDateTime(request.needed_by)}
                                    </span>
                                </Fact>
                            )}
                            {hasTankLevel && (
                                <Fact label="Tank when requested">
                                    <span className="tabular-nums">
                                        Tank{' '}
                                        {request.current_fuel_level_percent}%
                                    </span>
                                </Fact>
                            )}
                            {request.shift && (
                                <Fact label="Shift">
                                    #{request.shift.id}
                                    {request.shift.operator_name &&
                                        ` · ${request.shift.operator_name}`}
                                </Fact>
                            )}
                            {asset && (
                                <Fact label="Equipment type">
                                    {humanize(asset.kind ?? 'equipment')}
                                    {asset.subtype ? ` (${asset.subtype})` : ''}
                                </Fact>
                            )}
                            {asset?.registration_number && (
                                <Fact label="Plate / Reg.">
                                    {asset.registration_number}
                                </Fact>
                            )}
                            {asset?.meter_value && (
                                <Fact label="Current meter">
                                    <span className="tabular-nums">
                                        {Number.isFinite(
                                            Number(asset.meter_value),
                                        )
                                            ? Number(
                                                  asset.meter_value,
                                              ).toLocaleString()
                                            : asset.meter_value}{' '}
                                        {meterUnit}
                                    </span>
                                </Fact>
                            )}
                            {asset?.baseline_burn_rate && (
                                <Fact label="Baseline burn">
                                    <span className="tabular-nums">
                                        {asset.baseline_burn_rate}{' '}
                                        {asset.burn_rate_unit ?? 'L/hr'}
                                    </span>
                                </Fact>
                            )}
                            {request.purpose && (
                                <Fact
                                    label="Purpose"
                                    className="col-span-2 sm:col-span-3"
                                >
                                    <span className="block rounded-lg bg-surface-subtle px-3 py-2 font-normal">
                                        {request.purpose}
                                    </span>
                                </Fact>
                            )}
                            {request.decision_reason && !isRejected && (
                                <Fact
                                    label="Reviewer note"
                                    className="col-span-2 sm:col-span-3"
                                >
                                    <span className="font-normal">
                                        “{request.decision_reason}”
                                    </span>
                                </Fact>
                            )}
                        </dl>
                    </section>
                )}

                {/* No equipment linked: meter and burn-rate checks cannot run */}
                {isDetail && !asset && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-soft/30 p-3.5 text-xs">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" />
                        <div>
                            <p className="font-semibold text-warning-strong">
                                No equipment linked
                            </p>
                            <p className="mt-0.5 text-ink-soft">
                                This request isn&apos;t tied to a crane or
                                vehicle, so meter validation and burn-rate
                                anomaly checks don&apos;t apply.
                            </p>
                        </div>
                    </div>
                )}

                {/* Refueling record(s): what was actually dispensed and the evidence */}
                {request.logs && request.logs.length > 0 && (
                    <section>
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-sm font-semibold text-ink">
                                Refueling record
                            </h3>
                            {primaryLog?.recorded_at && (
                                <span className="text-[11px] text-ink-soft tabular-nums">
                                    Logged{' '}
                                    {formatShortDateTime(
                                        primaryLog.recorded_at,
                                    )}
                                    {primaryLog.recorded_by &&
                                        ` by ${primaryLog.recorded_by.name}`}
                                </span>
                            )}
                        </div>

                        <div className="space-y-3">
                            {request.logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="overflow-hidden rounded-xl border border-line"
                                >
                                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-4">
                                        <Fact label="Dispensed">
                                            <span className="font-semibold tabular-nums">
                                                {log.quantity_litres} L
                                            </span>
                                        </Fact>
                                        <Fact label="Total cost">
                                            {log.total_cost ? (
                                                <span className="font-semibold tabular-nums">
                                                    {formatPeso(log.total_cost)}
                                                    {log.price_per_litre && (
                                                        <span className="block text-[11px] font-normal text-ink-soft">
                                                            ₱
                                                            {
                                                                log.price_per_litre
                                                            }
                                                            /L
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="font-normal text-ink-soft">
                                                    Not recorded
                                                </span>
                                            )}
                                        </Fact>
                                        <Fact label="Meter reading">
                                            <span className="tabular-nums">
                                                {log.hour_meter !== null
                                                    ? `${Number(log.hour_meter).toLocaleString()} hrs`
                                                    : log.odometer_km !== null
                                                      ? `${log.odometer_km.toLocaleString()} km`
                                                      : 'Not recorded'}
                                            </span>
                                        </Fact>
                                        <Fact label="Source">
                                            {log.fuel_station ||
                                                'On-site dispense'}
                                        </Fact>
                                    </dl>

                                    <div className="space-y-3 border-t border-line bg-surface-subtle/60 p-4 text-xs">
                                        {/* Consumption variance */}
                                        {log.variance_percentage !== null ||
                                        log.is_anomaly ? (
                                            <div>
                                                <FuelVarianceBadge
                                                    variancePercentage={
                                                        log.variance_percentage
                                                    }
                                                    varianceLitres={
                                                        log.variance_litres
                                                    }
                                                    isAnomaly={log.is_anomaly}
                                                />
                                                {log.is_anomaly &&
                                                    log.anomaly_reason && (
                                                        <p className="mt-1 text-xs font-medium text-danger tabular-nums">
                                                            {log.anomaly_reason}
                                                        </p>
                                                    )}
                                            </div>
                                        ) : (
                                            <p className="text-ink-soft">
                                                Not enough data to assess
                                                consumption (missing baseline or
                                                prior meter)
                                            </p>
                                        )}

                                        {/* Receipt evidence */}
                                        {log.receipt_url && (
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="inline-flex items-center gap-1.5 font-medium text-ink">
                                                    <ReceiptText className="h-3.5 w-3.5 text-success-strong" />
                                                    Receipt attached
                                                    {log.receipt_number && (
                                                        <span className="font-normal text-ink-soft tabular-nums">
                                                            · No.{' '}
                                                            {log.receipt_number}
                                                        </span>
                                                    )}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setViewingReceiptUrl(
                                                                log.receipt_url ??
                                                                    null,
                                                            )
                                                        }
                                                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-brand-strong/50 bg-brand-soft px-2.5 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft/80 focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                                        aria-label="Inspect station receipt photo in lightbox"
                                                    >
                                                        <Camera className="h-3.5 w-3.5" />
                                                        <span>
                                                            View receipt
                                                        </span>
                                                    </button>
                                                    <a
                                                        href={log.receipt_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11px] font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                                    >
                                                        <FileText className="h-3 w-3" />
                                                        <span>Open file</span>
                                                        <ExternalLink className="h-2.5 w-2.5" />
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {/* Receipt exception: logged without a receipt */}
                                        {log.no_receipt_reason && (
                                            <div
                                                className={cn(
                                                    'space-y-2 rounded-lg border p-3 text-xs',
                                                    log.requires_receipt_review
                                                        ? 'border-warning/50 bg-warning-soft/40'
                                                        : 'border-line bg-surface',
                                                )}
                                                data-testid="receipt-exception"
                                            >
                                                <p className="flex items-center gap-1.5 font-semibold text-ink">
                                                    <AlertTriangle
                                                        className={cn(
                                                            'h-3.5 w-3.5 shrink-0',
                                                            log.requires_receipt_review
                                                                ? 'text-warning-strong'
                                                                : 'text-ink-soft',
                                                        )}
                                                    />
                                                    No receipt:{' '}
                                                    {
                                                        log.no_receipt_reason
                                                            .label
                                                    }
                                                </p>
                                                {log.no_receipt_note && (
                                                    <p className="text-ink-soft">
                                                        “{log.no_receipt_note}”
                                                    </p>
                                                )}
                                                {log.requires_receipt_review ? (
                                                    capabilities.verify_fuel &&
                                                    onReviewReceipt ? (
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onReviewReceipt(
                                                                    log.id,
                                                                );
                                                            }}
                                                            disabled={Boolean(
                                                                pendingActionId,
                                                            )}
                                                        >
                                                            {pendingActionId ===
                                                            `log:${log.id}:receipt-review`
                                                                ? 'Saving…'
                                                                : 'Mark exception reviewed'}
                                                        </Button>
                                                    ) : (
                                                        <p className="text-[11px] text-warning-strong">
                                                            Awaiting office
                                                            review.
                                                        </p>
                                                    )
                                                ) : (
                                                    log.receipt_reviewed_at && (
                                                        <p className="inline-flex items-center gap-1 text-[11px] text-ink-soft tabular-nums">
                                                            <CheckCircle2 className="h-3 w-3 text-success-strong" />
                                                            Reviewed{' '}
                                                            {formatShortDateTime(
                                                                log.receipt_reviewed_at,
                                                            )}
                                                            {log.receipt_review_note
                                                                ? ` · ${log.receipt_review_note}`
                                                                : ''}
                                                        </p>
                                                    )
                                                )}
                                            </div>
                                        )}

                                        {log.remarks && (
                                            <p className="text-ink-soft">
                                                <span className="font-semibold text-ink">
                                                    Notes:{' '}
                                                </span>
                                                {log.remarks}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Accessible Receipt Photo Lightbox Modal */}
            {viewingReceiptUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                    onClick={() => setViewingReceiptUrl(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Station receipt inspection lightbox"
                >
                    <div
                        className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-brand-strong" />
                                <span className="font-mono text-xs font-semibold text-ink tabular-nums">
                                    Station Receipt Audit · {request.reference}
                                </span>
                            </div>
                            <Button
                                variant="quiet"
                                size="sm"
                                onClick={() => setViewingReceiptUrl(null)}
                                aria-label="Close receipt inspection"
                                autoFocus
                                className="focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex max-h-[65vh] items-center justify-center overflow-auto rounded-lg bg-surface-subtle p-2">
                            <img
                                src={viewingReceiptUrl}
                                alt={`Receipt for ${request.reference}`}
                                className="max-h-[60vh] w-auto rounded object-contain"
                            />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-xs text-ink-soft">
                            <span>
                                Dispensed:{' '}
                                <strong className="text-ink tabular-nums">
                                    {primaryLog?.quantity_litres} L
                                </strong>
                                {primaryLog?.total_cost && (
                                    <>
                                        {' '}
                                        · Total:{' '}
                                        <strong className="text-ink tabular-nums">
                                            {formatPeso(primaryLog.total_cost)}
                                        </strong>
                                    </>
                                )}
                            </span>
                            <a
                                href={viewingReceiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                            >
                                <span>Open full resolution</span>
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </li>
    );
}
