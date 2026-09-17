import {
    Activity,
    AlertTriangle,
    Clock3,
    Compass,
    Navigation,
    PauseCircle,
    RefreshCw,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AssetTypeMultiSelect } from '@/components/asset-type-multi-select';
import {
    Button,
    EmptyState,
    PageHeading,
    Panel,
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui';
import type { AssetKind } from '@/lib/asset-kind';
import { getAssetKind, getAssetKindLabel } from '@/lib/asset-kind';
import { removeOutboxItem } from '@/lib/outbox';
import type { OutboxItem } from '@/lib/outbox';
import { cn } from '@/lib/utils';
import type {
    LocationUpdateViewModel,
    ScopeRefreshState,
    WorkspaceCapabilities,
} from '@/types/workspace';

const LiveTrackingMap = lazy(() =>
    import('@/components/live-tracking-map').then(
        ({ LiveTrackingMap: Map }) => ({ default: Map }),
    ),
);

function MapLoadingFallback() {
    return (
        <div
            className="flex h-[560px] min-h-[360px] items-center justify-center bg-surface-subtle p-6 text-center lg:h-[620px]"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading live location map"
        >
            <p className="text-sm text-ink-soft">Loading live location map…</p>
        </div>
    );
}

export function TrackingSurface({
    locations,
    capabilities,
    refresh,
    onRefresh,
    sharingEnabled,
    sharingPending,
    sharingError,
    onToggleSharing,
    outboxQueue,
    onOutboxChanged,
}: {
    locations: LocationUpdateViewModel[];
    capabilities: WorkspaceCapabilities;
    refresh: ScopeRefreshState;
    onRefresh: () => void;
    sharingEnabled: boolean;
    sharingPending: boolean;
    sharingError: string | null;
    onToggleSharing: (enable: boolean) => void;
    outboxQueue: OutboxItem[];
    onOutboxChanged: () => void;
}) {
    const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
    const [statusFilter, setStatusFilter] = useState<
        'all' | 'fresh' | 'delayed' | 'stale' | 'offline'
    >('all');
    const [assetFilters, setAssetFilters] = useState<Set<AssetKind>>(
        () => new Set(),
    );
    const [isOnline, setIsOnline] = useState(
        () => typeof navigator === 'undefined' || navigator.onLine,
    );

    const isRefreshing = refresh.status === 'refreshing';
    const pollError = refresh.status === 'failed';

    useEffect(() => {
        const markOnline = () => setIsOnline(true);
        const markOffline = () => setIsOnline(false);

        window.addEventListener('online', markOnline);
        window.addEventListener('offline', markOffline);

        return () => {
            window.removeEventListener('online', markOnline);
            window.removeEventListener('offline', markOffline);
        };
    }, []);

    const filteredLocations = locations.filter((loc) => {
        const matchesStatus =
            statusFilter === 'all' || loc.freshness_status === statusFilter;
        const matchesAsset =
            assetFilters.size === 0 || assetFilters.has(getAssetKind(loc));

        return matchesStatus && matchesAsset;
    });

    return (
        <div>
            <PageHeading
                title="Asset & Equipment Tracking"
                description="Monitor asset and equipment locations, verify freshness, retention limits, and manage offline outbox state."
            />

            <div className="space-y-6 p-4 md:p-6">
                {/* Header Controls & Coordinated Refresh Status */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                            <Activity className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-ink">
                                    Refresh coordinator (15s fallback)
                                </span>
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                                        !isOnline || pollError
                                            ? 'bg-danger-soft text-danger'
                                            : 'bg-success-soft text-success-strong',
                                    )}
                                    role="status"
                                >
                                    <span
                                        className={cn(
                                            'h-1.5 w-1.5 rounded-full',
                                            !isOnline || pollError
                                                ? 'bg-danger'
                                                : 'animate-pulse bg-success-strong',
                                        )}
                                    />
                                    {!isOnline
                                        ? 'Offline'
                                        : pollError
                                          ? 'Sync issue'
                                          : isRefreshing
                                            ? 'Refreshing'
                                            : refresh.mode === 'polling'
                                              ? 'Polling fallback'
                                              : 'Live'}
                                </span>
                            </div>
                            <p className="text-xs text-ink-soft">
                                Last refresh attempt:{' '}
                                {refresh.last_attempt_at
                                    ? new Date(
                                          refresh.last_attempt_at,
                                      ).toLocaleTimeString()
                                    : 'Not attempted'}{' '}
                                · Retention: 30-day precise coordinates
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {capabilities.share_location && (
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={sharingPending}
                                onClick={() => onToggleSharing(!sharingEnabled)}
                            >
                                {sharingEnabled ? (
                                    <>
                                        <PauseCircle className="mr-1.5 h-4 w-4 text-warning-strong" />
                                        Pause Location Sharing
                                    </>
                                ) : (
                                    <>
                                        <Navigation className="mr-1.5 h-4 w-4 text-brand-strong" />
                                        Enable Location Sharing
                                    </>
                                )}
                            </Button>
                        )}

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                        >
                            <RefreshCw
                                className={cn(
                                    'mr-1.5 h-4 w-4',
                                    isRefreshing && 'animate-spin',
                                )}
                            />
                            {isRefreshing ? 'Refreshing…' : 'Refresh now'}
                        </Button>

                        <div className="inline-flex rounded-lg border border-line bg-surface-subtle p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('visual')}
                                className={cn(
                                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                                    viewMode === 'visual'
                                        ? 'bg-surface font-semibold text-ink shadow-sm'
                                        : 'text-ink-soft hover:text-ink',
                                )}
                                aria-label="Switch to map view"
                                aria-pressed={viewMode === 'visual'}
                            >
                                Map View
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                                    viewMode === 'list'
                                        ? 'bg-surface font-semibold text-ink shadow-sm'
                                        : 'text-ink-soft hover:text-ink',
                                )}
                                aria-label="Switch to accessible synchronized list view"
                                aria-pressed={viewMode === 'list'}
                            >
                                Synchronized List
                            </button>
                        </div>
                    </div>
                </div>

                {sharingError && (
                    <div
                        className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger"
                        role="alert"
                    >
                        {sharingError}
                    </div>
                )}

                {/* Outbox Command Replay & Conflict Section */}
                {outboxQueue.length > 0 && (
                    <OutboxQueuePanel
                        queue={outboxQueue}
                        onResolved={onOutboxChanged}
                    />
                )}

                {/* Filter Tabs: Freshness Status & Asset Category */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                    {/* Freshness Status Filter */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {(
                            [
                                'all',
                                'fresh',
                                'delayed',
                                'stale',
                                'offline',
                            ] as const
                        ).map((status) => {
                            const count = locations.filter((l) => {
                                const matchesStatus =
                                    status === 'all' ||
                                    l.freshness_status === status;
                                const matchesAsset =
                                    assetFilters.size === 0 ||
                                    assetFilters.has(getAssetKind(l));

                                return matchesStatus && matchesAsset;
                            }).length;

                            const isSelected = statusFilter === status;
                            const statusDotColor =
                                status === 'fresh'
                                    ? 'bg-success-strong'
                                    : status === 'delayed'
                                      ? 'bg-warning-strong'
                                      : status === 'stale'
                                        ? 'bg-danger'
                                        : status === 'offline'
                                          ? 'bg-muted'
                                          : 'bg-brand-strong';

                            return (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setStatusFilter(status)}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-150',
                                        isSelected
                                            ? 'bg-brand-strong font-semibold text-white shadow-xs'
                                            : 'bg-surface-subtle text-ink-soft hover:bg-surface-subtle/80 hover:text-ink',
                                    )}
                                    aria-pressed={isSelected}
                                >
                                    <span
                                        className={cn(
                                            'h-2 w-2 shrink-0 rounded-full',
                                            isSelected
                                                ? 'bg-white'
                                                : statusDotColor,
                                        )}
                                    />
                                    <span>{status}</span>
                                    <span
                                        className={cn(
                                            'py-0.2 rounded-full px-1.5 text-[10px] font-semibold',
                                            isSelected
                                                ? 'bg-white/20 text-white'
                                                : 'bg-surface text-ink-soft',
                                        )}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Asset Type Filter */}
                    <AssetTypeMultiSelect
                        locations={locations}
                        selectedTypes={assetFilters}
                        onChange={setAssetFilters}
                        statusFilter={statusFilter}
                    />
                </div>

                {/* Main Content Pane */}
                {viewMode === 'visual' ? (
                    <Suspense fallback={<MapLoadingFallback />}>
                        <LiveTrackingMap locations={filteredLocations} />
                    </Suspense>
                ) : filteredLocations.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Compass}
                            title="No location updates found"
                            message="No field worker or asset updates match the selected freshness filter."
                        />
                    </Panel>
                ) : (
                    <SynchronizedLocationList locations={filteredLocations} />
                )}
            </div>
        </div>
    );
}

