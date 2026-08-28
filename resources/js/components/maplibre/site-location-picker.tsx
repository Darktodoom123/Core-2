import {
    AlertTriangle,
    Check,
    Crosshair,
    Loader2,
    MapPin,
    Navigation,
    Plus,
    Radio,
    RotateCcw,
    Search,
    Trash2,
} from 'lucide-react';
import type { Marker as MapLibreMarker } from 'maplibre-gl';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    DispatchAssetAssignmentViewModel,
    PlannedCraneSlotViewModel,
} from '@/types/workspace';
import type { LngLat } from './geojson';
import { MapLibreMap, useMapLibre } from './maplibre-map';

export interface PinnedSlotData {
    id: string;
    slotKey: string;
    name: string;
    assignmentId?: number | null;
    assetCode?: string | null;
    latitude: number | null;
    longitude: number | null;
    jibRadiusMeters: number;
}

export interface SiteLocationPickerProps {
    latitude?: number | null;
    longitude?: number | null;
    siteName?: string | null;
    assignedCranes?: DispatchAssetAssignmentViewModel[];
    plannedSlots?: PlannedCraneSlotViewModel[];
    onChange: (coords: { latitude: number; longitude: number }) => void;
    onSave?: (coords: { latitude: number; longitude: number }) => void;
    onSaveSlots?: (slots: PlannedCraneSlotViewModel[]) => void;
    onSaveCrane?: (
        assignmentId: number,
        coords: {
            latitude: number;
            longitude: number;
            jibRadiusMeters?: number;
        },
    ) => void;
    isSaving?: boolean;
    className?: string;
}

/**
 * Built-in coordinate catalog for key Philippine cities and construction districts
 */
const PHILIPPINE_SITE_CATALOG: Record<string, { lat: number; lon: number }> = {
    bgc: { lat: 14.5503, lon: 121.0505 },
    taguig: { lat: 14.5204, lon: 121.0539 },
    makati: { lat: 14.5547, lon: 121.0244 },
    ortigas: { lat: 14.5866, lon: 121.0617 },
    pasig: { lat: 14.5764, lon: 121.0851 },
    mandaluyong: { lat: 14.5794, lon: 121.0359 },
    'quezon city': { lat: 14.676, lon: 121.0437 },
    qc: { lat: 14.676, lon: 121.0437 },
    manila: { lat: 14.5995, lon: 120.9842 },
    pasay: { lat: 14.5378, lon: 120.9996 },
    paranaque: { lat: 14.4793, lon: 121.0198 },
    alabang: { lat: 14.4254, lon: 121.0366 },
    muntinlupa: { lat: 14.4081, lon: 121.0415 },
    valenzuela: { lat: 14.6853, lon: 120.9785 },
    caloocan: { lat: 14.6571, lon: 120.9841 },
    clark: { lat: 15.1783, lon: 120.5361 },
    pampanga: { lat: 15.0794, lon: 120.62 },
    bulacan: { lat: 14.7943, lon: 120.8799 },
    cavite: { lat: 14.3494, lon: 120.8647 },
    laguna: { lat: 14.2814, lon: 121.2182 },
    batangas: { lat: 13.7565, lon: 121.0583 },
    subic: { lat: 14.8219, lon: 120.2833 },
    cebu: { lat: 10.3157, lon: 123.8854 },
    mandaue: { lat: 10.3396, lon: 123.9416 },
    davao: { lat: 7.1907, lon: 125.4553 },
    iloilo: { lat: 10.7202, lon: 122.5621 },
    bacolod: { lat: 10.6766, lon: 122.9509 },
    cagayan: { lat: 8.4542, lon: 124.6319 },
};

function resolveSiteCoordinates(siteName?: string | null): {
    lat: number;
    lon: number;
} {
    if (!siteName) {
        return { lat: 14.5764, lon: 121.0851 };
    }

    const lower = siteName.toLowerCase();

    for (const [keyword, coords] of Object.entries(PHILIPPINE_SITE_CATALOG)) {
        if (lower.includes(keyword)) {
            return coords;
        }
    }

    return { lat: 14.5764, lon: 121.0851 };
}

/**
 * Creates a GeoJSON circle polygon for a given center coordinate and radius in meters
 */
function createGeoJsonCircle(
    center: [number, number],
    radiusInMeters: number,
    points = 64,
) {
    const coords = {
        latitude: center[1],
        longitude: center[0],
    };

    const km = radiusInMeters / 1000;
    const coordinates: [number, number][] = [];
    const distanceX =
        km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        const x = distanceX * Math.cos(theta);
        const y = distanceY * Math.sin(theta);

        coordinates.push([coords.longitude + x, coords.latitude + y]);
    }

    coordinates.push(coordinates[0]!);

    return {
        type: 'Feature' as const,
        geometry: {
            type: 'Polygon' as const,
            coordinates: [coordinates],
        },
        properties: {},
    };
}

