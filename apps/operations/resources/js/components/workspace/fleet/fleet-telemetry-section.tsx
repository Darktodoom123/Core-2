import { Compass, MapPin, Navigation } from 'lucide-react';
import React, { lazy, Suspense } from 'react';
import { Button } from '@/components/ui';
import { WeatherSafetyTelemetry } from '@/components/weather/weather-safety-telemetry';
import { MapErrorBoundary } from '@/components/workspace/fleet/map-error-boundary';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    LocationUpdateViewModel,
    SosIncidentViewModel,
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

export interface FleetTelemetrySectionProps {
    asset: AssetViewModel;
    location?: LocationUpdateViewModel | null;
    activeSosIncidents?: SosIncidentViewModel[];
    onViewFullTracking?: () => void;
}

export function FleetTelemetrySection({
    asset,
    location,
    activeSosIncidents = [],
    onViewFullTracking,
}: FleetTelemetrySectionProps) {
    const hasGps =
        location && location.latitude !== null && location.longitude !== null;

    if (!hasGps) {
        return (
            <div className="space-y-4">
                <div className="rounded-xl border border-line bg-surface-subtle/70 p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface text-brand-strong">
                        <MapPin className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-ink">
                        No Active Live GPS Stream
                    </h3>
                    <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
                        This vehicle is not currently broadcasting live GPS
                        coordinates. Its registered yard or depot location is:
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink">
                        <Navigation className="h-4 w-4 text-brand-strong" />
                        <span>
                            {asset.location ??
                                'Depot yard location not specified'}
                        </span>
                    </div>
                    <p className="mx-auto mt-4 max-w-lg text-xs text-ink-soft">
                        Real-time GPS telemetry streams automatically when an
                        operator or driver starts an active dispatch assignment
                        with this unit using the field mobile app.
                    </p>
                    {onViewFullTracking && (
                        <div className="mt-5 flex justify-center">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onViewFullTracking}
                            >
                                <Compass className="mr-1.5 h-4 w-4" />
                                View Fleet Map
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Coordinates (Lat, Lng)
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">
                        {location.latitude?.toFixed(5)},{' '}
                        {location.longitude?.toFixed(5)}
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Current Speed
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">
                        {location.speed !== null ? (
                            location.speed > 0 ? (
                                <span className="font-bold text-brand-strong tabular-nums">
                                    {location.speed} km/h
                                </span>
                            ) : (
                                <span className="text-ink-soft tabular-nums">
                                    0 km/h (Stationary)
                                </span>
                            )
                        ) : (
                            <span className="text-ink-soft">
                                Speed not recorded
                            </span>
                        )}
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Signal Freshness
                    </dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                        <span
                            className={cn(
                                'h-2 w-2 rounded-full',
                                location.freshness_status === 'fresh' &&
                                    'animate-pulse bg-success-strong',
                                location.freshness_status === 'delayed' &&
                                    'bg-warning-strong',
                                location.freshness_status === 'stale' &&
                                    'bg-warning-strong',
                                location.freshness_status === 'offline' &&
                                    'bg-ink-soft/40',
                            )}
                        />
                        <span className="capitalize">
                            {humanize(location.freshness_status)}
                        </span>
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Assigned Operator / Driver
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">
                        {location.user?.name ?? 'Unassigned'}
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Active Dispatch Job
                    </dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-ink">
                        {location.job ? (
                            <a
                                href={`/operations/dispatch-jobs/${location.job.id}`}
                                className="inline-flex items-center gap-1 rounded text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            >
                                <span>{location.job.reference}</span>
                                <span className="max-w-[120px] truncate text-xs font-normal text-ink-soft">
                                    ({location.job.title})
                                </span>
                            </a>
                        ) : (
                            <span className="font-normal text-ink-soft">
                                None (Standby)
                            </span>
                        )}
                    </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                    <dt className="text-xs font-medium text-ink-soft">
                        Last Ping Received
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-ink tabular-nums">
                        {location.received_at
                            ? formatDateTime(location.received_at)
                            : 'N/A'}
                    </dd>
                </div>
            </dl>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-ink">
                        Live map position
                    </h4>
                    {location.accuracy_metres !== null && (
                        <span className="text-xs text-ink-soft">
                            Accuracy: ±
                            <span className="tabular-nums">
                                {location.accuracy_metres}
                            </span>
                            m · Source: {humanize(location.source)}
                        </span>
                    )}
                </div>
                <MapErrorBoundary
                    compact={true}
                    fallbackTitle="Asset Map Preview Unavailable"
                    fallbackMessage="Unable to render map preview for this unit. Coordinates and speed telematics remain valid above."
                >
                    <Suspense
                        fallback={<AssetMapLoadingFallback compact={true} />}
                    >
                        <LiveTrackingMap
                            locations={[location]}
                            activeSosIncidents={activeSosIncidents}
                            compact={true}
                            showLocationList={false}
                        />
                    </Suspense>
                </MapErrorBoundary>
            </div>

            {/* Hyper-local Site Weather & Wind Safety at Crane GPS Location */}
            <WeatherSafetyTelemetry
                variant="site"
                latitude={location.latitude}
                longitude={location.longitude}
                locationLabel={`${asset.code} Current Telemetry Location`}
                className="mt-3"
            />

            {onViewFullTracking && (
                <div className="flex justify-end pt-1">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onViewFullTracking}
                    >
                        <Compass className="mr-1.5 h-4 w-4" />
                        View Fleet Map
                    </Button>
                </div>
            )}
        </div>
    );
}
