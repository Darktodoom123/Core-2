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
    CircleMarker,
    MapContainer,
    Polyline,
    Popup,
    TileLayer,
    useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
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
            <div className="relative min-h-[28rem] overflow-hidden bg-[#eef3f6]">
                <MapContainer
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    scrollWheelZoom
                    className="h-full min-h-[28rem] w-full"
                    aria-label="OpenStreetMap showing Metro Manila job sites and tracked resources"
                >
                    <TileLayer
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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

                    {points.map((point) => (
                        <CircleMarker
                            key={point.id}
                            center={pointPosition(point)}
                            radius={
                                selected?.resourceId === point.resourceId
                                    ? 11
                                    : 8
                            }
                            eventHandlers={{
                                click: () => onSelect(point.resourceId),
                            }}
                            pathOptions={{
                                color: 'var(--color-surface)',
                                fillColor: markerColor(point.freshness),
                                fillOpacity:
                                    point.freshness === 'Offline' ? 0.55 : 0.95,
                                weight:
                                    selected?.resourceId === point.resourceId
                                        ? 4
                                        : 2,
                            }}
                        >
                            <Popup>
                                <strong>{point.label}</strong>
                                <br />
                                {point.destination}
                                <br />
                                {point.freshness} · {point.updatedAt}
                            </Popup>
                        </CircleMarker>
                    ))}
                </MapContainer>

                <div className="pointer-events-none absolute right-3 bottom-8 z-[500] rounded-lg bg-surface/95 p-3 text-xs text-ink-soft shadow-sm">
                    <div className="flex items-center gap-2">
                        <Construction className="h-4 w-4" aria-hidden="true" />
                        OpenStreetMap basemap · Prototype telemetry
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

                        return (
                            <li key={point.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(point.resourceId)}
                                    className={cn(
                                        'w-full px-4 py-3 text-left hover:bg-surface-subtle',
                                        selected?.resourceId ===
                                            point.resourceId && 'bg-brand-soft',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2">
                                            <Icon
                                                className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft"
                                                aria-hidden="true"
                                            />
                                            <div>
                                                <p className="text-sm font-semibold text-ink">
                                                    {point.label}
                                                </p>
                                                <p className="mt-1 text-xs text-ink-soft">
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

function markerColor(freshness: TelemetryPoint['freshness']): string {
    switch (freshness) {
        case 'Live':
            return 'var(--color-success-strong)';
        case 'Delayed':
            return 'var(--color-warning-strong)';
        case 'Stale':
            return 'var(--color-danger)';
        case 'Offline':
            return 'var(--color-muted)';
    }
}
