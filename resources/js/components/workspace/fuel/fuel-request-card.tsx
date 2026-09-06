import {
    Clock,
    ExternalLink,
    FileText,
    Fuel,
    Gauge,
    Truck,
    User,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { humanize } from '@/lib/formatters';
import type {
    FuelRequestViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';
import { FuelVarianceBadge } from './fuel-variance-badge';

interface FuelRequestCardProps {
    request: FuelRequestViewModel;
    capabilities: WorkspaceCapabilities;
    onRecordLog: (request: FuelRequestViewModel) => void;
    onTransition: (requestId: number, status: string, reason?: string) => void;
    pendingActionId?: string | null;
}

export function FuelRequestCard({
    request,
    capabilities,
    onRecordLog,
    onTransition,
    pendingActionId,
}: FuelRequestCardProps) {
    const [decisionReason, setDecisionReason] = useState('');
    const [showDecisionInput, setShowDecisionInput] = useState(false);

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
            className={`flex flex-col gap-4 rounded-xl border p-4 transition-colors ${
                hasAnomaly
                    ? 'border-danger/40 bg-danger-soft/10'
                    : 'border-line bg-surface hover:border-line-strong'
            }`}
        >
            {/* Top Bar: Reference, Badges, Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-ink">
                            {request.reference}
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
                            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-soft">
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
                        <span>{request.quantity_litres} Litres</span>
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
                            onClick={() =>
                                onTransition(request.id, 'forwarded')
                            }
                            disabled={pendingActionId !== null}
                        >
                            {isPendingThisAction('forwarded')
                                ? 'Forwarding…'
                                : 'Forward for Review'}
                        </Button>
                    )}

                    {/* Approve / Reject (Forwarded -> Approved / Rejected) */}
                    {statusVal === 'forwarded' && capabilities.approve_fuel && (
                        <>
                            {!showDecisionInput ? (
                                <>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            setShowDecisionInput(true);
                                        }}
                                        disabled={pendingActionId !== null}
                                    >
                                        Review Decision
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                            onTransition(request.id, 'approved')
                                        }
                                        disabled={pendingActionId !== null}
                                    >
                                        {isPendingThisAction('approved')
                                            ? 'Approving…'
                                            : 'Quick Approve'}
                                    </Button>
                                </>
                            ) : null}
                        </>
                    )}

                    {/* Verify (Approved -> Verified) */}
                    {statusVal === 'approved' && capabilities.verify_fuel && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onTransition(request.id, 'verified')}
                            disabled={pendingActionId !== null}
                        >
                            {isPendingThisAction('verified')
                                ? 'Verifying…'
                                : 'Verify Allocation'}
                        </Button>
                    )}

                    {/* Record Fuel Log (Verified / Approved -> Logged) */}
                    {(statusVal === 'verified' || statusVal === 'approved') &&
                        capabilities.record_fuel &&
                        !primaryLog && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => onRecordLog(request)}
                                disabled={pendingActionId !== null}
                            >
                                <Fuel className="mr-1.5 h-3.5 w-3.5" />
                                Record Fuel Log
                            </Button>
                        )}
                </div>
            </div>

            {/* Decision Reason Input Box for Managers */}
            {statusVal === 'forwarded' &&
                capabilities.approve_fuel &&
                showDecisionInput && (
                    <div className="space-y-2 rounded-lg border border-brand/40 bg-brand-soft/20 p-3 text-xs">
                        <label className="font-semibold text-ink">
                            Reviewer Justification / Feedback Note:
                        </label>
                        <input
                            type="text"
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                            placeholder="Add reason or guidance (recommended for rejections, optional for approvals)..."
                            className="h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                                type="button"
                                variant="quiet"
                                size="sm"
                                onClick={() => setShowDecisionInput(false)}
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
                                disabled={pendingActionId !== null}
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
                                disabled={pendingActionId !== null}
                            >
                                {isPendingThisAction('approved')
                                    ? 'Approving…'
                                    : 'Approve Request'}
                            </Button>
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
                        <span className="font-semibold text-ink">
                            {asset.code}
                        </span>
                    </div>
                    {asset.meter_value && (
                        <>
                            <span className="text-ink-soft">·</span>
                            <div className="flex items-center gap-1">
                                <Gauge className="h-3 w-3 text-brand" />
                                <span className="text-ink-soft">Meter: </span>
                                <span className="font-mono font-medium text-ink">
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
                                <span className="font-medium text-ink">
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
                <div className="space-y-3 rounded-lg border border-line bg-surface-subtle p-3 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold tracking-wider text-ink uppercase">
                            Verified Refueling Audit Log
                        </span>
                        {primaryLog?.recorded_at && (
                            <span className="text-[11px] text-ink-soft">
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
                            className="space-y-2.5 rounded-lg border border-line/70 bg-surface p-3"
                        >
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div>
                                    <span className="text-[10px] font-bold text-ink-soft uppercase">
                                        Dispensed Volume
                                    </span>
                                    <p className="font-mono text-sm font-bold text-ink">
                                        {log.quantity_litres} L
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-ink-soft uppercase">
                                        Total Amount
                                    </span>
                                    <p className="font-mono text-sm font-bold text-ink">
                                        {log.total_cost
                                            ? `₱${parseFloat(log.total_cost).toLocaleString()}`
                                            : 'N/A'}
                                        {log.price_per_litre && (
                                            <span className="block text-[10px] font-normal text-ink-soft">
                                                (₱{log.price_per_litre}/L)
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-ink-soft uppercase">
                                        Ending Meter
                                    </span>
                                    <p className="font-mono text-sm font-semibold text-ink">
                                        {log.hour_meter !== null
                                            ? `${log.hour_meter} hrs`
                                            : log.odometer_km !== null
                                              ? `${log.odometer_km.toLocaleString()} km`
                                              : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-ink-soft uppercase">
                                        Station / Vendor
                                    </span>
                                    <p className="truncate text-xs font-medium text-ink">
                                        {log.fuel_station || 'On-site Dispense'}
                                    </p>
                                </div>
                            </div>

                            {/* Consumption Variance Analysis Banner */}
                            {(log.variance_percentage !== null ||
                                log.is_anomaly) && (
                                <div className="mt-2">
                                    <FuelVarianceBadge
                                        variancePercentage={
                                            log.variance_percentage
                                        }
                                        varianceLitres={log.variance_litres}
                                        isAnomaly={log.is_anomaly}
                                    />
                                    {log.is_anomaly && log.anomaly_reason && (
                                        <p className="mt-1 text-xs font-medium text-danger">
                                            {log.anomaly_reason}
                                        </p>
                                    )}
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
                                    <a
                                        href={log.receipt_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 font-medium text-brand-strong transition-colors hover:bg-brand-soft/50"
                                    >
                                        <FileText className="h-3.5 w-3.5" />
                                        <span>View Station Receipt</span>
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </li>
    );
}
