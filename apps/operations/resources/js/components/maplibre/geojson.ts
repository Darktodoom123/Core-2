import type {
    Feature,
    FeatureCollection,
    LineString,
    Point,
    Polygon,
} from 'geojson';

export type LngLat = [number, number];

export function pointFeature(
    coordinates: LngLat,
    properties: Record<string, unknown> = {},
): Feature<Point> {
    return {
        type: 'Feature',
        properties,
        geometry: { type: 'Point', coordinates },
    };
}

export function lineFeature(
    coordinates: LngLat[],
    properties: Record<string, unknown> = {},
): Feature<LineString> {
    return {
        type: 'Feature',
        properties,
        geometry: { type: 'LineString', coordinates },
    };
}

export function featureCollection<T extends Feature>(
    features: T[],
): FeatureCollection<T['geometry']> {
    return {
        type: 'FeatureCollection',
        features,
    } as FeatureCollection<T['geometry']>;
}

export function circleFeature(
    center: LngLat,
    radiusMetres: number,
    properties: Record<string, unknown> = {},
): Feature<Polygon> {
    const coordinates: LngLat[] = [];
    const radiusInDegrees = radiusMetres / 111_320;
    const latitudeRadians = (center[1] * Math.PI) / 180;
    const longitudeScale = Math.max(Math.cos(latitudeRadians), 0.1);

    for (let index = 0; index <= 64; index += 1) {
        const angle = (index / 64) * Math.PI * 2;
        coordinates.push([
            center[0] + (Math.cos(angle) * radiusInDegrees) / longitudeScale,
            center[1] + Math.sin(angle) * radiusInDegrees,
        ]);
    }

    return {
        type: 'Feature',
        properties,
        geometry: { type: 'Polygon', coordinates: [coordinates] },
    };
}
