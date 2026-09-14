import { usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    Clock,
    ExternalLink,
    FileText,
    Fuel,
    Gauge,
    Truck,
    User,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    FuelRequestViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';
import { FuelVarianceBadge } from './fuel-variance-badge';

export interface FuelRequestCardProps {
    request: FuelRequestViewModel;
    capabilities: WorkspaceCapabilities;
    onRecordLog: (request: FuelRequestViewModel) => void;
    onTransition: (requestId: number, status: string, reason?: string) => void;
    pendingActionId?: string | null;
    currentUserId?: number | null;
    isDetail?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
}

export function FuelRequestCard({
    request,
    capabilities,
    onRecordLog,
    onTransition,
    pendingActionId,
    currentUserId,
    isDetail = false,
    isSelected = false,
    onSelect,
}: FuelRequestCardProps) {
    const [decisionReason, setDecisionReason] = useState('');
    const [showDecisionInput, setShowDecisionInput] = useState(false);
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

    // Check if any logged entry is an anomaly
    const primaryLog =
        request.logs && request.logs.length > 0 ? request.logs[0] : null;
    const hasAnomaly = request.logs?.some((l) => l.is_anomaly);

    const isPendingThisAction = (actionStatus: string) =>
        pendingActionId === `${request.id}:${actionStatus}`;

    return (
        <li
            onClick={onSelect}
            className={cn(
                'flex flex-col gap-4 rounded-xl border p-4 transition-colors',
                isSelected
                    ? 'border-brand-strong bg-surface ring-1 ring-brand-strong'
                    : hasAnomaly
                      ? 'border-danger/40 bg-danger-soft/10'
                      : 'border-line bg-surface hover:border-line-strong',
            )}
        >
            {/* Top Bar: Reference, Badges, Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink tabular-nums">
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

                        {request.shift && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-soft tabular-nums">
                                <Clock className="h-3 w-3 text-brand" />
                                <span>Shift #{request.shift.id}</span>
                                {request.shift.operator_name && (
                                    <span className="font-semibold text-ink">
                                        ({request.shift.operator_name})
                                    </span>
                                )}
                            </span>
                        )}
                    </div>

                    <p className="text-sm font-semibold text-ink">
                        <span className="tabular-nums">
                            Requested: {request.quantity_litres} Litres
                        </span>
                        <span className="font-normal text-ink-soft"> · </span>
                        <span className="font-medium text-ink capitalize">
                            {humanize(request.fuel_type)}
                        </span>
                        {request.purpose && (
                            <>
                                <span className="font-normal text-ink-soft">
                                    {' '}
                                    ·{' '}
                                </span>
                                <span className="font-normal text-ink-soft">
                                    {request.purpose}
                                </span>
                            </>
                        )}
                    </p>
                </div>

                {/* State Transition Actions */}
                <div className="flex flex-wrap items-center gap-2 self-start">
                    {/* Forward (Submitted -> Forwarded) */}
                    {statusVal === 'submitted' && capabilities.forward_fuel && (
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

                    {/* Review Decision (Forwarded -> Approved / Rejected) */}
                    {statusVal === 'forwarded' && capabilities.approve_fuel && (
                        <>
                            {!showDecisionInput && (
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
                        </>
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

                    {/* Record Fuel Log (STRICTLY Verified -> Logged ONLY: approved shortcut eliminated!) */}
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

            {/* Decision Reason Input Box / Self-Review Guard for Forwarded Requests */}
            {statusVal === 'forwarded' &&
                capabilities.approve_fuel &&
                showDecisionInput && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="space-y-3 rounded-lg border border-brand/40 bg-brand-soft/20 p-3 text-xs"
                    >
                        {isSelfReview ? (
                            <div
                                className="space-y-2 rounded-md border border-warning/40 bg-warning-soft/30 p-3"
                                data-testid="self-review-guard"
                            >
                                <div className="flex items-center gap-1.5 font-semibold text-warning-strong">
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
                                <label className="font-medium text-ink">
                                    Reviewer Justification / Feedback Note:
                                </label>
                                <input
                                    type="text"
                                    value={decisionReason}
                                    onChange={(e) =>
                                        setDecisionReason(e.target.value)
                                    }
                                    placeholder="Add reason or guidance (recommended for rejections, optional for approvals)..."
                                    className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-xs text-ink transition-colors placeholder:text-ink-soft focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-hidden"
                                />
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="quiet"
                                        size="sm"
                                        onClick={() =>
                                            setShowDecisionInput(false)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="danger"
                                        size="sm"
                                        onClick={() =>
                                            onTransition(
                                                request.id,
                                                'rejected',
                                                decisionReason,
                                            )
                                        }
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
                                        onClick={() =>
                                            onTransition(
                                                request.id,
                                                'approved',
                                                decisionReason,
                                            )
                                        }
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

            {/* Rejection Callout Banner */}
            {statusVal === 'rejected' && (
                <div
                    className="rounded-xl border border-danger/40 bg-danger-soft/20 p-4 text-xs"
                    role="alert"
                    data-testid="rejection-callout"
                >
                    <div className="flex items-center gap-2 font-semibold text-danger-strong">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="text-sm">
                            Fuel Request Rejected by Operations
                        </span>
                    </div>
                    <p className="mt-2 text-ink">
                        <span className="font-medium text-ink-soft">
                            Reviewer Decision Note:{' '}
                        </span>
                        {request.decision_reason ? (
                            <span className="font-medium text-ink italic">
                                "{request.decision_reason}"
                            </span>
                        ) : (
                            <span className="text-ink-soft italic">
                                No specific feedback note recorded by reviewer.
                            </span>
                        )}
                    </p>
                    {request.approved_at && (
                        <p className="mt-1 text-[11px] text-ink-soft tabular-nums">
                            Decision finalized on{' '}
                            {new Date(request.approved_at).toLocaleString()}
                        </p>
                    )}
                </div>
            )}

            {/* Lifecycle Audit Milestones (4 Stages) in Detail View */}
            {isDetail && (
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-subtle p-3 text-xs sm:grid-cols-4">
                    <div>
                        <span className="block text-xs font-medium text-ink-soft">
                            1. Submitted
                        </span>
                        <p className="mt-0.5 text-xs font-semibold text-ink tabular-nums">
                            {request.created_at
                                ? new Date(
                                      request.created_at,
                                  ).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                  })
                                : 'Recorded'}
                        </p>
                        <p className="truncate text-[11px] text-ink-soft">
                            {request.requester.name}
                        </p>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-ink-soft">
                            2. Forwarded
                        </span>
                        <p className="mt-0.5 text-xs font-semibold text-ink tabular-nums">
                            {request.reviewed_at
                                ? new Date(
                                      request.reviewed_at,
                                  ).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                  })
                                : statusVal === 'submitted'
                                  ? 'In Queue'
                                  : '—'}
                        </p>
                        <p className="text-[11px] text-ink-soft">
                            {request.reviewed_at
                                ? 'Reviewed'
                                : statusVal === 'submitted'
                                  ? 'Awaiting review'
                                  : 'Bypassed'}
                        </p>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-ink-soft">
                            3.{' '}
                            {statusVal === 'rejected' ? 'Rejected' : 'Approval'}
                        </span>
                        <p
                            className={cn(
                                'mt-0.5 text-xs font-semibold tabular-nums',
                                statusVal === 'rejected'
                                    ? 'text-danger'
                                    : 'text-ink',
                            )}
                        >
                            {request.approved_at
                                ? new Date(
                                      request.approved_at,
                                  ).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                  })
                                : ['approved', 'verified', 'logged'].includes(
                                        statusVal,
                                    )
                                  ? 'Approved'
                                  : statusVal === 'rejected'
                                    ? 'Declined'
                                    : 'Pending'}
                        </p>
                        <p className="text-[11px] text-ink-soft">
                            {statusVal === 'rejected'
                                ? 'Declined'
                                : ['approved', 'verified', 'logged'].includes(
                                        statusVal,
                                    )
                                  ? 'Authorized'
                                  : 'Awaiting Review'}
                        </p>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-ink-soft">
                            4. Pump Verification
                        </span>
                        <p className="mt-0.5 text-xs font-semibold text-ink tabular-nums">
                            {primaryLog?.recorded_at
                                ? new Date(
                                      primaryLog.recorded_at,
                                  ).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                  })
                                : statusVal === 'verified'
                                  ? 'Ready to Dispense'
                                  : statusVal === 'rejected'
                                    ? 'Closed'
                                    : 'Awaiting'}
                        </p>
                        <p className="text-[11px] text-ink-soft">
                            {primaryLog ? (
                                <span>
                                    <span className="tabular-nums">
                                        {primaryLog.quantity_litres}
                                    </span>{' '}
                                    L Dispensed
                                </span>
                            ) : statusVal === 'verified' ? (
                                'Authorized'
                            ) : statusVal === 'rejected' ? (
                                'No Pump Log'
                            ) : (
                                'Pending'
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* Operational Context Card in Detail View */}
            {isDetail && (
                <div className="space-y-2 rounded-xl border border-line bg-surface p-3.5 text-xs">
                    <div className="flex items-center justify-between border-b border-line/60 pb-2">
                        <span className="text-xs font-semibold text-ink">
                            Operational Scope & Project Allocation
                        </span>
                        <span className="font-mono text-xs font-semibold text-brand-strong tabular-nums">
                            {request.quantity_litres} L ·{' '}
                            {humanize(request.fuel_type)}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                        <div>
                            <span className="block text-[11px] text-ink-soft">
                                Field Requester / Operator:
                            </span>
                            <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-ink">
                                <User className="h-3.5 w-3.5 text-ink-soft" />
                                <span>{request.requester.name}</span>
                            </p>
                        </div>
                        <div>
                            <span className="block text-[11px] text-ink-soft">
                                Contract / Project Allocation:
                            </span>
                            <p className="mt-0.5 font-semibold text-ink">
                                {request.job ? (
                                    <span>
                                        {request.job.reference} (
                                        {request.job.title})
                                    </span>
                                ) : (
                                    <span className="font-normal text-ink-soft italic">
                                        General Yard / Unassigned Project
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    {request.purpose && (
                        <div className="border-t border-line/40 pt-2">
                            <span className="block text-[11px] text-ink-soft">
                                Stated Field Purpose:
                            </span>
                            <p className="mt-0.5 rounded-md bg-surface-subtle p-2 font-medium text-ink">
                                {request.purpose}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Unlinked Asset Informational Warning */}
            {isDetail && !asset && (
                <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-soft/30 p-3.5 text-xs text-warning-strong">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <p className="font-semibold">
                            Unlinked General Request (No Equipment Assigned)
                        </p>
                        <p className="mt-0.5 text-ink-soft">
                            This request is not tied to a specific crane or
                            vehicle. Baseline burn-rate telematics, engine hour
                            validation, and consumption anomaly detection
                            ("paihi" theft guard) are inactive.
                        </p>
                    </div>
                </div>
            )}

            {/* Equipment & Job Details Card */}
            {asset && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-subtle px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                        <Truck className="h-3.5 w-3.5 text-brand" />
                        <span>{asset.name || asset.code}</span>
                    </div>
                    <span className="text-ink-soft">·</span>
                    <div>
                        <span className="text-ink-soft">Type: </span>
                        <span className="font-medium text-ink">
                            {humanize(asset.kind ?? 'equipment')}
                            {asset.subtype ? ` (${asset.subtype})` : ''}
                        </span>
                    </div>
                    {asset.registration_number && (
                        <>
                            <span className="text-ink-soft">·</span>
                            <div>
                                <span className="text-ink-soft">
                                    Plate/Reg:{' '}
                                </span>
                                <span className="font-semibold text-ink">
                                    {asset.registration_number}
                                </span>
                            </div>
                        </>
                    )}
                    <span className="text-ink-soft">·</span>
                    <div className="font-mono text-[11px]">
                        <span className="text-ink-soft">Code: </span>
                        <span className="font-semibold text-ink tabular-nums">
                            {asset.code}
                        </span>
                    </div>
                    {asset.meter_value && (
                        <>
                            <span className="text-ink-soft">·</span>
                            <div className="flex items-center gap-1">
                                <Gauge className="h-3 w-3 text-brand" />
                                <span className="text-ink-soft">Meter: </span>
                                <span className="font-mono font-medium text-ink tabular-nums">
                                    {asset.meter_value} {meterUnit}
                                </span>
                            </div>
                        </>
                    )}
                    {asset.baseline_burn_rate && (
                        <>
                            <span className="text-ink-soft">·</span>
                            <div>
                                <span className="text-ink-soft">
                                    Baseline:{' '}
                                </span>
                                <span className="font-medium text-ink tabular-nums">
                                    {asset.baseline_burn_rate}{' '}
                                    {asset.burn_rate_unit ?? 'L/hr'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Secondary Meta: Requester, Job, Decision Reason */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                <span className="flex items-center gap-1">
                    <User className="h-3 w-3 text-ink-soft" />
                    <span>
                        Requested by{' '}
                        <strong className="font-medium text-ink">
                            {request.requester.name}
                        </strong>
                    </span>
                </span>
                {request.job && (
                    <span>
                        · Job:{' '}
                        <strong className="font-medium text-ink">
                            {request.job.reference} ({request.job.title})
                        </strong>
                    </span>
                )}
                {request.decision_reason && (
                    <span className="italic">
                        · Reason: "{request.decision_reason}"
                    </span>
                )}
            </div>

            {/* Recorded Fuel Log Details Strip */}
            {request.logs && request.logs.length > 0 && (
                <div className="space-y-3 rounded-xl border border-line bg-surface-subtle p-3 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink">
                            Verified Refueling Audit Log
                        </span>
                        {primaryLog?.recorded_at && (
                            <span className="text-[11px] text-ink-soft tabular-nums">
                                Logged{' '}
                                {new Date(
                                    primaryLog.recorded_at,
                                ).toLocaleString()}
                            </span>
                        )}
                    </div>

                    {request.logs.map((log) => (
                        <div
                            key={log.id}
                            className="space-y-2.5 rounded-lg border border-line bg-surface p-3"
                        >
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div>
                                    <span className="text-xs font-medium text-ink-soft">
                                        Dispensed Volume
                                    </span>
                                    <p className="font-mono text-sm font-semibold text-ink tabular-nums">
                                        {log.quantity_litres} L
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-ink-soft">
                                        Total Amount
                                    </span>
                                    <p className="font-mono text-sm font-semibold text-ink tabular-nums">
                                        {log.total_cost
                                            ? `₱${parseFloat(log.total_cost).toLocaleString()}`
                                            : 'Not recorded'}
                                        {log.price_per_litre && (
                                            <span className="block text-[10px] font-normal text-ink-soft tabular-nums">
                                                (₱{log.price_per_litre}/L)
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-ink-soft">
                                        Ending Meter
                                    </span>
                                    <p className="font-mono text-sm font-semibold text-ink tabular-nums">
                                        {log.hour_meter !== null
                                            ? `${log.hour_meter} hrs`
                                            : log.odometer_km !== null
                                              ? `${log.odometer_km.toLocaleString()} km`
                                              : 'Not recorded'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-ink-soft">
                                        Station / Vendor
                                    </span>
                                    <p className="truncate text-xs font-medium text-ink">
                                        {log.fuel_station || 'On-site Dispense'}
                                    </p>
                                </div>
                            </div>

                            {/* Consumption Variance Analysis Banner */}
                            {log.variance_percentage !== null ||
                            log.is_anomaly ? (
                                <div className="mt-2">
                                    <FuelVarianceBadge
                                        variancePercentage={
                                            log.variance_percentage
                                        }
                                        varianceLitres={log.variance_litres}
                                        isAnomaly={log.is_anomaly}
                                    />
                                    {log.is_anomaly && log.anomaly_reason && (
                                        <p className="mt-1 text-xs font-medium text-danger tabular-nums">
                                            {log.anomaly_reason}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-1">
                                    <p className="text-xs text-ink-soft">
                                        Not enough data to assess consumption
                                        (missing baseline or prior meter)
                                    </p>
                                </div>
                            )}

                            {/* Attachments & Remarks */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2 text-xs text-ink-soft">
                                <div>
                                    {log.remarks && (
                                        <p>
                                            <span className="font-semibold text-ink">
                                                Notes:{' '}
                                            </span>
                                            {log.remarks}
                                        </p>
                                    )}
                                    {log.recorded_by && (
                                        <p className="text-[11px]">
                                            Recorded by{' '}
                                            <strong className="text-ink">
                                                {log.recorded_by.name}
                                            </strong>
                                        </p>
                                    )}
                                </div>

                                {log.receipt_url && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setViewingReceiptUrl(
                                                    log.receipt_url ?? null,
                                                )
                                            }
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-brand/50 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft/80 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                            aria-label="Inspect station receipt photo in lightbox"
                                        >
                                            <Camera className="h-3.5 w-3.5" />
                                            <span>Inspect Receipt</span>
                                        </button>
                                        <a
                                            href={log.receipt_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                                        >
                                            <FileText className="h-3 w-3" />
                                            <span>Direct link</span>
                                            <ExternalLink className="h-2.5 w-2.5" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
                                <FileText className="h-4 w-4 text-brand" />
                                <span className="font-mono text-xs font-semibold text-ink tabular-nums">
                                    Station Receipt Audit · {request.reference}
                                </span>
                            </div>
                            <Button
                                variant="quiet"
                                size="sm"
                                onClick={() => setViewingReceiptUrl(null)}
                                aria-label="Close receipt inspection"
                                className="focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
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
                                            ₱
                                            {parseFloat(
                                                primaryLog.total_cost,
                                            ).toLocaleString()}
                                        </strong>
                                    </>
                                )}
                            </span>
                            <a
                                href={viewingReceiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
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
