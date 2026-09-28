import * as Location from 'expo-location';
import type {
    DutyLocationSnapshot,
    LocationCoordinates,
} from '../services/locationService';

export interface LocationPermissionState {
    foregroundGranted: boolean;
    backgroundGranted: boolean;
    canAskAgain: boolean;
}

/** Longest a live tracking fix may take; below the 15 s ping cadence. */
export const TRACKING_FIX_TIMEOUT_MS = 10_000;

/** Oldest cached fix tracking may send in place of a live one. */
export const TRACKING_MAX_FIX_AGE_MS = 30_000;

/** Oldest cached fix a one-off capture may reuse without asking the GPS. */
export const CURRENT_FIX_MAX_CACHE_AGE_MS = 60_000;

/** A cached fix is reused only when at least this precise. */
export const CURRENT_FIX_MAX_ACCURACY_METRES = 50;

/** Longest a one-off live fix may take; long enough for a warm GPS lock. */
export const CURRENT_FIX_TIMEOUT_MS = 8_000;

/** Oldest last-known fix a one-off capture may fall back to. */
export const CURRENT_FIX_MAX_FALLBACK_AGE_MS = 5 * 60_000;

/** Longest a duty status change waits for its location snapshot. */
export const DUTY_FIX_TIMEOUT_MS = 5_000;

/**
 * Android flags fixes from test providers and fake-GPS apps as mocked.
 * They mark a spot the device is not at, so no capture may use one.
 */
const isMockedFix = (position: Location.LocationObject): boolean =>
    position.mocked === true;

const requireRealFix = (
    position: Location.LocationObject,
): Location.LocationObject => {
    if (isMockedFix(position)) {
        throw new Error('Mock location rejected');
    }

    return position;
};

const fixAgeMs = (position: Location.LocationObject): number =>
    position.timestamp ? Date.now() - position.timestamp : Infinity;

const isUsableCachedFix = (
    position: Location.LocationObject | null | undefined,
    maxAgeMs: number,
    maxAccuracyMetres: number | null,
): position is Location.LocationObject => {
    if (
        position?.coords?.latitude === undefined ||
        position?.coords?.longitude === undefined ||
        isMockedFix(position)
    ) {
        return false;
    }

    if (fixAgeMs(position) > maxAgeMs) {
        return false;
    }

    if (maxAccuracyMetres === null) {
        return true;
    }

    const accuracy = position.coords.accuracy;

    return typeof accuracy === 'number' && accuracy <= maxAccuracyMetres;
};

const toCoordinates = (
    position: Location.LocationObject,
    source: 'gps' | 'last_known',
): LocationCoordinates => ({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMetres: position.coords.accuracy ?? null,
    observedAt: position.timestamp
        ? new Date(position.timestamp).toISOString()
        : null,
    source,
});

/**
 * Native location adapter providing hardware GPS access via expo-location with safe fallback for testing environments.
 */
export class NativeLocationAdapter {
    public async checkPermissions(): Promise<LocationPermissionState> {
        let fgGranted = false;
        let canAskAgain = true;

        try {
            const fg = await Location.getForegroundPermissionsAsync();
            fgGranted = fg.granted;
            canAskAgain = fg.canAskAgain;
        } catch {
            fgGranted = false;
        }

        let bgGranted = false;

        try {
            const bg = await Location.getBackgroundPermissionsAsync();
            bgGranted = bg.granted;
        } catch {
            bgGranted = false;
        }

        return {
            foregroundGranted: fgGranted,
            backgroundGranted: bgGranted,
            canAskAgain,
        };
    }

    public async requestPermissions(): Promise<LocationPermissionState> {
        let fgGranted = false;
        let canAskAgain = true;

        try {
            const fg = await Location.requestForegroundPermissionsAsync();
            fgGranted = fg.granted;
            canAskAgain = fg.canAskAgain;
        } catch {
            fgGranted = false;
        }

        return {
            foregroundGranted: fgGranted,
            backgroundGranted: false,
            canAskAgain,
        };
    }

