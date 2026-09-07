import {
    Check,
    Construction,
    Layers,
    LocateFixed,
    MapPin,
    Maximize,
    Maximize2,
    Minimize,
    Search,
    Truck,
    UserRoundCog,
    Wrench,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import type {
    GeoJSONSource,
    MapLayerMouseEvent,
    Marker as MapLibreMarker,
} from 'maplibre-gl';
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Button, StatusBadge } from '@/components/ui';
import { getAssetKind } from '@/lib/asset-kind';
import { cn } from '@/lib/utils';
import {
    reverseGeocode,
    usePreciseLocation,
} from '@/services/reverse-geocoder';
import type {
    LocationUpdateViewModel,
    SosIncidentViewModel,
} from '@/types/workspace';
import {
    circleFeature,
    featureCollection,
    pointFeature,
} from './maplibre/geojson';
import type { LngLat } from './maplibre/geojson';
import { getMapProviderConfiguration } from './maplibre/map-config';
import type { MapStyleVariant } from './maplibre/map-config';
import { MapLibreMap, useMapLibre } from './maplibre/maplibre-map';
import { groupOverlappingMarkers } from './maplibre/marker-overlap';
import {
    createAssetMarker,
    createMarkerGroup,
    createSosMarker,
    getSosMarkerPosition,
} from './maplibre/markers';
import type { SosMarkerOptions } from './maplibre/markers';
import {
    createTrackingGroupPopup,
    createTrackingLocationPopup,
    createTrackingSosPopup,
    formatReportAge,
    trackingUnitLabel,
} from './maplibre/tracking-map-popups';

export type { AssetKind } from '@/lib/asset-kind';
export {
    getAssetKind,
    getAssetKindLabel,
    resolveLocationName,
} from '@/lib/asset-kind';

const DEFAULT_CENTER: LngLat = [121.04, 14.64];
const DEFAULT_ZOOM = 11;
const HTML_MARKER_THRESHOLD = 250;
function PreciseLocationDisplay({
    location,
    isMapped,
}: {
    location: LocationUpdateViewModel;
    isMapped: boolean;
}) {
    const locationName = usePreciseLocation(location);

    return (
        <span
            className="flex items-center gap-1.5 truncate"
            title={
                isMapped &&
                location.latitude !== null &&
                location.longitude !== null
                    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                    : undefined
            }
        >
            <MapPin
                className="h-3.5 w-3.5 shrink-0 text-brand-strong"
                aria-hidden="true"
            />
            <span className="truncate font-medium text-ink">
                {isMapped ? locationName : 'Location unavailable'}
            </span>
        </span>
    );
}

const EMPTY_SOS_INCIDENTS: SosIncidentViewModel[] = [];