/**
 * Calculates distance in meters between two lat/lon coordinates
 */
function calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * MapLibre layer rendering interactive slot markers and dynamic Jib Radius GeoJSON
 */
function MultiSlotMapLayer({
    slots,
    selectedSlotId,
    singlePosition,
    targetFlyTo,
    showJibRadius,
    onPinDrop,
    onSelectSlot,
}: {
    slots: PinnedSlotData[];
    selectedSlotId: string | null;
    singlePosition: [number, number] | null;
    targetFlyTo: { center: LngLat; zoom: number } | null;
    showJibRadius: boolean;
    onPinDrop: (lat: number, lon: number) => void;
    onSelectSlot: (slotId: string) => void;
}) {
    const { map, maplibregl } = useMapLibre();
    const markersMapRef = useRef<Map<string, MapLibreMarker>>(new Map());

    // Handle camera fly-to
    useEffect(() => {
        if (targetFlyTo) {
            map.flyTo({
                center: targetFlyTo.center,
                zoom: targetFlyTo.zoom,
                essential: true,
                duration: 1200,
            });
        }
    }, [map, targetFlyTo]);

    // Attach click event on map to drop or update the active slot pin
    useEffect(() => {
        const handleClick = (e: { lngLat: { lng: number; lat: number } }) => {
            const lat = Number(e.lngLat.lat.toFixed(7));
            const lon = Number(e.lngLat.lng.toFixed(7));

            onPinDrop(lat, lon);
        };

        map.on('click', handleClick);

        return () => {
            map.off('click', handleClick);
        };
    }, [map, onPinDrop]);

    // Render Jib Radius Circles via MapLibre GeoJSON layers
    useEffect(() => {
        const sourceId = 'tower-crane-jib-radiuses';
        const fillLayerId = 'tower-crane-jib-fill';
        const lineLayerId = 'tower-crane-jib-line';

        const features = [];

        if (showJibRadius) {
            if (slots.length > 0) {
                for (const slot of slots) {
                    if (
                        slot.latitude !== null &&
                        slot.longitude !== null &&
                        slot.jibRadiusMeters > 0
                    ) {
                        features.push(
                            createGeoJsonCircle(
                                [slot.longitude, slot.latitude],
                                slot.jibRadiusMeters,
                            ),
                        );
                    }
                }
            } else if (singlePosition) {
                features.push(createGeoJsonCircle(singlePosition, 60));
            }
        }

        const geojsonData = {
            type: 'FeatureCollection' as const,
            features,
        };

        const updateLayers = () => {
            const existingSource = map.getSource(sourceId) as
                { setData: (data: typeof geojsonData) => void } | undefined;

            if (existingSource) {
                existingSource.setData(geojsonData);
            } else {
                map.addSource(sourceId, {
                    type: 'geojson',
                    data: geojsonData,
                });

                map.addLayer({
                    id: fillLayerId,
                    type: 'fill',
                    source: sourceId,
                    paint: {
                        'fill-color': '#2563EB',
                        'fill-opacity': 0.15,
                    },
                });

                map.addLayer({
                    id: lineLayerId,
                    type: 'line',
                    source: sourceId,
                    paint: {
                        'line-color': '#2563EB',
                        'line-width': 1.8,
                        'line-dasharray': [3, 2],
                    },
                });
            }
        };

        if (map.isStyleLoaded()) {
            updateLayers();
        } else {
            map.once('styledata', updateLayers);
        }

        return () => {
            if (map.getLayer(lineLayerId)) {
                map.removeLayer(lineLayerId);
            }

            if (map.getLayer(fillLayerId)) {
                map.removeLayer(fillLayerId);
            }

            if (map.getSource(sourceId)) {
                map.removeSource(sourceId);
            }
        };
    }, [map, showJibRadius, singlePosition, slots]);

    // Render Markers for each slot
    useEffect(() => {
        const markersMap = markersMapRef.current;
        const activeMarkerKeys = new Set<string>();

        if (slots.length > 0) {
            slots.forEach((slot) => {
                if (slot.latitude === null || slot.longitude === null) {
                    return;
                }

                const key = `slot-${slot.id}`;

                activeMarkerKeys.add(key);

                const isSelected = selectedSlotId === slot.id;
                const pos: [number, number] = [slot.longitude, slot.latitude];

                let marker = markersMap.get(key);

                if (!marker) {
                    const el = document.createElement('div');

                    el.className = 'tower-crane-marker-node';
                    el.style.cursor = 'grab';

                    el.innerHTML = `
                        <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-50%);">
                            <div style="background:${isSelected ? '#1D4ED8' : '#2563EB'};color:#FFFFFF;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;gap:4px;margin-bottom:2px;white-space:nowrap;border:${isSelected ? '2px solid #FFFFFF' : 'none'};">
                                <span>🏗️ ${slot.slotKey}</span>
                                <span style="opacity:0.85;font-size:9px;">(${slot.jibRadiusMeters}m Jib)</span>
                            </div>
                            <div style="width:14px;height:14px;background:${isSelected ? '#1D4ED8' : '#2563EB'};border:3px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 2px #2563EB;"></div>
                        </div>
                    `;

                    marker = new maplibregl.Marker({
                        element: el,
                        draggable: true,
                    })
                        .setLngLat(pos)
                        .addTo(map);

                    el.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        onSelectSlot(slot.id);
                    });

                    marker.on('dragend', () => {
                        const lngLat = marker?.getLngLat();

                        if (lngLat) {
                            onSelectSlot(slot.id);
                            onPinDrop(
                                Number(lngLat.lat.toFixed(7)),
                                Number(lngLat.lng.toFixed(7)),
                            );
                        }
                    });

                    markersMap.set(key, marker);
                } else {
                    marker.setLngLat(pos);
                    const labelDiv = marker
                        .getElement()
                        .querySelector('div > div:first-child') as HTMLElement;

                    if (labelDiv) {
                        labelDiv.style.background = isSelected
                            ? '#1D4ED8'
                            : '#2563EB';
                        labelDiv.style.border = isSelected
                            ? '2px solid #FFFFFF'
                            : 'none';
                    }
                }
            });
        } else if (singlePosition) {
            const key = 'master-single-pin';

            activeMarkerKeys.add(key);

            let marker = markersMap.get(key);

            if (!marker) {
                const el = document.createElement('div');

                el.className = 'site-pin-dropper-marker';
                el.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;cursor:grab;transform:translateY(-50%);">
                        <div style="background:#2563EB;color:#FFFFFF;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;gap:4px;margin-bottom:2px;white-space:nowrap;">
                            <span>🏗️ Tower Crane Anchor</span>
                        </div>
                        <div style="width:14px;height:14px;background:#2563EB;border:3px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 2px #2563EB;"></div>
                    </div>
                `;

                marker = new maplibregl.Marker({
                    element: el,
                    draggable: true,
                })
                    .setLngLat(singlePosition)
                    .addTo(map);

                marker.on('dragend', () => {
                    const lngLat = marker?.getLngLat();

                    if (lngLat) {
                        onPinDrop(
                            Number(lngLat.lat.toFixed(7)),
                            Number(lngLat.lng.toFixed(7)),
                        );
                    }
                });

                markersMap.set(key, marker);
            } else {
                marker.setLngLat(singlePosition);
            }
        }

        markersMap.forEach((marker, k) => {
            if (!activeMarkerKeys.has(k)) {
                marker.remove();
                markersMap.delete(k);
            }
        });

        return () => {
            markersMap.forEach((marker) => marker.remove());
            markersMap.clear();
        };
    }, [
        map,
        maplibregl,
        onPinDrop,
        onSelectSlot,
        selectedSlotId,
        singlePosition,
        slots,
    ]);

    return null;
}

export function SiteLocationPicker({
    latitude,
    longitude,
    siteName,
    assignedCranes = [],
    plannedSlots = [],
    onChange,
    onSave,
    onSaveSlots,
    onSaveCrane,
    isSaving = false,
    className,
}: SiteLocationPickerProps) {
    // 1. Build initial unified slot list from planned_crane_slots or assignedCranes or default Slot 1
    const initialSlots: PinnedSlotData[] = useMemo(() => {
        if (plannedSlots && plannedSlots.length > 0) {
            return plannedSlots.map((s, idx) => ({
                id: s.slot_key || `slot-${idx + 1}`,
                slotKey: s.slot_key || `TC-${idx + 1}`,
                name: s.name || `Tower Crane Position ${idx + 1}`,
                latitude: s.site_latitude ?? latitude ?? null,
                longitude: s.site_longitude ?? longitude ?? null,
                jibRadiusMeters: s.jib_radius_meters || 60,
            }));
        }

        if (assignedCranes && assignedCranes.length > 0) {
            const filteredCranes = assignedCranes.filter((a) => {
                return (
                    a.kind?.toLowerCase().includes('crane') ||
                    a.subtype?.toLowerCase().includes('tower') ||
                    a.type?.toLowerCase().includes('crane')
                );
            });

            if (filteredCranes.length > 0) {
                return filteredCranes.map((a, idx) => ({
                    id: `assigned-${a.id}`,
                    slotKey: a.code || `TC-${idx + 1}`,
                    name: a.name || `Tower Crane ${idx + 1}`,
                    assignmentId: a.id,
                    assetCode: a.code,
                    latitude: a.site_latitude ?? latitude ?? null,
                    longitude: a.site_longitude ?? longitude ?? null,
                    jibRadiusMeters: a.jib_length_meters || 60,
                }));
            }
        }

        // Default single crane position
        return [
            {
                id: 'TC-1',
                slotKey: 'TC-1',
                name: 'Main Tower Crane Anchor',
                latitude: latitude ?? null,
                longitude: longitude ?? null,
                jibRadiusMeters: 60,
            },
        ];
    }, [assignedCranes, latitude, longitude, plannedSlots]);

    const [slotsState, setSlotsState] =
        useState<PinnedSlotData[]>(initialSlots);
    const [selectedSlotIdState, setSelectedSlotId] = useState<string | null>(
        null,
    );

    const selectedSlotId = selectedSlotIdState || slotsState[0]?.id || 'TC-1';

    const activeSlot = useMemo(() => {
        return (
            slotsState.find(
                (s) => s.id === selectedSlotId || s.slotKey === selectedSlotId,
            ) ||
            slotsState[0] ||
            null
        );
    }, [selectedSlotId, slotsState]);

    const customLat =
        activeSlot?.latitude !== null && activeSlot?.latitude !== undefined
            ? String(activeSlot.latitude)
            : '';
    const customLon =
        activeSlot?.longitude !== null && activeSlot?.longitude !== undefined
            ? String(activeSlot.longitude)
            : '';
    const jibRadiusInput = activeSlot?.jibRadiusMeters || 60;
    const slotNameInput = activeSlot?.name || 'Main Tower Crane Anchor';

    const [showJibRadius, setShowJibRadius] = useState<boolean>(true);
    const [searchInput, setSearchInput] = useState<string>(siteName || '');
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [targetFlyTo, setTargetFlyTo] = useState<{
        center: LngLat;
        zoom: number;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const updateSlotField = (
        field: 'name' | 'lat' | 'lon' | 'radius',
        value: string | number,
    ) => {
        const targetId = selectedSlotId || activeSlot?.id || slotsState[0]?.id;

        setSlotsState((prev) => {
            if (prev.length === 0) {
                return [
                    {
                        id: 'TC-1',
                        slotKey: 'TC-1',
                        name:
                            field === 'name'
                                ? String(value)
                                : 'Main Tower Crane Anchor',
                        latitude:
                            field === 'lat'
                                ? parseFloat(String(value)) || null
                                : null,
                        longitude:
                            field === 'lon'
                                ? parseFloat(String(value)) || null
                                : null,
                        jibRadiusMeters:
                            field === 'radius' ? Number(value) || 60 : 60,
                    },
                ];
            }

            return prev.map((s, idx) => {
                const matches =
                    s.id === targetId ||
                    s.slotKey === targetId ||
                    (prev.length === 1 && idx === 0);

                if (!matches) {
                    return s;
                }

                let nextLat = s.latitude;
                let nextLon = s.longitude;

                if (field === 'lat') {
                    const parsed = parseFloat(String(value));

                    nextLat =
                        !isNaN(parsed) && parsed >= -90 && parsed <= 90
                            ? parsed
                            : String(value).trim() === ''
                              ? null
                              : s.latitude;
                }

                if (field === 'lon') {
                    const parsed = parseFloat(String(value));

                    nextLon =
                        !isNaN(parsed) && parsed >= -180 && parsed <= 180
                            ? parsed
                            : String(value).trim() === ''
                              ? null
                              : s.longitude;
                }

                const nextRadius =
                    field === 'radius'
                        ? Number(value) || 60
                        : s.jibRadiusMeters;
                const nextName = field === 'name' ? String(value) : s.name;

                return {
                    ...s,
                    latitude: nextLat,
                    longitude: nextLon,
                    jibRadiusMeters: nextRadius,
                    name: nextName,
                };
            });
        });
    };

    // Check anti-collision slewing overlap between any 2 pinned slots
    const collisionOverlap = useMemo(() => {
        if (slotsState.length < 2) {
            return null;
        }

        for (let i = 0; i < slotsState.length; i++) {
            for (let j = i + 1; j < slotsState.length; j++) {
                const s1 = slotsState[i];
                const s2 = slotsState[j];

                if (
                    typeof s1?.latitude === 'number' &&
                    typeof s1?.longitude === 'number' &&
                    typeof s2?.latitude === 'number' &&
                    typeof s2?.longitude === 'number' &&
                    !isNaN(s1.latitude) &&
                    !isNaN(s1.longitude) &&
                    !isNaN(s2.latitude) &&
                    !isNaN(s2.longitude)
                ) {
                    const dist = calculateDistanceMeters(
                        s1.latitude,
                        s1.longitude,
                        s2.latitude,
                        s2.longitude,
                    );
                    const combinedRadius =
                        s1.jibRadiusMeters + s2.jibRadiusMeters;

                    if (dist < combinedRadius) {
                        return {
                            slot1: s1.slotKey,
                            slot2: s2.slotKey,
                            distanceMeters: Math.round(dist),
                            overlapMeters: Math.round(combinedRadius - dist),
                        };
                    }
                }
            }
        }

        return null;
    }, [slotsState]);

    const isAllPinned = useMemo(() => {
        return (
            slotsState.length > 0 &&
            slotsState.every(
                (s) =>
                    typeof s.latitude === 'number' &&
                    typeof s.longitude === 'number' &&
                    !isNaN(s.latitude) &&
                    !isNaN(s.longitude),
            )
        );
    }, [slotsState]);

    const resolvedSiteCoords = useMemo(
        () => resolveSiteCoordinates(siteName),
        [siteName],
    );

    const defaultCenter: [number, number] = useMemo(() => {
        if (activeSlot?.longitude && activeSlot?.latitude) {
            return [activeSlot.longitude, activeSlot.latitude];
        }

        if (resolvedSiteCoords) {
            return [resolvedSiteCoords.lon, resolvedSiteCoords.lat];
        }

        return [121.04, 14.6];
    }, [activeSlot, resolvedSiteCoords]);

    const handlePinDrop = (lat: number, lon: number) => {
        setError(null);

        const targetId = selectedSlotId || activeSlot?.id || slotsState[0]?.id;

        setSlotsState((prev) => {
            if (prev.length === 0) {
                return [
                    {
                        id: 'TC-1',
                        slotKey: 'TC-1',
                        name: 'Main Tower Crane Anchor',
                        latitude: lat,
                        longitude: lon,
                        jibRadiusMeters: 60,
                    },
                ];
            }

            return prev.map((s, idx) => {
                const matches =
                    s.id === targetId ||
                    s.slotKey === targetId ||
                    (prev.length === 1 && idx === 0);

                return matches
                    ? {
                          ...s,
                          latitude: lat,
                          longitude: lon,
                      }
                    : s;
            });
        });

        onChange({ latitude: lat, longitude: lon });
    };

    const handleAddSlot = () => {
        setSlotsState((prev) => {
            const nextNum = prev.length + 1;
            const newKey = `TC-${nextNum}`;
            const baseSlot =
                prev.find(
                    (s) =>
                        s.id === selectedSlotId || s.slotKey === selectedSlotId,
                ) || prev[0];
            const newSlot: PinnedSlotData = {
                id: newKey,
                slotKey: newKey,
                name: `Tower Crane Position ${nextNum}`,
                latitude:
                    typeof baseSlot?.latitude === 'number'
                        ? Number((baseSlot.latitude + 0.0004).toFixed(7))
                        : (latitude ?? 14.5768),
                longitude:
                    typeof baseSlot?.longitude === 'number'
                        ? Number((baseSlot.longitude + 0.0004).toFixed(7))
                        : (longitude ?? 121.0856),
                jibRadiusMeters: 60,
            };

            setSelectedSlotId(newKey);

            return [...prev, newSlot];
        });
    };

    const handleRemoveSlot = (slotId: string, ev: React.MouseEvent) => {
        ev.stopPropagation();

        if (slotsState.length <= 1) {
            setError('At least one crane slot is required for site layout.');

            return;
        }

        const filtered = slotsState.filter((s) => s.id !== slotId);

        setSlotsState(filtered);

        if (selectedSlotId === slotId) {
            setSelectedSlotId(filtered[0]?.id || 'TC-1');
        }
    };

    const handleCenterOnSite = async (queryText?: string) => {
        const domInput =
            typeof document !== 'undefined'
                ? (
                      document.querySelector(
                          '[data-testid="site-address-input"]',
                      ) as HTMLInputElement | null
                  )?.value
                : undefined;
        const query = (
            queryText ||
            domInput ||
            searchInput ||
            siteName ||
            ''
        ).trim();

        if (!query) {
            setError('Please enter a site name or address to locate.');

            return;
        }

        setError(null);
        setIsSearching(true);

        try {
            const localCoords = resolveSiteCoordinates(query);

            if (localCoords) {
                setTargetFlyTo({
                    center: [localCoords.lon, localCoords.lat],
                    zoom: 16,
                });
                handlePinDrop(localCoords.lat, localCoords.lon);
                setIsSearching(false);

                return;
            }

            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ph&q=${encodeURIComponent(query)}&limit=1`,
                {
                    headers: { Accept: 'application/json' },
                },
            );

            if (response.ok) {
                const results = (await response.json()) as Array<{
                    lat: string;
                    lon: string;
                }>;

                if (results.length > 0 && results[0]) {
                    const lat = Number(parseFloat(results[0].lat).toFixed(7));
                    const lon = Number(parseFloat(results[0].lon).toFixed(7));

                    setTargetFlyTo({
                        center: [lon, lat],
                        zoom: 16,
                    });
                    handlePinDrop(lat, lon);
                    setIsSearching(false);

                    return;
                }
            }

            setError(
                `Could not find coordinates for "${query}". You can click directly on the map or enter coordinates manually.`,
            );
        } catch {
            setError(
                'Geocoding request could not be completed. You can click directly on the map.',
            );
        } finally {
            setIsSearching(false);
        }
    };

    const handleApplyCustom = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const combined = `${customLat} ${customLon}`.trim();
        const commaMatch = combined.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);

        let latNum = parseFloat(customLat);
        let lonNum = parseFloat(customLon);

        if (commaMatch && commaMatch[1] && commaMatch[2]) {
            latNum = parseFloat(commaMatch[1]);
            lonNum = parseFloat(commaMatch[2]);
        }

        if (isNaN(latNum) || latNum < -90 || latNum > 90) {
            setError('Latitude must be a valid number between -90 and 90');

            return;
        }

        if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
            setError('Longitude must be a valid number between -180 and 180');

            return;
        }

        const lat = Number(latNum.toFixed(7));
        const lon = Number(lonNum.toFixed(7));

        setTargetFlyTo({
            center: [lon, lat],
            zoom: 16,
        });

        const targetId = selectedSlotId || activeSlot?.id || slotsState[0]?.id;

        const updatedSlots = slotsState.map((s, idx) => {
            const matches =
                s.id === targetId ||
                s.slotKey === targetId ||
                (slotsState.length === 1 && idx === 0);

            return matches
                ? {
                      ...s,
                      latitude: lat,
                      longitude: lon,
                      jibRadiusMeters: jibRadiusInput,
                      name: slotNameInput,
                  }
                : s;
        });

        setSlotsState(updatedSlots);
        onChange({ latitude: lat, longitude: lon });

        // Save planned slots to backend if handler provided
        if (onSaveSlots) {
            onSaveSlots(
                updatedSlots.map((s) => ({
                    slot_key: s.slotKey,
                    name: s.name,
                    required_type: 'tower_crane',
                    jib_radius_meters: s.jibRadiusMeters,
                    site_latitude: s.latitude,
                    site_longitude: s.longitude,
                })),
            );
        } else if (activeSlot?.assignmentId && onSaveCrane) {
            onSaveCrane(activeSlot.assignmentId, {
                latitude: lat,
                longitude: lon,
                jibRadiusMeters: jibRadiusInput,
            });
        } else if (onSave) {
            onSave({ latitude: lat, longitude: lon });
        }
    };

    return (
        <div
            data-testid="site-location-picker"
            className={cn(
                'text-content space-y-4 rounded-xl border border-line bg-surface p-4 shadow-xs',
                className,
            )}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className="bg-brand-subtle flex size-8 items-center justify-center rounded-lg text-brand">
                        <Crosshair className="size-4" />
                    </div>
                    <div>
                        <h4 className="text-content text-sm font-semibold">
                            Project Site & Crane Slots Layout (Method 1)
                        </h4>
                        <p className="text-content-muted text-xs">
                            {slotsState.length > 1
                                ? `Multi-Crane Layout (${slotsState.length} positions): Click lot to anchor each crane foundation.`
                                : 'Centered on project site lot. Click directly on property footprint to drop crane anchor.'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowJibRadius((prev) => !prev)}
                        className="text-content inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium hover:bg-surface-subtle"
                    >
                        <Radio className="size-3 text-brand" />
                        {showJibRadius
                            ? 'Hide Jib Radiuses'
                            : 'Show Jib Radiuses'}
                    </button>
                    {isAllPinned ? (
                        <span
                            data-testid="pinned-badge"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        >
                            <Check className="size-3" /> Pinned & Anchored
                        </span>
                    ) : (
                        <span
                            data-testid="pending-badge"
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                        >
                            Pending Site Pin
                        </span>
                    )}
                </div>
            </div>

            {/* Crane Slot Switcher Bar */}
            <div
                data-testid="crane-selector-tabs"
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-subtle p-2"
            >
                <span className="text-content-muted text-xs font-semibold">
                    Crane Positions:
                </span>
                {slotsState.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    const isSlotPinned =
                        slot.latitude !== null && slot.longitude !== null;

                    return (
                        <div
                            key={slot.id}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
                                isSelected
                                    ? 'bg-brand text-brand-contrast shadow-xs'
                                    : 'text-content border border-line bg-surface hover:bg-surface-subtle',
                            )}
                        >
                            <button
                                type="button"
                                data-testid={`select-crane-${slot.slotKey}`}
                                onClick={() => setSelectedSlotId(slot.id)}
                                className="flex items-center gap-1.5"
                            >
                                <span>🏗️ {slot.slotKey}</span>
                                <span className="text-[10px] opacity-85">
                                    ({slot.jibRadiusMeters}m Jib)
                                </span>
                                {isSlotPinned ? (
                                    <span className="size-1.5 rounded-full bg-emerald-400" />
                                ) : (
                                    <span className="size-1.5 rounded-full bg-amber-400" />
                                )}
                            </button>
                            {slotsState.length > 1 && (
                                <button
                                    type="button"
                                    onClick={(ev) =>
                                        handleRemoveSlot(slot.id, ev)
                                    }
                                    title="Remove this crane position"
                                    className="ml-1 opacity-70 hover:opacity-100"
                                >
                                    <Trash2 className="size-3 text-rose-400" />
                                </button>
                            )}
                        </div>
                    );
                })}

                <button
                    type="button"
                    data-testid="add-crane-slot-button"
                    onClick={handleAddSlot}
                    className="bg-brand-subtle inline-flex items-center gap-1 rounded-md border border-dashed border-brand/50 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/20"
                >
                    <Plus className="size-3" /> Add Crane Position
                </button>
            </div>

            {/* Anti-Collision Overlap Warning */}
            {collisionOverlap && (
                <div
                    data-testid="anti-collision-warning"
                    className="flex items-center gap-2 rounded-lg border border-amber-300/80 bg-amber-50/80 p-2.5 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200"
                >
                    <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                        <strong>Anti-Collision Zone Detected:</strong>{' '}
                        {collisionOverlap.slot1} and {collisionOverlap.slot2}{' '}
                        are {collisionOverlap.distanceMeters}m apart with{' '}
                        {collisionOverlap.overlapMeters}m slewing jib overlap.
                        Verify boom clearance heights.
                    </span>
                </div>
            )}

            {/* Site Address Search & Auto-Center */}
            <div className="rounded-lg border border-line bg-surface-subtle p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                data-testid="site-address-input"
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void handleCenterOnSite();
                                    }
                                }}
                                placeholder="Search project site, client lot, or address…"
                                className="text-content placeholder:text-content-muted w-full rounded-md border border-line bg-surface py-1.5 pr-3 pl-8 text-xs focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                            />
                            <Search className="text-content-muted pointer-events-none absolute top-2 left-2.5 size-3.5" />
                        </div>
                        <Button
                            data-testid="locate-site-button"
                            type="button"
                            size="sm"
                            disabled={isSearching}
                            onClick={() => void handleCenterOnSite()}
                            className="shrink-0"
                        >
                            {isSearching ? (
                                <>
                                    <Loader2 className="mr-1 size-3.5 animate-spin" />{' '}
                                    Locating…
                                </>
                            ) : (
                                <>
                                    <MapPin className="mr-1 size-3.5" /> Locate
                                    Site
                                </>
                            )}
                        </Button>
                    </div>

                    {siteName && (
                        <Button
                            data-testid="fly-to-job-site-button"
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleCenterOnSite(siteName)}
                            className="shrink-0 text-xs"
                        >
                            <Navigation className="mr-1 size-3 text-brand" />
                            Fly to Job Site ({siteName})
                        </Button>
                    )}
                </div>
            </div>

            {/* Interactive Map Canvas */}
            <div
                data-testid="site-map-container"
                className="relative h-76 w-full overflow-hidden rounded-lg border border-line shadow-inner"
            >
                <MapLibreMap
                    center={defaultCenter}
                    zoom={isAllPinned ? 16 : resolvedSiteCoords ? 15 : 12}
                    ariaLabel="Interactive project site coordinate picker. Click to place the tower crane anchor."
                >
                    <MultiSlotMapLayer
                        slots={slotsState}
                        selectedSlotId={selectedSlotId}
                        singlePosition={
                            activeSlot?.latitude && activeSlot?.longitude
                                ? [activeSlot.longitude, activeSlot.latitude]
                                : null
                        }
                        targetFlyTo={targetFlyTo}
                        showJibRadius={showJibRadius}
                        onPinDrop={handlePinDrop}
                        onSelectSlot={(id) => setSelectedSlotId(id)}
                    />
                </MapLibreMap>

                {/* Floating Helper Overlay */}
                <div className="text-content pointer-events-none absolute top-3 left-3 z-[2] flex items-center gap-1.5 rounded-md border border-line/80 bg-surface/90 px-2.5 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur-xs">
                    <MapPin className="size-3.5 text-brand" />
                    <span>
                        Click lot to position{' '}
                        <strong>{activeSlot?.slotKey}</strong> base anchor (
                        {jibRadiusInput}m Jib)
                    </span>
                </div>

                {activeSlot?.latitude && activeSlot?.longitude && (
                    <div
                        data-testid="coordinates-overlay"
                        className="text-content pointer-events-none absolute right-3 bottom-3 z-[2] rounded-md border border-line/80 bg-surface/95 px-3 py-1.5 font-mono text-xs shadow-sm backdrop-blur-xs"
                    >
                        {activeSlot.slotKey}: {activeSlot.latitude.toFixed(5)}°
                        N, {activeSlot.longitude.toFixed(5)}° E
                    </div>
                )}
            </div>

            {/* Selected Crane Position Form */}
            <form
                onSubmit={handleApplyCustom}
                className="space-y-3 rounded-lg border border-line bg-surface-subtle p-3"
            >
                <div className="flex items-center justify-between">
                    <span className="text-content text-xs font-semibold">
                        Foundation Anchor: {activeSlot?.slotKey} (
                        {slotNameInput || 'Crane Position'})
                    </span>
                    {siteName && (
                        <span className="text-xs font-medium text-brand">
                            {siteName}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                        <label
                            htmlFor="slot-name-input"
                            className="text-content-muted block text-[11px] font-medium"
                        >
                            Position Label
                        </label>
                        <input
                            data-testid="slot-name-input"
                            id="slot-name-input"
                            type="text"
                            value={slotNameInput}
                            onChange={(e) =>
                                updateSlotField('name', e.target.value)
                            }
                            placeholder="e.g. North Core Tower Crane"
                            className="text-content mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="site-lat-input"
                            className="text-content-muted block text-[11px] font-medium"
                        >
                            Latitude (°N)
                        </label>
                        <input
                            data-testid="site-lat-input"
                            id="site-lat-input"
                            type="text"
                            value={customLat}
                            onChange={(e) =>
                                updateSlotField('lat', e.target.value)
                            }
                            placeholder="e.g. 14.5547"
                            className="text-content mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-xs focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="site-lon-input"
                            className="text-content-muted block text-[11px] font-medium"
                        >
                            Longitude (°E)
                        </label>
                        <input
                            data-testid="site-lon-input"
                            id="site-lon-input"
                            type="text"
                            value={customLon}
                            onChange={(e) =>
                                updateSlotField('lon', e.target.value)
                            }
                            placeholder="e.g. 121.0509"
                            className="text-content mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-xs focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="jib-radius-input"
                            className="text-content-muted block text-[11px] font-medium"
                        >
                            Jib Working Radius (Meters)
                        </label>
                        <input
                            data-testid="jib-radius-input"
                            id="jib-radius-input"
                            type="number"
                            min="10"
                            max="120"
                            value={jibRadiusInput}
                            onChange={(e) =>
                                updateSlotField(
                                    'radius',
                                    parseInt(e.target.value, 10) || 60,
                                )
                            }
                            className="text-content mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-xs focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                        />
                    </div>
                </div>

                {error && (
                    <p
                        data-testid="site-error-message"
                        className="text-xs text-rose-600 dark:text-rose-400"
                    >
                        {error}
                    </p>
                )}

                <div className="flex items-center justify-between pt-1">
                    <p className="text-content-muted text-[11px]">
                        💡 Tip: Click lot to drop pin, drag marker, or enter
                        foundation coordinates.
                    </p>
                    <div className="flex gap-2">
                        <Button
                            data-testid="clear-coordinates-button"
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                setError(null);
                                setSlotsState((prev) =>
                                    prev.map((s) =>
                                        s.id === selectedSlotId
                                            ? {
                                                  ...s,
                                                  latitude: null,
                                                  longitude: null,
                                              }
                                            : s,
                                    ),
                                );
                            }}
                        >
                            <RotateCcw className="mr-1 size-3" /> Clear
                        </Button>
                        <Button
                            data-testid="apply-pin-button"
                            type="submit"
                            size="sm"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-1 size-3 animate-spin" />{' '}
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <Navigation className="mr-1 size-3" /> Apply
                                    Pin & Save Layout
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
