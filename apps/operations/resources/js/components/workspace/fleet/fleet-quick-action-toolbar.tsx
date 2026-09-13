import { Camera, MapPin, ShieldAlert } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    LocationUpdateViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export interface FleetQuickActionToolbarProps {
    asset: AssetViewModel;
    assetLocation?: LocationUpdateViewModel | null;
    capabilities: WorkspaceCapabilities;
    onSelectTab?: (
        tab: 'overview' | 'status' | 'inspections' | 'maintenance',
    ) => void;
    onOpenLockdown?: () => void;
    onViewFullTracking?: () => void;
    onViewDvir?: () => void;
    lockdownTriggerRef?: React.RefObject<HTMLButtonElement | null>;
    className?: string;
}

export function FleetQuickActionToolbar({
    asset,
    assetLocation,
    capabilities,
    onOpenLockdown,
    onViewFullTracking,
    onViewDvir,
    lockdownTriggerRef,
    className,
}: FleetQuickActionToolbarProps) {
    const canLockdown = Boolean(
        capabilities.safety_lockdown_asset &&
        asset.status?.value !== 'unavailable',
    );
    const canTrack = Boolean(
        (capabilities.view_tracking ?? true) &&
        onViewFullTracking &&
        assetLocation &&
        assetLocation.latitude !== null &&
        assetLocation.longitude !== null,
    );
    const canViewDvir = Boolean(asset.latest_dvir && onViewDvir);

    const hasAnyAction = canLockdown || canTrack || canViewDvir;

    if (!hasAnyAction) {
        return null;
    }

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-subtle/50 p-2.5',
                className,
            )}
            role="toolbar"
            aria-label="Asset quick actions"
        >
            <span className="text-xs font-semibold text-ink-soft select-none">
                Quick Actions:
            </span>

            {/* Emergency Safety Recall Lockdown */}
            {canLockdown && (
                <Button
                    ref={lockdownTriggerRef}
                    size="sm"
                    variant="danger"
                    onClick={onOpenLockdown}
                    title="Place asset under emergency safety recall lockdown"
                    className="shrink-0"
                >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Safety Lockdown
                </Button>
            )}

            {/* Live GIS Map View */}
            {canTrack && (
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={onViewFullTracking}
                    title="View asset location on live GIS fleet map"
                    className="shrink-0"
                >
                    <MapPin className="h-3.5 w-3.5" />
                    Track on Map
                </Button>
            )}

            {/* 4-Angle DVIR Walkaround Photos */}
            {canViewDvir && (
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={onViewDvir}
                    title="View DVIR walkaround photos and inspection checklist"
                    className="shrink-0"
                >
                    <Camera className="h-3.5 w-3.5" />
                    {(asset.latest_dvir?.photos?.length ?? 0) > 0 ? (
                        <>
                            Walkaround Photos (
                            <span className="tabular-nums">
                                {asset.latest_dvir?.photos?.length}
                            </span>
                            )
                        </>
                    ) : (
                        'Walkaround Photos'
                    )}
                </Button>
            )}
        </div>
    );
}
