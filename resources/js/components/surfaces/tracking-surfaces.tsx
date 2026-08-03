import { router } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    Compass,
    Construction,
    Navigation,
    PauseCircle,
    RefreshCw,
    Truck,
    UserRoundCog,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    getAssetKind,
    HeavyEquipmentIcon,
    OpenStreetMapTrackingMap,
} from '@/components/openstreetmap-tracking-map';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import {
    getOutboxQueue,
    queueCommand,
    removeOutboxItem,
    syncOutbox,
} from '@/lib/outbox';
import type { OutboxItem } from '@/lib/outbox';
import { cn } from '@/lib/utils';
import type {
    LocationUpdateViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export function TrackingSurface({
    locations,
    capabilities,
}: {
    locations: LocationUpdateViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
    const [statusFilter, setStatusFilter] = useState<
        'all' | 'fresh' | 'delayed' | 'stale' | 'offline'
    >('all');
    const [assetFilter, setAssetFilter] = useState<
        'all' | 'truck' | 'crane' | 'equipment' | 'personnel'
    >('all');
    const [lastPolledAt, setLastPolledAt] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pollError, setPollError] = useState(false);
    const [isOnline, setIsOnline] = useState(
        () => typeof navigator === 'undefined' || navigator.onLine,
    );
    const [outboxQueue, setOutboxQueue] = useState<OutboxItem[]>(() =>
        getOutboxQueue(),
    );
    const [sharingPending, setSharingPending] = useState(false);
    const sharingEnabled = locations[0]?.sharing_enabled ?? false;

    const refreshData = useCallback(() => {
        setIsRefreshing(true);
        router.reload({
            only: ['locations', 'workspace'],
            onSuccess: () => setPollError(false),
            onError: () => setPollError(true),
            onFinish: () => {
                setIsRefreshing(false);
                setLastPolledAt(new Date());
                setOutboxQueue(getOutboxQueue());
            },
        });
    }, []);

    // Measured Polling — 15 seconds
    useEffect(() => {
        const interval = window.setInterval(() => {
            refreshData();
        }, 15_000);

        return () => window.clearInterval(interval);
    }, [refreshData]);

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

    const toggleSharing = async (enable: boolean) => {
        setSharingPending(true);

        const submit = async (payload: Record<string, unknown>) => {
            queueCommand('location.store', '/operations/locations', payload);
            setOutboxQueue(getOutboxQueue());
            await syncOutbox();
            setOutboxQueue(getOutboxQueue());
            setSharingPending(false);
            refreshData();
        };

        if (!enable) {
            await submit({
                sharing_enabled: false,
                captured_at: new Date().toISOString(),
            });

            return;
        }

        if (!('geolocation' in navigator)) {
            setSharingPending(false);

            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) =>
                void submit({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy_metres: pos.coords.accuracy,
                    captured_at: new Date(pos.timestamp).toISOString(),
                    sharing_enabled: true,
                }),
            () => setSharingPending(false),
            { enableHighAccuracy: true, timeout: 10_000 },
        );
    };

    useEffect(() => {
        const flush = () =>
            void syncOutbox().then(() => setOutboxQueue(getOutboxQueue()));
        window.addEventListener('online', flush);
        flush();

        return () => window.removeEventListener('online', flush);
    }, []);

    const filteredLocations = locations.filter((loc) => {
        const matchesStatus =
            statusFilter === 'all' || loc.freshness_status === statusFilter;
        const matchesAsset =
            assetFilter === 'all' || getAssetKind(loc) === assetFilter;

        return matchesStatus && matchesAsset;
    });

    return (
        <div>
            <PageHeading
                title="Live Field Tracking & Resilience"
                description="Monitor worker and asset locations, verify freshness, retention limits, and manage offline outbox state."
            />

            <div className="space-y-6 p-4 md:p-6">
                {/* Header Controls & Measured Polling Status */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                            <Activity className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-ink">
                                    Measured Polling (15s)
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
                                          : 'Live'}
                                </span>
                            </div>
                            <p className="text-xs text-ink-soft">
                                Last poll attempt:{' '}
                                {lastPolledAt.toLocaleTimeString()} · Retention:
                                30-day precise coordinates
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {capabilities.share_location && (
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={sharingPending}
                                onClick={() => toggleSharing(!sharingEnabled)}
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
                            onClick={refreshData}
                            disabled={isRefreshing}
                        >
                            <RefreshCw
                                className={cn(
                                    'mr-1.5 h-4 w-4',
                                    isRefreshing && 'animate-spin',
                                )}
                            />
                            {isRefreshing ? 'Polling…' : 'Refresh now'}
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

                {/* Outbox Command Replay & Conflict Section */}
                {outboxQueue.length > 0 && (
                    <OutboxQueuePanel
                        queue={outboxQueue}
                        onResolved={() => setOutboxQueue(getOutboxQueue())}
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
                                    assetFilter === 'all' ||
                                    getAssetKind(l) === assetFilter;

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
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-xs font-semibold tracking-wider text-ink-soft uppercase">
                            Asset:
                        </span>
                        {(
                            [
                                { id: 'all', label: 'All Types', icon: null },
                                { id: 'truck', label: 'Trucks', icon: Truck },
                                {
                                    id: 'crane',
                                    label: 'Cranes',
                                    icon: Construction,
                                },
                                {
                                    id: 'equipment',
                                    label: 'Heavy Eqp',
                                    icon: HeavyEquipmentIcon,
                                },
                                {
                                    id: 'personnel',
                                    label: 'Personnel',
                                    icon: UserRoundCog,
                                },
                            ] as const
                        ).map((item) => {
                            const count = locations.filter((l) => {
                                const matchesStatus =
                                    statusFilter === 'all' ||
                                    l.freshness_status === statusFilter;
                                const matchesAsset =
                                    item.id === 'all' ||
                                    getAssetKind(l) === item.id;

                                return matchesStatus && matchesAsset;
                            }).length;

                            const isSelected = assetFilter === item.id;
                            const Icon = item.icon;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setAssetFilter(item.id)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150',
                                        isSelected
                                            ? 'bg-brand-strong font-semibold text-white shadow-xs'
                                            : 'bg-surface-subtle text-ink-soft hover:bg-surface-subtle/80 hover:text-ink',
                                    )}
                                    aria-pressed={isSelected}
                                >
                                    {Icon && (
                                        <Icon
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span>{item.label}</span>
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
                </div>

                {/* Main Content Pane */}
                {viewMode === 'visual' ? (
                    <OpenStreetMapTrackingMap locations={filteredLocations} />
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
            <table
                className="w-full text-left text-sm"
                aria-label="Synchronized field location updates"
            >
                <caption className="sr-only">
                    List of current location updates showing worker name,
                    coordinates, accuracy, capture time, receive time, sharing
                    state, and freshness.
                </caption>
                <thead className="border-b border-line bg-surface-subtle text-xs font-semibold text-ink-soft uppercase">
                    <tr>
                        <th scope="col" className="px-4 py-3">
                            Worker / Asset
                        </th>
                        <th scope="col" className="px-4 py-3">
                            Freshness Status
                        </th>
                        <th scope="col" className="px-4 py-3">
                            Coordinates
                        </th>
                        <th scope="col" className="px-4 py-3">
                            Accuracy
                        </th>
                        <th scope="col" className="px-4 py-3">
                            Sharing
                        </th>
                        <th scope="col" className="px-4 py-3">
                            Captured Time
                        </th>
                        <th scope="col" className="px-4 py-3">
                            Received Time
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-line">
                    {locations.map((loc) => (
                        <tr
                            key={loc.id}
                            className="transition-colors hover:bg-surface-subtle"
                        >
                            <td className="px-4 py-3 font-semibold text-ink">
                                {loc.user.name}
                                {loc.asset && (
                                    <div className="text-xs font-normal text-ink-soft">
                                        {loc.asset.code}
                                    </div>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <FreshnessBadge status={loc.freshness_status} />
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                                {loc.latitude !== null && loc.longitude !== null
                                    ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
                                    : 'Pruned / Off'}
                            </td>
                            <td className="px-4 py-3 text-xs">
                                {loc.accuracy_metres
                                    ? `±${loc.accuracy_metres}m`
                                    : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-xs font-medium">
                                {loc.sharing_enabled ? (
                                    <span className="text-success-strong">
                                        On
                                    </span>
                                ) : (
                                    <span className="text-warning-strong">
                                        Off
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-xs text-ink-soft">
                                {loc.captured_at
                                    ? new Date(
                                          loc.captured_at,
                                      ).toLocaleTimeString()
                                    : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-xs text-ink-soft">
                                {loc.received_at
                                    ? new Date(
                                          loc.received_at,
                                      ).toLocaleTimeString()
                                    : 'N/A'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Panel>
    );
}

function FreshnessBadge({
    status,
}: {
    status: LocationUpdateViewModel['freshness_status'];
}) {
    const config =
        status === 'fresh'
            ? {
                  label: 'Fresh (≤2m)',
                  cls: 'bg-success-soft text-success-strong',
              }
            : status === 'delayed'
              ? {
                    label: 'Delayed (2–10m)',
                    cls: 'bg-info-soft text-info-strong',
                }
              : status === 'stale'
                ? {
                      label: 'Stale (10–30m)',
                      cls: 'bg-warning-soft text-warning-strong',
                  }
                : { label: 'Offline / Off', cls: 'bg-danger-soft text-danger' };

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
