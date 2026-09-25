import {
    AlertTriangle,
    Check,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Layers,
    LocateFixed,
    MapPin,
    Maximize,
    Maximize2,
    Minimize,
    Search,
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
import type { MutableRefObject } from 'react';
import { Button } from '@/components/ui';
import { FleetAssetCategoryIcon } from '@/components/workspace/fleet/fleet-asset-category-icon';
import {
    classifyFleetAsset,
    filterFleetLocationsByCategory,
    FLEET_ASSET_CATEGORY_LABELS,
} from '@/components/workspace/fleet/fleet-asset-classification';
import type { FleetAssetCategory } from '@/components/workspace/fleet/fleet-asset-classification';
import {
    getFleetLocationFreshnessDescription,
    getFleetLocationFreshnessLabel,
    hasLocationCoordinates,
} from '@/components/workspace/fleet/fleet-location-labels';
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
    createPopupCard,
    createSosMarker,
    createWarehouseMarker,
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
import { FOCHUN_WAREHOUSE } from './maplibre/warehouse-location';

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
            className="flex min-w-0 items-center gap-1.5"
            title={
                isMapped &&
                location.latitude !== null &&
                location.longitude !== null
                    ? `${getFleetLocationFreshnessDescription(location)} · ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                    : undefined
            }
        >
            <MapPin
                className="h-3.5 w-3.5 shrink-0 text-brand-strong"
                aria-hidden="true"
            />
            <span className="min-w-0 truncate font-medium text-ink">
                {isMapped
                    ? locationName
                    : location.recorded_location
                      ? `No map position · Recorded location: ${location.recorded_location}`
                      : 'No map position'}
            </span>
        </span>
    );
}

const EMPTY_SOS_INCIDENTS: SosIncidentViewModel[] = [];

export function LiveTrackingMap({
    locations,
    activeSosIncidents = EMPTY_SOS_INCIDENTS,
    categoryFilter = null,
    compact = false,
    showLocationList = true,
    selectedLocationId,
    onSelectedLocationChange,
    onCollapse,
    onSectionChange,
    className,
}: {
    locations: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    categoryFilter?: FleetAssetCategory | null;
    compact?: boolean;
    showLocationList?: boolean;
    selectedLocationId?: number | null;
    onSelectedLocationChange?: (id: number) => void;
    onCollapse?: () => void;
    onSectionChange?: (section: 'tracking') => void;
    className?: string;
}) {
    const [internalSelectedId, setInternalSelectedId] = useState<number | null>(
        null,
    );
    const [styleVariant, setStyleVariant] = useState<MapStyleVariant>('light');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
    const [isLocationListCollapsed, setIsLocationListCollapsed] =
        useState(false);
    const [mapActionsReady, setMapActionsReady] = useState(false);
    const mapActionsRef = useRef<MapActions | null>(null);
    const fullscreenSurfaceRef = useRef<HTMLDivElement>(null);
    const locationListId = useId();

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

    const assetLocations = useMemo(
        () => filterFleetLocationsByCategory(locations, null),
        [locations],
    );
    const mappedLocations = useMemo(
        () => assetLocations.filter(hasLocationCoordinates),
        [assetLocations],
    );
    const sosLocations = useMemo(
        () => locations.filter(hasLocationCoordinates),
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
        const categoryLocations = filterFleetLocationsByCategory(
            locations,
            categoryFilter,
        );

        if (!searchQuery.trim()) {
            return categoryLocations;
        }

        const query = searchQuery.trim().toLowerCase();

        return categoryLocations.filter(
            (location) =>
                location.user.name.toLowerCase().includes(query) ||
                (location.asset?.code ?? '').toLowerCase().includes(query) ||
                (location.asset?.name ?? '').toLowerCase().includes(query),
        );
    }, [categoryFilter, locations, searchQuery]);
    const filteredMappedLocations = useMemo(
        () => filteredLocations.filter(hasLocationCoordinates),
        [filteredLocations],
    );
    const mapCenter = useMemo(
        () =>
            filteredMappedLocations.length > 0
                ? averagePosition(filteredMappedLocations)
                : averageSosPosition(activeSosIncidents, sosLocations),
        [activeSosIncidents, filteredMappedLocations, sosLocations],
    );
    const selectedId =
        selectedLocationId === undefined
            ? (internalSelectedId ?? filteredMappedLocations[0]?.id ?? null)
            : selectedLocationId;
    const selected =
        (selectedId === null
            ? undefined
            : assetLocations.find((location) => location.id === selectedId)) ??
        undefined;

    const selectLocation = useCallback(
        (id: number) => {
            setInternalSelectedId(id);
            onSelectedLocationChange?.(id);
        },
        [onSelectedLocationChange],
    );

    const provider = getMapProviderConfiguration(styleVariant);
    const mapHeight = isFullscreen
        ? 'fixed inset-4 z-[9999] h-[calc(100vh-2rem)] rounded-2xl shadow-2xl ring-1 ring-line/50'
        : compact
          ? 'h-[560px] md:h-[680px]'
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
                '@container relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm',
                mapHeight,
                !isFullscreen && className,
            )}
        >
            {compact && (
                <CompactMapToolbar
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    onFitAll={() => mapActionsRef.current?.fitAll()}
                    fitAllDisabled={!mapActionsReady}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={() =>
                        setIsFullscreen((value) => !value)
                    }
                    styleVariant={styleVariant}
                    onStyleVariantChange={setStyleVariant}
                    mobileView={mobileView}
                    onMobileViewChange={setMobileView}
                    showLocationList={showLocationList}
                    onCollapse={onCollapse}
                    onSectionChange={onSectionChange}
                />
            )}

            <div
                className={cn(
                    'grid min-h-0 flex-1 grid-cols-1',
                    showLocationList &&
                        !isLocationListCollapsed &&
                        '@lg:grid-cols-[minmax(0,1fr)_22rem]',
                )}
            >
                <div
                    className={cn(
                        'relative min-h-0 w-full overflow-hidden bg-surface-subtle',
                        compact &&
                            showLocationList &&
                            mobileView === 'list' &&
                            'hidden @lg:block',
                    )}
                >
                    {showLocationList && isLocationListCollapsed && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="absolute top-3 right-3 z-[4] hidden min-h-10 gap-1.5 px-2.5 text-xs @lg:inline-flex"
                            onClick={() => setIsLocationListCollapsed(false)}
                            aria-label="Show asset list"
                            aria-controls={locationListId}
                            aria-expanded={false}
                        >
                            <ChevronRight
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                            Show list
                        </Button>
                    )}
                    <MapLibreMap
                        center={mapCenter}
                        zoom={DEFAULT_ZOOM}
                        ariaLabel="Interactive live field location map; use the synchronized location list for an accessible alternative"
                        styleVariant={styleVariant}
                    >
                        <TrackingMapContent
                            locations={filteredMappedLocations}
                            sosLocations={sosLocations}
                            activeSosIncidents={activeSosIncidents}
                            selected={
                                selected && hasLocationCoordinates(selected)
                                    ? selected
                                    : undefined
                            }
                            onSelect={selectLocation}
                        />
                        <MapActionBridge
                            mappedLocations={filteredMappedLocations}
                            sosLocations={sosLocations}
                            activeSosIncidents={activeSosIncidents}
                            actionsRef={mapActionsRef}
                            onReady={setMapActionsReady}
                        />
                        <LiveMapControls
                            compact={compact}
                            activeSosIncidents={activeSosIncidents}
                            mappedLocations={filteredMappedLocations}
                            sosLocations={sosLocations}
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

                    {filteredMappedLocations.length === 0 &&
                        activeSosIncidents.every(
                            (incident) =>
                                getSosMarkerPosition(
                                    incident,
                                    sosLocations.find(
                                        (location) =>
                                            location.user.id ===
                                            incident.worker.id,
                                    ),
                                    incident.asset?.id
                                        ? sosLocations.find(
                                              (location) =>
                                                  location.asset?.id ===
                                                  incident.asset?.id,
                                          )
                                        : undefined,
                                ) === null,
                        ) && (
                            <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-surface/40 p-6 backdrop-blur-xs">
                                <div className="rounded-xl border border-line bg-surface/95 px-5 py-4 text-center text-sm text-ink-soft shadow-lg">
                                    {searchQuery.trim()
                                        ? `No assets match “${searchQuery}”.`
                                        : filteredLocations.length === 0
                                          ? 'No assets match this category or search. The yard and warehouse reference remains on the map.'
                                          : 'Coordinates are unavailable for these assets. The yard and warehouse reference remains on the map.'}
                                </div>
                            </div>
                        )}
                </div>

                {showLocationList && (
                    <aside
                        id={locationListId}
                        className={cn(
                            'flex min-h-0 flex-col overflow-hidden border-t border-line bg-surface @lg:border-t-0 @lg:border-l',
                            compact &&
                                mobileView === 'map' &&
                                (isLocationListCollapsed
                                    ? 'hidden @lg:hidden'
                                    : 'hidden @lg:flex'),
                            isLocationListCollapsed && '@lg:hidden',
                        )}
                        aria-label="Synchronized mapped location list"
                    >
                        <div className="space-y-2 border-b border-line bg-surface p-3.5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-ink">
                                        Asset locations
                                    </h3>
                                    <p className="text-xs text-ink-soft">
                                        {filteredMappedLocations.length} mapped
                                        ·{' '}
                                        {Math.max(
                                            0,
                                            filteredLocations.length -
                                                filteredMappedLocations.length,
                                        )}{' '}
                                        without coordinates
                                    </p>
                                </div>
                                {!isLocationListCollapsed && (
                                    <Button
                                        type="button"
                                        variant="quiet"
                                        size="icon"
                                        className="hidden h-9 w-9 shrink-0 @lg:inline-flex"
                                        onClick={() =>
                                            setIsLocationListCollapsed(true)
                                        }
                                        aria-label="Hide asset list"
                                        aria-controls={locationListId}
                                        aria-expanded={true}
                                        title="Hide asset list"
                                    >
                                        <ChevronLeft
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                )}
                            </div>
                            {!compact && (
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
                                        placeholder="Search asset code, name, or operator…"
                                        aria-label="Search mapped locations"
                                        className="min-h-[44px] w-full rounded-lg border border-line bg-surface-subtle py-2 pr-3 pl-10 text-sm text-ink placeholder:text-ink-soft focus:border-brand-strong focus:outline-none"
                                    />
                                </div>
                            )}
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
                                    const isMapped =
                                        hasLocationCoordinates(location);
                                    const isSelected =
                                        location.id === selectedId;
                                    const category = classifyFleetAsset(
                                        location.asset!,
                                    );
                                    const operationalStatus =
                                        location.asset?.status_label ??
                                        location.asset?.status ??
                                        'Operational status unavailable';
                                    const freshnessLabel =
                                        getFleetLocationFreshnessLabel(
                                            location,
                                        );
                                    const freshnessTone =
                                        location.freshness_status === 'fresh'
                                            ? 'text-success-strong'
                                            : isMapped
                                              ? 'text-warning-strong'
                                              : 'text-ink-soft';

                                    return (
                                        <button
                                            key={location.id}
                                            type="button"
                                            onClick={() =>
                                                selectLocation(location.id)
                                            }
                                            aria-pressed={isSelected}
                                            className={cn(
                                                'group relative w-full border-l px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-inset',
                                                isSelected
                                                    ? 'border-brand-strong bg-brand-soft/55 text-ink'
                                                    : 'border-transparent text-ink-soft hover:bg-surface-subtle',
                                                !isMapped &&
                                                    !isSelected &&
                                                    'bg-surface-subtle/50',
                                            )}
                                        >
                                            <div className="flex min-w-0 items-start gap-3">
                                                <span
                                                    className={cn(
                                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-surface-subtle text-ink-soft',
                                                        isSelected
                                                            ? 'border-brand-strong/35 bg-brand-soft text-brand-strong'
                                                            : 'border-line',
                                                    )}
                                                >
                                                    <span className="flex items-center justify-center">
                                                        <FleetAssetCategoryIcon
                                                            category={category}
                                                            className="h-4 w-4"
                                                        />
                                                    </span>
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                    <div className="min-w-0">
                                                        <div className="min-w-0">
                                                            <span className="block truncate text-sm font-semibold text-ink">
                                                                {location.asset
                                                                    ?.code ??
                                                                    location
                                                                        .asset
                                                                        ?.name ??
                                                                    'Asset'}
                                                            </span>
                                                            <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-ink-soft">
                                                                {location.asset
                                                                    ?.name ??
                                                                    FLEET_ASSET_CATEGORY_LABELS[
                                                                        category
                                                                    ]}
                                                            </span>
                                                            <span className="text-ink-muted mt-1 block text-[11px] font-medium">
                                                                {
                                                                    FLEET_ASSET_CATEGORY_LABELS[
                                                                        category
                                                                    ]
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                        <span className="inline-flex min-w-0 items-center gap-1.5 text-ink">
                                                            <span
                                                                className="bg-ink-muted h-1.5 w-1.5 shrink-0 rounded-full"
                                                                aria-hidden="true"
                                                            />
                                                            <span className="truncate">
                                                                <span className="text-ink-soft">
                                                                    Operational
                                                                </span>{' '}
                                                                {
                                                                    operationalStatus
                                                                }
                                                            </span>
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                'inline-flex min-w-0 items-center gap-1.5',
                                                                freshnessTone,
                                                            )}
                                                        >
                                                            <span
                                                                className={cn(
                                                                    'h-1.5 w-1.5 shrink-0 rounded-full',
                                                                    location.freshness_status ===
                                                                        'fresh'
                                                                        ? 'bg-success-strong'
                                                                        : isMapped
                                                                          ? 'bg-warning-strong'
                                                                          : 'bg-ink-muted',
                                                                )}
                                                                aria-hidden="true"
                                                            />
                                                            <span className="truncate">
                                                                <span className="text-ink-soft">
                                                                    GPS
                                                                </span>{' '}
                                                                {freshnessLabel}
                                                            </span>
                                                        </span>
                                                    </div>

                                                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
                                                        <span>
                                                            Reported{' '}
                                                            {formatReportAge(
                                                                location.received_at ??
                                                                    location.captured_at,
                                                            )}
                                                        </span>
                                                        {location.user
                                                            ?.name && (
                                                            <>
                                                                <span aria-hidden="true">
                                                                    ·
                                                                </span>
                                                                <span className="min-w-0 truncate">
                                                                    Operator:{' '}
                                                                    {
                                                                        location
                                                                            .user
                                                                            .name
                                                                    }
                                                                    {location.reported_via_phone && (
                                                                        <span className="text-ink-muted ml-1">
                                                                            (via
                                                                            phone)
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-2.5 min-w-0 border-t border-line/70 pt-2 text-xs text-ink-soft">
                                                <PreciseLocationDisplay
                                                    location={location}
                                                    isMapped={isMapped}
                                                />
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}

function TrackingMapContent({
    locations,
    sosLocations,
    activeSosIncidents,
    selected,
    onSelect,
}: {
    locations: LocationUpdateViewModel[];
    sosLocations: LocationUpdateViewModel[];
    activeSosIncidents: SosIncidentViewModel[];
    selected?: LocationUpdateViewModel;
    onSelect: (id: number) => void;
}) {
    const { map, maplibregl, prefersReducedMotion, cameraWasRestored } =
        useMapLibre();
    const markersRef = useRef<MapLibreMarker[]>([]);
    const accuracySourceRef = useRef<GeoJSONSource | null>(null);
    const overviewSourceRef = useRef<GeoJSONSource | null>(null);
    const previousSelectedAssetKeyRef = useRef<string | number | null>(null);
    const hasInitializedSelectionRef = useRef(false);
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
        const markerElement = createWarehouseMarker({
            label: FOCHUN_WAREHOUSE.label,
            address: FOCHUN_WAREHOUSE.address,
        });
        let popup: InstanceType<typeof maplibregl.Popup> | undefined;
        const openPopup = () => {
            popup?.remove();
            popup = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: true,
                offset: 28,
                maxWidth: '320px',
            }).setDOMContent(
                createPopupCard({
                    title: FOCHUN_WAREHOUSE.label,
                    subtitle: 'Fochun Industrial Compound',
                    status: 'Reference location',
                    statusTone: 'info',
                    fields: [
                        { label: 'Type', value: 'Yard and warehouse' },
                        { label: 'Address', value: FOCHUN_WAREHOUSE.address },
                    ],
                    locationName: FOCHUN_WAREHOUSE.address,
                    coordinateText: `${FOCHUN_WAREHOUSE.position[1].toFixed(5)}, ${FOCHUN_WAREHOUSE.position[0].toFixed(5)}`,
                    onCopyCoordinates: (button) => {
                        void navigator.clipboard?.writeText(
                            `${FOCHUN_WAREHOUSE.position[1]}, ${FOCHUN_WAREHOUSE.position[0]}`,
                        );
                        button.textContent = 'Copied';
                    },
                }),
            );
            popup.setLngLat(FOCHUN_WAREHOUSE.position).addTo(map);
        };

        markerElement.addEventListener('click', openPopup);

        const marker = new maplibregl.Marker({
            element: markerElement,
            anchor: 'bottom',
        })
            .setLngLat(FOCHUN_WAREHOUSE.position)
            .addTo(map);

        return () => {
            markerElement.removeEventListener('click', openPopup);
            popup?.remove();
            marker.remove();
        };
    }, [map, maplibregl]);

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
                    '#806000',
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
        const incidentsByWorker = new Map(
            activeSosIncidents.map((incident) => [
                incident.worker.id,
                incident,
            ]),
        );
        const locationsByWorker = new Map(
            sosLocations.map((location) => [location.user.id, location]),
        );
        const locationsByAsset = new Map(
            sosLocations
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
                const label = trackingUnitLabel(location);
                const category = classifyFleetAsset(location.asset!);
                const categoryLabel = FLEET_ASSET_CATEGORY_LABELS[category];
                entries.push({
                    key: `location:${location.id}`,
                    locationId: location.id,
                    position: toLngLat(location),
                    label,
                    description: `${categoryLabel} · ${location.freshness_status} · Received ${formatReportAge(location.received_at)}`,
                    content: () =>
                        createTrackingLocationPopup(location, incident),
                    element: () =>
                        createAssetMarker({
                            category,
                            freshness: location.freshness_status,
                            isSelected: false,
                            label: `${label}, ${categoryLabel}, ${location.freshness_status} location`,
                        }),
                });
            }
        }

        for (const incident of activeSosIncidents) {
            const location = locationsByWorker.get(incident.worker.id);
            const assetLocation = incident.asset?.id
                ? locationsByAsset.get(incident.asset.id)
                : undefined;

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
                content: () => createTrackingSosPopup(incident),
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
                            description: `${FLEET_ASSET_CATEGORY_LABELS[classifyFleetAsset(location.asset!)]} · ${location.freshness_status} · Received ${formatReportAge(location.received_at)}`,
                            hasSos: Boolean(incident),
                            onSelect: () => {
                                popupGeneration += 1;
                                popup.setDOMContent(
                                    createTrackingLocationPopup(
                                        location,
                                        incident,
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
                                description: `${FLEET_ASSET_CATEGORY_LABELS[classifyFleetAsset(location.asset!)]} · ${location.freshness_status} · Received ${formatReportAge(location.received_at)}`,
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
        onSelect,
        sosLocations,
    ]);
    useEffect(() => {
        if (!selected) {
            previousSelectedAssetKeyRef.current = null;

            return;
        }

        const selectedAssetKey =
            selected.asset?.id ?? `location:${selected.id}`;
        const selectedAssetChanged =
            previousSelectedAssetKeyRef.current !== selectedAssetKey;
        const shouldCenter =
            (!hasInitializedSelectionRef.current && !cameraWasRestored) ||
            (hasInitializedSelectionRef.current && selectedAssetChanged);
        previousSelectedAssetKeyRef.current = selectedAssetKey;
        hasInitializedSelectionRef.current = true;

        if (!shouldCenter) {
            return;
        }

        map.easeTo({
            center: toLngLat(selected),
            zoom: 13,
            duration: prefersReducedMotion ? 0 : 350,
        });
    }, [cameraWasRestored, map, prefersReducedMotion, selected]);

    return null;
}

type MapActions = {
    fitAll: () => void;
};

function MapActionBridge({
    mappedLocations,
    sosLocations,
    activeSosIncidents,
    actionsRef,
    onReady,
}: {
    mappedLocations: LocationUpdateViewModel[];
    sosLocations: LocationUpdateViewModel[];
    activeSosIncidents: SosIncidentViewModel[];
    actionsRef: MutableRefObject<MapActions | null>;
    onReady: (ready: boolean) => void;
}) {
    const { map, maplibregl, prefersReducedMotion } = useMapLibre();

    const fitAll = useCallback(() => {
        const positions = [
            FOCHUN_WAREHOUSE.position,
            ...mappedLocations.map(toLngLat),
            ...activeSosIncidents.flatMap((incident) => {
                const position = getSosMarkerPosition(
                    incident,
                    sosLocations.find(
                        (location) => location.user.id === incident.worker.id,
                    ),
                    incident.asset?.id
                        ? sosLocations.find(
                              (location) =>
                                  location.asset?.id === incident.asset?.id,
                          )
                        : undefined,
                );

                return position ? [position] : [];
            }),
        ];

        if (positions.length === 1) {
            map.easeTo({
                center: positions[0],
                zoom: 13,
                duration: prefersReducedMotion ? 0 : 350,
            });

            return;
        }

        const bounds = new maplibregl.LngLatBounds();
        positions.forEach((position) => bounds.extend(position));
        map.fitBounds(bounds, {
            padding: 40,
            maxZoom: 15,
            duration: prefersReducedMotion ? 0 : 350,
        });
    }, [
        activeSosIncidents,
        map,
        maplibregl,
        mappedLocations,
        prefersReducedMotion,
        sosLocations,
    ]);

    useEffect(() => {
        actionsRef.current = { fitAll };
        onReady(true);

        return () => {
            actionsRef.current = null;
            onReady(false);
        };
    }, [actionsRef, fitAll, onReady]);

    return null;
}

function LiveMapControls({
    compact,
    activeSosIncidents,
    mappedLocations,
    sosLocations,
    mapCenter,
    styleVariant,
    onStyleVariantChange,
    isFullscreen,
    onToggleFullscreen,
}: {
    compact: boolean;
    activeSosIncidents: SosIncidentViewModel[];
    mappedLocations: LocationUpdateViewModel[];
    sosLocations: LocationUpdateViewModel[];
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
            FOCHUN_WAREHOUSE.position,
            ...mappedLocations.map(toLngLat),
            ...activeSosIncidents.flatMap((incident) => {
                const position = getSosMarkerPosition(
                    incident,
                    sosLocations.find(
                        (location) => location.user.id === incident.worker.id,
                    ),
                    incident.asset?.id
                        ? sosLocations.find(
                              (location) =>
                                  location.asset?.id === incident.asset?.id,
                          )
                        : undefined,
                );

                return position ? [position] : [];
            }),
        ];

        if (positions.length === 1) {
            map.easeTo({
                center: positions[0],
                zoom: 13,
                duration: prefersReducedMotion ? 0 : 350,
            });

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
            <MapZoomControls
                onZoomIn={() =>
                    map.zoomIn({ duration: prefersReducedMotion ? 0 : 200 })
                }
                onZoomOut={() =>
                    map.zoomOut({ duration: prefersReducedMotion ? 0 : 200 })
                }
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

function MapZoomControls({
    onZoomIn,
    onZoomOut,
}: {
    onZoomIn: () => void;
    onZoomOut: () => void;
}) {
    return (
        <div className="absolute top-3 left-3 z-[3] flex flex-col overflow-hidden rounded-lg border border-line bg-surface/95 shadow-sm backdrop-blur-md">
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
    );
}

function CompactMapToolbar({
    searchQuery,
    onSearchQueryChange,
    onFitAll,
    fitAllDisabled,
    isFullscreen,
    onToggleFullscreen,
    styleVariant,
    onStyleVariantChange,
    mobileView,
    onMobileViewChange,
    showLocationList,
    onCollapse,
    onSectionChange,
}: {
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    onFitAll: () => void;
    fitAllDisabled: boolean;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    styleVariant: MapStyleVariant;
    onStyleVariantChange: (variant: MapStyleVariant) => void;
    mobileView: 'map' | 'list';
    onMobileViewChange: (view: 'map' | 'list') => void;
    showLocationList: boolean;
    onCollapse?: () => void;
    onSectionChange?: (section: 'tracking') => void;
}) {
    const menuId = `fleet-map-options-${useId().replace(/:/g, '')}`;
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMapKeyOpen, setIsMapKeyOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (!isMenuOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                !menuRef.current?.contains(event.target) &&
                !triggerRef.current?.contains(event.target)
            ) {
                setIsMenuOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setIsMenuOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMenuOpen]);

    return (
        <div className="shrink-0 space-y-2 border-b border-line bg-surface p-2.5">
            <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[min(100%,14rem)] flex-1">
                    <span className="sr-only">Search fleet map</span>
                    <Search
                        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) =>
                            onSearchQueryChange(event.target.value)
                        }
                        placeholder="Search asset code, name, or operator…"
                        className="h-10 w-full rounded-lg border border-line bg-surface-subtle py-2 pr-3 pl-9 text-sm text-ink placeholder:text-ink-soft focus:border-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong/30"
                    />
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-10 px-2.5 text-xs"
                        onClick={onFitAll}
                        disabled={fitAllDisabled}
                        aria-label="Fit all assets and yard"
                    >
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Fit all
                    </Button>
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-10 w-10"
                        aria-label={
                            isFullscreen
                                ? 'Exit fullscreen'
                                : 'Expand map fullscreen'
                        }
                        title={
                            isFullscreen
                                ? 'Exit fullscreen'
                                : 'Expand fullscreen'
                        }
                        onClick={onToggleFullscreen}
                    >
                        {isFullscreen ? (
                            <Minimize className="h-4 w-4" aria-hidden="true" />
                        ) : (
                            <Maximize className="h-4 w-4" aria-hidden="true" />
                        )}
                    </Button>
                    <Button
                        ref={triggerRef}
                        variant="secondary"
                        size="sm"
                        className="min-h-10 px-2.5 text-xs"
                        aria-haspopup="menu"
                        aria-controls={menuId}
                        aria-expanded={isMenuOpen}
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
                                        window.innerHeight - 260,
                                    ),
                                });
                            }

                            setIsMenuOpen((value) => !value);
                        }}
                    >
                        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                        Map options
                    </Button>
                    {onCollapse && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="min-h-10 px-2.5 text-xs"
                            onClick={onCollapse}
                            aria-label="Collapse fleet map"
                        >
                            <ChevronUp
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                            Collapse
                        </Button>
                    )}
                </div>
            </div>

            {showLocationList && (
                <div
                    className="flex w-full gap-1 rounded-lg bg-surface-subtle p-1 @lg:hidden"
                    role="group"
                    aria-label="Fleet map view"
                >
                    {(['map', 'list'] as const).map((view) => (
                        <button
                            key={view}
                            type="button"
                            aria-pressed={mobileView === view}
                            onClick={() => onMobileViewChange(view)}
                            className={cn(
                                'min-h-9 flex-1 rounded-md px-3 text-xs font-semibold capitalize transition-colors focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none',
                                mobileView === view
                                    ? 'bg-surface text-ink shadow-sm'
                                    : 'text-ink-soft hover:text-ink',
                            )}
                        >
                            {view}
                        </button>
                    ))}
                </div>
            )}

            {isMenuOpen && (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label="Map options"
                    className="fixed z-50 m-0 w-48 rounded-lg border border-line bg-surface p-1 text-ink shadow-lg"
                    style={menuPosition}
                >
                    <p className="px-3 py-2 text-xs font-medium text-ink-soft">
                        Basemap
                    </p>
                    <button
                        type="button"
                        role="menuitem"
                        className="flex min-h-11 w-full items-center gap-2 rounded-md border-b border-line px-3 text-left text-sm hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-brand-strong"
                        onClick={() => {
                            setIsMenuOpen(false);
                            setIsMapKeyOpen((value) => !value);
                            triggerRef.current?.focus();
                        }}
                    >
                        Map key
                    </button>
                    {(['light', 'dark'] as const).map((variant) => (
                        <button
                            key={variant}
                            type="button"
                            role="menuitemradio"
                            aria-checked={variant === styleVariant}
                            className="flex min-h-11 w-full items-center justify-between rounded-md px-3 text-left text-sm capitalize hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-brand-strong"
                            onClick={() => {
                                setIsMenuOpen(false);
                                triggerRef.current?.focus();
                                onStyleVariantChange(variant);
                            }}
                        >
                            {variant}
                            {styleVariant === variant && (
                                <Check className="h-4 w-4" aria-hidden="true" />
                            )}
                        </button>
                    ))}
                    {onSectionChange && (
                        <button
                            type="button"
                            role="menuitem"
                            className="flex min-h-11 w-full items-center gap-2 rounded-md border-t border-line px-3 text-left text-sm hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-brand-strong"
                            onClick={() => {
                                setIsMenuOpen(false);
                                triggerRef.current?.focus();
                                onSectionChange('tracking');
                            }}
                        >
                            Open operations tracking
                        </button>
                    )}
                </div>
            )}
            {isMapKeyOpen && (
                <div
                    role="region"
                    aria-label="Map key"
                    className="absolute top-full right-2 z-40 mt-2 w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-line bg-surface p-3 text-xs text-ink shadow-lg"
                >
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="font-semibold">Map key</h3>
                        <button
                            type="button"
                            className="min-h-8 rounded-md px-2 text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-strong"
                            onClick={() => setIsMapKeyOpen(false)}
                        >
                            Close
                        </button>
                    </div>
                    <MapKeyContent />
                </div>
            )}
        </div>
    );
}

function MapLegend() {
    return (
        <div
            role="region"
            aria-label="Map key"
            className="absolute bottom-3 left-3 z-[2] max-w-[calc(100%-1.5rem)] rounded-xl border border-line/70 bg-surface/95 px-3 py-2 text-[11px] text-ink shadow-sm backdrop-blur-md"
        >
            <MapKeyContent />
        </div>
    );
}

function MapKeyContent() {
    const categories = Object.keys(
        FLEET_ASSET_CATEGORY_LABELS,
    ) as FleetAssetCategory[];

    return (
        <div
            className="space-y-2"
            role="group"
            aria-label="Asset categories and map states"
        >
            <div className="flex flex-wrap gap-x-3 gap-y-2">
                {categories.map((category) => (
                    <span
                        key={category}
                        className="inline-flex items-center gap-1.5 font-medium"
                    >
                        <FleetAssetCategoryIcon
                            category={category}
                            className="h-3.5 w-3.5 text-ink-soft"
                        />
                        {FLEET_ASSET_CATEGORY_LABELS[category]}
                    </span>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-2 text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="h-3 w-3 rounded-full border-2 border-success-strong"
                        aria-hidden="true"
                    />
                    GPS current
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="h-3 w-3 rounded-full border-2 border-warning-strong"
                        aria-hidden="true"
                    />
                    Delayed
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="border-ink-muted h-3 w-3 rounded-full border-2 border-dashed"
                        aria-hidden="true"
                    />
                    Stale / offline
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="h-3 w-3 rounded-full border-2 border-brand-strong"
                        aria-hidden="true"
                    />
                    Selected
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle
                        className="h-3.5 w-3.5 text-danger-strong"
                        aria-hidden="true"
                    />
                    SOS
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <MapPin
                        className="h-3.5 w-3.5 text-brand-strong"
                        aria-hidden="true"
                    />
                    Yard / warehouse
                </span>
            </div>
        </div>
    );
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

function averageSosPosition(
    incidents: SosIncidentViewModel[],
    locations: LocationUpdateViewModel[] = [],
): LngLat {
    const coordinates = incidents.flatMap((incident) => {
        const location = locations.find(
            (candidate) => candidate.user.id === incident.worker.id,
        );
        const assetLocation = incident.asset?.id
            ? locations.find(
                  (candidate) => candidate.asset?.id === incident.asset?.id,
              )
            : undefined;
        const position = getSosMarkerPosition(
            incident,
            location,
            assetLocation,
        );

        return position ? [position] : [];
    });

    if (coordinates.length === 0) {
        return FOCHUN_WAREHOUSE.position;
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
    delayed: '#806000',
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
