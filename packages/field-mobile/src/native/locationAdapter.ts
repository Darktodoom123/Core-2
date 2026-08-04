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
    private locationModule: typeof import('expo-location') | null = null;
    private isInitialized = false;

    private async getModule(): Promise<typeof import('expo-location') | null> {
        if (this.isInitialized) {
            return this.locationModule;
        }

        try {
            // Dynamically import expo-location to prevent crashing in non-native Node/Jest test runners
            const module = await import('expo-location');
            this.locationModule = module;
        } catch {
            this.locationModule = null;
        }

        this.isInitialized = true;

        return this.locationModule;
    }

    public async checkPermissions(): Promise<LocationPermissionState> {
        const mod = await this.getModule();
        if (!mod) {
            return {
                foregroundGranted: false,
                backgroundGranted: false,
                canAskAgain: false,
            };
        }

        try {
            const fg = await mod.getForegroundPermissionsAsync();
            const bg = await mod.getBackgroundPermissionsAsync();

            return {
                foregroundGranted: fg.granted,
                backgroundGranted: bg.granted,
                canAskAgain: fg.canAskAgain && bg.canAskAgain,
            };
        } catch {
            return {
                foregroundGranted: false,
                backgroundGranted: false,
                canAskAgain: false,
            };
        }
    }

    public async requestPermissions(): Promise<LocationPermissionState> {
        const mod = await this.getModule();
        if (!mod) {
            return {
                foregroundGranted: false,
                backgroundGranted: false,
                canAskAgain: false,
            };
        }

        try {
            const fg = await mod.requestForegroundPermissionsAsync();
            let bgGranted = false;

            if (fg.granted) {
                const bg = await mod.requestBackgroundPermissionsAsync();
                bgGranted = bg.granted;
            }

            return {
                foregroundGranted: fg.granted,
                backgroundGranted: bgGranted,
                canAskAgain: fg.canAskAgain,
            };
        } catch {
            return {
                foregroundGranted: false,
                backgroundGranted: false,
                canAskAgain: false,
            };
        }
    }

    public async getCurrentLocation(): Promise<LocationCoordinates> {
        const mod = await this.getModule();
        if (!mod) {
            throw new Error('Native location module is not available on this platform.');
        }

        const position = await mod.getCurrentPositionAsync({
            accuracy: mod.Accuracy.High,
        });

        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMetres: position.coords.accuracy ?? null,
        };
    }
}

export const nativeLocationAdapter = new NativeLocationAdapter();
