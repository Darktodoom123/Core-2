import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../nativeStyles';
import type { RouteWaypoint } from './FieldRouteMapView';

export interface MapLibreWebContainerProps {
    originLabel?: string;
    originCoords?: [number, number]; // [lng, lat]
    destinationLabel?: string;
    destinationCoords?: [number, number]; // [lng, lat]
    waypoints?: RouteWaypoint[];
    styleVariant?: 'light' | 'dark';
    testID?: string;
}

// Safely resolve react-native-webview if available in native binary without throwing InvariantViolation
function resolveNativeWebView(): React.ComponentType<any> | null {
    if (Platform.OS === 'web') {
        return null;
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const module = require('react-native-webview');

        return module?.WebView ?? null;
    } catch {
        return null;
    }
}

const SafeNativeWebView = resolveNativeWebView();

export const MapLibreWebContainer: React.FC<MapLibreWebContainerProps> = ({
    originLabel = 'Yard / Base',
    originCoords = [120.9842, 14.5995],
    destinationLabel = 'Project Site',
    destinationCoords = [121.002, 14.612],
    waypoints = [],
    styleVariant = 'dark',
    testID = 'maplibre-web-container',
}) => {
    const [selectedPin, setSelectedPin] = useState<string | null>(null);

    // Generate route coordinates GeoJSON LineString
    const routeCoordinates = useMemo(() => {
        const coords: [number, number][] = [originCoords];
        waypoints.forEach((wp) => {
            coords.push([wp.longitude, wp.latitude]);
        });
        coords.push(destinationCoords);

        return coords;
    }, [originCoords, destinationCoords, waypoints]);

    // Build self-contained MapLibre HTML template for WebView / Web
    const mapHtml = useMemo(() => {
        const styleUrl =
            styleVariant === 'dark'
                ? 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json'
                : 'https://tiles.stadiamaps.com/styles/alidade_smooth.json';

        const waypointsJson = JSON.stringify(waypoints);
        const routeCoordsJson = JSON.stringify(routeCoordinates);
        const originJson = JSON.stringify({
            label: originLabel,
            coords: originCoords,
        });
        const destJson = JSON.stringify({
            label: destinationLabel,
            coords: destinationCoords,
        });

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        #map { width: 100%; height: 100%; }
        .marker { cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .marker-origin { width: 22px; height: 22px; background: #10b981; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
        .marker-dest { width: 24px; height: 24px; background: #2563eb; border: 2px solid #ffffff; border-radius: 50%; font-size: 13px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
        .marker-wp { width: 18px; height: 18px; background: #3b82f6; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .marker-hazard { width: 20px; height: 20px; background: #ef4444; border: 2px solid #ffffff; border-radius: 50%; font-size: 11px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(239,68,68,0.5); }
        .maplibregl-popup-content { background: #1e293b; color: #ffffff; padding: 8px 12px; border-radius: 8px; font-size: 12px; border: 1px solid #334155; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        .maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color: #1e293b; }
        .maplibregl-ctrl-attrib { display: none; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        try {
            const routeCoords = ${routeCoordsJson};
            const waypoints = ${waypointsJson};
            const origin = ${originJson};
            const dest = ${destJson};

            const map = new maplibregl.Map({
                container: 'map',
                style: '${styleUrl}',
                center: origin.coords,
                zoom: 12,
                attributionControl: false
            });

            map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

            map.on('load', () => {
                map.addSource('route', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: routeCoords
                        }
                    }
                });

                map.addLayer({
                    id: 'route-glow',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': '#60a5fa',
                        'line-width': 7,
                        'line-opacity': 0.35
                    }
                });

                map.addLayer({
                    id: 'route-line',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': '#2563eb',
                        'line-width': 3.5
                    }
                });

                const originEl = document.createElement('div');
                originEl.className = 'marker marker-origin';
                new maplibregl.Marker({ element: originEl })
                    .setLngLat(origin.coords)
                    .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML('<strong>Departure:</strong> ' + origin.label))
                    .addTo(map);

                const destEl = document.createElement('div');
                destEl.className = 'marker marker-dest';
                destEl.innerHTML = '🏁';
                new maplibregl.Marker({ element: destEl })
                    .setLngLat(dest.coords)
                    .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML('<strong>Destination:</strong> ' + dest.label))
                    .addTo(map);

                waypoints.forEach((wp) => {
                    const el = document.createElement('div');
                    el.className = wp.hazardNote ? 'marker marker-hazard' : 'marker marker-wp';
                    if (wp.hazardNote) el.innerHTML = '!';

                    const popupHtml = '<strong>' + wp.label + '</strong>' + 
                        (wp.hazardNote ? '<div style="color:#f87171;margin-top:4px;">' + wp.hazardNote + '</div>' : '');

                    new maplibregl.Marker({ element: el })
                        .setLngLat([wp.longitude, wp.latitude])
                        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml))
                        .addTo(map);
                });

                if (routeCoords.length > 0) {
                    const bounds = routeCoords.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(routeCoords[0], routeCoords[0]));
                    map.fitBounds(bounds, { padding: 36, maxZoom: 14 });
                }
            });
        } catch (e) {
            console.error('MapLibre init error', e);
        }
    </script>
