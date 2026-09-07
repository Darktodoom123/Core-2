import { MapPin, Truck } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { EmptyState, InlineNotice, PageHeading, Panel } from '@/components/ui';
import { FleetDetailPane } from '@/components/workspace/fleet/fleet-detail-pane';
import { FleetMapView } from '@/components/workspace/fleet/fleet-map-view';
import type { FleetCategoryFilter } from '@/components/workspace/fleet/fleet-queue';
import { FleetQueue } from '@/components/workspace/fleet/fleet-queue';
import { FleetTriageBar } from '@/components/workspace/fleet/fleet-triage-bar';
import type { FleetTriageException } from '@/components/workspace/fleet/fleet-triage-bar';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    LocationUpdateViewModel,
    PaginationMeta,
    SosIncidentViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
} from '@/types/workspace';

export interface FleetSurfaceProps {
    assets: AssetViewModel[];
    assetsTotal?: number;
    locations?: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    capabilities: WorkspaceCapabilities;
    onSectionChange?: (section: WorkspaceSection) => void;
    initialViewMode?: 'list' | 'map';
    pagination?: PaginationMeta;
}

export function FleetSurface({
    assets,
    assetsTotal,
    locations = [],
    activeSosIncidents = [],
    capabilities,
    onSectionChange,
    initialViewMode = 'list',
}: FleetSurfaceProps) {
    const [viewMode, setViewMode] = useState<'list' | 'map'>(initialViewMode);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] =
        useState<FleetCategoryFilter>('all');

    const [triageFilter, setTriageFilter] =
        useState<FleetTriageException | null>(null);
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        assets.length > 0 ? assets[0].id : null,
    );
    const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

    const counts = useMemo(() => {
        let ready = 0;
        let working = 0;
        let maintenance = 0;
        let cranes = 0;
        let trucks = 0;

        for (const a of assets) {
            const v = a.status?.value;
            const k = (a.kind || '').toLowerCase();
            const sub = (a.subtype || '').toLowerCase();

            if (k.includes('crane') || sub.includes('crane')) {
                cranes += 1;
            } else if (
                k.includes('truck') ||
                k.includes('vehicle') ||
                k.includes('trailer') ||
                sub.includes('truck') ||
                sub.includes('trailer')
            ) {
                trucks += 1;
            }

            if (a.is_dispatchable === true) {
                ready += 1;
            } else if (
                v === 'working' ||
                v === 'assigned' ||
                v === 'in_transit' ||
                v === 'on_site'
            ) {
                working += 1;
            } else if (
                v === 'maintenance' ||
                v === 'out_of_service' ||
                v === 'under_maintenance' ||
                a.blocking_work_orders_count > 0
            ) {
                maintenance += 1;
            }
        }

        return {
            total: assets.length,
            ready,
            working,
            maintenance,
            cranes,
            trucks,
        };
    }, [assets]);

    const triageCounts = useMemo(() => {
        let lockouts = 0;
        let blocking_orders = 0;
        let dvir_defects = 0;
        let stale_gps = 0;

        for (const asset of assets) {
            if (asset.lockout?.is_locked_out) {
                lockouts += 1;
            }

            if (asset.blocking_work_orders_count > 0) {
                blocking_orders += 1;
            }

            if (
                asset.latest_dvir &&
                (asset.latest_dvir.has_defects ||
                    asset.latest_dvir.critical_defects_count > 0 ||
                    asset.latest_dvir.status === 'critical_defect' ||
                    asset.latest_dvir.status === 'defect_flagged')
            ) {
                dvir_defects += 1;
            }

            const loc = locations.find((l) => l.asset?.id === asset.id);
            const isStale =
                loc?.freshness_status === 'stale' ||
                (!loc && asset.active_operator?.telemetry_status === 'stale');

            if (isStale) {
                stale_gps += 1;
            }
        }

        return {
            lockouts,
            blocking_orders,
            dvir_defects,
            stale_gps,
        };
    }, [assets, locations]);

    const filteredAssets = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return assets.filter((asset) => {
            const kindLower = (asset.kind || '').toLowerCase();
            const subtypeLower = (asset.subtype || '').toLowerCase();
            const isCrane =
                kindLower.includes('crane') || subtypeLower.includes('crane');
            const isTruck =
                kindLower.includes('truck') ||
                kindLower.includes('vehicle') ||
                kindLower.includes('trailer') ||
                subtypeLower.includes('truck') ||
                subtypeLower.includes('trailer');
            const isAvailable =
                (asset.status?.value === 'available' ||
                    asset.status?.value === 'ready_for_service') &&
                asset.blocking_work_orders_count === 0;
            const isMaintenance =
                asset.status?.value === 'maintenance' ||
                asset.status?.value === 'out_of_service' ||
                asset.status?.value === 'under_maintenance' ||
                asset.blocking_work_orders_count > 0;

            const matchesCategory =
                categoryFilter === 'all'
                    ? true
                    : categoryFilter === 'cranes'
                      ? isCrane
                      : categoryFilter === 'trucks'
                        ? isTruck
                        : categoryFilter === 'available'
                          ? isAvailable
                          : categoryFilter === 'maintenance'
                            ? isMaintenance
                            : true;

            const matchesQuery =
                q === '' ||
                `${asset.code} ${asset.name} ${asset.model ?? ''} ${asset.manufacturer ?? ''} ${asset.registration_number ?? ''} ${asset.kind} ${asset.subtype ?? ''} ${asset.rated_capacity ?? ''}`
                    .toLowerCase()
                    .includes(q);

            if (!matchesCategory || !matchesQuery) {
                return false;
            }

            if (triageFilter === 'lockouts') {
                if (!asset.lockout?.is_locked_out) {
                    return false;
                }
            } else if (triageFilter === 'blocking_orders') {
                if (!(asset.blocking_work_orders_count > 0)) {
                    return false;
                }
            } else if (triageFilter === 'dvir_defects') {
                const hasDefect = Boolean(
                    asset.latest_dvir &&
                    (asset.latest_dvir.has_defects ||
                        asset.latest_dvir.critical_defects_count > 0 ||
                        asset.latest_dvir.status === 'critical_defect' ||
                        asset.latest_dvir.status === 'defect_flagged'),
                );

                if (!hasDefect) {
                    return false;
                }
            } else if (triageFilter === 'stale_gps') {
                const loc = locations.find((l) => l.asset?.id === asset.id);
                const isStale =
                    loc?.freshness_status === 'stale' ||
                    (!loc &&
                        asset.active_operator?.telemetry_status === 'stale');

                if (!isStale) {
                    return false;
                }
            }

            return true;
        });
    }, [assets, categoryFilter, searchQuery, triageFilter, locations]);

    // Strict selection invariant: selected asset is strictly derived from filteredAssets
    const selectedAsset = useMemo(() => {
        if (filteredAssets.length === 0) {
            return null;
        }

        return (
            filteredAssets.find((a) => a.id === selectedAssetId) ??
            filteredAssets[0]
        );
    }, [filteredAssets, selectedAssetId]);

    const selectedAssetLocation = useMemo(
        () =>
            selectedAsset
                ? (locations.find((l) => l.asset?.id === selectedAsset.id) ??
                  null)
                : null,
        [locations, selectedAsset],
    );

    const activeLiveGpsCount = useMemo(
        () =>
            locations.filter(
                (l) =>
                    l.latitude !== null &&
                    l.longitude !== null &&
                    (l.freshness_status === 'fresh' ||
                        l.freshness_status === 'delayed'),
            ).length,
        [locations],
    );

    const handleSelectAsset = (assetId: number) => {
        setSelectedAssetId(assetId);
        setIsMobileDetailOpen(true);
    };

    const handleClearFilters = () => {
        setSearchQuery('');
        setCategoryFilter('all');
        setTriageFilter(null);
    };

    return (
        <div>
            <PageHeading
                title="Fleet Management"
                description="Core 3 assets, live GPS telematics, readiness status, specifications, safety inspections, and maintenance work orders."
            />
            <div className="space-y-6 p-4 md:p-6">
                {/* Calm Operate-Mode View Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex rounded-lg border border-line bg-surface-subtle p-1 shadow-xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                                viewMode === 'list'
                                    ? 'bg-surface text-ink shadow-xs'
                                    : 'text-ink-soft hover:text-ink',
                            )}
                        >
                            <Truck className="h-3.5 w-3.5" />
                            Asset registry ({assets.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('map')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                                viewMode === 'map'
                                    ? 'bg-surface text-brand-strong shadow-xs'
                                    : 'text-ink-soft hover:text-ink',
                            )}
                        >
                            <MapPin className="h-3.5 w-3.5" />
                            Fleet map view
                            {activeLiveGpsCount > 0 && (
                                <span className="py-0.2 inline-flex items-center rounded-full bg-brand-soft px-1.5 text-[10px] font-bold text-brand-strong">
                                    {activeLiveGpsCount} live
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* 1-Click Exception Triage Bar */}
                <FleetTriageBar
                    activeFilter={triageFilter}
                    onFilterChange={setTriageFilter}
                    counts={triageCounts}
                />

                {assetsTotal !== undefined && assetsTotal > assets.length && (
                    <InlineNotice tone="info" title="Fleet list truncated">
                        Showing the first {assets.length} of {assetsTotal} fleet
                        assets. Newer assets may not be listed — use the search
                        field to find a specific asset.
                    </InlineNotice>
                )}

                {assets.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Truck}
                            title="No assets available"
                            message="Assets received from Core 3 or assigned to your role will appear here."
                        />
                    </Panel>
                ) : viewMode === 'map' ? (
                    <FleetMapView
                        locations={locations}
                        activeSosIncidents={activeSosIncidents}
                        onSectionChange={onSectionChange}
                    />
                ) : (
                    <div className="grid gap-6 lg:grid-cols-12">
                        {/* Queue Column */}
                        <div
                            className={cn(
                                'lg:col-span-5 xl:col-span-4',
                                isMobileDetailOpen && 'hidden lg:block',
                            )}
                        >
                            <FleetQueue
                                assets={filteredAssets}
                                selectedAssetId={selectedAsset?.id ?? null}
                                onSelectAsset={handleSelectAsset}
                                locations={locations}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                categoryFilter={categoryFilter}
                                onCategoryFilterChange={setCategoryFilter}
                                counts={counts}
                                onClearFilters={handleClearFilters}
                            />
                        </div>

                        {/* Detail Column */}
                        <div
                            className={cn(
                                'lg:col-span-7 xl:col-span-8',
                                !isMobileDetailOpen && 'hidden lg:block',
                            )}
                        >
                            {selectedAsset ? (
                                <FleetDetailPane
                                    key={selectedAsset.id}
                                    asset={selectedAsset}
                                    assetLocation={selectedAssetLocation}
                                    activeSosIncidents={activeSosIncidents}
                                    capabilities={capabilities}
                                    onViewFullTracking={() =>
                                        setViewMode('map')
                                    }
                                    onBackToList={() =>
                                        setIsMobileDetailOpen(false)
                                    }
                                />
                            ) : (
                                <Panel>
                                    <EmptyState
                                        icon={Truck}
                                        title="Select an asset"
                                        message="Choose a crane or transport unit to review its telematics, specifications, and maintenance records."
                                    />
                                </Panel>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
