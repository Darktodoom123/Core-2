import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
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
    style?: StyleProp<ViewStyle>;
    apiKey?: string;
    vehicleCoords?: [number, number];
    vehicleBearing?: number;
    followVehicle?: boolean;
    customRouteCoordinates?: [number, number][];
    currentRoadName?: string;
}

export function resolveStadiaApiKey(configuredKey?: string): string {
    return (
        configuredKey?.trim() ||
        process.env.EXPO_PUBLIC_STADIA_MAPS_API_KEY?.trim() ||
        process.env.VITE_STADIA_MAPS_API_KEY?.trim() ||
        ''
    );
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
    style,
    apiKey,
    vehicleCoords,
    vehicleBearing = 0,
    followVehicle = true,
    customRouteCoordinates,
    currentRoadName,
}) => {
    const [selectedPin, setSelectedPin] = useState<string | null>(null);
    const webViewRef = useRef<any>(null);

    useEffect(() => {
        if (!vehicleCoords) {
            return;
        }

        const script = `if (window.updateVehiclePosition) { window.updateVehiclePosition(${vehicleCoords[0]}, ${vehicleCoords[1]}, ${vehicleBearing}, ${Boolean(followVehicle)}, ${JSON.stringify(currentRoadName || '')}); } true;`;

        if (webViewRef.current?.injectJavaScript) {
            webViewRef.current.injectJavaScript(script);
        }
    }, [vehicleCoords, vehicleBearing, followVehicle, currentRoadName]);

    // Generate route coordinates GeoJSON LineString
    const routeCoordinates = useMemo(() => {
        if (customRouteCoordinates && customRouteCoordinates.length > 0) {
            return customRouteCoordinates;
        }

        const coords: [number, number][] = [originCoords];
        waypoints.forEach((wp) => {
            coords.push([wp.longitude, wp.latitude]);
        });
        coords.push(destinationCoords);

        return coords;
    }, [customRouteCoordinates, originCoords, destinationCoords, waypoints]);

    // Build self-contained MapLibre HTML template for WebView / Web
    const mapHtml = useMemo(() => {
        const resolvedKey = resolveStadiaApiKey(apiKey);
        const styleUrl = resolvedKey
            ? styleVariant === 'dark'
                ? `https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json?api_key=${resolvedKey}`
                : `https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=${resolvedKey}`
            : '';

        const osmFallbackStyleJson = JSON.stringify({
            version: 8,
            sources: {
                'osm-tiles': {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution:
                        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                },
            },
            layers: [
                {
                    id: 'osm-tiles-layer',
                    type: 'raster',
                    source: 'osm-tiles',
                    minzoom: 0,
                    maxzoom: 19,
                },
            ],
        });

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
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0B1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        #map { width: 100%; height: 100%; }
        ${
            !resolvedKey && styleVariant === 'dark'
                ? '.maplibregl-canvas { filter: invert(92%) hue-rotate(180deg) brightness(85%) contrast(115%); }'
                : ''
        }
        .marker { cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .marker-origin { width: 24px; height: 24px; background: #10B981; border: 2.5px solid #FFFFFF; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.6); font-size: 11px; color: #fff; }
        .marker-dest { width: 28px; height: 28px; background: #2563EB; border: 2.5px solid #FFFFFF; border-radius: 50%; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.6); }
        .marker-wp { width: 18px; height: 18px; background: #38BDF8; border: 2px solid #FFFFFF; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
        .marker-hazard { width: 24px; height: 24px; background: #DC2626; border: 2px solid #FFFFFF; border-radius: 50%; font-size: 13px; font-weight: 900; color: #fff; box-shadow: 0 2px 8px rgba(220,38,38,0.7); }
        .marker-vehicle { width: 64px; height: 64px; position: relative; display: flex; align-items: center; justify-content: center; z-index: 999; }
        .vehicle-pulse { position: absolute; width: 60px; height: 60px; border-radius: 50%; background: rgba(37, 99, 235, 0.25); animation: pulse 2s infinite ease-out; }
        .vehicle-puck { width: 36px; height: 36px; border-radius: 50%; background: #1A73E8; border: 3.5px solid #FFFFFF; box-shadow: 0 4px 14px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .vehicle-arrow { color: #FFFFFF; font-size: 20px; font-weight: 900; line-height: 20px; display: block; text-shadow: 0 1px 2px rgba(0,0,0,0.4); transform-origin: center center; }
        @keyframes pulse { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(1.8); opacity: 0; } }
        .maplibregl-popup-content { background: #1E293B; color: #FFFFFF; padding: 8px 12px; border-radius: 8px; font-size: 12px; border: 1px solid #334155; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        .maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color: #1E293B; }
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

            const isFollow = ${Boolean(followVehicle)};
            const startCenter = ${vehicleCoords ? JSON.stringify(vehicleCoords) : 'origin.coords'};
            const startZoom = isFollow ? 18 : 14.5;
            const startPitch = isFollow ? 65 : 50;
            const startBearing = ${typeof vehicleBearing === 'number' ? vehicleBearing : 0};

            const map = new maplibregl.Map({
                container: 'map',
                style: ${resolvedKey ? `'${styleUrl}'` : osmFallbackStyleJson},
                center: startCenter,
                zoom: startZoom,
                pitch: startPitch,
                bearing: startBearing,
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
                    id: 'route-casing',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': '#1558B0',
                        'line-width': 11,
                        'line-opacity': 0.8
                    }
                });

                map.addLayer({
                    id: 'route-line',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': '#388AF6',
                        'line-width': 7
                    }
                });

                // Live Vehicle navigation arrow puck (clean Google Maps style, no redundant text bubble)
                const vehicleEl = document.createElement('div');
                vehicleEl.className = 'marker marker-vehicle';
                vehicleEl.innerHTML = '<div class="vehicle-pulse"></div><div class="vehicle-puck"><span class="vehicle-arrow">▲</span></div>';
                window.vehicleMarker = new maplibregl.Marker({ element: vehicleEl })
                    .setLngLat(startCenter)
                    .addTo(map);

                window.updateVehiclePosition = function(lng, lat, heading, follow) {
                    if (window.vehicleMarker) {
                        window.vehicleMarker.setLngLat([lng, lat]);
                        const arrow = document.querySelector('.vehicle-arrow');
                        if (arrow && typeof heading === 'number') {
                            arrow.style.transform = 'rotate(' + heading + 'deg)';
                        }
                    }
                    if (follow && map) {
                        map.easeTo({
                            center: [lng, lat],
                            pitch: 65,
                            zoom: 18,
                            bearing: typeof heading === 'number' ? heading : map.getBearing(),
                            duration: 800
                        });
                    }
                };

                if (!isFollow) {
                    const originEl = document.createElement('div');
                    originEl.className = 'marker marker-origin';
                    new maplibregl.Marker({ element: originEl })
                        .setLngLat(origin.coords)
                        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML('<strong>Departure:</strong> ' + origin.label))
                        .addTo(map);
                }

                const destEl = document.createElement('div');
                destEl.className = 'marker marker-dest';
                destEl.innerHTML = '●';
                new maplibregl.Marker({ element: destEl })
                    .setLngLat(dest.coords)
                    .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML('<strong>Destination:</strong> ' + dest.label))
                    .addTo(map);

                waypoints.forEach((wp) => {
                    const el = document.createElement('div');
                    el.className = wp.hazardNote ? 'marker marker-hazard' : 'marker marker-wp';
                    if (wp.hazardNote) el.innerHTML = '!';

                    const popupHtml = '<strong>' + wp.label + '</strong>' + 
                        (wp.hazardNote ? '<div style="color:#F87171;margin-top:4px;">' + wp.hazardNote + '</div>' : '');

                    new maplibregl.Marker({ element: el })
                        .setLngLat([wp.longitude, wp.latitude])
                        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml))
                        .addTo(map);
                });

                if (!isFollow && routeCoords.length > 0) {
                    const bounds = routeCoords.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(routeCoords[0], routeCoords[0]));
                    map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
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
        apiKey,
        followVehicle,
        vehicleCoords,
        vehicleBearing,
    ]);

    // On Native with WebView: render WebView safely if available in binary
    if (Platform.OS !== 'web' && SafeNativeWebView) {
        return (
            <View style={[styles.container, style]} testID={testID}>
                <SafeNativeWebView
                    domStorageEnabled
                    javaScriptEnabled
                    originWhitelist={['*']}
                    ref={webViewRef}
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
            <View style={[styles.container, style]} testID={testID}>
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
        <View style={[styles.container, style]} testID={testID}>
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
                        <Text style={styles.destIconText}>⚑</Text>
                    </View>
                    <Text style={styles.nodeLabel} numberOfLines={1}>
                        {destinationLabel}
                    </Text>
                </Pressable>
            </View>

            {selectedPin ? (
                <View style={styles.selectedBanner}>
                    <Text style={styles.selectedBannerText} numberOfLines={1}>
                        {selectedPin}
                    </Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        minHeight: 260,
        backgroundColor: '#0F172A',
        borderRadius: 12,
        overflow: 'hidden',
    },
    webView: {
        flex: 1,
        backgroundColor: '#0F172A',
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
        backgroundColor: '#1E293B',
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
        color: '#93C5FD',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    coordText: {
        color: '#94A3B8',
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
        borderColor: '#FFFFFF',
    },
    originDot: {
        backgroundColor: colors.green,
    },
    destDot: {
        backgroundColor: colors.primary,
    },
    waypointDot: {
        backgroundColor: '#3B82F6',
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
        color: '#FFFFFF',
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
        backgroundColor: '#1E293B',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    selectedBannerText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
});
