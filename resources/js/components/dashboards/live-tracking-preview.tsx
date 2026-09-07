import {
    ArrowUpRight,
    CircleAlert,
    Clock3,
    List,
    Map,
    PanelLeftClose,
    PanelLeftOpen,
    Radio,
    Search,
    WifiOff,
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { AssetTypeMultiSelect } from '@/components/asset-type-multi-select';
import { Button, EmptyState, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    LocationUpdateViewModel,
    ScopeRefreshState,
    SosIncidentViewModel,
} from '@/types/workspace';
import {
    FRESHNESS_META,
    TrackingUnitDetails,
    TrackingUnitRow,
} from './tracking-preview-units';
import { UNASSIGNED_JOBSITE, useTrackingPreview } from './use-tracking-preview';

const LiveTrackingMap = lazy(() =>
    import('@/components/live-tracking-map').then(
        ({ LiveTrackingMap: Map }) => ({ default: Map }),
    ),
);
const EMPTY_SOS_INCIDENTS: SosIncidentViewModel[] = [];

export interface LiveTrackingPreviewProps {
    locations: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    refresh?: ScopeRefreshState;
    realtimeConnected?: boolean;
    onOpenTracking?: () => void;
}

export function LiveTrackingPreview({
    locations,
    activeSosIncidents = EMPTY_SOS_INCIDENTS,
    refresh,
    realtimeConnected,
    onOpenTracking,
}: LiveTrackingPreviewProps) {
    const tracking = useTrackingPreview(locations, activeSosIncidents);

    return (
        <section
            aria-labelledby="live-tracking-preview-heading"
            className="min-w-0 rounded-2xl border border-line bg-surface"
        >
            <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-b border-line px-4 py-4 sm:px-5">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <h2
                            id="live-tracking-preview-heading"
                            className="text-lg font-semibold tracking-tight text-ink"
                        >
                            Field tracking
                        </h2>
                        {realtimeConnected !== undefined && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                                {realtimeConnected ? (
                                    <Radio
                                        className="size-3.5 text-success-strong"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <WifiOff
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                )}
                                {realtimeConnected
                                    ? 'Feed connected'
                                    : 'Feed disconnected'}
                            </span>
                        )}
                    </div>
                    <div
                        role="group"
                        aria-label="Unit freshness"
                        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums"
                    >
                        <span className="font-medium text-ink">
                            {tracking.visibleLocations.length} units
                        </span>
                        {(
                            Object.keys(FRESHNESS_META) as Array<
                                keyof typeof FRESHNESS_META
                            >
                        ).map((status) => (
                            <span
                                key={status}
                                className={
                                    tracking.counts[status] > 0
                                        ? FRESHNESS_META[status].textClassName
                                        : 'text-ink-soft'
                                }
                            >
                                {tracking.counts[status]} {status}
                            </span>
                        ))}
                    </div>
                </div>
                {onOpenTracking && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 shrink-0"
                        onClick={onOpenTracking}
                    >
                        Open full tracking
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Button>
                )}
            </header>

            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-subtle/40 px-4 py-3 sm:px-5">
                <div className="relative min-w-0 basis-full lg:max-w-72 lg:grow lg:basis-auto">
                    <Search
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
                        aria-hidden="true"
                    />
                    <Input
                        type="search"
                        aria-label="Find a unit"
                        placeholder="Find a unit by ID or name"
                        value={tracking.filters.query}
                        onChange={(event) =>
                            tracking.updateFilters({
                                query: event.target.value,
                            })
                        }
                        className="pl-9 placeholder:text-ink-soft"
                    />
                </div>
                <AssetTypeMultiSelect
                    locations={tracking.assetFilterLocations}
                    selectedTypes={tracking.filters.assetTypes}
                    onChange={(assetTypes) =>
                        tracking.updateFilters({ assetTypes })
                    }
                    appearance="neutral"
                    label=""
                />
                <Select
                    aria-label="Assigned jobsite"
                    value={tracking.filters.site}
                    onChange={(event) =>
                        tracking.updateFilters({ site: event.target.value })
                    }
                    className="min-w-0 flex-1 basis-44 lg:max-w-64"
                >
                    <option value="">All assigned jobsites</option>
                    {tracking.sites.map((site) => (
                        <option key={site} value={site}>
                            {site}
                        </option>
                    ))}
                    {tracking.hasUnassignedSite && (
                        <option value={UNASSIGNED_JOBSITE}>
                            No assigned jobsite
                        </option>
                    )}
                </Select>
                {tracking.hasFilters && (
                    <Button
                        variant="quiet"
                        size="sm"
                        className="min-h-11"
                        onClick={tracking.clearFilters}
                    >
                        Clear filters
                    </Button>
                )}
            </div>

            <div className="border-b border-line">
                <div
                    role="group"
                    aria-label="Unit views"
                    className="flex w-full gap-1 px-3 pt-2 lg:w-80"
                >
                    <UnitViewButton
                        active={!tracking.filters.attentionOnly}
                        onClick={() =>
                            tracking.updateFilters({ attentionOnly: false })
                        }
                        label="All units"
                        count={tracking.allCount}
                    />
                    <UnitViewButton
                        active={tracking.filters.attentionOnly}
                        onClick={() =>
                            tracking.updateFilters({ attentionOnly: true })
                        }
                        label="Needs attention"
                        count={tracking.attentionCount}
                    />
                </div>
            </div>

            {refresh?.status === 'failed' && (
                <p
                    role="status"
                    className="flex items-start gap-2 border-b border-line bg-warning-soft px-4 py-3 text-xs text-warning-strong"
                >
                    <CircleAlert
                        className="size-4 shrink-0"
                        aria-hidden="true"
                    />
                    Location refresh failed. Showing the last available reports.
                </p>
            )}

            <div
                role="group"
                aria-label="Tracking view"
                className="flex gap-1 border-b border-line px-4 py-2 lg:hidden"
            >
                <Button
                    variant={
                        tracking.mobileView === 'map' ? 'secondary' : 'quiet'
                    }
                    size="sm"
                    aria-pressed={tracking.mobileView === 'map'}
                    className="min-h-11 flex-1"
                    onClick={() => tracking.setMobileView('map')}
                >
                    <Map className="size-4" aria-hidden="true" />
                    Map
                </Button>
                <Button
                    variant={
                        tracking.mobileView === 'list' ? 'secondary' : 'quiet'
                    }
                    size="sm"
                    aria-pressed={tracking.mobileView === 'list'}
                    className="min-h-11 flex-1"
                    onClick={() => tracking.setMobileView('list')}
                >
                    <List className="size-4" aria-hidden="true" />
                    List
                </Button>
            </div>

            <div
                className={cn(
                    'grid min-w-0',
                    tracking.sidebarCollapsed
                        ? 'grid-cols-1'
                        : 'lg:grid-cols-[20rem_minmax(0,1fr)]',
                )}
            >
                <div
                    role="region"
                    aria-label="Field units"
                    className={cn(
                        'h-[420px] min-w-0 flex-col lg:h-[480px] lg:border-r lg:border-line',
                        tracking.sidebarCollapsed ? 'lg:hidden' : 'lg:flex',
                        tracking.mobileView === 'list' ? 'flex' : 'hidden',
                    )}
                >
                    <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-line px-4 py-2 text-xs text-ink-soft">
                        <span>
                            {tracking.mappedCount} of{' '}
                            {tracking.visibleLocations.length} with coordinates
                        </span>
                        <Button
                            variant="quiet"
                            size="icon"
                            className="hidden size-8 text-ink-soft hover:text-ink lg:inline-flex"
                            onClick={() => tracking.setSidebarCollapsed(true)}
                            aria-label="Collapse unit list"
                            title="Collapse unit list"
                        >
                            <PanelLeftClose
                                className="size-4"
                                aria-hidden="true"
                            />
                        </Button>
                    </div>
                    {tracking.visibleLocations.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center p-5">
                            <EmptyState
                                compact
                                icon={Search}
                                title={
                                    locations.length
                                        ? 'No matching units'
                                        : 'No location updates'
                                }
                                message={
                                    locations.length
                                        ? 'Try a different name, asset type, or assigned jobsite.'
                                        : 'Units will appear when location reports are available.'
                                }
                            />
                        </div>
                    ) : (
                        <ul
                            aria-label="Matching units"
                            className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain"
                        >
                            {tracking.visibleLocations.map((location) => (
                                <TrackingUnitRow
                                    key={location.id}
                                    location={location}
                                    selected={
                                        tracking.selected?.id === location.id
                                    }
                                    hasSos={tracking.sosWorkerIds.has(
                                        location.user.id,
                                    )}
                                    onSelect={() =>
                                        tracking.selectLocation(location.id)
                                    }
                                />
                            ))}
                        </ul>
                    )}
                </div>

                <div
                    className={cn(
                        'h-[420px] min-w-0 flex-col overflow-hidden rounded-b-2xl lg:flex lg:h-[480px]',
                        tracking.sidebarCollapsed
                            ? 'lg:rounded-bl-2xl'
                            : 'lg:rounded-bl-none',
                        tracking.mobileView === 'map' ? 'flex' : 'hidden',
                        tracking.selected && 'rounded-b-none',
                    )}
                >
                    <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-subtle/50 px-3 py-1.5 text-xs text-ink-soft sm:px-4">
                        <div className="flex min-w-0 items-center gap-2">
                            <Button
                                variant={
                                    tracking.sidebarCollapsed
                                        ? 'secondary'
                                        : 'quiet'
                                }
                                size="sm"
                                onClick={tracking.toggleSidebar}
                                aria-label={
                                    tracking.sidebarCollapsed
                                        ? 'Show unit list'
                                        : 'Hide unit list'
                                }
                                aria-pressed={!tracking.sidebarCollapsed}
                                title={
                                    tracking.sidebarCollapsed
                                        ? 'Show unit list'
                                        : 'Hide unit list'
                                }
                                className="hidden h-8 gap-1.5 px-2.5 text-xs lg:inline-flex"
                            >
                                {tracking.sidebarCollapsed ? (
                                    <>
                                        <PanelLeftOpen
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                        <span>Show list</span>
                                        <span className="rounded bg-surface-subtle px-1 py-0.5 text-[10px] font-semibold tabular-nums">
                                            {tracking.visibleLocations.length}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <PanelLeftClose
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                        <span>Hide list</span>
                                    </>
                                )}
                            </Button>
                            <Clock3
                                className="hidden size-3.5 shrink-0 sm:inline"
                                aria-hidden="true"
                            />
                            <span className="truncate">
                                {tracking.hasOldLocations
                                    ? 'Showing last reported locations'
                                    : tracking.mappedCount
                                      ? 'Select a unit to inspect its latest report'
                                      : 'No reported coordinates to show'}
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="tabular-nums">
                                {tracking.mappedCount} of{' '}
                                {tracking.visibleLocations.length} mapped
                            </span>
                        </div>
                    </div>
                    <Suspense fallback={<MapLoadingFallback />}>
                        <LiveTrackingMap
                            locations={tracking.visibleLocations}
                            activeSosIncidents={tracking.activeIncidents}
                            compact
                            showLocationList={false}
                            selectedLocationId={tracking.selected?.id ?? null}
                            onSelectedLocationChange={tracking.selectLocation}
                            className="h-full min-h-0 flex-1 rounded-none border-0 shadow-none md:h-full"
                        />
                    </Suspense>
                </div>
            </div>
            {tracking.selected && (
                <TrackingUnitDetails
                    location={tracking.selected}
                    hasSos={tracking.sosWorkerIds.has(
                        tracking.selected.user.id,
                    )}
                    onClose={() => tracking.selectLocation(null)}
                />
            )}
        </section>
    );
}

function UnitViewButton({
    active,
    onClick,
    label,
    count,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'inline-flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 px-1 pb-2 text-xs font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
                active
                    ? 'border-brand text-ink'
                    : 'border-transparent text-ink-soft hover:border-line-strong hover:text-ink',
            )}
        >
            <span className="text-xs whitespace-nowrap">{label}</span>
            <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-xs tabular-nums">
                {count}
            </span>
        </button>
    );
}

function MapLoadingFallback() {
    return (
        <div
            className="flex min-h-0 flex-1 items-center justify-center bg-surface-subtle p-6 text-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading live location map"
        >
            <p className="text-sm text-ink-soft">Loading live location map…</p>
        </div>
    );
}
