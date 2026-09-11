import { ChevronDown, ChevronUp, Compass, MapPin } from 'lucide-react';
import React, { lazy, Suspense, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { MapErrorBoundary } from '@/components/workspace/fleet/map-error-boundary';
import { cn } from '@/lib/utils';
import type {
    LocationUpdateViewModel,
    SosIncidentViewModel,
    WorkspaceSection,
} from '@/types/workspace';

const LiveTrackingMap = lazy(() =>
    import('@/components/live-tracking-map').then(
        ({ LiveTrackingMap: Map }) => ({ default: Map }),
    ),
);

export function AssetMapLoadingFallback({
    compact = false,
}: {
    compact?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex items-center justify-center rounded-2xl border border-line bg-surface-subtle p-6 text-center',
                compact ? 'h-[360px] md:h-[420px]' : 'h-[560px] lg:h-[620px]',
            )}
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading live location map"
        >
            <p className="text-sm text-ink-soft">Loading live location map…</p>
        </div>
    );
}

export interface FleetMapViewProps {
    locations?: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    onSectionChange?: (section: WorkspaceSection) => void;
    selectedLocationId?: number | null;
    onSelectedLocationChange?: (locationId: number) => void;
    compact?: boolean;
    showLocationList?: boolean;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    id?: string;
    className?: string;
}

export function FleetMapView({
    locations = [],
    activeSosIncidents = [],
    onSectionChange,
    selectedLocationId,
    onSelectedLocationChange,
    compact = true,
    showLocationList = true,
    collapsible = false,
    defaultCollapsed = false,
    id = 'fleet-live-map',
    className,
}: FleetMapViewProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    const activeLiveGpsCount = locations.filter(
        (l) =>
            l.latitude !== null &&
            l.longitude !== null &&
            (l.freshness_status === 'fresh' ||
                l.freshness_status === 'delayed'),
    ).length;

    return (
        <Panel
            id={id}
            className={cn('space-y-4 overflow-hidden p-4 md:p-6', className)}
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-ink">
                                Live Fleet Telematics &amp; GIS Map
                            </h3>
                            {activeLiveGpsCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">
                                    {activeLiveGpsCount} active GPS
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-ink-soft">
                            Real-time positional tracking and telemetry across
                            visible fleet assets and units.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {collapsible && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsCollapsed((prev) => !prev)}
                            className="text-xs font-medium"
                            aria-expanded={!isCollapsed}
                            aria-controls={`${id}-content`}
                        >
                            {isCollapsed ? (
                                <>
                                    <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                                    Show Map
                                </>
                            ) : (
                                <>
                                    <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
                                    Hide Map
                                </>
                            )}
                        </Button>
                    )}
                    {onSectionChange && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onSectionChange('tracking')}
                        >
                            <Compass className="mr-1.5 h-3.5 w-3.5" />
                            Open operations tracking
                        </Button>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <div id={`${id}-content`}>
                    <MapErrorBoundary
                        compact={compact}
                        fallbackTitle="Fleet Map Currently Unavailable"
                        fallbackMessage="Failed to initialize or render the GIS tracking map. Network tile requests or WebGL may be offline. Telemetry lists and queue data remain fully functional."
                    >
                        <Suspense
                            fallback={
                                <AssetMapLoadingFallback compact={compact} />
                            }
                        >
                            <LiveTrackingMap
                                locations={locations}
                                activeSosIncidents={activeSosIncidents}
                                selectedLocationId={selectedLocationId}
                                onSelectedLocationChange={
                                    onSelectedLocationChange
                                }
                                compact={compact}
                                showLocationList={showLocationList}
                            />
                        </Suspense>
                    </MapErrorBoundary>
                </div>
            )}
        </Panel>
    );
}
