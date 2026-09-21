import { AlertTriangle, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import {
    getFleetLocationFreshnessLabel,
    hasLocationCoordinates,
} from '@/components/workspace/fleet/fleet-location-labels';
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
    onCollapse,
}: {
    compact?: boolean;
    onCollapse?: () => void;
}) {
    return (
        <div
            className={cn(
                'flex items-center justify-center rounded-2xl border border-line bg-surface-subtle p-6 text-center',
                compact ? 'h-[520px] md:h-[640px]' : 'h-[560px] lg:h-[620px]',
            )}
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading live location map"
        >
            <div className="space-y-3">
                <p className="text-sm text-ink-soft">
                    Loading live location map…
                </p>
                {onCollapse && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onCollapse}
                        aria-label="Collapse fleet map"
                    >
                        <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
                        Collapse map
                    </Button>
                )}
            </div>
        </div>
    );
}

export function FleetMapFailureFallback({
    locations,
    selectedLocationId,
    onSelectedLocationChange,
    onRetry,
    onCollapse,
    compact,
}: {
    locations: LocationUpdateViewModel[];
    selectedLocationId?: number | null;
    onSelectedLocationChange?: (locationId: number) => void;
    onRetry: () => void;
    onCollapse?: () => void;
    compact: boolean;
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const mappedLocationCount = locations.filter(hasLocationCoordinates).length;
    const filteredLocations = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
            return locations;
        }

        return locations.filter((location) =>
            [
                location.asset?.code,
                location.asset?.name,
                location.user?.name,
                location.recorded_location,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [locations, searchQuery]);

    return (
        <div
            data-testid="live-tracking-map"
            className={cn(
                'grid min-h-0 grid-cols-1 grid-rows-[minmax(13rem,auto)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-warning/40 bg-warning-soft/10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-1',
                compact ? 'h-[520px] md:h-[640px]' : 'h-[560px] lg:h-[620px]',
            )}
        >
            <section
                role="alert"
                aria-live="polite"
                className="flex min-h-0 flex-col items-center justify-center border-b border-warning/30 p-6 text-center lg:border-r lg:border-b-0"
            >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning-strong">
                    <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                </div>
                <h4 className="mt-3 text-base font-semibold text-ink">
                    Map unavailable
                </h4>
                <p className="mx-auto mt-1 max-w-md text-xs text-ink-soft">
                    The map could not be rendered, but the synchronized asset
                    location list remains available.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onRetry}
                    >
                        Retry loading map
                    </Button>
                    {onCollapse && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onCollapse}
                            aria-label="Collapse fleet map"
                        >
                            <ChevronUp
                                className="mr-1.5 h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                            Collapse map
                        </Button>
                    )}
                </div>
            </section>

            <aside
                className="flex min-h-0 flex-col overflow-hidden bg-surface"
                aria-label="Synchronized mapped location list"
            >
                <div className="space-y-2 border-b border-line p-3.5">
                    <div>
                        <h3 className="text-sm font-semibold text-ink">
                            Asset locations
                        </h3>
                        <p className="text-xs text-ink-soft">
                            {mappedLocationCount} mapped ·{' '}
                            {Math.max(
                                0,
                                locations.length - mappedLocationCount,
                            )}{' '}
                            without coordinates
                        </p>
                    </div>
                    <label className="relative block">
                        <span className="sr-only">Search mapped locations</span>
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(event) =>
                                setSearchQuery(event.target.value)
                            }
                            placeholder="Search asset or operator…"
                            aria-label="Search mapped locations"
                            className="min-h-10 w-full rounded-lg border border-line bg-surface-subtle px-3 text-sm text-ink placeholder:text-ink-soft focus:border-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                        />
                    </label>
                </div>

                <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                    {filteredLocations.length === 0 ? (
                        <p className="p-6 text-center text-xs text-ink-soft">
                            {searchQuery
                                ? `No locations match “${searchQuery}”.`
                                : 'No location updates are available.'}
                        </p>
                    ) : (
                        filteredLocations.map((location) => {
                            const isSelected =
                                location.id === selectedLocationId;
                            const locationLabel =
                                location.asset?.code ??
                                location.asset?.name ??
                                'Asset location';

                            return (
                                <button
                                    key={location.id}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() =>
                                        onSelectedLocationChange?.(location.id)
                                    }
                                    className={cn(
                                        'min-h-16 w-full px-3.5 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-inset',
                                        isSelected
                                            ? 'bg-brand-soft/80 text-ink'
                                            : 'text-ink-soft hover:bg-surface-subtle',
                                    )}
                                >
                                    <span className="block text-sm font-semibold text-ink">
                                        {locationLabel}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-ink-soft">
                                        {location.asset?.name ??
                                            location.user?.name ??
                                            'Asset details unavailable'}
                                    </span>
                                    <span className="mt-1 block text-[11px] text-ink-soft">
                                        {getFleetLocationFreshnessLabel(
                                            location,
                                        )}
                                        {location.user?.name &&
                                            ` · Operator: ${location.user.name}`}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            </aside>
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

    const mappedLocationCount = locations.filter(
        (location) => location.latitude !== null && location.longitude !== null,
    ).length;
    const missingLocationCount = Math.max(
        0,
        locations.length - mappedLocationCount,
    );

    return (
        <Panel
            id={id}
            className={cn('space-y-3 overflow-hidden p-3 md:p-4', className)}
        >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-ink">
                                Fleet map
                            </h3>
                            <span className="text-xs text-ink-soft tabular-nums">
                                {mappedLocationCount} mapped
                                {locations.length > 0 &&
                                    ` · ${missingLocationCount} without coordinates`}
                            </span>
                        </div>
                        <p className="text-xs text-ink-soft">
                            Locate equipment, check position freshness, and open
                            asset details.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {collapsible && isCollapsed && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsCollapsed((prev) => !prev)}
                            className="text-xs font-medium"
                            aria-expanded={!isCollapsed}
                            aria-controls={`${id}-content`}
                        >
                            <>
                                <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                                Show map
                            </>
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
                        fallbackRender={({ retry }) => (
                            <FleetMapFailureFallback
                                locations={locations}
                                selectedLocationId={selectedLocationId}
                                onSelectedLocationChange={
                                    onSelectedLocationChange
                                }
                                onRetry={retry}
                                onCollapse={
                                    collapsible
                                        ? () => setIsCollapsed(true)
                                        : undefined
                                }
                                compact={compact}
                            />
                        )}
                        onCollapse={
                            collapsible ? () => setIsCollapsed(true) : undefined
                        }
                    >
                        <Suspense
                            fallback={
                                <AssetMapLoadingFallback
                                    compact={compact}
                                    onCollapse={
                                        collapsible
                                            ? () => setIsCollapsed(true)
                                            : undefined
                                    }
                                />
                            }
                        >
                            <LiveTrackingMap
                                locations={locations}
                                activeSosIncidents={activeSosIncidents}
                                selectedLocationId={selectedLocationId}
                                onSelectedLocationChange={
                                    onSelectedLocationChange
                                }
                                onCollapse={
                                    collapsible
                                        ? () => setIsCollapsed(true)
                                        : undefined
                                }
                                onSectionChange={onSectionChange}
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
