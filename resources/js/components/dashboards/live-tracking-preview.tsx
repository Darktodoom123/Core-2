import {
    ArrowUpRight,
    CheckCircle2,
    CircleAlert,
    Clock3,
    Construction,
    Radio,
    Truck,
    UserRoundCog,
    WifiOff,
    Wrench,
} from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { AssetTypeMultiSelect } from '@/components/asset-type-multi-select';
import { Button, EmptyState, Panel } from '@/components/ui';
import type { AssetKind } from '@/lib/asset-kind';
import { getAssetKind } from '@/lib/asset-kind';
import type {
    LocationUpdateViewModel,
    ScopeRefreshState,
} from '@/types/workspace';

const LiveTrackingMap = lazy(() =>
    import('@/components/live-tracking-map').then(
        ({ LiveTrackingMap: Map }) => ({ default: Map }),
    ),
);

function MapLoadingFallback() {
    return (
        <div
            className="flex h-[360px] min-h-[360px] items-center justify-center bg-surface-subtle p-6 text-center md:h-[420px]"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading live location map"
        >
            <p className="text-sm text-ink-soft">Loading live location map…</p>
        </div>
    );
}

const STATUS_ORDER: Record<
    LocationUpdateViewModel['freshness_status'],
    number
> = {
    offline: 0,
    stale: 1,
    delayed: 2,
    fresh: 3,
};

export interface LiveTrackingPreviewProps {
    locations: LocationUpdateViewModel[];
    refresh?: ScopeRefreshState;
    realtimeConnected?: boolean;
    onOpenTracking?: () => void;
}

export function LiveTrackingPreview({
    locations,
    refresh,
    realtimeConnected = false,
    onOpenTracking,
}: LiveTrackingPreviewProps) {
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
        null,
    );
    const [assetFilters, setAssetFilters] = useState<Set<AssetKind>>(
        () => new Set(),
    );

    const filteredLocations = useMemo(
        () =>
            locations.filter(
                (location) =>
                    assetFilters.size === 0 ||
                    assetFilters.has(getAssetKind(location)),
            ),
        [assetFilters, locations],
    );

    const effectiveSelectedLocationId = filteredLocations.some(
        (location) => location.id === selectedLocationId,
    )
        ? selectedLocationId
        : null;

    const sortedLocations = useMemo(
        () =>
            [...filteredLocations]
                .sort((a, b) => {
                    const statusDifference =
                        STATUS_ORDER[a.freshness_status] -
                        STATUS_ORDER[b.freshness_status];

                    if (statusDifference !== 0) {
                        return statusDifference;
                    }

                    return timestamp(b.received_at) - timestamp(a.received_at);
                })
                .slice(0, 5),
        [filteredLocations],
    );

    const latestReceivedAt = filteredLocations.reduce<string | null>(
        (latest, location) =>
            timestamp(location.received_at) > timestamp(latest)
                ? location.received_at
                : latest,
        null,
    );
    const connection = getConnectionState(refresh, realtimeConnected);
    const mappedCount = filteredLocations.filter(
        (location) => location.latitude !== null && location.longitude !== null,
    ).length;

    return (
        <section aria-labelledby="live-tracking-preview-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2
                        id="live-tracking-preview-heading"
                        className="text-lg font-semibold tracking-tight text-ink"
                    >
                        Live field tracking
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">
                        Monitor the latest visible worker and asset locations
                        before opening the full tracking workspace.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span
                        className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${connection.className}`}
                        role="status"
                        aria-live="polite"
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${connection.dotClassName}`}
                            aria-hidden="true"
                        />
                        {connection.label}
                        {latestReceivedAt && (
                            <span className="font-normal text-current/75">
                                · updated {formatAge(latestReceivedAt)}
                            </span>
                        )}
                    </span>
                    {onOpenTracking && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onOpenTracking}
                        >
                            Open full tracking
                            <ArrowUpRight
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        </Button>
                    )}
                </div>
            </div>

            <div className="mb-3 flex justify-end">
                <AssetTypeMultiSelect
                    locations={locations}
                    selectedTypes={assetFilters}
                    onChange={setAssetFilters}
                />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
                <Suspense fallback={<MapLoadingFallback />}>
                    <LiveTrackingMap
                        locations={filteredLocations}
                        compact
                        showLocationList={false}
                        selectedLocationId={effectiveSelectedLocationId}
                        onSelectedLocationChange={setSelectedLocationId}
                    />
                </Suspense>

                <Panel className="flex min-h-[360px] flex-col overflow-hidden p-0 md:min-h-[420px]">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                        <div>
                            <h3 className="text-sm font-semibold text-ink">
                                Unit status
                            </h3>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                {filteredLocations.length === 0
                                    ? 'No visible field units'
                                    : `${mappedCount} of ${filteredLocations.length} with coordinates`}
                            </p>
                        </div>
                        <Radio
                            className="h-4 w-4 text-brand-strong"
                            aria-hidden="true"
                        />
                    </div>

                    {sortedLocations.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center p-6">
                            <EmptyState
                                compact
                                icon={Radio}
                                title="No location updates"
                                message="Visible field units will appear here when location sharing is active."
                            />
                        </div>
                    ) : (
                        <ul className="divide-y divide-line overflow-y-auto">
                            {sortedLocations.map((location) => (
                                <UnitStatusRow
                                    key={location.id}
                                    location={location}
                                    selected={
                                        location.id ===
                                        effectiveSelectedLocationId
                                    }
                                    onSelect={() => {
                                        if (
                                            location.latitude !== null &&
                                            location.longitude !== null
                                        ) {
                                            setSelectedLocationId(location.id);
                                        }
                                    }}
                                />
                            ))}
                        </ul>
                    )}

                    {filteredLocations.length > sortedLocations.length &&
                        onOpenTracking && (
                            <div className="mt-auto border-t border-line px-4 py-3">
                                <button
                                    type="button"
                                    className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-strong hover:text-brand focus-visible:outline-none"
                                    onClick={onOpenTracking}
                                >
                                    View all {filteredLocations.length} units
                                    <ArrowUpRight
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                </button>
                            </div>
                        )}
                </Panel>
            </div>
        </section>
    );
}

