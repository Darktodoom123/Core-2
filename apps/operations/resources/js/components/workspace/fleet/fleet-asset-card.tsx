import { AlertTriangle, Radio, ShieldAlert } from 'lucide-react';
import React from 'react';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { DvirStatusBadge } from '@/components/workspace/fleet/dvir-status-badge';
import { getFleetDispatchabilityState } from '@/components/workspace/fleet/fleet-dispatchability';
import {
    getFleetLocationFreshnessLabel,
    hasLocationCoordinates,
} from '@/components/workspace/fleet/fleet-location-labels';
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
    compact?: boolean;
}

export function FleetAssetCard({
    asset,
    isSelected = false,
    location = null,
    onSelect,
    onViewDvir,
    className,
    compact = false,
}: FleetAssetCardProps) {
    const hasFreshLocation =
        location &&
        hasLocationCoordinates(location) &&
        location.freshness_status === 'fresh';
    const dispatchabilityState = getFleetDispatchabilityState(asset);

    const cardClasses = cn(
        'min-h-[72px] w-full px-3.5 py-2.5 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden',
        isSelected && 'bg-brand-soft/50 ring-1 ring-brand-strong/40 ring-inset',
        className,
    );

    const cardContent = (
        <>
            <div className="flex items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span
                        className={cn(
                            'font-bold text-ink',
                            compact ? 'text-sm' : 'text-xs',
                        )}
                    >
                        {asset.code}
                    </span>
                    {!compact && Boolean(asset.rated_capacity) && (
                        <span className="rounded border border-line bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-soft tabular-nums">
                            {asset.rated_capacity}
                            {asset.capacity_unit
                                ? ` ${asset.capacity_unit}`
                                : ''}
                        </span>
                    )}
                    {!compact && Boolean(asset.registration_number) && (
                        <span className="font-mono text-[10px] text-ink-soft tabular-nums">
                            Reg: {asset.registration_number}
                        </span>
                    )}
                </div>
                <CanonicalStatusBadge
                    status={asset.status}
                    variant="minimal"
                    size={compact ? 'md' : 'sm'}
                    presentation="inline"
                />
            </div>

            <p
                className={cn(
                    'mt-0.5 truncate font-semibold text-ink',
                    compact ? 'text-sm' : 'text-xs',
                )}
            >
                {asset.name}
            </p>

            <div
                className={cn(
                    'mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-ink-soft',
                    compact ? 'text-xs' : 'text-[11px]',
                )}
            >
                {!compact && (
                    <span className="truncate">
                        {humanize(asset.subtype || asset.kind)}
                    </span>
                )}
                {location && hasLocationCoordinates(location) ? (
                    hasFreshLocation ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-strong tabular-nums">
                            <Radio className="h-2.5 w-2.5 animate-pulse text-success" />
                            Fresh location
                            {location.speed !== null && location.speed > 0
                                ? ` (${location.speed} km/h)`
                                : ''}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
                            <span className="h-1.5 w-1.5 rounded-full bg-ink-soft/40" />
                            {getFleetLocationFreshnessLabel(location)}
                        </span>
                    )
                ) : (
                    <span className="max-w-[110px] truncate text-xs text-ink-soft/70">
                        {location
                            ? getFleetLocationFreshnessLabel(location)
                            : (asset.location ?? 'Location not recorded')}
                    </span>
                )}
            </div>

            {/* Dispatchability or Blocker Alert */}
            {dispatchabilityState === 'blocking_work_orders' ? (
                <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger tabular-nums">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {asset.blocking_work_orders_count} blocking work order
                    {asset.blocking_work_orders_count > 1 ? 's' : ''}
                </div>
            ) : dispatchabilityState === 'ready' ? (
                <div className="mt-1 text-xs font-medium text-success-strong">
                    Ready for dispatch
                </div>
            ) : dispatchabilityState === 'inspection_required' ? (
                <div className="mt-1 text-xs font-medium text-warning-strong">
                    Inspection required before dispatch
                </div>
            ) : null}

            {/* Parity Status: Operator, HoS & DVIR */}
            {!compact &&
                (asset.active_operator || asset.latest_dvir || asset.hos) && (
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 border-t border-line/40 pt-1.5">
                        {asset.active_operator ? (
                            <OperatorBindingChip
                                activeOperator={asset.active_operator}
                                compact
                                location={location}
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
                <div className="mt-1 flex items-center gap-1 rounded-md border border-danger/20 bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger-strong">
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