</body>
</html>
        `;
    }, [
        styleVariant,
        originLabel,
        originCoords,
        destinationLabel,
        destinationCoords,
        waypoints,
        routeCoordinates,
    ]);

    // On Native with WebView: render WebView safely if available in binary
    if (Platform.OS !== 'web' && SafeNativeWebView) {
        return (
            <View style={styles.container} testID={testID}>
                <SafeNativeWebView
                    domStorageEnabled
                    javaScriptEnabled
                    originWhitelist={['*']}
                    source={{ html: mapHtml }}
                    style={styles.webView}
                />
            </View>
        );
    }

    // On Web: render iframe safely
    if (Platform.OS === 'web') {
        const IframeComponent = 'iframe' as any;

        return (
            <View style={styles.container} testID={testID}>
                <IframeComponent
                    aria-label="MapLibre Route View"
                    srcDoc={mapHtml}
                    style={styles.iframe}
                    title="MapLibre Route View"
                />
            </View>
        );
    }

    // Fallback Native Vector Interactive Canvas (for native mobile without WebView bridge)
    return (
        <View style={styles.container} testID={testID}>
            <View style={styles.fallbackHeader}>
                <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBadgeText}>MAPLIBRE CORRIDOR</Text>
                </View>
                <Text style={styles.coordText}>
                    {originCoords[1].toFixed(3)}°N, {originCoords[0].toFixed(3)}
                    °E
                </Text>
            </View>

            {/* Visual Vector Schematic Simulation */}
            <View style={styles.corridorCanvas}>
                {/* Background Grid Accent */}
                <View style={styles.gridOverlay} />

                {/* Origin Pin */}
                <Pressable
                    accessibilityLabel={`Origin: ${originLabel}`}
                    accessibilityRole="button"
                    onPress={() => setSelectedPin(`origin: ${originLabel}`)}
                    style={styles.pinNode}
                >
                    <View style={[styles.nodeDot, styles.originDot]} />
                    <Text style={styles.nodeLabel} numberOfLines={1}>
                        {originLabel}
                    </Text>
                </Pressable>

                <View style={styles.corridorLine} />

                {/* Waypoints */}
                {waypoints.map((wp) => (
                    <React.Fragment key={wp.id}>
                        <Pressable
                            accessibilityLabel={`Waypoint: ${wp.label}`}
                            accessibilityRole="button"
                            onPress={() =>
                                setSelectedPin(
                                    wp.hazardNote
                                        ? `${wp.label} (Hazard: ${wp.hazardNote})`
                                        : wp.label,
                                )
                            }
                            style={styles.pinNode}
                        >
                            <View
                                style={[
                                    styles.nodeDot,
                                    wp.hazardNote
                                        ? styles.hazardDot
                                        : styles.waypointDot,
                                ]}
                            >
                                {wp.hazardNote ? (
                                    <Text style={styles.hazardIconText}>!</Text>
                                ) : null}
                            </View>
                            <Text style={styles.nodeLabel} numberOfLines={1}>
                                {wp.label}
                            </Text>
                        </Pressable>
                        <View style={styles.corridorLine} />
                    </React.Fragment>
                ))}

                {/* Destination Pin */}
                <Pressable
                    accessibilityLabel={`Destination: ${destinationLabel}`}
                    accessibilityRole="button"
                    onPress={() =>
                        setSelectedPin(`destination: ${destinationLabel}`)
                    }
                    style={styles.pinNode}
                >
                    <View style={[styles.nodeDot, styles.destDot]}>
                        <Text style={styles.destIconText}>🏁</Text>
                    </View>
                    <Text style={styles.nodeLabel} numberOfLines={1}>
                        {destinationLabel}
                    </Text>
                </Pressable>
            </View>

            {selectedPin ? (
                <View style={styles.selectedBanner}>
                    <Text style={styles.selectedBannerText} numberOfLines={1}>
                        📍 {selectedPin}
                    </Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 260,
        backgroundColor: '#0f172a',
        borderRadius: 12,
        overflow: 'hidden',
    },
    webView: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    iframe: {
        width: '100%',
        height: '100%',
        border: 'none',
    } as any,
    fallbackHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#1e293b',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.green,
    },
    liveBadgeText: {
        color: '#93c5fd',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    coordText: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '600',
    },
    corridorCanvas: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 12,
        position: 'relative',
    },
    gridOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.1,
    },
    pinNode: {
        alignItems: 'center',
        zIndex: 2,
        maxWidth: 76,
    },
    nodeDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    originDot: {
        backgroundColor: colors.green,
    },
    destDot: {
        backgroundColor: colors.primary,
    },
    waypointDot: {
        backgroundColor: '#3b82f6',
    },
    hazardDot: {
        backgroundColor: colors.red,
    },
    hazardIconText: {
        fontSize: 12,
    },
    destIconText: {
        fontSize: 12,
    },
    nodeLabel: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 4,
        textAlign: 'center',
    },
    corridorLine: {
        flex: 1,
        height: 3,
        backgroundColor: colors.primary,
        marginHorizontal: -4,
    },
    selectedBanner: {
        backgroundColor: '#1e293b',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    selectedBannerText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
    },
});
