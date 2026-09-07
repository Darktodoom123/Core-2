import { AlertTriangle, Radio, ShieldAlert } from 'lucide-react';
import React from 'react';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { DvirStatusBadge } from '@/components/workspace/fleet/dvir-status-badge';
import { HosDutyBadge } from '@/components/workspace/fleet/hos-duty-badge';
import { OperatorBindingChip } from '@/components/workspace/fleet/operator-binding-chip';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    LocationUpdateViewModel,
} from '@/types/workspace';

export interface FleetAssetCardProps {
    asset: AssetViewModel;
    isSelected?: boolean;
    location?: LocationUpdateViewModel | null;
    onSelect?: (assetId: number) => void;
    onViewDvir?: (dvirId: number) => void;
    className?: string;
}

export function FleetAssetCard({
    asset,
    isSelected = false,
    location = null,
    onSelect,
    onViewDvir,
    className,
}: FleetAssetCardProps) {
    const hasLiveGps =
        location &&
        location.latitude !== null &&
        location.longitude !== null &&
        location.freshness_status === 'fresh';

    const cardClasses = cn(
        'min-h-[72px] w-full px-3.5 py-2.5 text-left transition-colors hover:bg-surface-subtle focus:outline-none',
        isSelected && 'bg-brand-soft/60 ring-1 ring-brand/30',
        className,
    );

    const cardContent = (
        <>
            <div className="flex items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-ink">
                        {asset.code}
                    </span>
                    {Boolean(asset.rated_capacity) && (
                        <span className="py-0.2 rounded border border-line bg-surface-subtle px-1.5 font-mono text-[10px] font-semibold text-ink-soft">
                            {asset.rated_capacity}
                            {asset.capacity_unit
                                ? ` ${asset.capacity_unit}`
                                : ''}
                        </span>
                    )}
                    {Boolean(asset.registration_number) && (
                        <span className="font-mono text-[10px] text-ink-soft">
                            Reg: {asset.registration_number}
                        </span>
                    )}
                </div>
                <CanonicalStatusBadge status={asset.status} />
            </div>

            <p className="mt-0.5 truncate text-xs font-semibold text-ink">
                {asset.name}
            </p>

            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-ink-soft">
                <span className="truncate">
                    {humanize(asset.subtype || asset.kind)}
                </span>
                {location &&
                location.latitude !== null &&
                location.longitude !== null ? (
                    hasLiveGps ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-strong">
                            <Radio className="h-2.5 w-2.5 animate-pulse text-success" />
                            GPS Live{' '}
                            {location.speed !== null && location.speed > 0
                                ? `(${location.speed} km/h)`
                                : ''}
                        </span>
                    ) : location.freshness_status === 'delayed' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            GPS Delayed
                        </span>
                    ) : location.freshness_status === 'stale' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-soft">
                            <span className="bg-ink-muted h-1.5 w-1.5 rounded-full" />
                            Last Known (Stale)
                        </span>
                    ) : (
                        <span className="text-ink-muted inline-flex items-center gap-1 text-[10px] font-medium">
                            Telemetry Offline
                        </span>
                    )
                ) : (
                    <span className="text-ink-muted max-w-[110px] truncate text-[10px]">
                        {asset.location ?? 'Location not recorded'}
                    </span>
                )}
            </div>

            {/* Dispatchability or Blocker Alert */}
            {asset.blocking_work_orders_count > 0 ? (
                <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-danger">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {asset.blocking_work_orders_count} blocking work order
                    {asset.blocking_work_orders_count > 1 ? 's' : ''}
                </div>
            ) : asset.is_dispatchable ? (
                <div className="mt-1 text-[10px] font-medium text-success-strong">
                    Ready for dispatch
                </div>
            ) : (
                <div className="mt-1 text-[10px] font-medium text-warning-strong">
                    Non-dispatchable
                </div>
            )}

            {/* Parity Status: Operator, HoS & DVIR */}
            {(asset.active_operator || asset.latest_dvir || asset.hos) && (
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 border-t border-line/40 pt-1.5">
                    {asset.active_operator ? (
                        <OperatorBindingChip
                            activeOperator={asset.active_operator}
                            compact
                        />
                    ) : asset.hos ? (
                        <HosDutyBadge hos={asset.hos} compact />
                    ) : null}

                    {asset.latest_dvir && (
                        <DvirStatusBadge
                            dvir={asset.latest_dvir}
                            onViewInspection={onViewDvir}
                            compact
                        />
                    )}
                </div>
            )}

            {/* Safety Lockout Alert */}
            {asset.lockout?.is_locked_out && (
                <div className="mt-1 flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-strong">
                    <ShieldAlert className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                        {asset.lockout.lockout_reason ||
                            'Safety Lockout Active'}
                    </span>
                </div>
            )}
        </>
    );

    if (onViewDvir) {
        return (
            <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect?.(asset.id)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect?.(asset.id);
                    }
                }}
                className={cn('cursor-pointer', cardClasses)}
                aria-pressed={isSelected}
            >
                {cardContent}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onSelect?.(asset.id)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(asset.id);
                }
            }}
            className={cardClasses}
            aria-pressed={isSelected}
        >
            {cardContent}
        </button>
    );
}
