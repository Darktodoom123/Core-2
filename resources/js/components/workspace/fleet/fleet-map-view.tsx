import { Compass } from 'lucide-react';
import React, { lazy, Suspense } from 'react';
import { Button, Panel } from '@/components/ui';
import { AssetMapLoadingFallback } from '@/components/workspace/fleet/fleet-telemetry-section';
import { MapErrorBoundary } from '@/components/workspace/fleet/map-error-boundary';
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

export interface FleetMapViewProps {
    locations?: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    onSectionChange?: (section: WorkspaceSection) => void;
}

export function FleetMapView({
    locations = [],
    activeSosIncidents = [],
    onSectionChange,
}: FleetMapViewProps) {
    return (
        <Panel className="space-y-4 overflow-hidden p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                    <h3 className="text-base font-semibold text-ink">
                        Live Fleet Telematics &amp; GIS Map
                    </h3>
                    <p className="text-xs text-ink-soft">
                        Real-time positional tracking and telemetry across
                        visible fleet assets and units.
                    </p>
                </div>
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
            <MapErrorBoundary
                compact={false}
                fallbackTitle="Fleet Map Currently Unavailable"
                fallbackMessage="Failed to initialize or render the GIS tracking map. Network tile requests or WebGL may be offline. Telemetry lists and queue data remain fully functional."
            >
                <Suspense
                    fallback={<AssetMapLoadingFallback compact={false} />}
                >
                    <LiveTrackingMap
                        locations={locations}
                        activeSosIncidents={activeSosIncidents}
                        compact={false}
                        showLocationList={true}
                    />
                </Suspense>
            </MapErrorBoundary>
        </Panel>
    );
}
