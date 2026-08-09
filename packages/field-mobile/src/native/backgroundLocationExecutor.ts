import type { LocationObject } from 'expo-location';
import type { TaskManagerTaskBody } from 'expo-task-manager';
import type { CommandOutboxManager } from '../services/commandOutbox';
import type { BackgroundLocationContext } from './backgroundLocationContext';
import { toLocationSharePayload } from './backgroundLocationPayload';

export interface BackgroundLocationTaskData {
    locations?: LocationObject[];
}

export interface BackgroundLocationTaskDependencies {
    loadContext: () => Promise<BackgroundLocationContext | null>;
    outbox: Pick<
        CommandOutboxManager,
        'activateActor' | 'deactivateActor' | 'enqueueShareLocation'
    >;
    now?: () => Date;
}

export function createBackgroundLocationTaskExecutor(
    dependencies: BackgroundLocationTaskDependencies,
): (body: TaskManagerTaskBody<BackgroundLocationTaskData>) => Promise<void> {
    let activeActorId: number | null = null;
    let processing = Promise.resolve();

    const processLocations = async (
        locations: LocationObject[],
    ): Promise<void> => {
        const context = await dependencies.loadContext();

        if (!context) {
            return;
        }

        if (activeActorId !== context.actorId) {
            if (activeActorId !== null) {
                dependencies.outbox.deactivateActor();
            }

            await dependencies.outbox.activateActor(context.actorId);
            activeActorId = context.actorId;
        }

        for (const location of locations) {
            const payload = toLocationSharePayload(
                location,
                context,
                dependencies.now,
            );

            if (payload) {
                await dependencies.outbox.enqueueShareLocation(payload);
            }
        }
    };

    return async (body): Promise<void> => {
        if (body.error || !Array.isArray(body.data?.locations)) {
            return;
        }

        const next = processing.then(() =>
            processLocations(body.data.locations!),
        );
        processing = next.catch(() => undefined);

        await next;
    };
}
