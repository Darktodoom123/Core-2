import { Crosshair } from 'lucide-react';
import type { Marker as MapLibreMarker } from 'maplibre-gl';
import { useCallback, useEffect, useRef } from 'react';
import type { SosIncidentStatusValue } from '@/types/workspace';
import { circleFeature, featureCollection } from '../maplibre/geojson';
import type { LngLat } from '../maplibre/geojson';
import { MapLibreMap, useMapLibre } from '../maplibre/maplibre-map';
import { createSosMarker } from '../maplibre/markers';

// Street level: close enough to pick out a crane pad or a site gate.
const PRECISE_ZOOM = 18;
const ACCURACY_SOURCE_ID = 'sos-accuracy';

interface SosPreciseMapProps {
    latitude: number;
    longitude: number;
    accuracyMetres: number | null;
    status: SosIncidentStatusValue;
    workerName: string;
}

/**
 * A single-incident map that pins the exact SOS fix. Unlike the fleet map it
 * never clusters, never fits other units into view, and draws the reported
 * GPS accuracy so responders can see how far the true position may be.
 */
export default function SosPreciseMap(props: SosPreciseMapProps) {
    const center: LngLat = [props.longitude, props.latitude];

    return (
        <MapLibreMap
            className="h-72 md:h-80"
            center={center}
            zoom={PRECISE_ZOOM}
            ariaLabel={`Map pinned to the emergency location of ${props.workerName}`}
        >
            <SosPreciseLayer {...props} />
        </MapLibreMap>
    );
}

function SosPreciseLayer({
    latitude,
    longitude,
    accuracyMetres,
    status,
    workerName,
}: SosPreciseMapProps) {
    const { map, maplibregl, prefersReducedMotion } = useMapLibre();
    const markerRef = useRef<MapLibreMarker | null>(null);

    const recenter = useCallback(
        (animate: boolean) => {
            map.easeTo({
                center: [longitude, latitude],
                zoom: Math.max(map.getZoom(), PRECISE_ZOOM),
                duration: animate && !prefersReducedMotion ? 350 : 0,
            });
        },
        [latitude, longitude, map, prefersReducedMotion],
    );

    // Follow the incident when the selection or a location update changes it.
    useEffect(() => {
        recenter(false);
    }, [recenter]);

    useEffect(() => {
        const element = createSosMarker({
            status,
            label: `SOS location for ${workerName}`,
            prefersReducedMotion,
        });
        element.tabIndex = -1;
        markerRef.current = new maplibregl.Marker({ element })
            .setLngLat([longitude, latitude])
            .addTo(map);

        return () => {
            markerRef.current?.remove();
            markerRef.current = null;
        };
    }, [
        latitude,
        longitude,
        map,
        maplibregl,
        prefersReducedMotion,
        status,
        workerName,
    ]);

    useEffect(() => {
        if (!accuracyMetres || accuracyMetres <= 0) {
            return;
        }

        const data = featureCollection([
            circleFeature([longitude, latitude], accuracyMetres),
        ]);

        map.addSource(ACCURACY_SOURCE_ID, { type: 'geojson', data });
        map.addLayer({
            id: `${ACCURACY_SOURCE_ID}-fill`,
            type: 'fill',
            source: ACCURACY_SOURCE_ID,
            paint: { 'fill-color': '#DC2626', 'fill-opacity': 0.12 },
        });
        map.addLayer({
            id: `${ACCURACY_SOURCE_ID}-line`,
            type: 'line',
            source: ACCURACY_SOURCE_ID,
            paint: {
                'line-color': '#DC2626',
                'line-width': 1.5,
                'line-dasharray': [2, 2],
            },
        });

        return () => {
            if (!map.getStyle()) {
                return;
            }

            for (const id of [
                `${ACCURACY_SOURCE_ID}-line`,
                `${ACCURACY_SOURCE_ID}-fill`,
            ]) {
                if (map.getLayer(id)) {
                    map.removeLayer(id);
                }
            }

            if (map.getSource(ACCURACY_SOURCE_ID)) {
                map.removeSource(ACCURACY_SOURCE_ID);
            }
        };
    }, [accuracyMetres, latitude, longitude, map]);

    return (
        <button
            type="button"
            onClick={() => recenter(true)}
            className="absolute top-3 right-3 z-[2] inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface/95 px-3 text-xs font-medium text-ink shadow-sm backdrop-blur-xs hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
            <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
            Recenter on SOS
        </button>
    );
}
