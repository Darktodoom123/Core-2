import {
    Camera,
    ClipboardCheck,
    MapPin,
    ShieldAlert,
    ShieldCheck,
    Wrench,
} from 'lucide-react';
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
    onSelectTab: (
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
    onSelectTab,
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
    const canUpdateStatus = Boolean(capabilities.update_asset_status);
    const canInspect = Boolean(capabilities.inspect_asset);
    const canMaintain = Boolean(capabilities.maintain_asset);
    const canTrack = Boolean(
        (capabilities.view_tracking ?? true) &&
        onViewFullTracking &&
        assetLocation &&
        assetLocation.latitude !== null &&
        assetLocation.longitude !== null,
    );
    const canViewDvir = Boolean(asset.latest_dvir && onViewDvir);

    const hasAnyAction =
        canLockdown ||
        canUpdateStatus ||
        canInspect ||
        canMaintain ||
        canTrack ||
        canViewDvir;

    if (!hasAnyAction) {
        return null;
    }

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-subtle/50 p-2.5 shadow-2xs',
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

            {/* Update Readiness & Status */}
            {canUpdateStatus && (
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onSelectTab('status')}
                    title="Change operational readiness status"
                    className="shrink-0"
                >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Update Status
                </Button>
            )}

            {/* Record Pre-Op / Safety Inspection */}
            {canInspect && (
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onSelectTab('inspections')}
                    title="Submit safety or pre-operation inspection"
                    className="shrink-0"
                >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Record Inspection
                </Button>
            )}

            {/* Open Maintenance Work Order */}
            {canMaintain && (
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onSelectTab('maintenance')}
                    title="Open maintenance work order"
                    className="shrink-0"
                >
                    <Wrench className="h-3.5 w-3.5" />
                    Open Work Order
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
                    {(asset.latest_dvir?.photos?.length ?? 0) > 0
                        ? `Walkaround Photos (${asset.latest_dvir?.photos?.length})`
                        : 'Walkaround Photos'}
                </Button>
            )}
        </div>
    );
}
