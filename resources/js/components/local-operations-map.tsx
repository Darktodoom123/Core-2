import {
    AlertTriangle,
    Construction,
    Layers3,
    LocateFixed,
    Route,
    Truck,
    UserRoundCog,
} from 'lucide-react';
import type { GeoJSONSource, Marker as MapLibreMarker } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TelemetryPoint } from '@/types/operations';
import {
    circleFeature,
    featureCollection,
    lineFeature,
} from './maplibre/geojson';
import type { LngLat } from './maplibre/geojson';
import { MapLibreMap, useMapLibre } from './maplibre/maplibre-map';
import { createAssetMarker, createPopupCard } from './maplibre/markers';

const DEFAULT_CENTER: LngLat = [121.04, 14.64];
const DEFAULT_ZOOM = 11;
const destinationCoordinates: Record<string, LngLat> = {
    'Balintawak Substation': [120.9847, 14.6572],
    'Marikina River Bridge': [121.1021, 14.6367],
    'North Yard': [121.0116, 14.6762],
};

export function LocalOperationsMap({
    points,
    selectedId,
    onSelect,
}: {
    points: TelemetryPoint[];
    selectedId: string;
    onSelect: (resourceId: string) => void;
}) {
    const [showRoutes, setShowRoutes] = useState(true);
    const [showGeofences, setShowGeofences] = useState(true);
    const selected = useMemo(
        () =>
            points.find((point) => point.resourceId === selectedId) ??
            points[0],
        [points, selectedId],
    );
    const routePositions = useMemo(
        () =>
            points
                .filter((point) => point.freshness !== 'Offline')
                .map(pointPosition),
        [points],
    );
    const geofenceCenters = useMemo(
        () =>
            Array.from(new Set(points.map((point) => point.destination))).map(
                (destination) => ({
                    destination,
                    position:
                        destinationCoordinates[destination] ?? DEFAULT_CENTER,
                }),
            ),
        [points],
    );

    return (
        <div className="grid min-h-[34rem] grid-cols-1 border-t border-line xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="relative min-h-[28rem] overflow-hidden bg-surface-subtle">
                <MapLibreMap
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    ariaLabel="Interactive prototype operations map showing simulated resources, routes, and job-site geofences"
                >
                    <OperationsMapContent
                        points={points}
                        selected={selected}
                        routePositions={routePositions}
                        geofenceCenters={geofenceCenters}
                        showRoutes={showRoutes}
                        showGeofences={showGeofences}
                        onSelect={onSelect}
                    />
                    <OperationsMapControls
                        showRoutes={showRoutes}
                        showGeofences={showGeofences}
                        onToggleRoutes={() => setShowRoutes((value) => !value)}
                        onToggleGeofences={() =>
                            setShowGeofences((value) => !value)
                        }
                    />
                </MapLibreMap>

                <div className="pointer-events-none absolute right-3 bottom-3 z-[2] rounded-lg border border-line/60 bg-surface/90 p-2.5 text-xs text-ink-soft shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <Construction
                            className="h-4 w-4 text-brand-strong"
                            aria-hidden="true"
                        />
                        Stadia Maps · development/evaluation · prototype
                        telemetry
                    </div>
                </div>
            </div>

            <aside
                className="max-h-[38rem] overflow-y-auto border-t border-line bg-surface xl:border-t-0 xl:border-l"
                aria-label="Prototype live asset list"
            >
                <div className="sticky top-0 z-10 border-b border-line bg-surface px-4 py-3">
                    <h3 className="font-semibold text-ink">
                        Tracked resources
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-soft">
                        {
                            points.filter((point) => point.freshness === 'Live')
                                .length
                        }{' '}
                        live · {points.length} total
                    </p>
                </div>
                <ul className="divide-y divide-line">
                    {points.map((point) => {
                        const Icon =
                            point.kind === 'truck'
                                ? Truck
                                : point.kind === 'crane'
                                  ? Construction
                                  : UserRoundCog;
                        const isSelected =
                            selected?.resourceId === point.resourceId;

                        return (
                            <li key={point.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(point.resourceId)}
                                    className={cn(
                                        'min-h-[44px] w-full px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-inset',
                                        isSelected &&
                                            'bg-brand-soft/80 font-medium text-ink ring-1 ring-brand-strong/20',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5">
                                            <span
                                                className={cn(
                                                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-xs font-semibold text-white shadow-xs',
                                                    point.kind === 'truck'
                                                        ? 'rounded-lg bg-success-strong'
                                                        : point.kind === 'crane'
                                                          ? 'rotate-45 rounded-md bg-success-strong'
                                                          : 'rounded-full bg-success-strong',
                                                )}
                                            >
                                                <Icon
                                                    className={cn(
                                                        'h-3.5 w-3.5',
                                                        point.kind ===
                                                            'crane' &&
                                                            '-rotate-45',
                                                    )}
                                                    aria-hidden="true"
                                                />
                                            </span>
                                            <span>
                                                <span className="block text-sm font-semibold text-ink">
                                                    {point.label}
                                                </span>
                                                <span className="mt-0.5 block text-xs text-ink-soft">
                                                    {point.destination}
                                                </span>
                                            </span>
                                        </div>
                                        <StatusBadge status={point.freshness} />
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-soft">
                                        <span>{point.eta}</span>
                                        <span>Updated {point.updatedAt}</span>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <div className="m-4 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning-strong">
                    <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                    />
                    Stale and offline signals remain visible so dispatchers can
                    distinguish missing data from inactive assets.
                </div>
            </aside>
        </div>
    );
}

function OperationsMapContent({
    points,
    selected,
    routePositions,
    geofenceCenters,
    showRoutes,
    showGeofences,
    onSelect,
}: {
    points: TelemetryPoint[];
    selected?: TelemetryPoint;
    routePositions: LngLat[];
    geofenceCenters: { destination: string; position: LngLat }[];
    showRoutes: boolean;
    showGeofences: boolean;
    onSelect: (resourceId: string) => void;
}) {
    const { map, maplibregl, prefersReducedMotion } = useMapLibre();
    const markersRef = useRef<MapLibreMarker[]>([]);
    const routeSourceRef = useRef<GeoJSONSource | null>(null);
    const geofenceSourceRef = useRef<GeoJSONSource | null>(null);

    const routeData = useMemo(
        () =>
            featureCollection(
                routePositions.length > 1 ? [lineFeature(routePositions)] : [],
            ),
        [routePositions],
    );
    const geofenceData = useMemo(
        () =>
            featureCollection(
                geofenceCenters.map(({ destination, position }) =>
                    circleFeature(position, 350, { destination }),
                ),
            ),
        [geofenceCenters],
    );

    useEffect(() => {
        map.addSource('operations-route', { type: 'geojson', data: routeData });
        map.addLayer({
            id: 'operations-route-line',
            type: 'line',
            source: 'operations-route',
            paint: {
                'line-color': '#b45309',
                'line-dasharray': [3, 2],
                'line-width': 4,
            },
            layout: { visibility: showRoutes ? 'visible' : 'none' },
        });
        routeSourceRef.current = map.getSource(
            'operations-route',
        ) as GeoJSONSource;

        map.addSource('operations-geofences', {
            type: 'geojson',
            data: geofenceData,
        });
        map.addLayer({
            id: 'operations-geofence-fill',
            type: 'fill',
            source: 'operations-geofences',
            paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.08 },
            layout: { visibility: showGeofences ? 'visible' : 'none' },
        });
        map.addLayer({
            id: 'operations-geofence-outline',
            type: 'line',
            source: 'operations-geofences',
            paint: {
                'line-color': '#2563eb',
                'line-opacity': 0.7,
                'line-width': 1.5,
            },
            layout: { visibility: showGeofences ? 'visible' : 'none' },
        });
        geofenceSourceRef.current = map.getSource(
            'operations-geofences',
        ) as GeoJSONSource;

        return () => {
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];
            [
                'operations-geofence-outline',
                'operations-geofence-fill',
                'operations-route-line',
            ].forEach((layer) => {
                if (map.getLayer(layer)) {
                    map.removeLayer(layer);
                }
            });
            ['operations-geofences', 'operations-route'].forEach((source) => {
                if (map.getSource(source)) {
                    map.removeSource(source);
                }
            });
        };
        // Sources are created once for each map instance; updates are handled below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        routeSourceRef.current?.setData(routeData);
    }, [routeData]);

    useEffect(() => {
        geofenceSourceRef.current?.setData(geofenceData);
    }, [geofenceData]);

    useEffect(() => {
        if (map.getLayer('operations-route-line')) {
            map.setLayoutProperty(
                'operations-route-line',
                'visibility',
                showRoutes ? 'visible' : 'none',
            );
        }
    }, [map, showRoutes]);

    useEffect(() => {
        ['operations-geofence-fill', 'operations-geofence-outline'].forEach(
            (layer) => {
                if (map.getLayer(layer)) {
                    map.setLayoutProperty(
                        layer,
                        'visibility',
                        showGeofences ? 'visible' : 'none',
                    );
                }
            },
        );
    }, [map, showGeofences]);

    useEffect(() => {
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        points.forEach((point) => {
            const kind = point.kind === 'technician' ? 'personnel' : point.kind;
            const markerElement = createAssetMarker({
                kind,
                freshness: point.freshness,
                isSelected: selected?.resourceId === point.resourceId,
                label: `${point.label}, ${point.freshness} telemetry`,
            });
            markerElement.addEventListener('click', () =>
                onSelect(point.resourceId),
            );
            const popup = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: true,
                offset: 24,
            }).setDOMContent(
                createPopupCard({
                    title: point.label,
                    subtitle: point.destination,
                    status: point.freshness,
                    details: [`Updated ${point.updatedAt}`, point.eta],
                }),
            );
            markersRef.current.push(
                new maplibregl.Marker({ element: markerElement })
                    .setLngLat(pointPosition(point))
                    .setPopup(popup)
                    .addTo(map),
            );
        });

        return () => {
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];
        };
    }, [map, maplibregl, onSelect, points, selected?.resourceId]);

    useEffect(() => {
        if (!selected) {
            return;
        }

        map.easeTo({
            center: pointPosition(selected),
            zoom: 13,
            duration: prefersReducedMotion ? 0 : 350,
        });
    }, [map, prefersReducedMotion, selected]);

    return null;
}

function OperationsMapControls({
    showRoutes,
    showGeofences,
    onToggleRoutes,
    onToggleGeofences,
}: {
    showRoutes: boolean;
    showGeofences: boolean;
    onToggleRoutes: () => void;
    onToggleGeofences: () => void;
}) {
    const { map, prefersReducedMotion } = useMapLibre();
    const controlClass =
        'h-11 min-h-[44px] w-11 min-w-[44px] rounded-lg text-ink';

    return (
        <div className="absolute top-3 left-3 z-[3] flex flex-col gap-2">
            <Button
                size="icon"
                variant="secondary"
                onClick={() =>
                    map.easeTo({
                        center: DEFAULT_CENTER,
                        zoom: DEFAULT_ZOOM,
                        duration: prefersReducedMotion ? 0 : 350,
                    })
                }
                aria-label="Center the operations map"
                title="Center map"
                className={controlClass}
            >
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
                size="icon"
                variant={showRoutes ? 'primary' : 'secondary'}
                onClick={onToggleRoutes}
                aria-pressed={showRoutes}
                aria-label="Toggle planned routes"
                title="Planned routes"
                className={controlClass}
            >
                <Route className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
                size="icon"
                variant={showGeofences ? 'primary' : 'secondary'}
                onClick={onToggleGeofences}
                aria-pressed={showGeofences}
                aria-label="Toggle job-site geofences"
                title="Job-site geofences"
                className={controlClass}
            >
                <Layers3 className="h-4 w-4" aria-hidden="true" />
            </Button>
        </div>
    );
}

function pointPosition(point: TelemetryPoint): LngLat {
    const base = destinationCoordinates[point.destination] ?? DEFAULT_CENTER;
    const latitudeOffset = (point.y - 50) * 0.00012;
    const longitudeOffset = (point.x - 50) * 0.00012;

    return [base[0] + longitudeOffset, base[1] + latitudeOffset];
}
