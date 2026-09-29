import { useEffect, useSyncExternalStore } from 'react';
import type { LocationResolutionInput } from '@/lib/asset-kind';
import type { PlaceViewModel } from '@/types/workspace';

/**
 * Nearest-address lookups for coordinates.
 *
 * The browser never calls geocoding providers itself: every lookup goes to
 * the Operations server (`/operations/places/reverse`), which tries Stadia,
 * then Photon, then BigDataCloud and caches the answer for everyone. Pages
 * that already received a `place` from the server prime this cache so no
 * request is made at all.
 *
 * A failed lookup is "unavailable". Coordinates are never passed off as a
 * place name, and no location is ever invented.
 */

export interface DetailedLocationName {
    /** Most specific place: landmark, building, or street. */
    primary: string;
    /** Surrounding area from neighbourhood up to country, with postcode. */
    secondary: string | null;
}

export type PlaceState =
    | { status: 'none' }
    | { status: 'pending' }
    | { status: 'unavailable' }
    | ({ status: 'resolved' } & DetailedLocationName);

const LOOKUP_URL = '/operations/places/reverse';

const placeCache = new Map<string, PlaceViewModel>();
const inflightRequests = new Map<string, Promise<PlaceViewModel>>();

type LocationResolvedListener = (key: string, locationName: string) => void;
const listeners = new Set<LocationResolvedListener>();
const storeListeners = new Set<() => void>();

