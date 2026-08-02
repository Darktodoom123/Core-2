import L from 'leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import {
    Check,
    Construction,
    Copy,
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
import { useEffect, useMemo, useState } from 'react';
import {
    Circle,
    MapContainer,
    Marker,
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

type TileStyle = 'cartoLight' | 'cartoDark' | 'osm';
export type AssetKind = 'truck' | 'crane' | 'equipment' | 'personnel';

const TILE_LAYERS: Record<
    TileStyle,
    { name: string; url: string; attribution: string }
> = {
    cartoLight: {
        name: 'Clean Light',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    cartoDark: {
        name: 'Clean Dark',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    osm: {
        name: 'Standard OSM',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
};

export function HeavyEquipmentIcon({
    className,
    ...props
}: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            <rect x="2" y="16" width="13" height="4" rx="2" />
            <path d="M4 16V10a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6" />
            <path d="M6 10h4v3H6z" />
            <path d="M10 11l4-5 5 4" />
            <path d="M19 10l2 3h-3.5" />
        </svg>
    );
}

export function CraneTruckIcon({
    className,
    ...props
}: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            <path d="M14 18V10a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v8h2" />
            <path d="M14 18h2" />
            <path d="M19 18h2a1 1 0 0 0 1-1v-4a1 1 0 0 0-.25-.67l-2.5-3A1 1 0 0 0 18.5 9H14" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
            <path d="M5 9L15 2" />
            <path d="M15 2v5" />
        </svg>
    );
}

const ASSET_SVG_ICONS: Record<AssetKind, string> = {
    truck: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
    crane: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14v7"/><path d="M14 14v7"/></svg>`,
    equipment: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect x="2" y="16" width="13" height="4" rx="2"/><path d="M4 16V10a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/><path d="M6 10h4v3H6z"/><path d="M10 11l4-5 5 4"/><path d="M19 10l2 3h-3.5"/></svg>`,
    personnel: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
};

export function getAssetKind(location: LocationUpdateViewModel): AssetKind {
    if (!location.asset) {
        return 'personnel';
    }

    const text = `${location.asset.code} ${location.asset.name}`.toLowerCase();

    if (
        text.includes('trk') ||
        text.includes('truck') ||
        text.includes('hauler') ||
        text.includes('dump')
    ) {
        return 'truck';
    }

    if (
        text.includes('crn') ||
        text.includes('crane') ||
        text.includes('lift') ||
        text.includes('hoist')
    ) {
        return 'crane';
    }

    if (
        text.includes('eqp') ||
        text.includes('dozer') ||
        text.includes('rig') ||
        text.includes('gen') ||
        text.includes('pump')
    ) {
        return 'equipment';
    }

    return 'personnel';
}

export function createCustomAssetIcon(
    kind: AssetKind,
    freshness: string,
    isSelected: boolean,
) {
    const isLive = freshness === 'fresh' || freshness === 'Live';
    const isDelayed = freshness === 'delayed' || freshness === 'Delayed';
    const isStale = freshness === 'stale' || freshness === 'Stale';

    const bgStyle = isLive
        ? 'background: #059669; border-color: #34d399; color: white;'
        : isDelayed
          ? 'background: #d97706; border-color: #fcd34d; color: white;'
          : isStale
            ? 'background: #e11d48; border-color: #fda4af; color: white;'
            : 'background: #64748b; border-color: #cbd5e1; color: white; opacity: 0.85;';

    const shapeStyle =
        kind === 'truck'
            ? 'border-radius: 10px;'
            : kind === 'crane'
              ? 'border-radius: 8px; transform: rotate(45deg);'
              : kind === 'equipment'
                ? 'border-radius: 6px;'
                : 'border-radius: 9999px;';

    const innerRotate =
        kind === 'crane'
            ? 'transform: rotate(-45deg); flex: none;'
            : 'flex: none;';

    const pulseEffect = isLive
        ? `<div style="position: absolute; inset: -4px; border-radius: 9999px; background: rgba(16,185,129,0.35); animation: map-marker-pulse 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
        : '';

    const selectRing = isSelected
        ? 'box-shadow: 0 0 0 4px var(--color-brand-strong), 0 8px 16px rgba(0,0,0,0.25); transform: scale(1.15); z-index: 100;'
        : 'box-shadow: 0 4px 10px rgba(0,0,0,0.18);';

    const html = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
            ${pulseEffect}
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-width: 2px; border-style: solid; transition: all 0.15s ease; ${bgStyle} ${shapeStyle} ${selectRing}">
                <div style="${innerRotate} display: flex; align-items: center; justify-content: center;">
                    ${ASSET_SVG_ICONS[kind]}
                </div>
            </div>
        </div>
    `;

    return L.divIcon({
        className: 'custom-asset-leaflet-pin',
        html,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
    });
}

export function OpenStreetMapTrackingMap({
    locations,
}: {
    locations: LocationUpdateViewModel[];
}) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [tileStyle, setTileStyle] = useState<TileStyle>('cartoLight');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const mappedLocations = useMemo(
        () =>
            locations.filter(
                (location) =>
                    location.latitude !== null && location.longitude !== null,
            ),
        [locations],
    );

    const filteredLocations = useMemo(() => {
        if (!searchQuery.trim()) {
            return locations;
        }

        const query = searchQuery.toLowerCase();

        return locations.filter(
            (loc) =>
                loc.user.name.toLowerCase().includes(query) ||
                (loc.asset?.code ?? '').toLowerCase().includes(query) ||
                (loc.asset?.name ?? '').toLowerCase().includes(query),
        );
    }, [locations, searchQuery]);

    const mapCenter = useMemo(
        () => averagePosition(mappedLocations),
        [mappedLocations],
    );

    const selected =
        mappedLocations.find((location) => location.id === selectedId) ??
        mappedLocations[0];

    const copyCoordinates = (
        loc: LocationUpdateViewModel,
        e?: React.MouseEvent,
    ) => {
        e?.stopPropagation();

        if (loc.latitude === null || loc.longitude === null) {
            return;
        }

        const text = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
        void navigator.clipboard.writeText(text);
        setCopiedId(loc.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const activeTileConfig = TILE_LAYERS[tileStyle];

    return (
        <div
            className={cn(
                'grid grid-cols-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-all duration-300 xl:grid-cols-[minmax(0,1fr)_22rem]',
                isFullscreen
                    ? 'fixed inset-4 z-[9999] h-[calc(100vh-2rem)] rounded-2xl shadow-2xl ring-1 ring-line/50'
                    : 'h-[560px] lg:h-[620px]',
            )}
        >
            <div className="relative h-full w-full overflow-hidden bg-surface-subtle">
                <MapContainer
                    center={mapCenter}
                    zoom={DEFAULT_ZOOM}
                    scrollWheelZoom
                    zoomControl={false}
                    className="h-full w-full"
                    aria-label="OpenStreetMap showing live field locations"
                >
                    <TileLayer
                        key={tileStyle}
                        url={activeTileConfig.url}
                        attribution={activeTileConfig.attribution}
                        maxZoom={19}
                    />

                    <TrackingMapViewport selected={selected} />

                    <CustomMapControls
                        mappedLocations={mappedLocations}
                        mapCenter={mapCenter}
                        tileStyle={tileStyle}
                        onTileStyleChange={setTileStyle}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={() =>
                            setIsFullscreen((prev) => !prev)
                        }
                    />

                    {/* Accuracy circles for workers with high precision */}
                    {mappedLocations.map((location) => {
                        if (!location.accuracy_metres) {
                            return null;
                        }

                        const position = locationPosition(location);
                        const isSelected = location.id === selected?.id;

                        return (
                            <Circle
                                key={`acc-${location.id}`}
                                center={position}
                                radius={location.accuracy_metres}
                                pathOptions={{
                                    color: freshnessColor(
                                        location.freshness_status,
                                    ),
                                    fillColor: freshnessColor(
                                        location.freshness_status,
                                    ),
                                    fillOpacity: isSelected ? 0.18 : 0.08,
                                    weight: 1,
                                    dashArray: '4 4',
                                }}
                            />
                        );
                    })}

                    {/* Custom Shape Markers for Equipment, Trucks, Cranes & Personnel */}
                    {mappedLocations.map((location) => {
                        const position = locationPosition(location);
                        const isSelected = location.id === selected?.id;
                        const kind = getAssetKind(location);
                        const markerIcon = createCustomAssetIcon(
                            kind,
                            location.freshness_status,
                            isSelected,
                        );

                        return (
                            <Marker
                                key={location.id}
                                position={position}
                                icon={markerIcon}
                                eventHandlers={{
                                    click: () => setSelectedId(location.id),
                                }}
                            >
                                <Popup closeButton={true}>
                                    <div className="w-56 p-3">
                                        <div className="flex items-start justify-between gap-2 border-b border-line pb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand-strong">
                                                    {kind === 'truck' ? (
                                                        <Truck className="h-4 w-4 text-brand-strong" />
                                                    ) : kind === 'crane' ? (
                                                        <Construction className="h-4 w-4 text-brand-strong" />
                                                    ) : kind === 'equipment' ? (
                                                        <Wrench className="h-4 w-4 text-brand-strong" />
                                                    ) : (
                                                        <UserRoundCog className="h-4 w-4 text-brand-strong" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm leading-snug font-semibold text-ink">
                                                        {location.user.name}
                                                    </p>
                                                    <p className="text-[11px] text-ink-soft capitalize">
                                                        {location.asset?.code ??
                                                            kind}
                                                    </p>
                                                </div>
                                            </div>
                                            <StatusBadge
                                                status={
                                                    location.freshness_status
                                                }
                                            />
                                        </div>

                                        <div className="mt-2.5 space-y-1.5 text-xs text-ink-soft">
                                            <div className="flex items-center justify-between font-mono text-[11px]">
                                                <span>
                                                    {location.latitude?.toFixed(
                                                        5,
                                                    )}
                                                    ,{' '}
                                                    {location.longitude?.toFixed(
                                                        5,
                                                    )}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) =>
                                                        copyCoordinates(
                                                            location,
                                                            e,
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1 text-brand-strong transition-colors hover:text-brand"
                                                    title="Copy coordinates"
                                                >
                                                    {copiedId ===
                                                    location.id ? (
                                                        <Check className="h-3 w-3 text-success-strong" />
                                                    ) : (
                                                        <Copy className="h-3 w-3" />
                                                    )}
                                                </button>
                                            </div>
                                            {location.captured_at && (
                                                <p className="text-[11px]">
                                                    Captured:{' '}
                                                    {new Date(
                                                        location.captured_at,
                                                    ).toLocaleTimeString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>

                {/* Map Asset Shapes Legend Overlay */}
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
                        <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-emerald-600 text-white">
                            <HeavyEquipmentIcon className="h-2.5 w-2.5" />
                        </span>
                        <span>Equipment</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                            <UserRoundCog className="h-2.5 w-2.5" />
                        </span>
                        <span>Worker</span>
                    </div>
                </div>

                {/* Bottom Bar Info Overlay */}
                <div className="pointer-events-none absolute right-3 bottom-3 z-[500] flex items-center gap-2 rounded-lg border border-line/60 bg-surface/90 px-3 py-1.5 text-xs text-ink-soft shadow-sm backdrop-blur-md">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-success-strong" />
                    <span>
                        CARTO basemap · {mappedLocations.length} mapped markers
                    </span>
                </div>

                {mappedLocations.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-surface/40 p-6 backdrop-blur-xs">
                        <div className="rounded-xl border border-line bg-surface/95 px-5 py-4 text-center text-sm text-ink-soft shadow-lg">
                            {locations.length === 0
                                ? 'No location updates match the selected filter.'
                                : 'Coordinates are unavailable for the selected updates.'}
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar list panel */}
            <aside
                className="flex h-full flex-col overflow-hidden border-t border-line bg-surface xl:border-t-0 xl:border-l"
                aria-label="Mapped location list"
            >
                <div className="space-y-3 border-b border-line bg-surface p-3.5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-ink">
                                Mapped locations
                            </h3>
                            <p className="text-xs text-ink-soft">
                                {mappedLocations.length} of {locations.length}{' '}
                                updates mapped
                            </p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="relative">
                        <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-ink-soft" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search worker or asset..."
                            className="w-full rounded-lg border border-line bg-surface-subtle py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-soft focus:border-brand-strong focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 scrollbar-thin divide-y divide-line overflow-y-auto">
                    {filteredLocations.length === 0 ? (
                        <div className="p-6 text-center text-xs text-ink-soft">
                            {searchQuery
                                ? `No locations match "${searchQuery}".`
                                : 'No location updates match the selected filter.'}
                        </div>
                    ) : (
                        filteredLocations.map((location) => {
                            const isMapped =
                                location.latitude !== null &&
                                location.longitude !== null;
                            const isSelected = location.id === selected?.id;
                            const kind = getAssetKind(location);

                            return (
                                <div
                                    key={location.id}
                                    className={cn(
                                        'group relative flex flex-col p-3.5 transition-all duration-150',
                                        isSelected
                                            ? 'bg-brand-soft/80 font-medium text-ink shadow-2xs ring-1 ring-brand-strong/20'
                                            : 'text-ink-soft hover:bg-surface-subtle',
                                        !isMapped && 'opacity-60',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            isMapped &&
                                            setSelectedId(location.id)
                                        }
                                        disabled={!isMapped}
                                        className="min-h-[44px] w-full text-left focus:outline-none"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div
                                                    className={cn(
                                                        'flex h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold shadow-xs',
                                                        kind === 'truck'
                                                            ? 'rounded-lg'
                                                            : kind === 'crane'
                                                              ? 'rotate-45 rounded-md'
                                                              : kind ===
                                                                  'equipment'
                                                                ? 'rounded-md'
                                                                : 'rounded-full',
                                                        isSelected
                                                            ? 'bg-brand-strong text-white'
                                                            : 'bg-surface-subtle text-ink-soft group-hover:bg-brand-soft group-hover:text-brand-strong',
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'flex items-center justify-center',
                                                            kind === 'crane' &&
                                                                '-rotate-45',
                                                        )}
                                                    >
                                                        {kind === 'truck' ? (
                                                            <Truck className="h-4 w-4" />
                                                        ) : kind === 'crane' ? (
                                                            <Construction className="h-4 w-4" />
                                                        ) : kind ===
                                                          'equipment' ? (
                                                            <Wrench className="h-4 w-4" />
                                                        ) : (
                                                            <UserRoundCog className="h-4 w-4" />
                                                        )}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm leading-tight font-semibold text-ink">
                                                        {location.user.name}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-ink-soft">
                                                        {location.asset?.code ??
                                                            'Field worker'}
                                                    </p>
                                                </div>
                                            </div>
                                            <StatusBadge
                                                status={
                                                    location.freshness_status
                                                }
                                            />
                                        </div>

                                        <div className="mt-2.5 flex items-center justify-between font-mono text-xs text-ink-soft">
                                            <span>
                                                {isMapped
                                                    ? `${location.latitude!.toFixed(5)}, ${location.longitude!.toFixed(5)}`
                                                    : 'Coordinates unavailable'}
                                            </span>
                                            {isMapped && (
                                                <button
                                                    type="button"
                                                    onClick={(e) =>
                                                        copyCoordinates(
                                                            location,
                                                            e,
                                                        )
                                                    }
                                                    className="rounded p-1 text-ink-soft transition-colors hover:text-ink"
                                                    title="Copy coordinates"
                                                >
                                                    {copiedId ===
                                                    location.id ? (
                                                        <Check className="h-3.5 w-3.5 text-success-strong" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </aside>
        </div>
    );
}

function CustomMapControls({
    mappedLocations,
    mapCenter,
    tileStyle,
    onTileStyleChange,
    isFullscreen,
    onToggleFullscreen,
}: {
    mappedLocations: LocationUpdateViewModel[];
    mapCenter: LatLngExpression;
    tileStyle: TileStyle;
    onTileStyleChange: (style: TileStyle) => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}) {
    const map = useMap();
    const [showTileMenu, setShowTileMenu] = useState(false);

    const fitAllBounds = () => {
        if (mappedLocations.length === 0) {
            return;
        }

        const bounds: LatLngBoundsExpression = mappedLocations.map(
            (loc) => [loc.latitude!, loc.longitude!] as [number, number],
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    };

    return (
        <div className="absolute top-3 left-3 z-[500] flex flex-col gap-1.5">
            <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface/95 p-1 shadow-sm backdrop-blur-md">
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => map.zoomIn()}
                    aria-label="Zoom in"
                    title="Zoom in"
                    className="h-9 min-h-[36px] w-9 min-w-[36px] rounded-lg text-ink transition-transform active:scale-95"
                >
                    <ZoomIn className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => map.zoomOut()}
                    aria-label="Zoom out"
                    title="Zoom out"
                    className="h-9 min-h-[36px] w-9 min-w-[36px] rounded-lg text-ink transition-transform active:scale-95"
                >
                    <ZoomOut className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface/95 p-1 shadow-sm backdrop-blur-md">
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => map.flyTo(mapCenter, DEFAULT_ZOOM)}
                    aria-label="Center live map"
                    title="Center map"
                    className="h-9 min-h-[36px] w-9 min-w-[36px] rounded-lg text-ink transition-transform active:scale-95"
                >
                    <LocateFixed className="h-4 w-4" aria-hidden="true" />
                </Button>

                <Button
                    size="icon"
                    variant="secondary"
                    onClick={fitAllBounds}
                    aria-label="Fit all locations on map"
                    title="Fit all markers"
                    className="h-9 min-h-[36px] w-9 min-w-[36px] rounded-lg text-ink transition-transform active:scale-95"
                >
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                </Button>

                <div className="relative">
                    <Button
                        size="icon"
                        variant={showTileMenu ? 'primary' : 'secondary'}
                        onClick={() => setShowTileMenu((prev) => !prev)}
                        aria-label="Switch map style"
                        title="Basemap layers"
                        className="h-9 min-h-[36px] w-9 min-w-[36px] rounded-lg transition-transform active:scale-95"
                    >
                        <Layers className="h-4 w-4" aria-hidden="true" />
                    </Button>

                    {showTileMenu && (
                        <div className="absolute top-0 left-11 z-[600] w-36 rounded-xl border border-line bg-surface p-1 shadow-lg backdrop-blur-md">
                            {(Object.keys(TILE_LAYERS) as TileStyle[]).map(
                                (style) => (
                                    <button
                                        key={style}
                                        type="button"
                                        onClick={() => {
                                            onTileStyleChange(style);
                                            setShowTileMenu(false);
                                        }}
                                        className={cn(
                                            'min-h-[36px] w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
                                            tileStyle === style
                                                ? 'bg-brand-soft font-semibold text-brand-strong'
                                                : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                        )}
                                    >
                                        {TILE_LAYERS[style].name}
                                    </button>
                                ),
                            )}
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
                    title={isFullscreen ? 'Minimize' : 'Maximize map'}
                    className="h-9 min-h-[36px] w-9 min-w-[36px] rounded-lg text-ink transition-transform active:scale-95"
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
