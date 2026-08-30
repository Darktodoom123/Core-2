import {
    Check,
    Construction,
    Layers,
    LocateFixed,
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
import type { GeoJSONSource, Marker as MapLibreMarker } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, StatusBadge } from '@/components/ui';
import { deriveWeatherFromCoords } from '@/components/weather/weather-safety-telemetry';
import {
    getAssetKind,
    getAssetKindLabel,
    resolveLocationName,
} from '@/lib/asset-kind';
import { cn } from '@/lib/utils';
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
import {
    createAssetMarker,
    createPopupCard,
    createSosMarker,
    getSosMarkerPosition,
} from './maplibre/markers';
import type { PopupCardField } from './maplibre/markers';

export type { AssetKind } from '@/lib/asset-kind';
export {
    getAssetKind,
    getAssetKindLabel,
    resolveLocationName,
} from '@/lib/asset-kind';

const DEFAULT_CENTER: LngLat = [121.04, 14.64];
const DEFAULT_ZOOM = 11;
const HTML_MARKER_THRESHOLD = 250;
const EMPTY_SOS_INCIDENTS: SosIncidentViewModel[] = [];

export function LiveTrackingMap({
    locations,
    activeSosIncidents = EMPTY_SOS_INCIDENTS,
    compact = false,
    showLocationList = true,
    selectedLocationId,
    onSelectedLocationChange,
}: {
    locations: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    compact?: boolean;
    showLocationList?: boolean;
    selectedLocationId?: number | null;
    onSelectedLocationChange?: (id: number) => void;
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
            ).filter((element) => !element.hasAttribute('disabled'));

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
    const selectedId = selectedLocationId ?? internalSelectedId;
    const selected =
        (selectedId === null
            ? undefined
            : locations.find((location) => location.id === selectedId)) ??
        mappedLocations[0];

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

                <MapLegend />
                <div className="pointer-events-none absolute top-3 right-3 z-[2] flex items-center gap-2 rounded-lg border border-line/60 bg-surface/90 px-3 py-1.5 text-xs text-ink-soft shadow-sm backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-success-strong" />
                    <span>
                        {provider.isDevelopmentOnly
                            ? 'Stadia Maps · development/evaluation'
                            : `${provider.provider} basemap`}{' '}
                        · {mappedLocations.length} mapped markers
                    </span>
                </div>

                {mappedLocations.length === 0 && (
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
                                            <div className="mt-2.5 flex items-center justify-between gap-3 font-mono text-xs text-ink-soft">
                                                <span>
                                                    {isMapped
                                                        ? `${location.latitude?.toFixed(5)}, ${location.longitude?.toFixed(5)}`
                                                        : 'Coordinates unavailable'}
                                                </span>
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
                    }),
                ),
            ),
        [locations],
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
        });
        map.addLayer({
            id: 'tracking-marker-overview',
            type: 'circle',
            source: 'tracking-marker-overview',
            paint: {
                'circle-color': ['get', 'color'],
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8,
                    5,
                    14,
                    9,
                ],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-opacity': 0.9,
            },
            layout: { visibility: 'none' },
        });
        overviewSourceRef.current = map.getSource(
            'tracking-marker-overview',
        ) as GeoJSONSource;
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
        }
    }, [locations.length, map, overviewData]);

    useEffect(() => {
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        const matchedSosIncidentIds = new Set(
            activeSosIncidents
                .filter((incident) =>
                    locations.some(
                        (location) => location.user.id === incident.worker.id,
                    ),
                )
                .map((incident) => incident.id),
        );
        const shouldUseHtmlMarkers = locations.length <= HTML_MARKER_THRESHOLD;

        if (shouldUseHtmlMarkers) {
            locations.forEach((location) => {
                const kind = getAssetKind(location);
                const isSelected = location.id === selected?.id;
                const sosIncident = findSosIncidentForLocation(
                    location,
                    activeSosIncidents,
                );

                const markerElement = createAssetMarker({
                    kind,
                    freshness: location.freshness_status,
                    isSelected,
                    label: `${location.user.name}, ${location.freshness_status} location`,
                    sos: sosIncident
                        ? {
                              status: sosIncident.status.value,
                              label: `SOS incident for ${sosIncident.worker.name} (${sosIncident.status.label})`,
                              prefersReducedMotion,
                          }
                        : undefined,
                });
                markerElement.addEventListener('click', () => {
                    onSelect(location.id);

                    map.easeTo({
                        center: toLngLat(location),
                        offset: [0, -60],
                        duration: 250,
                    });
                });

                const hasAsset = Boolean(location.asset?.code);
                const title = hasAsset
                    ? location.asset?.name &&
                      location.asset.name.toLowerCase() !==
                          location.asset.code.toLowerCase()
                        ? `${location.asset.code} · ${location.asset.name}`
                        : (location.asset?.code ?? location.user.name)
                    : location.user.name;

                const subtitle = hasAsset
                    ? getAssetKindLabel(kind)
                    : 'Field Personnel';
                const freshness = getFreshnessMeta(location.freshness_status);

                const fields: PopupCardField[] = [
                    {
                        label: 'Personnel',
                        value: location.user.name,
                    },
                    {
                        label: 'Dispatch',
                        value: location.job
                            ? `${location.job.reference} — ${location.job.title}`
                            : 'Standby / Unassigned',
                    },
                ];

                if (kind === 'tower_crane') {
                    const weather = deriveWeatherFromCoords(
                        location.latitude,
                        location.longitude,
                    );
                    const windSafetyLabel =
                        weather.safetyStatus === 'danger'
                            ? '🚨 Hold'
                            : weather.safetyStatus === 'caution'
                              ? '⚠️ Elevated'
                              : 'Safe';

                    fields.push({
                        label: 'Wind Speed',
                        value: `${weather.windSpeedKmh} km/h ${weather.windDirection} (${windSafetyLabel} · Gust ${weather.windGustKmh} km/h)`,
                    });
                    fields.push({
                        label: 'Weather',
                        value: `${weather.temperatureC}°C · ${weather.conditionLabel}`,
                    });
                } else {
                    fields.push({
                        label: 'Movement',
                        value:
                            location.speed !== null && location.speed > 0
                                ? `${location.speed.toFixed(1)} km/h`
                                : 'Stationary',
                    });
                }

                fields.push({
                    label: 'Captured',
                    value: location.captured_at
                        ? new Date(location.captured_at).toLocaleTimeString()
                        : 'N/A',
                });

                if (location.remarks) {
                    fields.push({
                        label: 'Note',
                        value: location.remarks,
                    });
                }

                const locationName = resolveLocationName(location);

                const popup = new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: true,
                    offset: 24,
                    maxWidth: '320px',
                }).setDOMContent(
                    createPopupCard({
                        title,
                        subtitle,
                        status: freshness.label,
                        statusTone: freshness.tone,
                        badge: sosIncident
                            ? `🚨 SOS: ${sosIncident.status.label} (${sosIncident.category.label})`
                            : undefined,
                        badgeTone: 'danger',
                        fields,
                        locationName,
                    }),
                );

                markersRef.current.push(
                    new maplibregl.Marker({ element: markerElement })
                        .setLngLat(toLngLat(location))
                        .setPopup(popup)
                        .addTo(map),
                );
            });
        }

        activeSosIncidents.forEach((incident) => {
            const liveLocation = locations.find(
                (location) => location.user.id === incident.worker.id,
            );
            const markerPosition = getSosMarkerPosition(incident, liveLocation);

            if (
                (shouldUseHtmlMarkers &&
                    matchedSosIncidentIds.has(incident.id)) ||
                markerPosition === null
            ) {
                return;
            }

            const markerElement = createSosMarker({
                status: incident.status.value,
                label: `SOS incident for ${incident.worker.name} (${incident.status.label})`,
                prefersReducedMotion,
            });
            markerElement.addEventListener('click', () => {
                if (liveLocation) {
                    onSelect(liveLocation.id);
                }

                map.easeTo({
                    center: markerPosition,
                    offset: [0, -60],
                    duration: 250,
                });
            });

            const sosLocationName = incident.location
                ? resolveLocationName({
                      latitude: incident.location.latitude,
                      longitude: incident.location.longitude,
                      job: incident.dispatch,
                      asset: incident.asset,
                  })
                : (incident.dispatch?.site ?? 'Incident Site');

            const popup = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: true,
                offset: 24,
                maxWidth: '320px',
            }).setDOMContent(
                createPopupCard({
                    title: incident.worker.name,
                    subtitle: 'Emergency SOS Alert',
                    status: incident.status.label,
                    statusTone: 'danger',
                    badge: '🚨 Urgent Attention Required',
                    badgeTone: 'danger',
                    fields: [
                        {
                            label: 'Category',
                            value: incident.category.label,
                        },
                        {
                            label: 'Dispatch',
                            value: incident.dispatch
                                ? `${incident.dispatch.reference} — ${incident.dispatch.title}`
                                : 'No dispatch context attached',
                        },
                        {
                            label: 'Triggered',
                            value:
                                incident.received_at ||
                                incident.device_activated_at
                                    ? new Date(
                                          incident.received_at ||
                                              incident.device_activated_at!,
                                      ).toLocaleTimeString()
                                    : 'N/A',
                        },
                    ],
                    locationName: sosLocationName,
                }),
            );

            markersRef.current.push(
                new maplibregl.Marker({ element: markerElement })
                    .setLngLat(markerPosition)
                    .setPopup(popup)
                    .addTo(map),
            );
        });

        return () => {
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
        selected?.id,
    ]);

    useEffect(() => {
        if (!selected) {
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
    mappedLocations,
    mapCenter,
    styleVariant,
    onStyleVariantChange,
    isFullscreen,
    onToggleFullscreen,
}: {
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
        if (mappedLocations.length === 0) {
            return;
        }

        const bounds = new maplibregl.LngLatBounds();
        mappedLocations.forEach((location) =>
            bounds.extend(toLngLat(location)),
        );
        map.fitBounds(bounds, {
            padding: 40,
            maxZoom: 15,
            duration: prefersReducedMotion ? 0 : 350,
        });
    };

    const controlClass =
        'h-11 min-h-[44px] w-11 min-w-[44px] rounded-lg text-ink transition-transform active:scale-95';

    return (
        <div className="absolute top-3 left-3 z-[3] flex flex-col gap-1.5">
            <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface/95 p-1 shadow-sm backdrop-blur-md">
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => map.zoomIn()}
                    aria-label="Zoom in"
                    title="Zoom in"
                    className={controlClass}
                >
                    <ZoomIn className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => map.zoomOut()}
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

function getFreshnessMeta(
    status: LocationUpdateViewModel['freshness_status'],
): {
    label: string;
    tone: 'success' | 'warning' | 'danger' | 'info';
} {
    switch (status) {
        case 'fresh':
            return { label: 'Live (≤2m)', tone: 'success' };
        case 'delayed':
            return { label: 'Delayed (2–10m)', tone: 'info' };
        case 'stale':
            return { label: 'Stale (10–30m)', tone: 'warning' };
        case 'offline':
        default:
            return { label: 'Offline', tone: 'danger' };
    }
}
