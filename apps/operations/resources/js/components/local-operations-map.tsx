import {
    AlertTriangle,
    Construction,
    Layers3,
    LocateFixed,
    Route,
} from 'lucide-react';
import type { GeoJSONSource, Marker as MapLibreMarker } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, StatusBadge } from '@/components/ui';
import { FleetAssetCategoryIcon } from '@/components/workspace/fleet/fleet-asset-category-icon';
import {
    classifyFleetAsset,
    FLEET_ASSET_CATEGORY_LABELS,
} from '@/components/workspace/fleet/fleet-asset-classification';
import { cn } from '@/lib/utils';
import type { TelemetryPoint } from '@/types/operations';
import {
    circleFeature,
    featureCollection,
    lineFeature,
} from './maplibre/geojson';
import type { LngLat } from './maplibre/geojson';
import { MapLibreMap, useMapLibre } from './maplibre/maplibre-map';
import {
    createAssetMarker,
    createPopupCard,
    createWarehouseMarker,
} from './maplibre/markers';
import { FOCHUN_WAREHOUSE } from './maplibre/warehouse-location';

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
    const assetPoints = useMemo(
        () => points.filter((point) => point.kind !== 'operator'),
        [points],
    );
    const selected = useMemo(
        () =>
            assetPoints.find((point) => point.resourceId === selectedId) ??
            assetPoints[0],
        [assetPoints, selectedId],
    );
    const routePositions = useMemo(
        () =>
            assetPoints
                .filter((point) => point.freshness !== 'Offline')
                .map(pointPosition),
        [assetPoints],
    );
    const geofenceCenters = useMemo(
        () =>
            Array.from(
                new Set(assetPoints.map((point) => point.destination)),
            ).map((destination) => ({
                destination,
                position: destinationCoordinates[destination] ?? DEFAULT_CENTER,
            })),
        [assetPoints],
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
                        points={assetPoints}
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
                        [Prototype / Sandbox Simulation Map] Stadia Maps ·
                        Evaluation Only (Production tracking is LiveTrackingMap)
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
                            assetPoints.filter(
                                (point) => point.freshness === 'Live',
                            ).length
                        }{' '}
                        live · {assetPoints.length} assets
                    </p>
                </div>
                <ul className="divide-y divide-line">
                    {assetPoints.map((point) => {
                        const category = classifyFleetAsset({
                            kind: point.kind,
                            subtype: point.subtype ?? null,
                            category: point.category ?? null,
                        });
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
                                                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success-strong text-white shadow-xs',
                                                )}
                                            >
                                                <FleetAssetCategoryIcon
                                                    category={category}
                                                    className="h-3.5 w-3.5"
                                                />
                                            </span>
                                            <span>
                                                <span className="block text-sm font-semibold text-ink">
                                                    {point.label}
                                                </span>
                                                <span className="mt-0.5 block text-xs text-ink-soft">
                                                    {point.destination}
                                                </span>
                                                <span className="text-ink-muted mt-0.5 block text-[11px] font-medium">
                                                    {
                                                        FLEET_ASSET_CATEGORY_LABELS[
                                                            category
                                                        ]
                                                    }
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
                    Stale and offline signals remain visible so operators can
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
                'line-color': '#806000',
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
            const category = classifyFleetAsset({
                kind: point.kind,
                subtype: point.subtype ?? null,
                category: point.category ?? null,
            });
            const categoryLabel = FLEET_ASSET_CATEGORY_LABELS[category];
            const markerElement = createAssetMarker({
                category,
                freshness: point.freshness,
                isSelected: selected?.resourceId === point.resourceId,
                label: `${point.label}, ${categoryLabel}, ${point.freshness} telemetry`,
            });
            markerElement.addEventListener('click', () =>
                onSelect(point.resourceId),
            );
            const statusTone =
                point.freshness === 'Live'
                    ? 'success'
                    : point.freshness === 'Delayed'
                      ? 'info'
                      : point.freshness === 'Stale'
                        ? 'warning'
                        : 'danger';

            const popup = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: true,
                offset: 24,
                maxWidth: '320px',
            }).setDOMContent(
                createPopupCard({
                    title: point.label,
                    subtitle: point.destination,
                    status: point.freshness,
                    statusTone,
                    fields: [
                        { label: 'Asset category', value: categoryLabel },
                        { label: 'Updated', value: point.updatedAt },
                        { label: 'ETA', value: point.eta },
                    ],
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
