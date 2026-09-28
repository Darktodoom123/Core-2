import { useEffect, useSyncExternalStore } from 'react';
import type { PlaceName } from '../types/index';

/**
 * Nearest-address lookups for the field app.
 *
 * Order: a place the server already sent -> the Operations server (Stadia,
 * then Photon, then BigDataCloud, shared cache with the web app) -> the
 * device geocoder when the server cannot be reached. A failed lookup is
 * "unavailable"; coordinates are never shown as if they were a place name.
 */

export type PlaceLookup = (
    latitude: number,
    longitude: number,
) => Promise<PlaceName>;

export type DevicePlaceLookup = (
    latitude: number,
    longitude: number,
) => Promise<{ primary: string; secondary: string | null } | null>;

export type PlaceState =
    | { status: 'none' }
    | { status: 'pending' }
    | { status: 'unavailable' }
    | { status: 'resolved'; primary: string; secondary: string | null };

const UNAVAILABLE: PlaceName = {
    status: 'unavailable',
    primary: null,
    secondary: null,
    provider: null,
};

let serverLookup: PlaceLookup | null = null;
let deviceLookup: DevicePlaceLookup | null = null;
const cache = new Map<string, PlaceName>();
const inflight = new Map<string, Promise<PlaceName>>();
const listeners = new Set<() => void>();

/** Five decimals (~1 m), the same rounding the server cache uses. */
export function placeKey(latitude: number, longitude: number): string {
    return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

/** Six decimals (~0.1 m): never rounds away real GPS precision. */
export function formatCoordinates(latitude: number, longitude: number): string {
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/** One-line label: headline plus the nearest area. */
export function placeLabel(place: {
    primary: string | null;
    secondary: string | null;
}): string | null {
    if (!place.primary) {
        return null;
    }

    const area = place.secondary?.split(', ')[0];

    return area ? `${place.primary}, ${area}` : place.primary;
}

export function configurePlaceLookup(options: {
    server: PlaceLookup | null;
    device?: DevicePlaceLookup | null;
}): void {
    serverLookup = options.server;
    deviceLookup = options.device ?? null;
}

function store(key: string, place: PlaceName): void {
    cache.set(key, place);
    listeners.forEach((listener) => listener());
}

export function primePlace(
    latitude: number,
    longitude: number,
    place: PlaceName | null | undefined,
): void {
    if (!place || place.status === 'pending') {
        return;
    }

    const key = placeKey(latitude, longitude);

    if (cache.get(key)?.status !== 'resolved') {
        store(key, place);
    }
}

export function getCachedPlaceLabel(
    latitude: number,
    longitude: number,
): string | null {
    const place = cache.get(placeKey(latitude, longitude));

    return place?.status === 'resolved' ? placeLabel(place) : null;
}

async function lookup(latitude: number, longitude: number): Promise<PlaceName> {
    if (serverLookup) {
        try {
            const place = await serverLookup(latitude, longitude);

            if (place.status === 'resolved' && place.primary) {
                return place;
            }
        } catch {
            // Offline or server error: fall through to the device geocoder.
        }
    }

    if (deviceLookup) {
        const local = await deviceLookup(latitude, longitude).catch(() => null);

        if (local) {
            return { status: 'resolved', ...local, provider: 'device' };
        }
    }

    return UNAVAILABLE;
}

export async function resolvePlace(
    latitude: number,
    longitude: number,
): Promise<PlaceName> {
    const key = placeKey(latitude, longitude);
    const cached = cache.get(key);

    if (cached?.status === 'resolved') {
        return cached;
    }

    const existing = inflight.get(key);

    if (existing) {
        return existing;
    }

    const request = lookup(latitude, longitude)
        .then((place) => {
            store(key, place);

            return place;
        })
        .finally(() => inflight.delete(key));

    inflight.set(key, request);

    return request;
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

function isCoordinate(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/** Nearest address for a coordinate as React state. */
export function usePlaceName(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
    serverPlace?: PlaceName | null,
): PlaceState {
    const hasFix = isCoordinate(latitude) && isCoordinate(longitude);
    const key = hasFix ? placeKey(latitude, longitude as number) : null;

    if (hasFix) {
        primePlace(latitude, longitude as number, serverPlace);
    }

    const place = useSyncExternalStore(
        subscribe,
        () => (key ? (cache.get(key) ?? null) : null),
        () => null,
    );

    useEffect(() => {
        if (!hasFix || !key || cache.get(key)?.status === 'resolved') {
            return;
        }

        void resolvePlace(latitude, longitude as number);
    }, [hasFix, key, latitude, longitude]);

    if (!hasFix) {
        return { status: 'none' };
    }

    if (!place || place.status === 'pending') {
        return { status: 'pending' };
    }

    return place.status === 'resolved' && place.primary
        ? {
              status: 'resolved',
              primary: place.primary,
              secondary: place.secondary,
          }
        : { status: 'unavailable' };
}

/** Test helper. */
export function resetPlaceNames(): void {
    cache.clear();
    inflight.clear();
    serverLookup = null;
    deviceLookup = null;
}
