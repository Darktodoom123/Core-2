import * as Location from 'expo-location';
import type { LocationCoordinates } from '../services/locationService';

export interface LocationPermissionState {
    foregroundGranted: boolean;
    backgroundGranted: boolean;
    canAskAgain: boolean;
}

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

        // 1. Instant cache check if recent fix exists (< 10 minutes)
        try {
            const recentKnown = await Location.getLastKnownPositionAsync({
                maxAge: 10 * 60 * 1000,
            });

            if (
                recentKnown?.coords?.latitude !== undefined &&
                recentKnown?.coords?.longitude !== undefined
            ) {
                return {
                    latitude: recentKnown.coords.latitude,
                    longitude: recentKnown.coords.longitude,
                    accuracyMetres: recentKnown.coords.accuracy ?? null,
                };
            }
        } catch {
            // Proceed to live fix
        }

        // 2. Fast live fix with 3.5s timeout; falls back to any last known fix if indoors/slow
        try {
            const livePromise = Location.getCurrentPositionAsync({
                accuracy: isStationary
                    ? Location.Accuracy.Low
                    : Location.Accuracy.Balanced,
                mayShowUserSettingsDialog: true,
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('GPS timeout')), 3500),
            );

            const position = await Promise.race([livePromise, timeoutPromise]);

            return {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyMetres: position.coords.accuracy ?? null,
            };
        } catch {
            // 3. Fallback to any last known position if live fix fails or times out
            try {
                const fallbackLast = await Location.getLastKnownPositionAsync(
                    {},
                );

                if (
                    fallbackLast?.coords?.latitude !== undefined &&
                    fallbackLast?.coords?.longitude !== undefined
                ) {
                    return {
                        latitude: fallbackLast.coords.latitude,
                        longitude: fallbackLast.coords.longitude,
                        accuracyMetres: fallbackLast.coords.accuracy ?? null,
                    };
                }
            } catch {
                // Ignore fallback error
            }

            throw new Error('Device GPS location timed out or is unavailable.');
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