function UnitStatusRow({
    location,
    selected,
    onSelect,
}: {
    location: LocationUpdateViewModel;
    selected: boolean;
    onSelect: () => void;
}) {
    const status = statusMeta(location.freshness_status);
    const trackableLabel = location.asset?.code ?? 'Field worker';
    const hasCoordinates =
        location.latitude !== null && location.longitude !== null;

    return (
        <li>
            <button
                type="button"
                className={`flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none ${
                    selected ? 'bg-brand-soft/70' : 'hover:bg-surface-subtle'
                } ${!hasCoordinates ? 'opacity-75' : ''}`}
                onClick={onSelect}
                disabled={!hasCoordinates}
                aria-pressed={selected}
            >
                <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${status.iconClassName}`}
                >
                    <AssetIcon location={location} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                        {location.asset?.name ?? location.user.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">
                        {trackableLabel}
                        {location.job ? ` · ${location.job.reference}` : ''}
                    </span>
                </span>
                <span className="shrink-0 text-right">
                    <span
                        className={`flex items-center justify-end gap-1 text-xs font-semibold ${status.textClassName}`}
                    >
                        <StatusIcon
                            status={location.freshness_status}
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                        />
                        {status.label}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted">
                        Last received {formatAge(location.received_at)}
                    </span>
                </span>
            </button>
        </li>
    );
}

function statusMeta(status: LocationUpdateViewModel['freshness_status']) {
    if (status === 'fresh') {
        return {
            label: 'Fresh',
            textClassName: 'text-success-strong',
            iconClassName: 'bg-success-soft text-success-strong',
        };
    }

    if (status === 'delayed') {
        return {
            label: 'Delayed',
            textClassName: 'text-warning-strong',
            iconClassName: 'bg-warning-soft text-warning-strong',
        };
    }

    if (status === 'stale') {
        return {
            label: 'Stale',
            textClassName: 'text-danger',
            iconClassName: 'bg-danger-soft text-danger',
        };
    }

    return {
        label: 'Offline',
        textClassName: 'text-danger',
        iconClassName: 'bg-danger-soft text-danger',
    };
}

function AssetIcon({ location }: { location: LocationUpdateViewModel }) {
    const kind = getAssetKind(location);

    if (kind === 'truck') {
        return <Truck className="h-4 w-4" aria-hidden="true" />;
    }

    if (kind === 'crane') {
        return <Construction className="h-4 w-4" aria-hidden="true" />;
    }

    if (kind === 'equipment') {
        return <Wrench className="h-4 w-4" aria-hidden="true" />;
    }

    return <UserRoundCog className="h-4 w-4" aria-hidden="true" />;
}

function StatusIcon({
    status,
    className,
}: {
    status: LocationUpdateViewModel['freshness_status'];
    className: string;
}) {
    if (status === 'fresh') {
        return <CheckCircle2 className={className} aria-hidden="true" />;
    }

    if (status === 'delayed') {
        return <Clock3 className={className} aria-hidden="true" />;
    }

    if (status === 'stale') {
        return <CircleAlert className={className} aria-hidden="true" />;
    }

    return <WifiOff className={className} aria-hidden="true" />;
}

function getConnectionState(
    refresh: ScopeRefreshState | undefined,
    realtimeConnected: boolean,
) {
    if (refresh?.status === 'failed') {
        return {
            label: 'Sync issue',
            className: 'border-danger/30 bg-danger-soft text-danger',
            dotClassName: 'bg-danger',
        };
    }

    if (realtimeConnected) {
        return {
            label: 'Live',
            className: 'border-success/30 bg-success-soft text-success-strong',
            dotClassName: 'bg-success-strong',
        };
    }

    return {
        label: 'Polling fallback',
        className: 'border-warning/30 bg-warning-soft text-warning-strong',
        dotClassName: 'bg-warning-strong',
    };
}

function timestamp(value: string | null) {
    return value ? new Date(value).getTime() : 0;
}

function formatAge(value: string | null) {
    if (!value) {
        return 'not available';
    }

    const seconds = Math.max(
        0,
        Math.floor((Date.now() - timestamp(value)) / 1000),
    );

    if (seconds < 60) {
        return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    return `${Math.floor(minutes / 60)}h ago`;
}