export function LiveTrackingMap({
    locations,
    activeSosIncidents = EMPTY_SOS_INCIDENTS,
    compact = false,
    showLocationList = true,
    selectedLocationId,
    onSelectedLocationChange,
    className,
}: {
    locations: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    compact?: boolean;
    showLocationList?: boolean;
    selectedLocationId?: number | null;
    onSelectedLocationChange?: (id: number) => void;
    className?: string;
}) {
    const [internalSelectedId, setInternalSelectedId] = useState<number | null>(
        null,
    );
    const [styleVariant, setStyleVariant] = useState<MapStyleVariant>('light');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const fullscreenSurfaceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isFullscreen) {
            return;
        }

        const previousActiveElement =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusFrame = window.requestAnimationFrame(() =>
            fullscreenSurfaceRef.current
                ?.querySelector<HTMLButtonElement>(
                    'button[aria-label="Exit fullscreen"]',
                )
                ?.focus(),
        );
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (
                    fullscreenSurfaceRef.current?.querySelector(':popover-open')
                ) {
                    return;
                }

                event.preventDefault();
                setIsFullscreen(false);

                return;
            }

            if (event.key !== 'Tab' || !fullscreenSurfaceRef.current) {
                return;
            }

            const focusableElements = Array.from(
                fullscreenSurfaceRef.current.querySelectorAll<HTMLElement>(
                    'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
                ),
            ).filter(
                (element) =>
                    !element.hasAttribute('disabled') &&
                    element.getClientRects().length > 0,
            );

            if (focusableElements.length === 0) {
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements.at(-1);

            if (
                event.shiftKey &&
                (document.activeElement === firstElement ||
                    document.activeElement === fullscreenSurfaceRef.current)
            ) {
                event.preventDefault();
                lastElement?.focus();
            } else if (
                !event.shiftKey &&
                document.activeElement === lastElement
            ) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previousActiveElement?.focus();
        };
    }, [isFullscreen]);

    const mappedLocations = useMemo(
        () => locations.filter(hasMapCoordinates),
        [locations],
    );

    useEffect(() => {
        for (const location of mappedLocations) {
            if (location.latitude !== null && location.longitude !== null) {
                void reverseGeocode(location.latitude, location.longitude);
            }
        }
    }, [mappedLocations]);
    const filteredLocations = useMemo(() => {
        if (!searchQuery.trim()) {
            return locations;
        }

        const query = searchQuery.toLowerCase();

        return locations.filter(
            (location) =>
                location.user.name.toLowerCase().includes(query) ||
                (location.asset?.code ?? '').toLowerCase().includes(query) ||
                (location.asset?.name ?? '').toLowerCase().includes(query),
        );
    }, [locations, searchQuery]);
    const mapCenter = useMemo(
        () =>
            mappedLocations.length > 0
                ? averagePosition(mappedLocations)
                : averageSosPosition(activeSosIncidents),
        [activeSosIncidents, mappedLocations],
    );
    const selectedId =
        selectedLocationId === undefined
            ? internalSelectedId
            : selectedLocationId;
    const selected =
        (selectedId === null
            ? undefined
            : locations.find((location) => location.id === selectedId)) ??
        (selectedLocationId === undefined ? mappedLocations[0] : undefined);

    const selectLocation = useCallback(
        (id: number) => {
            setInternalSelectedId(id);
            onSelectedLocationChange?.(id);
        },
        [onSelectedLocationChange],
    );

    const copyCoordinates = useCallback(
        async (
            location: LocationUpdateViewModel,
            button?: HTMLButtonElement,
        ) => {
            if (
                location.latitude === null ||
                location.longitude === null ||
                !navigator.clipboard
            ) {
                return;
            }

            try {
                await navigator.clipboard.writeText(
                    `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
                );
                setCopiedId(location.id);

                if (button) {
                    button.textContent = 'Copied';
                }

                window.setTimeout(() => {
                    setCopiedId((current) =>
                        current === location.id ? null : current,
                    );

                    if (button) {
                        button.textContent = 'Copy';
                    }
                }, 2000);
            } catch {
                // Clipboard access is optional; the coordinates remain visible in the popup.
            }
        },
        [],
    );

    const provider = getMapProviderConfiguration(styleVariant);
    const mapHeight = isFullscreen
        ? 'fixed inset-4 z-[9999] h-[calc(100vh-2rem)] rounded-2xl shadow-2xl ring-1 ring-line/50'
        : compact
          ? 'h-[360px] md:h-[420px]'
          : 'h-[560px] lg:h-[620px]';

    return (
        <div
            ref={fullscreenSurfaceRef}
            data-testid="live-tracking-map"
            data-map-provider={provider.provider}
            data-map-plan={provider.plan}
            data-map-use-case={provider.useCase}
            role={isFullscreen ? 'dialog' : undefined}
            aria-modal={isFullscreen ? 'true' : undefined}
            aria-label={
                isFullscreen ? 'Fullscreen live tracking map' : undefined
            }
            className={cn(
                'grid grid-cols-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm',
                showLocationList && 'xl:grid-cols-[minmax(0,1fr)_22rem]',
                mapHeight,
                !isFullscreen && className,
            )}
        >
            <div className="relative h-full min-h-0 w-full overflow-hidden bg-surface-subtle">
                <MapLibreMap
                    key={styleVariant}
                    center={mapCenter}
                    zoom={DEFAULT_ZOOM}
                    ariaLabel="Interactive live field location map; use the synchronized location list for an accessible alternative"
                    styleVariant={styleVariant}
                >
                    <TrackingMapContent
                        locations={mappedLocations}
                        activeSosIncidents={activeSosIncidents}
                        selected={
                            selected && hasMapCoordinates(selected)
                                ? selected
                                : undefined
                        }
                        selectedId={selectedId}
                        onSelect={selectLocation}
                        onCopyCoordinates={copyCoordinates}
                    />
                    <LiveMapControls
                        compact={compact}
                        activeSosIncidents={activeSosIncidents}
                        mappedLocations={mappedLocations}
                        mapCenter={mapCenter}
                        styleVariant={styleVariant}
                        onStyleVariantChange={setStyleVariant}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={() =>
                            setIsFullscreen((value) => !value)
                        }
                    />
                </MapLibreMap>

                {!compact && <MapLegend />}
                <div
                    className={cn(
                        'pointer-events-none absolute z-[2] max-w-[calc(100%-1.5rem)] rounded-md bg-surface px-2 py-1 text-[11px] text-ink-soft',
                        compact ? 'bottom-10 left-3' : 'top-3 right-3',
                    )}
                >
                    <span>
                        {provider.isDevelopmentOnly
                            ? 'Stadia Maps · development/evaluation'
                            : `${provider.provider} basemap`}{' '}
                        · {mappedLocations.length} mapped units
                    </span>
                </div>

                {mappedLocations.length === 0 &&
                    activeSosIncidents.every(
                        (incident) => getSosMarkerPosition(incident) === null,
                    ) && (
                        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-surface/40 p-6 backdrop-blur-xs">
                            <div className="rounded-xl border border-line bg-surface/95 px-5 py-4 text-center text-sm text-ink-soft shadow-lg">
                                {locations.length === 0
                                    ? 'No location updates match the selected filter.'
                                    : 'Coordinates are unavailable for the selected updates.'}
                            </div>
                        </div>
                    )}
            </div>

            {showLocationList && (
                <aside
                    className="flex h-full min-h-0 flex-col overflow-hidden border-t border-line bg-surface xl:border-t-0 xl:border-l"
                    aria-label="Synchronized mapped location list"
                >
                    <div className="space-y-3 border-b border-line bg-surface p-3.5">
                        <div>
                            <h3 className="text-sm font-semibold text-ink">
                                Mapped locations
                            </h3>
                            <p className="text-xs text-ink-soft">
                                {mappedLocations.length} of {locations.length}{' '}
                                updates mapped
                            </p>
                        </div>
                        <div className="relative">
                            <Search
                                className="absolute top-3 left-3 h-4 w-4 text-ink-soft"
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) =>
                                    setSearchQuery(event.target.value)
                                }
                                placeholder="Search worker or asset…"
                                aria-label="Search mapped locations"
                                className="min-h-[44px] w-full rounded-lg border border-line bg-surface-subtle py-2 pr-3 pl-10 text-sm text-ink placeholder:text-ink-soft focus:border-brand-strong focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex-1 divide-y divide-line overflow-y-auto">
                        {filteredLocations.length === 0 ? (
                            <div className="p-6 text-center text-xs text-ink-soft">
                                {searchQuery
                                    ? `No locations match “${searchQuery}”.`
                                    : 'No location updates match the selected filter.'}
                            </div>
                        ) : (
                            filteredLocations.map((location) => {
                                const isMapped = hasMapCoordinates(location);
                                const isSelected = location.id === selected?.id;
                                const kind = getAssetKind(location);

                                return (
                                    <div
                                        key={location.id}
                                        className={cn(
                                            'group relative flex items-start justify-between p-3.5 transition-colors',
                                            isSelected
                                                ? 'bg-brand-soft/80 font-medium text-ink ring-1 ring-brand-strong/20'
                                                : 'text-ink-soft hover:bg-surface-subtle',
                                            !isMapped && 'opacity-60',
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                isMapped &&
                                                selectLocation(location.id)
                                            }
                                            disabled={!isMapped}
                                            aria-pressed={isSelected}
                                            className="min-h-[44px] flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <span
                                                        className={cn(
                                                            'flex h-7 w-7 shrink-0 items-center justify-center text-xs font-semibold text-white shadow-xs',
                                                            kind === 'truck'
                                                                ? 'rounded-lg bg-success-strong'
                                                                : kind ===
                                                                        'crane' ||
                                                                    kind ===
                                                                        'mobile_crane'
                                                                  ? 'rotate-45 rounded-md bg-success-strong'
                                                                  : kind ===
                                                                      'equipment'
                                                                    ? 'rounded-sm bg-success-strong'
                                                                    : 'rounded-full bg-success-strong',
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                'flex items-center justify-center',
                                                                (kind ===
                                                                    'crane' ||
                                                                    kind ===
                                                                        'mobile_crane') &&
                                                                    '-rotate-45',
                                                            )}
                                                        >
                                                            {kind ===
                                                            'truck' ? (
                                                                <Truck
                                                                    className="h-3.5 w-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                            ) : kind ===
                                                                  'crane' ||
                                                              kind ===
                                                                  'mobile_crane' ? (
                                                                <Construction
                                                                    className="h-3.5 w-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                            ) : kind ===
                                                              'equipment' ? (
                                                                <Wrench
                                                                    className="h-3.5 w-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                            ) : (
                                                                <UserRoundCog
                                                                    className="h-3.5 w-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                            )}
                                                        </span>
                                                    </span>
                                                    <span>
                                                        <span className="block text-sm font-semibold text-ink">
                                                            {location.user.name}
                                                        </span>
                                                        <span className="mt-0.5 block text-xs text-ink-soft">
                                                            {location.asset
                                                                ?.code ?? kind}
                                                        </span>
                                                    </span>
                                                </div>
                                                <StatusBadge
                                                    status={
                                                        location.freshness_status
                                                    }
                                                />
                                            </div>
                                            <div className="mt-2.5 flex items-center justify-between gap-3 text-xs text-ink-soft">
                                                <PreciseLocationDisplay
                                                    location={location}
                                                    isMapped={isMapped}
                                                />
                                            </div>
                                        </button>

                                        {isMapped && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void copyCoordinates(
                                                        location,
                                                    )
                                                }
                                                className="ml-2 min-h-[44px] min-w-[44px] rounded p-2 text-ink-soft transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong"
                                                title="Copy coordinates"
                                                aria-label={`Copy coordinates for ${location.user.name}`}
                                            >
                                                {copiedId === location.id ? (
                                                    <Check
                                                        className="mx-auto h-4 w-4 text-success-strong"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <span className="text-xs font-semibold">
                                                        Copy
                                                    </span>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
            )}
        </div>
    );
}

function TrackingMapContent({
    locations,
    activeSosIncidents,
    selected,
    selectedId,
    onSelect,
    onCopyCoordinates,
}: {
    locations: LocationUpdateViewModel[];
    activeSosIncidents: SosIncidentViewModel[];
    selected?: LocationUpdateViewModel;
    selectedId: number | null;
    onSelect: (id: number) => void;
    onCopyCoordinates: (
        location: LocationUpdateViewModel,
        button?: HTMLButtonElement,
    ) => void | Promise<void>;
}) {
    const { map, maplibregl, prefersReducedMotion } = useMapLibre();
    const markersRef = useRef<MapLibreMarker[]>([]);
    const accuracySourceRef = useRef<GeoJSONSource | null>(null);
    const overviewSourceRef = useRef<GeoJSONSource | null>(null);
    const hasCenteredRef = useRef(false);
    const previousSelectedIdRef = useRef<number | null>(null);
    const markerSelectionRef = useRef<number | null>(null);

    const accuracyData = useMemo(
        () =>
            featureCollection(
                locations
                    .filter((location) => Boolean(location.accuracy_metres))
                    .map((location) =>
                        circleFeature(
                            toLngLat(location),
                            location.accuracy_metres ?? 0,
                            {
                                color: freshnessColor(
                                    location.freshness_status,
                                ),
                                opacity:
                                    location.id === selected?.id ? 0.18 : 0.08,
                            },
                        ),
                    ),
            ),
        [locations, selected?.id],
    );
    const overviewData = useMemo(
        () =>
            featureCollection(
                locations.map((location) =>
                    pointFeature(toLngLat(location), {
                        color: freshnessColor(location.freshness_status),
                        id: location.id,
                        selectedCount: location.id === selected?.id ? 1 : 0,
                    }),
                ),
            ),
        [locations, selected?.id],
    );

    useEffect(() => {
        map.addSource('tracking-accuracy', {
            type: 'geojson',
            data: accuracyData,
        });
        accuracySourceRef.current = map.getSource(
            'tracking-accuracy',
        ) as GeoJSONSource;
        map.addLayer({
            id: 'tracking-accuracy-fill',
            type: 'fill',
            source: 'tracking-accuracy',
            paint: {
                'fill-color': ['get', 'color'],
                'fill-opacity': ['get', 'opacity'],
            },
        });
        map.addSource('tracking-marker-overview', {
            type: 'geojson',
            data: overviewData,
            cluster: true,
            clusterRadius: 44,
            clusterMaxZoom: 22,
            maxzoom: 24,
            clusterProperties: {
                selectedCount: ['+', ['get', 'selectedCount']],
            },
        });
        map.addLayer({
            id: 'tracking-marker-overview',
            type: 'circle',
            source: 'tracking-marker-overview',
            paint: {
                'circle-color': ['coalesce', ['get', 'color'], '#475569'],
                'circle-radius': [
                    'case',
                    ['has', 'point_count'],
                    [
                        'case',
                        ['>', ['coalesce', ['get', 'selectedCount'], 0], 0],
                        22,
                        20,
                    ],
                    [
                        'case',
                        ['>', ['coalesce', ['get', 'selectedCount'], 0], 0],
                        12,
                        9,
                    ],
                ],
                'circle-stroke-color': [
                    'case',
                    ['>', ['coalesce', ['get', 'selectedCount'], 0], 0],
                    '#c98f12',
                    '#ffffff',
                ],
                'circle-stroke-width': [
                    'case',
                    ['>', ['coalesce', ['get', 'selectedCount'], 0], 0],
                    3,
                    2,
                ],
                'circle-opacity': 0.9,
            },
            layout: { visibility: 'none' },
        });
        overviewSourceRef.current = map.getSource(
            'tracking-marker-overview',
        ) as GeoJSONSource;
        map.addLayer({
            id: 'tracking-marker-count',
            type: 'symbol',
            source: 'tracking-marker-overview',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-size': 13,
                'text-allow-overlap': true,
                visibility: 'none',
            },
            paint: { 'text-color': '#ffffff' },
        });
        map.addLayer({
            id: 'tracking-accuracy-outline',
            type: 'line',
            source: 'tracking-accuracy',
            paint: {
                'line-color': ['get', 'color'],
                'line-opacity': 0.75,
                'line-width': 1,
                'line-dasharray': [2, 2],
            },
        });

        return () => {
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];

            if (map.getLayer('tracking-accuracy-outline')) {
                map.removeLayer('tracking-accuracy-outline');
            }

            if (map.getLayer('tracking-accuracy-fill')) {
                map.removeLayer('tracking-accuracy-fill');
            }

            if (map.getSource('tracking-accuracy')) {
                map.removeSource('tracking-accuracy');
            }

            if (map.getLayer('tracking-marker-count')) {
                map.removeLayer('tracking-marker-count');
            }

            if (map.getLayer('tracking-marker-overview')) {
                map.removeLayer('tracking-marker-overview');
            }

            if (map.getSource('tracking-marker-overview')) {
                map.removeSource('tracking-marker-overview');
            }
        };
        // This effect intentionally creates one MapLibre source per map instance.
        // Data updates are handled below without rebuilding the map.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        accuracySourceRef.current?.setData(accuracyData);
    }, [accuracyData]);

    useEffect(() => {
        overviewSourceRef.current?.setData(overviewData);

        if (map.getLayer('tracking-marker-overview')) {
            map.setLayoutProperty(
                'tracking-marker-overview',
                'visibility',
                locations.length > HTML_MARKER_THRESHOLD ? 'visible' : 'none',
            );
            map.setLayoutProperty(
                'tracking-marker-count',
                'visibility',
                locations.length > HTML_MARKER_THRESHOLD ? 'visible' : 'none',
            );
        }
    }, [locations.length, map, overviewData]);

    useEffect(() => {
        type Entry = {
            key: string;
            locationId?: number;
            position: LngLat;
            label: string;
            description: string;
            sos?: SosMarkerOptions;
            content: () => HTMLDivElement;
            element: () => HTMLButtonElement;
        };
        const useHtml = locations.length <= HTML_MARKER_THRESHOLD;
        const entries: Entry[] = [];
        const representedSosIds = new Set<SosIncidentViewModel['id']>();
        const incidentsByWorker = new Map(
            activeSosIncidents.map((incident) => [
                incident.worker.id,
                incident,
            ]),
        );
        const locationsByWorker = new Map(
            locations.map((location) => [location.user.id, location]),
        );
        const locationsByAsset = new Map(
            locations
                .filter((location) => location.asset?.id !== undefined)
                .map((location) => [location.asset!.id, location]),
        );
        const sosOptions = (
            incident: SosIncidentViewModel,
        ): SosMarkerOptions => ({
            status: incident.status.value,
            label: `SOS incident for ${incident.worker.name} (${incident.status.label})`,
            prefersReducedMotion,
        });

        if (useHtml) {
            for (const location of locations) {
                const incident = incidentsByWorker.get(location.user.id);
                const sos = incident ? sosOptions(incident) : undefined;

                if (incident) {
                    representedSosIds.add(incident.id);
                }

                const label = trackingUnitLabel(location);
                entries.push({
                    key: `location:${location.id}`,
                    locationId: location.id,
                    position: toLngLat(location),
                    label,
                    description: `${location.freshness_status} · Received ${formatReportAge(location.received_at)}`,
                    sos,
                    content: () =>
                        createTrackingLocationPopup(
                            location,
                            incident,
                            (button) =>
                                void onCopyCoordinates(location, button),
                        ),
                    element: () =>
                        createAssetMarker({
                            kind: getAssetKind(location),
                            freshness: location.freshness_status,
                            isSelected: false,
                            label: `${label}, ${location.freshness_status} location`,
                            sos,
                        }),
                });
            }
        }

        for (const incident of activeSosIncidents) {
            const location = locationsByWorker.get(incident.worker.id);
            const assetLocation = incident.asset?.id
                ? locationsByAsset.get(incident.asset.id)
                : undefined;

            if (representedSosIds.has(incident.id)) {
                continue;
            }

            const position = getSosMarkerPosition(
                incident,
                location,
                assetLocation,
            );

            if (!position) {
                continue;
            }

            const sos = sosOptions(incident);
            entries.push({
                key: `sos:${incident.id}`,
                locationId: location?.id,
                position,
                label: incident.worker.name,
                description: `${incident.status.label} · ${incident.category.label}`,
                sos,
                content: () =>
                    createTrackingSosPopup(
                        incident,
                        location
                            ? (button) =>
                                  void onCopyCoordinates(location, button)
                            : undefined,
                    ),
                element: () => createSosMarker(sos),
            });
        }

        const getLargeFleetOverviewFeatureAt = (position: LngLat) => {
            if (
                useHtml ||
                !overviewSourceRef.current ||
                !map.getLayer('tracking-marker-overview')
            ) {
                return undefined;
            }

            return map
                .queryRenderedFeatures(map.project(position), {
                    layers: ['tracking-marker-overview'],
                })
                .find((candidate) => candidate.geometry.type === 'Point');
        };

        const getLargeFleetOverviewCountAt = (position: LngLat): number => {
            const feature = getLargeFleetOverviewFeatureAt(position);

            if (!feature) {
                return 0;
            }

            const count = Number(feature.properties?.point_count);

            return Number.isFinite(count) && count > 0 ? count : 1;
        };

        const getLargeFleetLocationsAt = async (
            position: LngLat,
        ): Promise<LocationUpdateViewModel[]> => {
            const feature = getLargeFleetOverviewFeatureAt(position);
            const overviewSource = overviewSourceRef.current;

            if (!feature || !overviewSource) {
                return [];
            }

            const clusterId = feature.properties?.cluster_id;
            let locationIds: Set<number>;

            if (typeof clusterId === 'number') {
                const leaves = await overviewSource.getClusterLeaves(
                    clusterId,
                    locations.length,
                    0,
                );
                locationIds = new Set(
                    leaves
                        .map((leaf) => Number(leaf.properties?.id))
                        .filter(Number.isFinite),
                );
            } else {
                const locationId = Number(feature.properties?.id);

                if (!Number.isFinite(locationId)) {
                    return [];
                }

                locationIds = new Set([locationId]);
            }

            return locations.filter((location) => locationIds.has(location.id));
        };

        let disposed = false;
        let signature = '';
        const renderMarkers = () => {
            const groups = groupOverlappingMarkers(
                entries.map((entry) => ({
                    value: entry,
                    priority: entry.sos ? 1 : 0,
                    ...map.project(entry.position),
                })),
            );
            const overviewCounts = groups.map((group) =>
                useHtml ? 0 : getLargeFleetOverviewCountAt(group[0].position),
            );
            const nextSignature = JSON.stringify(
                groups.map((group) => group.map((entry) => entry.key)),
            );

            if (signature === nextSignature) {
                if (!useHtml) {
                    groups.forEach((group, groupIndex) => {
                        const marker = markersRef.current[groupIndex];

                        if (!marker) {
                            return;
                        }

                        const overviewCount = overviewCounts[groupIndex];
                        const markerCount = Math.max(
                            group.length,
                            overviewCount +
                                group.filter(
                                    (entry) => entry.locationId === undefined,
                                ).length,
                        );
                        updateLargeFleetMarkerCount(
                            marker.getElement(),
                            markerCount,
                            overviewCount > 0,
                            Boolean(group[0].sos),
                        );
                    });
                }

                return;
            }

            signature = nextSignature;
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];

            groups.forEach((group, groupIndex) => {
                // Use the exact anchor used for grouping; SOS entries were prioritized first.
                const anchor = group[0];
                const overviewCount = overviewCounts[groupIndex];
                const markerCount = Math.max(
                    group.length,
                    overviewCount +
                        group.filter((entry) => entry.locationId === undefined)
                            .length,
                );
                const element =
                    group.length === 1
                        ? anchor.element()
                        : createMarkerGroup({
                              count: useHtml ? group.length : markerCount,
                              sos: anchor.sos,
                          });

                if (!useHtml) {
                    updateLargeFleetMarkerCount(
                        element,
                        markerCount,
                        overviewCount > 0,
                        Boolean(anchor.sos),
                    );
                }

                element.dataset.locationIds = group
                    .flatMap((entry) =>
                        entry.locationId === undefined
                            ? []
                            : [entry.locationId],
                    )
                    .join(',');
                const popup = new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: true,
                    offset: 24,
                    maxWidth: '320px',
                });
                let popupGeneration = 0;
                const groupContent = (
                    entriesForPopup: Array<{
                        label: string;
                        description: string;
                        hasSos: boolean;
                        onSelect: () => void;
                    }>,
                ) => createTrackingGroupPopup(entriesForPopup);
                const baseGroupContent = () =>
                    groupContent(
                        group.map((entry) => ({
                            label: entry.label,
                            description: entry.description,
                            hasSos: Boolean(entry.sos),
                            onSelect: () => {
                                popupGeneration += 1;
                                popup.setDOMContent(entry.content());

                                if (entry.locationId !== undefined) {
                                    onSelect(entry.locationId);
                                }
                            },
                        })),
                    );
                const showLargeFleetOverlap = async () => {
                    const generation = ++popupGeneration;
                    let members: LocationUpdateViewModel[];

                    try {
                        members = await getLargeFleetLocationsAt(
                            anchor.position,
                        );
                    } catch {
                        if (!disposed && generation === popupGeneration) {
                            const message = document.createElement('p');
                            message.className = 'maplibre-tracking-group';
                            message.textContent =
                                'This group changed. Select a unit from the synchronized list or try again.';
                            popup.setDOMContent(message);
                        }

                        return;
                    }

                    if (
                        disposed ||
                        generation !== popupGeneration ||
                        members.length === 0
                    ) {
                        return;
                    }

                    const memberIds = new Set(
                        members.map((member) => member.id),
                    );
                    const locationEntries = members.map((location) => {
                        const incident = findSosIncidentForLocation(
                            location,
                            activeSosIncidents,
                        );

                        return {
                            label: trackingUnitLabel(location),
                            description: `${location.freshness_status} · Received ${formatReportAge(location.received_at)}`,
                            hasSos: Boolean(incident),
                            onSelect: () => {
                                popupGeneration += 1;
                                popup.setDOMContent(
                                    createTrackingLocationPopup(
                                        location,
                                        incident,
                                        (button) =>
                                            void onCopyCoordinates(
                                                location,
                                                button,
                                            ),
                                    ),
                                );
                                onSelect(location.id);
                            },
                        };
                    });
                    const remainingSosEntries = group
                        .filter(
                            (entry) =>
                                entry.locationId === undefined ||
                                !memberIds.has(entry.locationId),
                        )
                        .map((entry) => ({
                            label: entry.label,
                            description: entry.description,
                            hasSos: true,
                            onSelect: () => {
                                popupGeneration += 1;
                                popup.setDOMContent(entry.content());

                                if (entry.locationId !== undefined) {
                                    onSelect(entry.locationId);
                                }
                            },
                        }));
                    const mergedEntries = [
                        ...locationEntries,
                        ...remainingSosEntries,
                    ];

                    if (mergedEntries.length === 1 && members.length === 1) {
                        const location = members[0];
                        popup.setDOMContent(
                            createTrackingLocationPopup(
                                location,
                                findSosIncidentForLocation(
                                    location,
                                    activeSosIncidents,
                                ),
                                (button) =>
                                    void onCopyCoordinates(location, button),
                            ),
                        );

                        return;
                    }

                    popup.setDOMContent(groupContent(mergedEntries));
                };
                popup.setDOMContent(
                    group.length === 1 ? anchor.content() : baseGroupContent(),
                );
                element.addEventListener('click', () => {
                    // Reopening a group always exposes every member, including identical coordinates.
                    popup.setDOMContent(
                        group.length === 1
                            ? anchor.content()
                            : baseGroupContent(),
                    );

                    if (!useHtml) {
                        void showLargeFleetOverlap();
                    }

                    if (group.length === 1 && anchor.locationId !== undefined) {
                        onSelect(anchor.locationId);
                    }
                });
                markersRef.current.push(
                    new maplibregl.Marker({ element })
                        .setLngLat(anchor.position)
                        .setPopup(popup)
                        .addTo(map),
                );
            });

            updateMarkerSelection(
                markersRef.current,
                markerSelectionRef.current,
            );
        };
        renderMarkers();
        map.on('moveend', renderMarkers);
        map.on('idle', renderMarkers);

        return () => {
            disposed = true;
            map.off('moveend', renderMarkers);
            map.off('idle', renderMarkers);
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];
        };
    }, [
        activeSosIncidents,
        locations,
        map,
        maplibregl,
        onCopyCoordinates,
        onSelect,
        prefersReducedMotion,
    ]);

    useEffect(() => {
        markerSelectionRef.current = selected?.id ?? null;
        updateMarkerSelection(markersRef.current, markerSelectionRef.current);
    }, [locations, selected?.id]);

    useEffect(() => {
        if (locations.length <= HTML_MARKER_THRESHOLD) {
            return;
        }

        let disposed = false;
        let activePopup: InstanceType<typeof maplibregl.Popup> | undefined;
        const onOverviewClick = (event: MapLayerMouseEvent) => {
            const feature = event.features?.[0];

            if (!feature || feature.geometry.type !== 'Point') {
                return;
            }

            const position = feature.geometry.coordinates;

            if (position.length < 2) {
                return;
            }

            const popup = new maplibregl.Popup({ maxWidth: '320px' }).setLngLat(
                [position[0], position[1]],
            );
            activePopup?.remove();
            activePopup = popup;
            const renderLocations = (ids: Set<number>) => {
                if (disposed || activePopup !== popup) {
                    return;
                }

                const members = locations.filter((location) =>
                    ids.has(location.id),
                );
                const selectMember = (location: LocationUpdateViewModel) => {
                    onSelect(location.id);
                    popup
                        .setDOMContent(
                            createTrackingLocationPopup(
                                location,
                                findSosIncidentForLocation(
                                    location,
                                    activeSosIncidents,
                                ),
                                (button) =>
                                    void onCopyCoordinates(location, button),
                            ),
                        )
                        .addTo(map);
                };

                if (members.length === 1) {
                    selectMember(members[0]);

                    return;
                }

                popup
                    .setDOMContent(
                        createTrackingGroupPopup(
                            members.map((location) => ({
                                label: trackingUnitLabel(location),
                                description: `${location.freshness_status} · Received ${formatReportAge(location.received_at)}`,
                                hasSos: Boolean(
                                    findSosIncidentForLocation(
                                        location,
                                        activeSosIncidents,
                                    ),
                                ),
                                onSelect: () => selectMember(location),
                            })),
                        ),
                    )
                    .addTo(map);
            };
            const clusterId: unknown = feature.properties?.cluster_id;

            if (typeof clusterId !== 'number') {
                renderLocations(new Set([Number(feature.properties?.id)]));

                return;
            }

            void overviewSourceRef.current
                ?.getClusterLeaves(clusterId, locations.length, 0)
                .then((leaves) =>
                    renderLocations(
                        new Set(
                            leaves.map((leaf) => Number(leaf.properties?.id)),
                        ),
                    ),
                )
                .catch(() => {
                    if (disposed || activePopup !== popup) {
                        return;
                    }

                    const message = document.createElement('p');
                    message.className = 'maplibre-tracking-group';
                    message.textContent =
                        'This group changed. Select a unit from the synchronized list or try again.';
                    popup.setDOMContent(message).addTo(map);
                });
        };
        map.on('click', 'tracking-marker-overview', onOverviewClick);

        return () => {
            disposed = true;
            activePopup?.remove();
            map.off('click', 'tracking-marker-overview', onOverviewClick);
        };
    }, [
        activeSosIncidents,
        locations,
        map,
        maplibregl,
        onCopyCoordinates,
        onSelect,
    ]);
    useEffect(() => {
        if (!selected) {
            previousSelectedIdRef.current = null;

            return;
        }

        const selectedIdChanged = previousSelectedIdRef.current !== selected.id;
        const shouldCenter =
            !hasCenteredRef.current ||
            (selectedId !== null &&
                selected.id === selectedId &&
                selectedIdChanged);
        previousSelectedIdRef.current = selected.id;

        if (!shouldCenter) {
            return;
        }

        hasCenteredRef.current = true;
        map.easeTo({
            center: toLngLat(selected),
            zoom: 13,
            duration: prefersReducedMotion ? 0 : 350,
        });
    }, [map, prefersReducedMotion, selected, selectedId]);

    return null;
}

function LiveMapControls({
    compact,
    activeSosIncidents,
    mappedLocations,
    mapCenter,
    styleVariant,
    onStyleVariantChange,
    isFullscreen,
    onToggleFullscreen,
}: {
    compact: boolean;
    activeSosIncidents: SosIncidentViewModel[];
    mappedLocations: LocationUpdateViewModel[];
    mapCenter: LngLat;
    styleVariant: MapStyleVariant;
    onStyleVariantChange: (variant: MapStyleVariant) => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}) {
    const { map, maplibregl, prefersReducedMotion } = useMapLibre();
    const [showStyleMenu, setShowStyleMenu] = useState(false);

    useEffect(() => {
        if (!showStyleMenu) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setShowStyleMenu(false);
            }
        };

        document.addEventListener('keydown', closeOnEscape);

        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [showStyleMenu]);

    const fitAll = () => {
        const positions = [
            ...mappedLocations.map(toLngLat),
            ...activeSosIncidents.flatMap((incident) => {
                const position = getSosMarkerPosition(
                    incident,
                    mappedLocations.find(
                        (location) => location.user.id === incident.worker.id,
                    ),
                    incident.asset?.id
                        ? mappedLocations.find(
                              (location) =>
                                  location.asset?.id === incident.asset?.id,
                          )
                        : undefined,
                );

                return position ? [position] : [];
            }),
        ];

        if (positions.length === 0) {
            return;
        }

        const bounds = new maplibregl.LngLatBounds();
        positions.forEach((position) => bounds.extend(position));
        map.fitBounds(bounds, {
            padding: 40,
            maxZoom: 15,
            duration: prefersReducedMotion ? 0 : 350,
        });
    };

    const controlClass =
        'h-11 min-h-[44px] w-11 min-w-[44px] rounded-lg text-ink transition-transform active:scale-95';

    if (compact) {
        return (
            <CompactMapControls
                onZoomIn={() =>
                    map.zoomIn({ duration: prefersReducedMotion ? 0 : 200 })
                }
                onZoomOut={() =>
                    map.zoomOut({ duration: prefersReducedMotion ? 0 : 200 })
                }
                onFitAll={fitAll}
                styleVariant={styleVariant}
                onStyleVariantChange={onStyleVariantChange}
                isFullscreen={isFullscreen}
                onToggleFullscreen={onToggleFullscreen}
            />
        );
    }

    return (
        <div className="absolute top-3 left-3 z-[3] flex flex-col gap-1.5">
            <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface/95 p-1 shadow-sm backdrop-blur-md">
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() =>
                        map.zoomIn({ duration: prefersReducedMotion ? 0 : 200 })
                    }
                    aria-label="Zoom in"
                    title="Zoom in"
                    className={controlClass}
                >
                    <ZoomIn className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() =>
                        map.zoomOut({
                            duration: prefersReducedMotion ? 0 : 200,
                        })
                    }
                    aria-label="Zoom out"
                    title="Zoom out"
                    className={controlClass}
                >
                    <ZoomOut className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface/95 p-1 shadow-sm backdrop-blur-md">
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() =>
                        map.easeTo({
                            center: mapCenter,
                            zoom: DEFAULT_ZOOM,
                            duration: prefersReducedMotion ? 0 : 350,
                        })
                    }
                    aria-label="Center live map"
                    title="Center map"
                    className={controlClass}
                >
                    <LocateFixed className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={fitAll}
                    aria-label="Fit all locations on map"
                    title="Fit all markers"
                    className={controlClass}
                >
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                </Button>
                <div className="relative">
                    <Button
                        size="icon"
                        variant={showStyleMenu ? 'primary' : 'secondary'}
                        onClick={() => setShowStyleMenu((value) => !value)}
                        aria-label="Switch map style"
                        aria-haspopup="menu"
                        aria-expanded={showStyleMenu}
                        title="Basemap styles"
                        className={controlClass}
                    >
                        <Layers className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    {showStyleMenu && (
                        <div
                            className="absolute top-0 left-12 z-[4] w-36 rounded-xl border border-line bg-surface p-1 shadow-lg"
                            role="menu"
                            aria-label="Basemap styles"
                        >
                            {(['light', 'dark'] as const).map((variant) => (
                                <button
                                    key={variant}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={styleVariant === variant}
                                    onClick={() => {
                                        onStyleVariantChange(variant);
                                        setShowStyleMenu(false);
                                    }}
                                    className={cn(
                                        'min-h-[44px] w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium capitalize transition-colors',
                                        styleVariant === variant
                                            ? 'bg-brand-soft font-semibold text-brand-strong'
                                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                >
                                    {variant}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={onToggleFullscreen}
                    aria-label={
                        isFullscreen
                            ? 'Exit fullscreen'
                            : 'Expand map fullscreen'
                    }
                    aria-expanded={isFullscreen}
                    title={isFullscreen ? 'Minimize' : 'Maximize map'}
                    className={controlClass}
                >
                    {isFullscreen ? (
                        <Minimize className="h-4 w-4" aria-hidden="true" />
                    ) : (
                        <Maximize className="h-4 w-4" aria-hidden="true" />
                    )}
                </Button>
            </div>
        </div>
    );
}

function CompactMapControls({
    onZoomIn,
    onZoomOut,
    onFitAll,
    styleVariant,
    onStyleVariantChange,
    isFullscreen,
    onToggleFullscreen,
}: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitAll: () => void;
    styleVariant: MapStyleVariant;
    onStyleVariantChange: (variant: MapStyleVariant) => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}) {
    const menuId = useId();
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

    return (
        <div className="absolute top-3 right-3 left-3 z-[3] flex items-start justify-between gap-2">
            <div className="flex flex-col gap-2">
                <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
                    <Button
                        size="icon"
                        variant="quiet"
                        className="h-11 w-11 rounded-none"
                        onClick={onZoomIn}
                        aria-label="Zoom in"
                        title="Zoom in"
                    >
                        <ZoomIn className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                        size="icon"
                        variant="quiet"
                        className="h-11 w-11 rounded-none border-t border-line"
                        onClick={onZoomOut}
                        aria-label="Zoom out"
                        title="Zoom out"
                    >
                        <ZoomOut className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
                <Button
                    variant="secondary"
                    className="min-h-11 bg-surface px-3 text-xs"
                    onClick={onFitAll}
                >
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                    Fit all units
                </Button>
                {isFullscreen && (
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11 bg-surface"
                        aria-label="Exit fullscreen"
                        onClick={onToggleFullscreen}
                    >
                        <Minimize className="h-4 w-4" aria-hidden="true" />
                    </Button>
                )}
                <Button
                    ref={triggerRef}
                    variant="secondary"
                    className="min-h-11 bg-surface px-3 text-xs"
                    popoverTarget={menuId}
                    onClick={() => {
                        const rect =
                            triggerRef.current?.getBoundingClientRect();

                        if (rect) {
                            setMenuPosition({
                                left: Math.max(
                                    8,
                                    Math.min(
                                        rect.right - 192,
                                        window.innerWidth - 200,
                                    ),
                                ),
                                top: Math.min(
                                    rect.bottom + 8,
                                    window.innerHeight - 228,
                                ),
                            });
                        }
                    }}
                >
                    <Layers className="h-4 w-4" aria-hidden="true" />
                    Map options
                </Button>
                <div
                    ref={menuRef}
                    id={menuId}
                    popover="auto"
                    aria-label="Map options"
                    className="fixed m-0 w-48 rounded-lg border border-line bg-surface p-1 text-ink shadow-lg"
                    style={{ inset: 'auto', ...menuPosition }}
                >
                    <p className="px-3 py-2 text-xs font-medium text-ink-soft">
                        Basemap
                    </p>
                    {(['light', 'dark'] as const).map((variant) => (
                        <button
                            key={variant}
                            type="button"
                            aria-pressed={variant === styleVariant}
                            className="flex min-h-11 w-full items-center justify-between rounded-md px-3 text-left text-sm capitalize hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-brand-strong"
                            onClick={() => {
                                menuRef.current?.hidePopover();
                                onStyleVariantChange(variant);
                            }}
                        >
                            {variant}
                            {styleVariant === variant && (
                                <Check className="h-4 w-4" aria-hidden="true" />
                            )}
                        </button>
                    ))}
                    <button
                        type="button"
                        className="flex min-h-11 w-full items-center gap-2 rounded-md border-t border-line px-3 text-left text-sm hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-brand-strong"
                        onClick={() => {
                            menuRef.current?.hidePopover();
                            onToggleFullscreen();
                        }}
                    >
                        <Maximize className="h-4 w-4" aria-hidden="true" />
                        {isFullscreen ? 'Exit fullscreen' : 'Expand fullscreen'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MapLegend() {
    return (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[2] flex flex-wrap items-center gap-3 rounded-xl border border-line/70 bg-surface/90 px-3 py-2 text-[11px] text-ink shadow-sm backdrop-blur-md">
            <span className="flex items-center gap-1.5 font-medium">
                <Truck
                    className="h-3.5 w-3.5 text-success-strong"
                    aria-hidden="true"
                />
                Truck
            </span>
            <span className="flex items-center gap-1.5 font-medium">
                <Construction
                    className="h-3.5 w-3.5 text-success-strong"
                    aria-hidden="true"
                />
                Crane
            </span>
            <span className="flex items-center gap-1.5 font-medium">
                <Wrench
                    className="h-3.5 w-3.5 text-success-strong"
                    aria-hidden="true"
                />
                Equipment
            </span>
            <span className="flex items-center gap-1.5 font-medium">
                <UserRoundCog
                    className="h-3.5 w-3.5 text-success-strong"
                    aria-hidden="true"
                />
                Worker
            </span>
        </div>
    );
}

function hasMapCoordinates(location: LocationUpdateViewModel): boolean {
    return location.latitude !== null && location.longitude !== null;
}

function toLngLat(location: LocationUpdateViewModel): LngLat {
    return [
        location.longitude ?? DEFAULT_CENTER[0],
        location.latitude ?? DEFAULT_CENTER[1],
    ];
}

function findSosIncidentForLocation(
    location: LocationUpdateViewModel,
    incidents: SosIncidentViewModel[],
): SosIncidentViewModel | undefined {
    return incidents.find(
        (incident) => incident.worker.id === location.user.id,
    );
}

function averageSosPosition(incidents: SosIncidentViewModel[]): LngLat {
    const coordinates = incidents.flatMap((incident) => {
        const location = incident.location;

        return location !== null &&
            location.latitude !== null &&
            location.longitude !== null
            ? [[location.longitude, location.latitude] as LngLat]
            : [];
    });

    if (coordinates.length === 0) {
        return DEFAULT_CENTER;
    }

    return [
        coordinates.reduce((sum, coordinate) => sum + coordinate[0], 0) /
            coordinates.length,
        coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) /
            coordinates.length,
    ];
}

function averagePosition(locations: LocationUpdateViewModel[]): LngLat {
    if (locations.length === 0) {
        return DEFAULT_CENTER;
    }

    return [
        locations.reduce(
            (sum, location) => sum + (location.longitude ?? 0),
            0,
        ) / locations.length,
        locations.reduce((sum, location) => sum + (location.latitude ?? 0), 0) /
            locations.length,
    ];
}

const MAP_FRESHNESS_COLORS: Record<
    LocationUpdateViewModel['freshness_status'],
    string
> = {
    fresh: '#15803d',
    delayed: '#b45309',
    stale: '#dc2626',
    offline: '#64748b',
};

function freshnessColor(
    status: LocationUpdateViewModel['freshness_status'],
): string {
    return MAP_FRESHNESS_COLORS[status];
}

function updateMarkerSelection(
    markers: MapLibreMarker[],
    selectedId: number | null,
): void {
    for (const marker of markers) {
        const element = marker.getElement();
        const selected =
            selectedId !== null &&
            (element.dataset.locationIds ?? '')
                .split(',')
                .includes(String(selectedId));
        element.dataset.selected = String(selected);
        element.setAttribute('aria-pressed', String(selected));
    }
}

function updateLargeFleetMarkerCount(
    element: HTMLElement,
    markerCount: number,
    hasOverviewCount: boolean,
    hasSos: boolean,
): void {
    if (element.classList.contains('maplibre-marker-group')) {
        const countElement = element.querySelector<HTMLElement>(
            '.maplibre-marker-group__count',
        );

        if (countElement) {
            countElement.textContent = String(markerCount);
        }

        element.setAttribute(
            'aria-label',
            `${markerCount} units in this area${hasSos ? '. Includes SOS incidents' : ''}. Select a unit`,
        );

        return;
    }

    if (!hasSos) {
        return;
    }

    const indicator = element.querySelector<HTMLElement>(
        '.maplibre-sos-marker__indicator',
    );

    if (!indicator) {
        return;
    }

    let countElement = indicator.querySelector<HTMLElement>(
        '.maplibre-sos-marker__overlap-count',
    );

    if (hasOverviewCount) {
        if (!countElement) {
            countElement = document.createElement('span');
            countElement.className = 'maplibre-sos-marker__overlap-count';
            indicator.appendChild(countElement);
        }

        countElement.textContent = ` · ${markerCount}`;
        element.dataset.sosBaseAriaLabel ??=
            element.getAttribute('aria-label') ?? 'SOS marker';
        element.setAttribute(
            'aria-label',
            `${element.dataset.sosBaseAriaLabel}. ${markerCount} units in this area`,
        );
        element.dataset.overlapCount = String(markerCount);

        return;
    }

    countElement?.remove();
    delete element.dataset.overlapCount;

    if (element.dataset.sosBaseAriaLabel) {
        element.setAttribute('aria-label', element.dataset.sosBaseAriaLabel);
    }
}
