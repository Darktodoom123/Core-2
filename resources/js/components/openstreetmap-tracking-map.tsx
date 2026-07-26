import type { LatLngExpression } from 'leaflet';
import { LocateFixed, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    CircleMarker,
    MapContainer,
    Popup,
    TileLayer,
    useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Button, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { LocationUpdateViewModel } from '@/types/workspace';

const DEFAULT_CENTER: [number, number] = [14.64, 121.04];
const DEFAULT_ZOOM = 11;

export function OpenStreetMapTrackingMap({
    locations,
}: {
    locations: LocationUpdateViewModel[];
}) {
    const mappedLocations = useMemo(
        () =>
            locations.filter(
                (location) =>
                    location.latitude !== null && location.longitude !== null,
            ),
        [locations],
    );
    const mapCenter = useMemo(
        () => averagePosition(mappedLocations),
        [mappedLocations],
    );
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected =
        mappedLocations.find((location) => location.id === selectedId) ??
        mappedLocations[0];

    return (
        <div className="grid min-h-[30rem] grid-cols-1 overflow-hidden rounded-xl border border-line xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="relative min-h-[30rem] bg-[#eef3f6]">
                <MapContainer
                    center={mapCenter}
                    zoom={DEFAULT_ZOOM}
                    scrollWheelZoom
                    className="h-full min-h-[30rem] w-full"
                    aria-label="OpenStreetMap showing live field locations"
                >
                    <TileLayer
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <TrackingMapViewport selected={selected} />
                    <div className="absolute top-3 left-3 z-[500]">
                        <MapCenterButton center={mapCenter} />
                    </div>

                    {mappedLocations.map((location) => {
                        const position = locationPosition(location);
                        const isSelected = location.id === selected?.id;

                        return (
                            <CircleMarker
                                key={location.id}
                                center={position}
                                radius={isSelected ? 11 : 8}
                                eventHandlers={{
                                    click: () => setSelectedId(location.id),
                                }}
                                pathOptions={{
                                    color: 'var(--color-surface)',
                                    fillColor: freshnessColor(
                                        location.freshness_status,
                                    ),
                                    fillOpacity:
                                        location.freshness_status === 'offline'
                                            ? 0.55
                                            : 0.95,
                                    weight: isSelected ? 4 : 2,
                                }}
                            >
                                <Popup>
                                    <strong>{location.user.name}</strong>
                                    <br />
                                    {location.asset?.name ?? 'Field worker'}
                                    <br />
                                    {location.freshness_status}
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>

                <div className="pointer-events-none absolute right-3 bottom-3 z-[500] rounded-lg bg-surface/95 p-3 text-xs text-ink-soft shadow-sm">
                    OpenStreetMap basemap · Live coordinates
                </div>

                {mappedLocations.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-6">
                        <div className="rounded-lg border border-line bg-surface/95 px-4 py-3 text-sm text-ink-soft shadow-sm">
                            Coordinates are unavailable for the selected
                            updates.
                        </div>
                    </div>
                )}
            </div>

            <aside
                className="max-h-[30rem] overflow-y-auto border-t border-line bg-surface xl:border-t-0 xl:border-l"
                aria-label="Mapped location list"
            >
                <div className="sticky top-0 z-10 border-b border-line bg-surface px-4 py-3">
                    <h3 className="font-semibold text-ink">Mapped locations</h3>
                    <p className="mt-0.5 text-xs text-ink-soft">
                        {mappedLocations.length} of {locations.length} updates
                        mapped
                    </p>
                </div>
                <ul className="divide-y divide-line">
                    {locations.map((location) => (
                        <li key={location.id}>
                            <button
                                type="button"
                                onClick={() =>
                                    location.latitude !== null &&
                                    location.longitude !== null &&
                                    setSelectedId(location.id)
                                }
                                disabled={
                                    location.latitude === null ||
                                    location.longitude === null
                                }
                                className={cn(
                                    'w-full px-4 py-3 text-left hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60',
                                    location.id === selected?.id &&
                                        'bg-brand-soft',
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2">
                                        <MapPin
                                            className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft"
                                            aria-hidden="true"
                                        />
                                        <div>
                                            <p className="text-sm font-semibold text-ink">
                                                {location.user.name}
                                            </p>
                                            <p className="mt-1 text-xs text-ink-soft">
                                                {location.asset?.code ??
                                                    'Field worker'}
                                            </p>
                                        </div>
                                    </div>
                                    <StatusBadge
                                        status={location.freshness_status}
                                    />
                                </div>
                                <p className="mt-2 text-xs text-ink-soft">
                                    {location.latitude !== null &&
                                    location.longitude !== null
                                        ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                                        : 'Coordinates pruned / unavailable'}
                                </p>
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>
        </div>
    );
}

function MapCenterButton({ center }: { center: LatLngExpression }) {
    const map = useMap();

    return (
        <Button
            size="icon"
            variant="secondary"
            onClick={() => map.flyTo(center, DEFAULT_ZOOM)}
            aria-label="Center the live locations map"
            title="Center map"
        >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
        </Button>
    );
}

function TrackingMapViewport({
    selected,
}: {
    selected?: LocationUpdateViewModel;
}) {
    const map = useMap();

    useEffect(() => {
        if (!selected) {
            return;
        }

        map.flyTo(locationPosition(selected), 13, { duration: 0.35 });
    }, [map, selected]);

    return null;
}

function locationPosition(location: LocationUpdateViewModel): [number, number] {
    return [
        location.latitude ?? DEFAULT_CENTER[0],
        location.longitude ?? DEFAULT_CENTER[1],
    ];
}

function averagePosition(
    locations: LocationUpdateViewModel[],
): [number, number] {
    if (locations.length === 0) {
        return DEFAULT_CENTER;
    }

    return [
        locations.reduce((sum, location) => sum + (location.latitude ?? 0), 0) /
            locations.length,
        locations.reduce(
            (sum, location) => sum + (location.longitude ?? 0),
            0,
        ) / locations.length,
    ];
}

function freshnessColor(
    freshness: LocationUpdateViewModel['freshness_status'],
): string {
    switch (freshness) {
        case 'fresh':
            return 'var(--color-success-strong)';
        case 'delayed':
            return 'var(--color-warning-strong)';
        case 'stale':
            return 'var(--color-danger)';
        case 'offline':
            return 'var(--color-muted)';
    }
}
