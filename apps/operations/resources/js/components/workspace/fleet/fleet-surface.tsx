import { usePage } from '@inertiajs/react';
import { Truck } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
    Button,
    EmptyState,
    InlineNotice,
    PageHeading,
    Panel,
} from '@/components/ui';
import {
    classifyFleetAsset,
    isFleetAssetCategory,
} from '@/components/workspace/fleet/fleet-asset-classification';
import { FleetDetailPane } from '@/components/workspace/fleet/fleet-detail-pane';
import { FleetMapView } from '@/components/workspace/fleet/fleet-map-view';
import { FleetPermitRenewals } from '@/components/workspace/fleet/fleet-permit-renewals';
import type { FleetPermitIssue } from '@/components/workspace/fleet/fleet-permit-status';
import { getFleetPermitIssue } from '@/components/workspace/fleet/fleet-permit-status';
import type { FleetCategoryFilter } from '@/components/workspace/fleet/fleet-queue';
import { FleetQueue } from '@/components/workspace/fleet/fleet-queue';
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

const FLEET_FILTER_VALUES: readonly FleetCategoryFilter[] = [
    'all',
    'tower_cranes',
    'mobile_cranes',
    'heavy_equipment',
    'transport',
    'other',
    'available',
    'working',
    'maintenance',
    'inspection',
];

const PERMIT_FILTER_ISSUE = {
    permit_expired: 'expired',
    permit_expiring: 'expiring',
    permit_missing: 'missing',
} as const satisfies Partial<Record<FleetTriageException, FleetPermitIssue>>;

interface FleetFilterUrlState {
    search: string;
    category: FleetCategoryFilter;
}

function readFleetFilterFromUrl(url: string | undefined): FleetFilterUrlState {
    if (!url) {
        return { search: '', category: 'all' };
    }

    try {
        const parsed = new URL(
            url,
            typeof window === 'undefined'
                ? 'http://localhost'
                : window.location.origin,
        );
        const category = parsed.searchParams.get('asset_category');

        return {
            search: parsed.searchParams.get('asset_search') ?? '',
            category: FLEET_FILTER_VALUES.includes(
                category as FleetCategoryFilter,
            )
                ? (category as FleetCategoryFilter)
                : 'all',
        };
    } catch {
        return { search: '', category: 'all' };
    }
}

