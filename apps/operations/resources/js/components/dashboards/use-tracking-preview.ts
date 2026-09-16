import { useMemo, useState } from 'react';
import type { AssetKind } from '@/lib/asset-kind';
import { getAssetKind } from '@/lib/asset-kind';
import type {
    LocationUpdateViewModel,
    SosIncidentViewModel,
} from '@/types/workspace';

export const UNASSIGNED_JOBSITE = '__unassigned__';
type Freshness = LocationUpdateViewModel['freshness_status'];

interface TrackingFilters {
    query: string;
    site: string;
    assetTypes: Set<AssetKind>;
    attentionOnly: boolean;
}

const STATUS_ORDER: Record<Freshness, number> = {
    offline: 0,
    stale: 1,
    delayed: 2,
    fresh: 3,
};

function initialFilters(): TrackingFilters {
    return { query: '', site: '', assetTypes: new Set(), attentionOnly: false };
}

export function useTrackingPreview(
    locations: LocationUpdateViewModel[],
    incidents: SosIncidentViewModel[],
) {
    const [filters, setFilters] = useState(initialFilters);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const activeIncidents = useMemo(
        () =>
            incidents.filter((incident) =>
                ['active', 'escalated', 'acknowledged'].includes(
                    incident.status.value,
                ),
            ),
        [incidents],
    );
    const sosWorkerIds = useMemo(
        () => new Set(activeIncidents.map((incident) => incident.worker.id)),
        [activeIncidents],
    );
    const assetLocations = useMemo(() => {
        const filtered = locations.filter(
            (location) =>
                location.asset !== null &&
                location.asset !== undefined &&
                Boolean(location.asset.id),
        );

        const byAsset = new Map<number, LocationUpdateViewModel>();

        for (const loc of filtered) {
            const assetId = loc.asset!.id;
            const existing = byAsset.get(assetId);

            if (!existing) {
                byAsset.set(assetId, loc);
            } else {
                const existingTime = locationTimestamp(
                    existing.captured_at ?? existing.received_at,
                );
                const currentTime = locationTimestamp(
                    loc.captured_at ?? loc.received_at,
                );

                if (currentTime >= existingTime) {
                    byAsset.set(assetId, loc);
                }
            }
        }

        return Array.from(byAsset.values());
    }, [locations]);

    const sites = useMemo(
        () =>
            [
                ...new Set(assetLocations.map(assignedJobsite).filter(Boolean)),
            ].sort((a, b) => a.localeCompare(b)),
        [assetLocations],
    );
    const hasUnassignedSite = assetLocations.some(
        (location) => !assignedJobsite(location),
    );

    const matchingScope = useMemo(() => {
        const query = filters.query.trim().toLocaleLowerCase();

        return assetLocations.filter((location) => {
            const site = assignedJobsite(location);
            const matchesSite =
                filters.site === '' ||
                (filters.site === UNASSIGNED_JOBSITE
                    ? !site
                    : site === filters.site);
            const matchesQuery =
                !query ||
                [
                    location.asset?.code,
                    location.asset?.name,
                    location.user?.name,
                ].some((value) => value?.toLocaleLowerCase().includes(query));

            return matchesSite && matchesQuery;
        });
    }, [assetLocations, filters.query, filters.site]);

    const typeFilteredLocations = useMemo(
        () =>
            matchingScope.filter(
                (location) =>
                    filters.assetTypes.size === 0 ||
                    filters.assetTypes.has(getAssetKind(location)),
            ),
        [filters.assetTypes, matchingScope],
    );
    const attentionCount = typeFilteredLocations.filter((location) =>
        needsAttention(location, sosWorkerIds),
    ).length;
    const assetFilterLocations = useMemo(
        () =>
            matchingScope.filter(
                (location) =>
                    !filters.attentionOnly ||
                    needsAttention(location, sosWorkerIds),
            ),
        [filters.attentionOnly, matchingScope, sosWorkerIds],
    );
    const visibleLocations = useMemo(
        () =>
            typeFilteredLocations
                .filter(
                    (location) =>
                        !filters.attentionOnly ||
                        needsAttention(location, sosWorkerIds),
                )
                .sort(
                    (a, b) =>
                        Number(sosWorkerIds.has(b.user.id)) -
                            Number(sosWorkerIds.has(a.user.id)) ||
                        STATUS_ORDER[a.freshness_status] -
                            STATUS_ORDER[b.freshness_status] ||
                        locationTimestamp(b.received_at) -
                            locationTimestamp(a.received_at),
                ),
        [filters.attentionOnly, sosWorkerIds, typeFilteredLocations],
    );
    const counts: Record<Freshness, number> = {
        fresh: 0,
        delayed: 0,
        stale: 0,
        offline: 0,
    };
    let mappedCount = 0;
    let hasOldLocations = false;

    for (const location of visibleLocations) {
        counts[location.freshness_status] += 1;

        if (hasCoordinates(location)) {
            mappedCount += 1;
            hasOldLocations ||= location.freshness_status !== 'fresh';
        }
    }

    function updateFilters(next: Partial<TrackingFilters>) {
        setFilters((current) => ({ ...current, ...next }));
        setSelectedId(null);
    }

    function clearFilters() {
        setFilters(initialFilters());
        setSelectedId(null);
    }

    return {
        filters,
        updateFilters,
        clearFilters,
        hasFilters: Boolean(
            filters.query ||
            filters.site ||
            filters.assetTypes.size ||
            filters.attentionOnly,
        ),
        sites,
        hasUnassignedSite,
        assetFilterLocations,
        allCount: typeFilteredLocations.length,
        attentionCount,
        visibleLocations,
        counts,
        mappedCount,
        hasOldLocations,
        activeIncidents,
        sosWorkerIds,
        selected:
            visibleLocations.find((location) => location.id === selectedId) ??
            null,
        selectLocation: setSelectedId,
        mobileView,
        setMobileView,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar: () => setSidebarCollapsed((current) => !current),
    };
}

export function assignedJobsite(location: LocationUpdateViewModel): string {
    return location.job?.site?.trim() ?? '';
}

export function hasCoordinates(location: LocationUpdateViewModel): boolean {
    return location.latitude !== null && location.longitude !== null;
}

function needsAttention(
    location: LocationUpdateViewModel,
    sosWorkerIds: Set<number>,
): boolean {
    return (
        location.freshness_status !== 'fresh' ||
        sosWorkerIds.has(location.user.id)
    );
}

export function locationTimestamp(value: string | null): number {
    const parsed = value ? Date.parse(value) : Number.NaN;

    return Number.isFinite(parsed) ? parsed : 0;
}

export function formatReportAge(value: string | null): string {
    const timestamp = locationTimestamp(value);

    if (!timestamp) {
        return 'Unavailable';
    }

    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));

    if (minutes < 1) {
        return 'Just now';
    }

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    return `${Math.floor(hours / 24)}d ago`;
}

export function formatReportTimestamp(value: string | null): string {
    const timestamp = locationTimestamp(value);

    return timestamp
        ? new Date(timestamp).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'long',
          })
        : 'Unavailable';
}
