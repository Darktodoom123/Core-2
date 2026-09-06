import { AlertTriangle, Radio } from 'lucide-react';
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

interface FleetAssetCardProps {
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
        location && location.latitude !== null && location.longitude !== null;

    const isLockedOut =
        asset.lockout?.is_locked_out ??
        asset.status?.value === 'under_maintenance';

    return (
        <div
            className={cn(
                'group relative rounded-xl border p-3.5 text-left transition-all',
                isSelected
                    ? 'border-brand-strong bg-brand-soft/40 shadow-xs ring-1 ring-brand/30'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-surface-subtle/50',
                isLockedOut && 'border-danger/30 bg-danger-soft/10',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onSelect?.(asset.id)}
                        className="text-left font-bold text-ink hover:underline focus:outline-none"
                    >
                        {asset.code}
                    </button>
                    {asset.rated_capacity && (
                        <span className="py-0.2 rounded border border-line bg-surface-subtle px-1.5 font-mono text-[10px] font-semibold text-ink-soft">
                            {asset.rated_capacity} {asset.capacity_unit ?? 'MT'}
                        </span>
                    )}
                </div>

                <CanonicalStatusBadge status={asset.status} size="sm" />
            </div>

            <p
                onClick={() => onSelect?.(asset.id)}
                className="mt-1 cursor-pointer truncate text-xs font-semibold text-ink hover:text-brand-strong"
            >
                {asset.name}
            </p>

            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-ink-soft">
                <span>{humanize(asset.subtype || asset.kind)}</span>

                {hasLiveGps ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-strong">
                        <Radio className="h-2.5 w-2.5 animate-pulse text-success" />
                        GPS Live
                        {location.speed !== null && location.speed > 0
                            ? ` (${Math.round(location.speed)} km/h)`
                            : ''}
                    </span>
                ) : (
                    <span className="max-w-[120px] truncate text-[10px]">
                        {asset.location ?? 'Base Yard'}
                    </span>
                )}
            </div>

            {/* Live Operational Parity Strip: Operator + HoS + DVIR */}
            <div className="mt-3 space-y-1.5 border-t border-line/60 pt-2.5">
                {/* Active Operator & Telemetry */}
                <OperatorBindingChip
                    activeOperator={asset.active_operator}
                    compact
                    className="w-full justify-between"
                />

                {/* HoS Duty Clock & Fatigue Warnings */}
                {asset.hos && (
                    <div className="flex items-center justify-between">
                        <HosDutyBadge hos={asset.hos} compact />
                    </div>
                )}

                {/* DVIR Inspection Status & Walkaround Modal Trigger */}
                <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] font-medium text-ink-soft">
                        Safety Walkaround
                    </span>
                    <DvirStatusBadge
                        dvir={asset.latest_dvir}
                        onViewInspection={onViewDvir}
                        compact
                    />
                </div>
            </div>

            {/* Lockout indicator if active */}
            {isLockedOut && (
                <div className="mt-2 flex items-center gap-1 rounded-md bg-danger-soft px-2 py-1 text-[11px] font-semibold text-danger-strong">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                        {asset.lockout?.lockout_reason ||
                            'Safety Lockout Enforced'}
                    </span>
                </div>
            )}
        </div>
    );
}
