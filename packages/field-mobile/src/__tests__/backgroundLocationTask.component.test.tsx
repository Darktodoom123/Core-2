import { jest } from '@jest/globals';

jest.mock('expo-task-manager', () => ({
    defineTask: jest.fn(),
}));

jest.mock('expo-location', () => ({
    Accuracy: { Balanced: 3 },
    getBackgroundPermissionsAsync: jest.fn(),
    getForegroundPermissionsAsync: jest.fn(),
    hasStartedLocationUpdatesAsync: jest.fn(),
    startLocationUpdatesAsync: jest.fn(),
    stopLocationUpdatesAsync: jest.fn(),
}));

jest.mock('../native/backgroundLocationContext', () => ({
    clearBackgroundLocationContext: jest.fn(),
    loadBackgroundLocationContext: jest.fn(),
    saveBackgroundLocationContext: jest.fn(),
}));

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
    FIELD_BACKGROUND_LOCATION_TASK,
    registerBackgroundLocationUpdates,
} from '../native/backgroundLocationTask';

describe('background location task registration', () => {
    it('defines the task at module scope and starts native updates with safe options', async () => {
        expect(TaskManager.defineTask).toHaveBeenCalledWith(
            FIELD_BACKGROUND_LOCATION_TASK,
            expect.any(Function),
        );

        const grantedPermissions = {
            granted: true,
            canAskAgain: true,
            expires: 'never',
            status: 'granted',
        } as Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>;
        jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(
            grantedPermissions,
        );
        jest.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValue(
            grantedPermissions,
        );
        jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(
            false,
        );

        await registerBackgroundLocationUpdates({ actorId: 10, jobId: 101 });

        expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
            FIELD_BACKGROUND_LOCATION_TASK,
            expect.objectContaining({
                accuracy: 3,
                timeInterval: 120_000,
                deferredUpdatesInterval: 120_000,
                foregroundService: expect.objectContaining({
                    killServiceOnDestroy: true,
                }),
            }),
        );
    });
});