/** Five decimals (~1 m) — the same rounding the server cache uses. */
export function getCoordinatesCacheKey(lat: number, lon: number): string {
    return `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
}

/** Short one-line label: headline plus the nearest area. */
export function placeLabel(
    place: Pick<PlaceViewModel, 'primary' | 'secondary'>,
): string | null {
    if (!place.primary) {
        return null;
    }

    const area = place.secondary?.split(', ')[0];

    return area ? `${place.primary}, ${area}` : place.primary;
}

function isCoordinate(lat: unknown, lon: unknown): lat is number {
    return (
        typeof lat === 'number' &&
        typeof lon === 'number' &&
        Number.isFinite(lat) &&
        Number.isFinite(lon)
    );
}

function store(key: string, place: PlaceViewModel): void {
    placeCache.set(key, place);
    storeListeners.forEach((listener) => listener());

    const label = place.status === 'resolved' ? placeLabel(place) : null;

    if (label) {
        listeners.forEach((listener) => {
            try {
                listener(key, label);
            } catch {
                // Listener errors must not break other subscribers.
            }
        });
    }
}

export function getCachedPlace(
    lat: number,
    lon: number,
): PlaceViewModel | null {
    return placeCache.get(getCoordinatesCacheKey(lat, lon)) ?? null;
}

export function getCachedLocationName(lat: number, lon: number): string | null {
    const place = getCachedPlace(lat, lon);

    return place?.status === 'resolved' ? placeLabel(place) : null;
}

/** Seed the cache with a known name (tests, optimistic UI). */
export function setCachedLocationName(
    lat: number,
    lon: number,
    name: string,
): void {
    store(getCoordinatesCacheKey(lat, lon), {
        status: 'resolved',
        primary: name,
        secondary: null,
        provider: null,
    });
}

/** Use a `place` the server already sent with a location. */
export function primePlace(
    lat: number | null | undefined,
    lon: number | null | undefined,
    place: PlaceViewModel | null | undefined,
): void {
    if (!isCoordinate(lat, lon) || !place || place.status === 'pending') {
        return;
    }

    const key = getCoordinatesCacheKey(lat, lon as number);
    const current = placeCache.get(key);

    if (current?.status !== 'resolved') {
        store(key, place);
    }
}

export function onLocationResolved(
    listener: LocationResolvedListener,
): () => void {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

function subscribeStore(listener: () => void): () => void {
    storeListeners.add(listener);

    return () => {
        storeListeners.delete(listener);
    };
}

async function requestPlace(
    lat: number,
    lon: number,
    signal?: AbortSignal,
): Promise<PlaceViewModel> {
    const unavailable: PlaceViewModel = {
        status: 'unavailable',
        primary: null,
        secondary: null,
        provider: null,
    };

    try {
        const params = new URLSearchParams({
            latitude: String(lat),
            longitude: String(lon),
        });
        const response = await fetch(`${LOOKUP_URL}?${params}`, {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            signal,
        });

        if (!response.ok) {
            return unavailable;
        }

        const json = (await response.json()) as { data?: PlaceViewModel };

        return json.data?.status === 'resolved' && json.data.primary
            ? json.data
            : unavailable;
    } catch {
        return unavailable;
    }
}

/** Resolve (or reuse) the place for a coordinate. Deduplicates requests. */
export async function resolvePlace(
    lat: number,
    lon: number,
    signal?: AbortSignal,
): Promise<PlaceViewModel> {
    const key = getCoordinatesCacheKey(lat, lon);
    const cached = placeCache.get(key);

    if (cached && cached.status !== 'pending') {
        return cached;
    }

    const existing = inflightRequests.get(key);

    if (existing) {
        return existing;
    }

    const request = requestPlace(lat, lon, signal)
        .then((place) => {
            // An aborted request says nothing about the place; don't cache it.
            if (!signal?.aborted) {
                store(key, place);
            }

            return place;
        })
        .finally(() => {
            inflightRequests.delete(key);
        });

    inflightRequests.set(key, request);

    return request;
}

/** One-line nearest address, or null when no provider could name it. */
export async function reverseGeocode(
    latitude: number,
    longitude: number,
    signal?: AbortSignal,
): Promise<string | null> {
    const place = await resolvePlace(latitude, longitude, signal);

    return place.status === 'resolved' ? placeLabel(place) : null;
}

/** Headline + surrounding area, or null when unavailable. */
export async function reverseGeocodeDetailed(
    latitude: number,
    longitude: number,
    signal?: AbortSignal,
): Promise<DetailedLocationName | null> {
    const place = await resolvePlace(latitude, longitude, signal);

    return place.status === 'resolved' && place.primary
        ? { primary: place.primary, secondary: place.secondary }
        : null;
}

/**
 * Nearest address for a coordinate as React state. Uses the server-sent
 * `place` when given; otherwise looks it up once and shares the result.
 */
export function usePlace(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
    serverPlace?: PlaceViewModel | null,
): PlaceState {
    const hasFix = isCoordinate(latitude, longitude);
    const key = hasFix
        ? getCoordinatesCacheKey(latitude, longitude as number)
        : null;

    if (hasFix) {
        primePlace(latitude, longitude, serverPlace);
    }

    const cached = useSyncExternalStore(
        subscribeStore,
        () => (key ? (placeCache.get(key) ?? null) : null),
        () => null,
    );

    useEffect(() => {
        if (!hasFix || !key || placeCache.get(key)?.status === 'resolved') {
            return;
        }

        const controller = new AbortController();
        void resolvePlace(latitude, longitude as number, controller.signal);

        return () => controller.abort();
    }, [hasFix, key, latitude, longitude]);

    if (!hasFix) {
        return { status: 'none' };
    }

    if (!cached || cached.status === 'pending') {
        return { status: 'pending' };
    }

    return cached.status === 'resolved' && cached.primary
        ? {
              status: 'resolved',
              primary: cached.primary,
              secondary: cached.secondary,
          }
        : { status: 'unavailable' };
}

export const ADDRESS_PENDING_LABEL = 'Finding address…';
export const ADDRESS_UNAVAILABLE_LABEL = 'Address unavailable';

/**
 * One-line location for lists and cards. With a GPS fix: the nearest
 * address. Without one: the assigned job site or asset base, labelled so it
 * is never mistaken for a live position.
 */
export function usePreciseLocation(
    location?:
        (LocationResolutionInput & { place?: PlaceViewModel | null }) | null,
): string {
    const place = usePlace(
        location?.latitude,
        location?.longitude,
        location?.place,
    );

    if (place.status === 'resolved') {
        return placeLabel(place) ?? place.primary;
    }

    if (place.status === 'pending') {
        return ADDRESS_PENDING_LABEL;
    }

    if (place.status === 'unavailable') {
        return ADDRESS_UNAVAILABLE_LABEL;
    }

    const jobSite = location?.job?.site?.trim();

    if (jobSite) {
        return `Job site: ${jobSite} (no live GPS)`;
    }

    const assetBase = location?.asset?.location?.trim();

    if (assetBase) {
        return `Base: ${assetBase} (no live GPS)`;
    }

    return 'No GPS fix';
}

/** Test helper: forget every cached place. */
export function clearPlaceCache(): void {
    placeCache.clear();
    inflightRequests.clear();
    storeListeners.forEach((listener) => listener());
}