    public async getCurrentLocation(
        isStationary = false,
    ): Promise<LocationCoordinates> {
        // Active permission check: request from user if not granted yet
        let permissions = await this.checkPermissions();

        if (!permissions.foregroundGranted) {
            permissions = await this.requestPermissions();
        }

        if (!permissions.foregroundGranted) {
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
                return new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) =>
                            resolve({
                                latitude: pos.coords.latitude,
                                longitude: pos.coords.longitude,
                                accuracyMetres: pos.coords.accuracy ?? null,
                                observedAt: pos.timestamp
                                    ? new Date(pos.timestamp).toISOString()
                                    : null,
                                source: 'browser_gps',
                            }),
                        (err) => reject(new Error(err.message)),
                        {
                            enableHighAccuracy: !isStationary,
                            timeout: 5000,
                            maximumAge: 60000,
                        },
                    );
                });
            }

            throw new Error(
                'Location permission is not granted in device settings.',
            );
        }

        // 1. Reuse a cached fix only when it is both fresh and precise; an
        // older or network-derived fix would place the worker somewhere
        // they no longer are.
        try {
            const recentKnown = await Location.getLastKnownPositionAsync({
                maxAge: CURRENT_FIX_MAX_CACHE_AGE_MS,
                requiredAccuracy: CURRENT_FIX_MAX_ACCURACY_METRES,
            });

            if (
                isUsableCachedFix(
                    recentKnown,
                    CURRENT_FIX_MAX_CACHE_AGE_MS,
                    CURRENT_FIX_MAX_ACCURACY_METRES,
                )
            ) {
                return toCoordinates(recentKnown, 'last_known');
            }
        } catch {
            // Proceed to live fix
        }

        // 2. Live fix. High accuracy uses the GPS radio; Balanced and Low
        // settle for Wi-Fi and cell towers, which are often hundreds of
        // metres off. A stationary unit can take Balanced since it is not
        // moving away from its last precise fix.
        try {
            const livePromise = Location.getCurrentPositionAsync({
                accuracy: isStationary
                    ? Location.Accuracy.Balanced
                    : Location.Accuracy.High,
                // GPS capture starts as part of an active work flow. Keep
                // Android's location-accuracy prompt from stealing the app;
                // callers surface a clear in-app recovery message instead.
                mayShowUserSettingsDialog: false,
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error('GPS timeout')),
                    CURRENT_FIX_TIMEOUT_MS,
                ),
            );

            const position = await Promise.race([livePromise, timeoutPromise]);

            return toCoordinates(requireRealFix(position), 'gps');
        } catch {
            // 3. Fall back to a last known fix, but never one so old it
            // shows a place the worker has long left.
            try {
                const fallbackLast = await Location.getLastKnownPositionAsync({
                    maxAge: CURRENT_FIX_MAX_FALLBACK_AGE_MS,
                });

                if (
                    isUsableCachedFix(
                        fallbackLast,
                        CURRENT_FIX_MAX_FALLBACK_AGE_MS,
                        null,
                    )
                ) {
                    return toCoordinates(fallbackLast, 'last_known');
                }
            } catch {
                // Ignore fallback error
            }

            throw new Error('Device GPS location timed out or is unavailable.');
        }
    }

    /**
     * A fix for live tracking. Unlike getCurrentLocation, it never reuses a
     * cached fix older than TRACKING_MAX_FIX_AGE_MS: a ping marks where the
     * unit is now, and an old fix sent as new would show a wrong spot as
     * fresh on the dispatch map. With no fresh fix it throws, the ping is
     * skipped, and the map shows the unit as delayed.
     */
    public async getTrackingLocation(): Promise<LocationCoordinates> {
        const permissions = await this.checkPermissions();

        if (!permissions.foregroundGranted) {
            throw new Error(
                'Location permission is not granted in device settings.',
            );
        }

        try {
            const live = await Promise.race([
                Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                    mayShowUserSettingsDialog: false,
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error('GPS timeout')),
                        TRACKING_FIX_TIMEOUT_MS,
                    ),
                ),
            ]);

            return toCoordinates(requireRealFix(live), 'gps');
        } catch {
            const recent = await Location.getLastKnownPositionAsync({
                maxAge: TRACKING_MAX_FIX_AGE_MS,
            }).catch(() => null);

            if (recent?.coords && !isMockedFix(recent)) {
                return toCoordinates(recent, 'last_known');
            }

            throw new Error('Device GPS location timed out or is unavailable.');
        }
    }

    /**
     * Duty logging must remain available when permission or hardware GPS is
     * unavailable. The explicit unavailable snapshot is persisted with the
     * event instead of borrowing a later synchronization location.
     */
    public async getDutyLocationSnapshot(): Promise<DutyLocationSnapshot> {
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error('Duty location capture timed out')),
                DUTY_FIX_TIMEOUT_MS,
            ),
        );

        try {
            const location = await Promise.race([
                this.getCurrentLocation(false),
                timeoutPromise,
            ]);

            return {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracyMetres: location.accuracyMetres ?? null,
                observedAt: location.observedAt ?? null,
                source:
                    location.source === 'last_known'
                        ? 'last_known'
                        : location.source === 'browser_gps'
                          ? 'browser_gps'
                          : 'gps',
            };
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message.toLowerCase() : '';

            return {
                latitude: null,
                longitude: null,
                accuracyMetres: null,
                observedAt: null,
                source:
                    message.includes('permission') ||
                    message.includes('denied') ||
                    message.includes('settings')
                        ? 'permission_denied'
                        : 'unavailable',
            };
        }
    }

    /**
     * Full nearest address from the device geocoder, split into a headline
     * and the surrounding area. The offline fallback for server lookups.
     */
    public async reverseGeocodeAddress(
        latitude: number,
        longitude: number,
    ): Promise<{ primary: string; secondary: string | null } | null> {
        try {
            if (typeof Location.reverseGeocodeAsync !== 'function') {
                return null;
            }

            const addresses = await Promise.race([
                Location.reverseGeocodeAsync({ latitude, longitude }),
                new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), 3000),
                ),
            ]);
            const addr = addresses?.[0];

            if (!addr) {
                return null;
            }

            const seen = new Set<string>();
            const distinct = (parts: Array<string | null | undefined>) =>
                parts
                    .map((part) => part?.trim() ?? '')
                    .filter((part) => {
                        const key = part.toLowerCase();

                        if (!part || seen.has(key)) {
                            return false;
                        }

                        seen.add(key);

                        return true;
                    });
            const street = [addr.streetNumber, addr.street]
                .filter(Boolean)
                .join(' ');
            const primary = distinct([
                addr.name && addr.name !== addr.streetNumber ? addr.name : null,
                street || null,
            ]);
            const area = distinct([
                addr.district,
                addr.city,
                addr.subregion,
                [addr.region, addr.postalCode].filter(Boolean).join(' ') ||
                    null,
                addr.country,
            ]);

            if (primary.length === 0 && area.length === 0) {
                return null;
            }

            const headline =
                primary.length > 0 ? primary : [area.shift() as string];

            return {
                primary: headline.join(', '),
                secondary: area.length > 0 ? area.join(', ') : null,
            };
        } catch {
            return null;
        }
    }

    public async reverseGeocodeCity(
        latitude: number,
        longitude: number,
    ): Promise<string | null> {
        try {
            if (typeof Location.reverseGeocodeAsync !== 'function') {
                return null;
            }

            const geocodePromise = Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            const timeoutPromise = new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), 2000),
            );

            const addresses = await Promise.race([
                geocodePromise,
                timeoutPromise,
            ]);

            if (addresses && addresses.length > 0) {
                const addr = addresses[0];

                const genericRegions = [
                    'metro manila',
                    'national capital region',
                    'ncr',
                    'philippines',
                ];

                const rawCity = addr.city ? addr.city.trim() : null;
                const rawSubregion = addr.subregion
                    ? addr.subregion.trim()
                    : null;
                const rawDistrict = addr.district ? addr.district.trim() : null;

                let candidate: string | null = null;

                if (
                    rawCity &&
                    !genericRegions.includes(rawCity.toLowerCase())
                ) {
                    candidate = rawCity;
                } else if (
                    rawSubregion &&
                    !genericRegions.includes(rawSubregion.toLowerCase())
                ) {
                    candidate = rawSubregion;
                } else if (rawDistrict) {
                    candidate = rawDistrict;
                } else {
                    candidate = rawCity || rawSubregion || addr.region || null;
                }

                if (candidate) {
                    candidate = candidate.replace(/^City of\s+/i, '').trim();
                }

                return candidate;
            }
        } catch {
            return null;
        }

        return null;
    }
}

export const nativeLocationAdapter = new NativeLocationAdapter();
