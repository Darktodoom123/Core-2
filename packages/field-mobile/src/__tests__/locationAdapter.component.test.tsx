jest.mock('expo-location', () => ({
    Accuracy: { Balanced: 1, Low: 2, High: 3 },
    getForegroundPermissionsAsync: jest.fn(),
    getBackgroundPermissionsAsync: jest.fn(),
    requestForegroundPermissionsAsync: jest.fn(),
    getLastKnownPositionAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
}));

import * as Location from 'expo-location';
import {
    CURRENT_FIX_MAX_CACHE_AGE_MS,
    CURRENT_FIX_MAX_FALLBACK_AGE_MS,
    NativeLocationAdapter,
    TRACKING_MAX_FIX_AGE_MS,
} from '../native/locationAdapter';

const foregroundPermissions =
    Location.getForegroundPermissionsAsync as jest.Mock;
const backgroundPermissions =
    Location.getBackgroundPermissionsAsync as jest.Mock;
const requestForegroundPermissions =
    Location.requestForegroundPermissionsAsync as jest.Mock;
const lastKnownPosition = Location.getLastKnownPositionAsync as jest.Mock;
const currentPosition = Location.getCurrentPositionAsync as jest.Mock;

describe('NativeLocationAdapter duty snapshots', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        foregroundPermissions.mockResolvedValue({
            granted: true,
            canAskAgain: true,
        });
        backgroundPermissions.mockResolvedValue({ granted: false });
        requestForegroundPermissions.mockResolvedValue({
            granted: false,
            canAskAgain: false,
        });
    });

    it('labels a live GPS observation as fresh and preserves its timestamp', async () => {
        const observedAt = Date.now();
        lastKnownPosition.mockResolvedValue(null);
        currentPosition.mockResolvedValue({
            timestamp: observedAt,
            coords: {
                latitude: 14.5995,
                longitude: 120.9842,
                accuracy: 6,
            },
        });

        await expect(
            new NativeLocationAdapter().getDutyLocationSnapshot(),
        ).resolves.toEqual({
            latitude: 14.5995,
            longitude: 120.9842,
            accuracyMetres: 6,
            observedAt: new Date(observedAt).toISOString(),
            source: 'gps',
        });
        expect(currentPosition).toHaveBeenCalledWith(
            expect.objectContaining({
                mayShowUserSettingsDialog: false,
            }),
        );
    });

    it('asks the GPS radio for a high-accuracy live fix', async () => {
        lastKnownPosition.mockResolvedValue(null);
        currentPosition.mockResolvedValue({
            timestamp: Date.now(),
            coords: { latitude: 14.5995, longitude: 120.9842, accuracy: 5 },
        });

        await new NativeLocationAdapter().getCurrentLocation(false);

        expect(currentPosition).toHaveBeenCalledWith(
            expect.objectContaining({ accuracy: Location.Accuracy.High }),
        );
    });

    it('reuses a cached fix only when it is fresh and precise', async () => {
        const liveFix = {
            timestamp: Date.now(),
            coords: { latitude: 14.5995, longitude: 120.9842, accuracy: 5 },
        };
        currentPosition.mockResolvedValue(liveFix);
        const adapter = new NativeLocationAdapter();

        lastKnownPosition.mockResolvedValueOnce({
            timestamp: Date.now() - 10 * 1000,
            coords: { latitude: 14.6, longitude: 120.98, accuracy: 12 },
        });
        await expect(adapter.getCurrentLocation(false)).resolves.toMatchObject(
            { latitude: 14.6, source: 'last_known' },
        );
        expect(currentPosition).not.toHaveBeenCalled();

        lastKnownPosition.mockResolvedValueOnce({
            timestamp: Date.now() - (CURRENT_FIX_MAX_CACHE_AGE_MS + 1000),
            coords: { latitude: 14.6, longitude: 120.98, accuracy: 12 },
        });
        await expect(adapter.getCurrentLocation(false)).resolves.toMatchObject(
            { latitude: 14.5995, source: 'gps' },
        );

        lastKnownPosition.mockResolvedValueOnce({
            timestamp: Date.now() - 10 * 1000,
            coords: { latitude: 14.6, longitude: 120.98, accuracy: 800 },
        });
        await expect(adapter.getCurrentLocation(false)).resolves.toMatchObject(
            { latitude: 14.5995, source: 'gps' },
        );
    });

    it('rejects mocked fixes from test providers and fake-GPS apps', async () => {
        const mocked = {
            timestamp: Date.now(),
            mocked: true,
            coords: { latitude: 14.5995, longitude: 120.9842, accuracy: 5 },
        };
        lastKnownPosition.mockResolvedValue(mocked);
        currentPosition.mockResolvedValue(mocked);
        const adapter = new NativeLocationAdapter();

        await expect(adapter.getCurrentLocation(false)).rejects.toThrow(
            'unavailable',
        );
        await expect(adapter.getTrackingLocation()).rejects.toThrow(
            'unavailable',
        );
        await expect(adapter.getDutyLocationSnapshot()).resolves.toMatchObject(
            { latitude: null, source: 'unavailable' },
        );
    });

    it('never falls back to a last known fix older than the fallback window', async () => {
        currentPosition.mockRejectedValue(new Error('GPS timeout'));
        lastKnownPosition.mockResolvedValueOnce(null).mockResolvedValueOnce({
            timestamp: Date.now() - (CURRENT_FIX_MAX_FALLBACK_AGE_MS + 1000),
            coords: { latitude: 14.6, longitude: 120.98, accuracy: 25 },
        });

        await expect(
            new NativeLocationAdapter().getCurrentLocation(false),
        ).rejects.toThrow('unavailable');
        expect(lastKnownPosition).toHaveBeenLastCalledWith({
            maxAge: CURRENT_FIX_MAX_FALLBACK_AGE_MS,
        });
    });

    it('labels an older cached observation as last known', async () => {
        const observedAt = Date.now() - 3 * 60 * 1000;
        lastKnownPosition.mockResolvedValueOnce(null).mockResolvedValueOnce({
            timestamp: observedAt,
            coords: {
                latitude: 14.6,
                longitude: 120.98,
                accuracy: 25,
            },
        });
        currentPosition.mockRejectedValue(new Error('GPS timeout'));

        await expect(
            new NativeLocationAdapter().getDutyLocationSnapshot(),
        ).resolves.toMatchObject({
            latitude: 14.6,
            longitude: 120.98,
            accuracyMetres: 25,
            observedAt: new Date(observedAt).toISOString(),
            source: 'last_known',
        });
    });

    it('returns explicit unavailable states for denied permission and missing GPS', async () => {
        foregroundPermissions.mockResolvedValue({
            granted: false,
            canAskAgain: false,
        });

        await expect(
            new NativeLocationAdapter().getDutyLocationSnapshot(),
        ).resolves.toEqual({
            latitude: null,
            longitude: null,
            accuracyMetres: null,
            observedAt: null,
            source: 'permission_denied',
        });

        foregroundPermissions.mockResolvedValue({
            granted: true,
            canAskAgain: true,
        });
        lastKnownPosition.mockResolvedValue(null);
        currentPosition.mockRejectedValue(new Error('GPS unavailable'));

        await expect(
            new NativeLocationAdapter().getDutyLocationSnapshot(),
        ).resolves.toEqual({
            latitude: null,
            longitude: null,
            accuracyMetres: null,
            observedAt: null,
            source: 'unavailable',
        });
    });
});

