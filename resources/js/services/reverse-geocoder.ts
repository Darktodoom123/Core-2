import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { LocationResolutionInput } from '@/lib/asset-kind';

/**
 * Dynamic reverse geocoding service.
 * Resolves latitude/longitude coordinates to their most precise human-readable location
 * using live reverse-geocoding APIs (Photon/OpenStreetMap and BigDataCloud),
 * with client-side in-memory caching and request deduplication.
 * No hardcoded coordinates or bounding boxes.
 */

// Cache of resolved location names keyed by rounded coordinates (~11m precision: 4 decimals)
const locationCache = new Map<string, string>();

// In-flight promises to deduplicate simultaneous requests for identical coordinates
const inflightRequests = new Map<string, Promise<string>>();

// Listener mechanism so mounted DOM popups and React hooks are notified when coordinates resolve
type LocationResolvedListener = (key: string, locationName: string) => void;
const listeners = new Set<LocationResolvedListener>();

export function getCoordinatesCacheKey(lat: number, lon: number): string {
    return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export function getCachedLocationName(lat: number, lon: number): string | null {
    return locationCache.get(getCoordinatesCacheKey(lat, lon)) ?? null;
}

export function setCachedLocationName(
    lat: number,
    lon: number,
    name: string,
): void {
    locationCache.set(getCoordinatesCacheKey(lat, lon), name);
}

export function onLocationResolved(
    listener: LocationResolvedListener,
): () => void {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

function notifyLocationResolved(key: string, locationName: string): void {
    listeners.forEach((listener) => {
        try {
            listener(key, locationName);
        } catch {
            // Ignore listener errors
        }
    });
}

interface PhotonFeature {
    properties?: {
        name?: string;
        street?: string;
        locality?: string;
        district?: string;
        city?: string;
        county?: string;
        state?: string;
        country?: string;
        type?: string;
    };
}

function formatPhotonLocation(feature: PhotonFeature): string | null {
    const p = feature.properties;

    if (!p) {
        return null;
    }

    const parts: string[] = [];
    const name = p.name?.trim();
    const locality = p.locality?.trim();
    const district = p.district?.trim();
    const city = p.city?.trim() || p.county?.trim();

    // 1. Most precise: Street or POI name
    if (name && name.toLowerCase() !== city?.toLowerCase()) {
        parts.push(name);
    }

    // 2. Neighborhood / Suburb / Quarter (exclude generic district numbers)
    const subArea =
        locality ||
        (district && !/^district\s+[ivxlcdm0-9]+/i.test(district)
            ? district
            : null);

    if (
        subArea &&
        !parts.includes(subArea) &&
        subArea.toLowerCase() !== city?.toLowerCase()
    ) {
        parts.push(subArea);
    }

    // 3. City / Municipality
    if (city && !parts.includes(city)) {
        parts.push(city);
    } else if (parts.length === 0 && p.state) {
        parts.push(p.state.trim());
    }

    return parts.length > 0 ? parts.join(', ') : null;
}

interface BigDataCloudResponse {
    locality?: string;
    city?: string;
    principalSubdivision?: string;
    countryName?: string;
    localityInfo?: {
        informative?: Array<{ name: string; description?: string }>;
    };
}

function formatBigDataCloudLocation(data: BigDataCloudResponse): string | null {
    const parts: string[] = [];

    // Optional landmark name
    const landmark = data.localityInfo?.informative
        ?.find(
            (item) =>
                item.name &&
                !item.name.toLowerCase().includes('archdiocese') &&
                !item.name.toLowerCase().includes('district') &&
                !item.name.toLowerCase().includes('diocese'),
        )
        ?.name?.trim();

    const locality = data.locality?.trim();
    const city = data.city?.trim();

    if (landmark) {
        parts.push(landmark);
    }

    const cleanLocality = locality?.replace(/^City of\s+/i, '');
    const cleanCity = city?.replace(/^City of\s+/i, '');

    if (cleanLocality && !parts.includes(cleanLocality)) {
        parts.push(cleanLocality);
    } else if (cleanCity && !parts.includes(cleanCity)) {
        parts.push(cleanCity);
    }

    return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Dynamically reverse geocodes latitude/longitude coordinates to a human-readable location name.
 */
export async function reverseGeocode(
    latitude: number,
    longitude: number,
    signal?: AbortSignal,
): Promise<string> {
    const cacheKey = getCoordinatesCacheKey(latitude, longitude);
    const cached = locationCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const existingInflight = inflightRequests.get(cacheKey);

    if (existingInflight) {
        return existingInflight;
    }

    const fetchPromise = (async () => {
        // Strategy 1: Photon (OSM-powered, street/neighborhood/city precision, open CORS)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            if (signal) {
                signal.addEventListener('abort', () => controller.abort(), {
                    once: true,
                });
            }

            const photonUrl = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`;
            const res = await fetch(photonUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const json = (await res.json()) as {
                    features?: PhotonFeature[];
                };
                const features = json.features ?? [];

                if (features.length > 0 && features[0]) {
                    const formatted = formatPhotonLocation(features[0]);

                    if (formatted) {
                        locationCache.set(cacheKey, formatted);
                        notifyLocationResolved(cacheKey, formatted);

                        return formatted;
                    }
                }
            }
        } catch {
            // Photon failed or timed out; proceed to Strategy 2
        }

        // Strategy 2: BigDataCloud (administrative locality/city fallback)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            if (signal) {
                signal.addEventListener('abort', () => controller.abort(), {
                    once: true,
                });
            }

            const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
            const res = await fetch(bdcUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const json = (await res.json()) as BigDataCloudResponse;
                const formatted = formatBigDataCloudLocation(json);

                if (formatted) {
                    locationCache.set(cacheKey, formatted);
                    notifyLocationResolved(cacheKey, formatted);

                    return formatted;
                }
            }
        } catch {
            // BigDataCloud failed or timed out
        }

        // Strategy 3: Graceful fallback when network is completely offline
        const fallback = `GPS ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
        locationCache.set(cacheKey, fallback);
        notifyLocationResolved(cacheKey, fallback);

        return fallback;
    })().finally(() => {
        inflightRequests.delete(cacheKey);
    });

    inflightRequests.set(cacheKey, fetchPromise);

    return fetchPromise;
}

/**
 * React hook to resolve a location's most precise name dynamically without hardcoding.
 */
export function usePreciseLocation(
    location?: LocationResolutionInput | null,
): string {
    const jobSite = location?.job?.site?.trim();
    const assetLoc = location?.asset?.location?.trim();
    const lat = location?.latitude;
    const lon = location?.longitude;
    const hasCoords =
        lat !== null && lat !== undefined && lon !== null && lon !== undefined;

    const cacheKey = hasCoords ? getCoordinatesCacheKey(lat, lon) : null;

    const resolvedGeoName = useSyncExternalStore(
        useCallback(
            (notify) => {
                if (!cacheKey) {
                    return () => {};
                }

                return onLocationResolved((key) => {
                    if (key === cacheKey) {
                        notify();
                    }
                });
            },
            [cacheKey],
        ),
        () => (cacheKey ? (locationCache.get(cacheKey) ?? null) : null),
        () => null,
    );

    useEffect(() => {
        if (!hasCoords || jobSite || assetLoc) {
            return;
        }

        if (cacheKey && !locationCache.has(cacheKey)) {
            const controller = new AbortController();
            void reverseGeocode(lat, lon, controller.signal);

            return () => {
                controller.abort();
            };
        }
    }, [hasCoords, jobSite, assetLoc, cacheKey, lat, lon]);

    if (jobSite) {
        return jobSite;
    }

    if (assetLoc) {
        return assetLoc;
    }

    if (!hasCoords) {
        return 'Location unavailable';
    }

    return resolvedGeoName ?? 'Locating…';
}