export function FleetSurface({
    assets,
    assetsTotal,
    locations = [],
    activeSosIncidents = [],
    capabilities,
    onSectionChange,
}: FleetSurfaceProps) {
    const page = usePage();
    const initialFleetFilter = readFleetFilterFromUrl(page.url);
    const [searchQuery, setSearchQuery] = useState(initialFleetFilter.search);
    const [categoryFilter, setCategoryFilter] = useState<FleetCategoryFilter>(
        initialFleetFilter.category,
    );
    const mapCategoryFilter = isFleetAssetCategory(categoryFilter)
        ? categoryFilter
        : null;

    const [triageFilter, setTriageFilter] =
        useState<FleetTriageException | null>(null);
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        assets.length > 0 ? assets[0].id : null,
    );
    const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

    const syncFleetFilterUrl = (
        nextSearch: string,
        nextCategory: FleetCategoryFilter,
    ) => {
        if (typeof window === 'undefined') {
            return;
        }

        const url = new URL(window.location.href);

        if (nextSearch.trim() !== '') {
            url.searchParams.set('asset_search', nextSearch);
        } else {
            url.searchParams.delete('asset_search');
        }

        if (nextCategory !== 'all') {
            url.searchParams.set('asset_category', nextCategory);
        } else {
            url.searchParams.delete('asset_category');
        }

        window.history.replaceState(
            window.history.state,
            '',
            `${url.pathname}${url.search}${url.hash}`,
        );
    };

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        syncFleetFilterUrl(query, categoryFilter);
    };

    const handleCategoryFilterChange = (category: FleetCategoryFilter) => {
        setCategoryFilter(category);
        syncFleetFilterUrl(searchQuery, category);
    };

    const counts = useMemo(() => {
        let ready = 0;
        let working = 0;
        let maintenance = 0;
        let inspection = 0;
        let towerCranes = 0;
        let mobileCranes = 0;
        let heavyEquipment = 0;
        let transport = 0;
        let other = 0;

        for (const a of assets) {
            const v = a.status?.value;
            const category = classifyFleetAsset(a);

            if (category === 'tower_cranes') {
                towerCranes += 1;
            } else if (category === 'mobile_cranes') {
                mobileCranes += 1;
            } else if (category === 'heavy_equipment') {
                heavyEquipment += 1;
            } else if (category === 'transport') {
                transport += 1;
            } else {
                other += 1;
            }

            if (a.is_dispatchable === true) {
                ready += 1;
            }

            if (
                v === 'working' ||
                v === 'assigned' ||
                v === 'in_transit' ||
                v === 'on_site'
            ) {
                working += 1;
            }

            if (
                v === 'maintenance' ||
                v === 'out_of_service' ||
                v === 'under_maintenance' ||
                v === 'awaiting_parts' ||
                a.blocking_work_orders_count > 0
            ) {
                maintenance += 1;
            }

            if (
                a.dispatchability?.blockers?.some(
                    (blocker) => blocker.code === 'inspection',
                )
            ) {
                inspection += 1;
            }
        }

        return {
            total: assets.length,
            ready,
            working,
            maintenance,
            inspection,
            towerCranes,
            mobileCranes,
            heavyEquipment,
            transport,
            other,
        };
    }, [assets]);

    const triageCounts = useMemo(() => {
        let needs_attention = 0;
        let lockouts = 0;
        let blocking_orders = 0;
        let dvir_defects = 0;
        let stale_gps = 0;
        let permit_expired = 0;
        let permit_expiring = 0;
        let permit_missing = 0;

        for (const asset of assets) {
            const permitIssue = getFleetPermitIssue(asset);

            if (permitIssue === 'expired') {
                permit_expired += 1;
            } else if (permitIssue === 'expiring') {
                permit_expiring += 1;
            } else if (permitIssue === 'missing') {
                permit_missing += 1;
            }

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
            const isStale = loc?.freshness_status === 'stale';

            if (isStale) {
                stale_gps += 1;
            }

            if (
                asset.lockout?.is_locked_out ||
                asset.blocking_work_orders_count > 0 ||
                (asset.latest_dvir &&
                    (asset.latest_dvir.has_defects ||
                        asset.latest_dvir.critical_defects_count > 0 ||
                        asset.latest_dvir.status === 'critical_defect' ||
                        asset.latest_dvir.status === 'defect_flagged')) ||
                isStale ||
                permitIssue === 'expired' ||
                permitIssue === 'expiring' ||
                asset.permit_compliance?.blocks_dispatch
            ) {
                needs_attention += 1;
            }
        }

        return {
            needs_attention,
            lockouts,
            blocking_orders,
            dvir_defects,
            stale_gps,
            permit_expired,
            permit_expiring,
            permit_missing,
        };
    }, [assets, locations]);

    const filteredAssets = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return assets.filter((asset) => {
            const assetCategory = classifyFleetAsset(asset);
            const status = asset.status?.value;
            const isAvailable = asset.is_dispatchable === true;
            const isWorking = [
                'working',
                'assigned',
                'in_transit',
                'on_site',
            ].includes(status);
            const isMaintenance =
                status === 'maintenance' ||
                status === 'out_of_service' ||
                status === 'under_maintenance' ||
                status === 'awaiting_parts' ||
                asset.blocking_work_orders_count > 0;
            const needsInspection = Boolean(
                asset.dispatchability?.blockers?.some(
                    (blocker) => blocker.code === 'inspection',
                ),
            );

            const matchesCategory =
                categoryFilter === 'all'
                    ? true
                    : categoryFilter === 'available'
                      ? isAvailable
                      : categoryFilter === 'working'
                        ? isWorking
                        : categoryFilter === 'maintenance'
                          ? isMaintenance
                          : categoryFilter === 'inspection'
                            ? needsInspection
                            : assetCategory === categoryFilter;

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
                const isStale = loc?.freshness_status === 'stale';

                if (!isStale) {
                    return false;
                }
            } else if (
                triageFilter === 'permit_expired' ||
                triageFilter === 'permit_expiring' ||
                triageFilter === 'permit_missing'
            ) {
                if (
                    getFleetPermitIssue(asset) !==
                    PERMIT_FILTER_ISSUE[triageFilter]
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [assets, categoryFilter, searchQuery, triageFilter, locations]);

    // Keep the selected asset stable while registry filters change. Map selection
    // is authoritative; filtering must not silently move the detail pane.
    const selectedAsset = useMemo(() => {
        if (selectedAssetId !== null) {
            return assets.find((asset) => asset.id === selectedAssetId) ?? null;
        }

        return filteredAssets[0] ?? assets[0] ?? null;
    }, [assets, filteredAssets, selectedAssetId]);

    const selectedAssetLocation = useMemo(
        () =>
            selectedAsset
                ? (locations.find((l) => l.asset?.id === selectedAsset.id) ??
                  null)
                : null,
        [locations, selectedAsset],
    );
    const selectionOutsideFilters = Boolean(
        selectedAsset &&
        !filteredAssets.some((asset) => asset.id === selectedAsset.id),
    );
    const selectedAssetUnavailable =
        selectedAssetId !== null &&
        !assets.some((asset) => asset.id === selectedAssetId);

    const handleSelectAsset = (assetId: number) => {
        setSelectedAssetId(assetId);
        setIsMobileDetailOpen(true);
    };

    const handleLocationSelect = (locationId: number) => {
        const matchedLocation = locations.find((l) => l.id === locationId);

        if (matchedLocation?.asset?.id) {
            setSelectedAssetId(matchedLocation.asset.id);
            setIsMobileDetailOpen(true);
        }
    };

    const handleViewFullTracking = () => {
        const mapElement = document.getElementById('fleet-live-map');

        if (mapElement) {
            mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleClearFilters = () => {
        setSearchQuery('');
        setCategoryFilter('all');
        setTriageFilter(null);
        syncFleetFilterUrl('', 'all');
    };

    return (
        <div>
            <PageHeading
                title="Fleet & Equipment"
                description="Asset types, GPS freshness, dispatch readiness, specifications, inspections, and maintenance work orders."
            />
            <div className="space-y-6 p-4 md:p-6">
                {/* Live Fleet GIS Map prominently positioned on top */}
                <FleetMapView
                    locations={locations}
                    categoryFilter={mapCategoryFilter}
                    activeSosIncidents={activeSosIncidents}
                    onSectionChange={onSectionChange}
                    selectedLocationId={selectedAssetLocation?.id ?? null}
                    onSelectedLocationChange={handleLocationSelect}
                    compact={true}
                    showLocationList={true}
                    collapsible={true}
                />

                {assetsTotal !== undefined && assetsTotal > assets.length && (
                    <InlineNotice tone="info" title="Fleet list truncated">
                        Showing the first{' '}
                        <span className="font-semibold tabular-nums">
                            {assets.length}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold tabular-nums">
                            {assetsTotal}
                        </span>{' '}
                        fleet assets. Newer assets may not be listed — use the
                        search field to find a specific asset.
                    </InlineNotice>
                )}

                <FleetPermitRenewals
                    assets={assets}
                    activeFilter={triageFilter}
                    onFilterChange={setTriageFilter}
                />

                {assets.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Truck}
                            title="No assets available"
                            message="Assets received from Core 3 or assigned to your role will appear here."
                        />
                    </Panel>
                ) : (
                    <div className="grid scroll-mt-24 gap-6 lg:h-[calc(100dvh-7rem)] lg:min-h-96 lg:grid-cols-12">
                        {/* Queue Column */}
                        <div
                            className={cn(
                                'min-h-0 min-w-0 lg:col-span-5 xl:col-span-4',
                                isMobileDetailOpen && 'hidden lg:block',
                            )}
                        >
                            <FleetQueue
                                assets={filteredAssets}
                                selectedAssetId={selectedAsset?.id ?? null}
                                onSelectAsset={handleSelectAsset}
                                locations={locations}
                                searchQuery={searchQuery}
                                onSearchChange={handleSearchChange}
                                categoryFilter={categoryFilter}
                                onCategoryFilterChange={
                                    handleCategoryFilterChange
                                }
                                counts={counts}
                                onClearFilters={handleClearFilters}
                                triageFilter={triageFilter}
                                onTriageFilterChange={setTriageFilter}
                                triageCounts={triageCounts}
                            />
                        </div>

                        {/* Detail Column */}
                        <div
                            className={cn(
                                'min-h-0 min-w-0 lg:col-span-7 xl:col-span-8',
                                !isMobileDetailOpen && 'hidden lg:block',
                            )}
                        >
                            {selectedAsset ? (
                                <div className="flex min-h-0 flex-col gap-3 lg:h-full">
                                    {selectionOutsideFilters && (
                                        <InlineNotice
                                            tone="info"
                                            title="Selected asset is outside the filtered list"
                                            action={
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={handleClearFilters}
                                                >
                                                    Show selected asset
                                                </Button>
                                            }
                                        >
                                            Clear the search and filters to see
                                            it in the fleet list.
                                        </InlineNotice>
                                    )}
                                    <FleetDetailPane
                                        key={selectedAsset.id}
                                        asset={selectedAsset}
                                        assetLocation={selectedAssetLocation}
                                        activeSosIncidents={activeSosIncidents}
                                        capabilities={capabilities}
                                        onViewFullTracking={
                                            handleViewFullTracking
                                        }
                                        onBackToList={() =>
                                            setIsMobileDetailOpen(false)
                                        }
                                    />
                                </div>
                            ) : selectedAssetUnavailable ? (
                                <Panel>
                                    <EmptyState
                                        icon={Truck}
                                        title="Selected asset is no longer available"
                                        message="It may have been removed or your access may have changed. Select another asset from the fleet list."
                                    />
                                </Panel>
                            ) : (
                                <Panel>
                                    <EmptyState
                                        icon={Truck}
                                        title="Select an asset"
                                        message="Choose an asset to review its type, specifications, dispatch readiness, and maintenance records."
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