describe('NativeLocationAdapter tracking fixes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        foregroundPermissions.mockResolvedValue({
            granted: true,
            canAskAgain: true,
        });
        backgroundPermissions.mockResolvedValue({ granted: true });
    });

    it('asks for a live GPS fix instead of reusing a cached one', async () => {
        const observedAt = Date.now();
        currentPosition.mockResolvedValue({
            timestamp: observedAt,
            coords: { latitude: 14.56, longitude: 121.03, accuracy: 4 },
        });

        await expect(
            new NativeLocationAdapter().getTrackingLocation(),
        ).resolves.toMatchObject({
            latitude: 14.56,
            observedAt: new Date(observedAt).toISOString(),
            source: 'gps',
        });
        expect(currentPosition).toHaveBeenCalledWith(
            expect.objectContaining({ accuracy: Location.Accuracy.High }),
        );
        expect(lastKnownPosition).not.toHaveBeenCalled();
    });

    it('falls back only to a recent cached fix, and fails rather than send an old one', async () => {
        currentPosition.mockRejectedValue(new Error('no fix'));
        lastKnownPosition.mockResolvedValue(null);

        await expect(
            new NativeLocationAdapter().getTrackingLocation(),
        ).rejects.toThrow('unavailable');
        expect(lastKnownPosition).toHaveBeenCalledWith({
            maxAge: TRACKING_MAX_FIX_AGE_MS,
        });
    });
});