function SynchronizedLocationList({
    locations,
}: {
    locations: LocationUpdateViewModel[];
}) {
    return (
        <Panel className="overflow-hidden">
            <Table
                containerClassName="border-0 rounded-none"
                aria-label="Synchronized field location updates"
            >
                <TableCaption className="sr-only">
                    List of current location updates showing asset, assigned
                    operator, coordinates, accuracy, capture time, receive time,
                    sharing state, and freshness.
                </TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead scope="col">Asset / Equipment</TableHead>
                        <TableHead scope="col">Assigned Operator</TableHead>
                        <TableHead scope="col">Freshness Status</TableHead>
                        <TableHead scope="col">
                            Coordinates / Location
                        </TableHead>
                        <TableHead scope="col">Accuracy</TableHead>
                        <TableHead scope="col">Sharing</TableHead>
                        <TableHead scope="col">Captured Time</TableHead>
                        <TableHead scope="col">Received Time</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {locations.map((loc) => {
                        const availabilityLabel =
                            loc.asset?.status_label ?? 'Available';
                        const isAssigned =
                            loc.is_assigned ??
                            Boolean(loc.job || loc.user?.name);
                        const assignmentText = isAssigned
                            ? loc.job?.reference
                                ? `Assigned · Job ${loc.job.reference}`
                                : 'Assigned'
                            : 'Unassigned';

                        return (
                            <TableRow key={loc.id}>
                                <TableCell className="font-semibold text-ink">
                                    {loc.asset?.code ?? 'Asset'}
                                    <div className="text-xs font-normal text-ink-soft">
                                        {loc.asset?.name ??
                                            getAssetKindLabel(
                                                getAssetKind(loc),
                                            )}{' '}
                                        · {availabilityLabel} · {assignmentText}
                                        {Boolean(
                                            loc.job?.latest_delay &&
                                            (!loc.job.latest_delay
                                                .operational_asset_id ||
                                                loc.job.latest_delay
                                                    .operational_asset_id ===
                                                    loc.asset?.id),
                                        ) &&
                                            loc.job?.latest_delay && (
                                                <span
                                                    title={`Operational delay: ${loc.job.latest_delay.reason_label}${loc.job.latest_delay.estimated_minutes ? ` (+${loc.job.latest_delay.estimated_minutes}m)` : ''} (Distinct from GPS telemetry)`}
                                                    className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200"
                                                >
                                                    <AlertTriangle
                                                        className="size-2.5 text-amber-700 dark:text-amber-400"
                                                        aria-hidden="true"
                                                    />
                                                    <span>
                                                        Delay:{' '}
                                                        {
                                                            loc.job.latest_delay
                                                                .reason_label
                                                        }
                                                    </span>
                                                </span>
                                            )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs text-ink-soft">
                                    <div>
                                        {loc.user?.name
                                            ? loc.user.name
                                            : 'Unassigned'}
                                    </div>
                                    {loc.reported_via_phone && (
                                        <div className="text-ink-muted text-[10px]">
                                            via operator’s phone
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <FreshnessBadge
                                        status={loc.freshness_status}
                                        location={loc}
                                    />
                                </TableCell>
                                <TableCell className="text-xs">
                                    {loc.latitude !== null &&
                                    loc.longitude !== null ? (
                                        <span className="font-mono">
                                            {loc.latitude.toFixed(5)},{' '}
                                            {loc.longitude.toFixed(5)}
                                        </span>
                                    ) : loc.recorded_location ? (
                                        <span className="text-ink-soft">
                                            Recorded location:{' '}
                                            {loc.recorded_location}
                                        </span>
                                    ) : (
                                        <span className="text-ink-soft">
                                            Location unavailable
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs">
                                    {loc.accuracy_metres
                                        ? `±${loc.accuracy_metres}m`
                                        : 'N/A'}
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                    {loc.sharing_enabled ? (
                                        <span className="text-success-strong">
                                            On
                                        </span>
                                    ) : (
                                        <span className="text-warning-strong">
                                            Off
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs text-ink-soft">
                                    {loc.captured_at
                                        ? new Date(
                                              loc.captured_at,
                                          ).toLocaleTimeString()
                                        : 'N/A'}
                                </TableCell>
                                <TableCell className="text-xs text-ink-soft">
                                    {loc.received_at
                                        ? new Date(
                                              loc.received_at,
                                          ).toLocaleTimeString()
                                        : 'N/A'}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </Panel>
    );
}

function FreshnessBadge({
    status,
    location,
}: {
    status: LocationUpdateViewModel['freshness_status'];
    location?: LocationUpdateViewModel;
}) {
    const isNoReport =
        location?.has_gps_report === false ||
        location?.freshness_label === 'No GPS report';
    const isInterrupted =
        location?.freshness_label === 'Location not current' ||
        (!isNoReport && (status === 'delayed' || status === 'stale'));

    if (isNoReport) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                <Compass className="h-3 w-3" aria-hidden="true" />
                No GPS report
            </span>
        );
    }

    if (isInterrupted) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-warning-strong/50 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-strong">
                <Clock3 className="h-3 w-3" aria-hidden="true" />
                Location not current
            </span>
        );
    }

    const config =
        status === 'fresh'
            ? {
                  label: 'Fresh (≤3m)',
                  cls: 'bg-success-soft text-success-strong',
              }
            : { label: 'Device offline', cls: 'bg-danger-soft text-danger' };

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                config.cls,
            )}
        >
            {config.label}
        </span>
    );
}

function OutboxQueuePanel({
    queue,
    onResolved,
}: {
    queue: OutboxItem[];
    onResolved: () => void;
}) {
    const resolveConflict = (id: string) => {
        removeOutboxItem(id);
        onResolved();
    };

    return (
        <Panel className="border-warning-strong bg-warning-soft/20 p-4">
            <div className="flex items-center justify-between border-b border-warning-strong/30 pb-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning-strong" />
                    <h3 className="font-semibold text-ink">
                        Durable Outbox Queue ({queue.length} items)
                    </h3>
                </div>
                <span className="text-xs font-medium text-ink-soft">
                    Version-Aware Replay & Retry Active
                </span>
            </div>

            <ul className="mt-3 divide-y divide-line">
                {queue.map((item) => (
                    <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs"
                    >
                        <div>
                            <span className="font-semibold text-ink capitalize">
                                {item.action}
                            </span>{' '}
                            ·{' '}
                            <span className="font-mono">{item.commandId}</span>
                            <div className="text-ink-soft">
                                Status:{' '}
                                <span className="font-semibold capitalize">
                                    {item.status}
                                </span>{' '}
                                · Created:{' '}
                                {new Date(item.createdAt).toLocaleTimeString()}
                            </div>
                        </div>

                        {item.status === 'conflict' ? (
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-danger">
                                    409 Version Conflict
                                </span>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => resolveConflict(item.id)}
                                >
                                    Acknowledge Server Version
                                </Button>
                            </div>
                        ) : (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => resolveConflict(item.id)}
                            >
                                Clear from outbox
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
