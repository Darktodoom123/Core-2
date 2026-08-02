import type { LatLngExpression } from 'leaflet';
import {
    AlertTriangle,
    Construction,
    Layers3,
    LocateFixed,
    Route,
    Truck,
    UserRoundCog,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    Circle,
    MapContainer,
    Marker,
    Polyline,
    Popup,
    TileLayer,
    useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { createCustomAssetIcon } from '@/components/openstreetmap-tracking-map';
import { Button, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TelemetryPoint } from '@/types/operations';

const DEFAULT_CENTER: LatLngExpression = [14.64, 121.04];
const DEFAULT_ZOOM = 11;
const destinationCoordinates: Record<string, [number, number]> = {
    'Balintawak Substation': [14.6572, 120.9847],
    'Marikina River Bridge': [14.6367, 121.1021],
    'North Yard': [14.6762, 121.0116],
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
                <MapContainer
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    scrollWheelZoom
                    zoomControl={false}
                    className="h-full min-h-[28rem] w-full"
                    aria-label="OpenStreetMap showing Metro Manila job sites and tracked resources"
                >
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    <MapViewport selected={selected} />
                    <MapControls
                        showRoutes={showRoutes}
                        showGeofences={showGeofences}
                        onToggleRoutes={() => setShowRoutes((value) => !value)}
                        onToggleGeofences={() =>
                            setShowGeofences((value) => !value)
                        }
                    />

                    {showRoutes && routePositions.length > 1 && (
                        <Polyline
                            positions={routePositions}
                            pathOptions={{
                                color: 'var(--color-brand-strong)',
                                dashArray: '9 7',
                                weight: 4,
                            }}
                        />
                    )}

                    {showGeofences &&
                        geofenceCenters.map(({ destination, position }) => (
                            <Circle
                                key={`geofence-${destination}`}
                                center={position}
                                radius={350}
                                pathOptions={{
                                    color: 'var(--color-info)',
                                    fillColor: 'var(--color-info)',
                                    fillOpacity: 0.08,
                                    weight: 1.5,
                                }}
                            />
                        ))}

                    {points.map((point) => {
                        const position = pointPosition(point);
                        const isSelected =
                            selected?.resourceId === point.resourceId;
                        const kind =
                            point.kind === 'truck'
                                ? 'truck'
                                : point.kind === 'crane'
                                  ? 'crane'
                                  : 'personnel';
                        const markerIcon = createCustomAssetIcon(
                            kind,
                            point.freshness,
                            isSelected,
                        );

                        return (
                            <Marker
                                key={point.id}
                                position={position}
                                icon={markerIcon}
                                eventHandlers={{
                                    click: () => onSelect(point.resourceId),
                                }}
                            >
                                <Popup closeButton={true}>
                                    <div className="w-52 p-3">
                                        <div className="flex items-center gap-2 border-b border-line pb-2">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand-strong">
                                                {point.kind === 'truck' ? (
                                                    <Truck className="h-4 w-4 text-brand-strong" />
                                                ) : point.kind === 'crane' ? (
                                                    <Construction className="h-4 w-4 text-brand-strong" />
                                                ) : (
                                                    <UserRoundCog className="h-4 w-4 text-brand-strong" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm leading-tight font-semibold text-ink">
                                                    {point.label}
                                                </p>
                                                <p className="text-[11px] text-ink-soft">
                                                    {point.destination}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2.5 flex items-center justify-between text-xs text-ink-soft">
                                            <StatusBadge
                                                status={point.freshness.toLowerCase()}
                                            />
                                            <span className="text-[11px]">
                                                Updated {point.updatedAt}
                                            </span>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>

                {/* Map Asset Shapes Legend */}
                <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap items-center gap-3 rounded-xl border border-line/70 bg-surface/90 px-3 py-2 text-[11px] text-ink shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-1.5 font-medium">
                        <span className="flex h-4 w-4 items-center justify-center rounded-md bg-emerald-600 text-white">
                            <Truck className="h-2.5 w-2.5" />
                        </span>
                        <span>Truck</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                        <span className="flex h-4 w-4 rotate-45 items-center justify-center rounded-md bg-emerald-600 text-white">
                            <Construction className="h-2.5 w-2.5 -rotate-45" />
                        </span>
                        <span>Crane</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                            <UserRoundCog className="h-2.5 w-2.5" />
                        </span>
                        <span>Personnel</span>
                    </div>
                </div>

                <div className="pointer-events-none absolute right-3 bottom-3 z-[500] rounded-lg border border-line/60 bg-surface/90 p-2.5 text-xs text-ink-soft shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <Construction
                            className="h-4 w-4 text-brand-strong"
                            aria-hidden="true"
                        />
                        CARTO basemap · Telemetry
                    </div>
                </div>
            </div>

            <aside
                className="max-h-[38rem] overflow-y-auto border-t border-line bg-surface xl:border-t-0 xl:border-l"
                aria-label="Live asset list"
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
                                        'min-h-[44px] w-full px-4 py-3 text-left transition-colors hover:bg-surface-subtle',
                                        isSelected &&
                                            'bg-brand-soft/80 font-medium text-ink shadow-2xs ring-1 ring-brand-strong/20',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5">
                                            <div
                                                className={cn(
                                                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-xs font-semibold shadow-xs',
                                                    point.kind === 'truck'
                                                        ? 'rounded-lg bg-emerald-600 text-white'
                                                        : point.kind === 'crane'
                                                          ? 'rotate-45 rounded-md bg-emerald-600 text-white'
                                                          : 'rounded-full bg-emerald-600 text-white',
                                                )}
                                            >
                                                <span
                                                    className={
                                                        point.kind === 'crane'
                                                            ? '-rotate-45'
                                                            : ''
                                                    }
                                                >
                                                    <Icon
                                                        className="h-3.5 w-3.5"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-ink">
                                                    {point.label}
                                                </p>
                                                <p className="mt-0.5 text-xs text-ink-soft">
                                                    {point.destination}
                                                </p>
                                            </div>
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
                <div className="m-4 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs leading-5 text-amber-950">
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

function MapControls({
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
    const map = useMap();

    return (
        <div className="absolute top-3 left-3 z-[500] flex flex-col gap-2">
            <Button
                size="icon"
                variant="secondary"
                onClick={() => map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM)}
                aria-label="Center the operations map"
                title="Center map"
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
            >
                <Layers3 className="h-4 w-4" aria-hidden="true" />
            </Button>
        </div>
    );
}

function MapViewport({ selected }: { selected?: TelemetryPoint }) {
    const map = useMap();

    useEffect(() => {
        if (!selected) {
            return;
        }

        map.flyTo(pointPosition(selected), 13, { duration: 0.35 });
    }, [map, selected]);

    return null;
}

function pointPosition(point: TelemetryPoint): [number, number] {
    const base = destinationCoordinates[point.destination] ?? [14.64, 121.04];
    const latitudeOffset = (point.y - 50) * 0.00012;
    const longitudeOffset = (point.x - 50) * 0.00012;

    return [base[0] + latitudeOffset, base[1] + longitudeOffset];
}
