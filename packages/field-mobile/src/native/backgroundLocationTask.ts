import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { CommandOutboxManager } from '../services/commandOutbox';
import {
    createDefaultOutboxRepository,
    ExpoPayloadHasher,
} from '../storage/outboxRepository';
import {
    clearBackgroundLocationContext,
    loadBackgroundLocationContext,
    saveBackgroundLocationContext,
} from './backgroundLocationContext';
import type { BackgroundLocationContext } from './backgroundLocationContext';
import { createBackgroundLocationTaskExecutor } from './backgroundLocationExecutor';
import type { BackgroundLocationTaskData } from './backgroundLocationExecutor';

export const FIELD_BACKGROUND_LOCATION_TASK = 'core2-field-background-location';

const backgroundOutbox = new CommandOutboxManager({
    repository: createDefaultOutboxRepository(),
    hasher: new ExpoPayloadHasher(),
});

const executeBackgroundLocationTask = createBackgroundLocationTaskExecutor({
    loadContext: loadBackgroundLocationContext,
    outbox: backgroundOutbox,
});

let registrationOperation = Promise.resolve();

function enqueueRegistrationOperation(
    operation: () => Promise<void>,
): Promise<void> {
    const next = registrationOperation.then(operation);
    registrationOperation = next.catch(() => undefined);

    return next;
}

// Expo requires this registration at module scope because the task can run
// after the React tree has been suspended or the app process has been rebuilt.
TaskManager.defineTask<BackgroundLocationTaskData>(
    FIELD_BACKGROUND_LOCATION_TASK,
    executeBackgroundLocationTask,
);

export async function registerBackgroundLocationUpdates(
    context: BackgroundLocationContext,
): Promise<void> {
    return enqueueRegistrationOperation(async () => {
        const foreground = await Location.getForegroundPermissionsAsync();
        const background = await Location.getBackgroundPermissionsAsync();

        if (!foreground.granted || !background.granted) {
            throw new Error(
                'Foreground and background location permissions are required for background tracking.',
            );
        }

        await saveBackgroundLocationContext(context);

        try {
            const alreadyStarted =
                await Location.hasStartedLocationUpdatesAsync(
                    FIELD_BACKGROUND_LOCATION_TASK,
                );

            if (!alreadyStarted) {
                await Location.startLocationUpdatesAsync(
                    FIELD_BACKGROUND_LOCATION_TASK,
                    {
                        accuracy: Location.Accuracy.Balanced,
                        timeInterval: 120_000,
                        distanceInterval: 0,
                        deferredUpdatesInterval: 120_000,
                        pausesUpdatesAutomatically: false,
                        foregroundService: {
                            notificationTitle: 'Core 2 location sharing active',
                            notificationBody:
                                'Location updates are queued securely for the active assignment.',
                            killServiceOnDestroy: true,
                        },
                    },
                );
            }
        } catch (error: unknown) {
            await clearBackgroundLocationContext();

            throw error;
        }
    });
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
    return enqueueRegistrationOperation(async () => {
        try {
            const alreadyStarted =
                await Location.hasStartedLocationUpdatesAsync(
                    FIELD_BACKGROUND_LOCATION_TASK,
                );

            if (alreadyStarted) {
                await Location.stopLocationUpdatesAsync(
                    FIELD_BACKGROUND_LOCATION_TASK,
                );
            }
        } finally {
            await clearBackgroundLocationContext();
            backgroundOutbox.deactivateActor();
        }
    });
}
