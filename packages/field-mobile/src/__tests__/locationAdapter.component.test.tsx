jest.mock('expo-location', () => ({
    Accuracy: { Balanced: 1, Low: 2 },
    getForegroundPermissionsAsync: jest.fn(),
    getBackgroundPermissionsAsync: jest.fn(),
    requestForegroundPermissionsAsync: jest.fn(),
    getLastKnownPositionAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
}));

import * as Location from 'expo-location';
import { NativeLocationAdapter } from '../native/locationAdapter';

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
    });

    it('labels an older cached observation as last known', async () => {
        const observedAt = Date.now() - 20 * 60 * 1000;
        lastKnownPosition
            .mockResolvedValueOnce({
                timestamp: observedAt,
                coords: {
                    latitude: 14.6,
                    longitude: 120.98,
                    accuracy: 25,
                },
            })
            .mockResolvedValueOnce(null);
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
