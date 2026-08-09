import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { LocationObject } from 'expo-location';
import type { TaskManagerTaskBody } from 'expo-task-manager';
import { createBackgroundLocationTaskExecutor } from '../native/backgroundLocationExecutor';
import type { BackgroundLocationTaskData } from '../native/backgroundLocationExecutor';
import type { LocationSharePayload, OutboxCommand } from '../types/index';

const context = {
    actorId: 10,
    jobId: 101,
    operationalAssetId: 7,
};

function location(overrides: Partial<LocationObject> = {}): LocationObject {
    return {
        coords: {
            latitude: 14.5995,
            longitude: 120.9842,
            altitude: null,
            accuracy: 5,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        },
        timestamp: 1_754_712_000_000,
        ...overrides,
    };
}

function taskBody(
    locations: LocationObject[],
): TaskManagerTaskBody<BackgroundLocationTaskData> {
    return {
        data: { locations },
        error: null,
        executionInfo: {
            eventId: 'event-1',
            taskName: 'core2-field-background-location',
        },
    };
}

describe('Background location task executor', () => {
    test('converts real samples into actor-scoped durable outbox commands', async () => {
        const commands: LocationSharePayload[] = [];
        const outbox = {
            activateActor: async (actorId: number) => {
                assert.equal(actorId, context.actorId);
            },
            deactivateActor: () => undefined,
            enqueueShareLocation: async (payload: LocationSharePayload) => {
                commands.push(payload);

                return {} as OutboxCommand;
            },
        };
        const execute = createBackgroundLocationTaskExecutor({
            loadContext: async () => context,
            outbox,
            now: () => new Date('2026-08-09T08:00:00.000Z'),
        });

        await execute(taskBody([location()]));

        assert.equal(commands.length, 1);
        assert.deepEqual(commands[0], {
            dispatch_job_id: 101,
            operational_asset_id: 7,
            latitude: 14.5995,
            longitude: 120.9842,
            accuracy_metres: 5,
            sharing_enabled: true,
            captured_at: '2025-08-09T04:00:00.000Z',
            remarks: 'Background field telemetry',
        });
    });

    test('does not enqueue mocked or invalid provider samples', async () => {
        const commands: LocationSharePayload[] = [];
        const execute = createBackgroundLocationTaskExecutor({
            loadContext: async () => context,
            outbox: {
                activateActor: async () => undefined,
                deactivateActor: () => undefined,
                enqueueShareLocation: async (payload: LocationSharePayload) => {
                    commands.push(payload);

                    return {} as OutboxCommand;
                },
            },
        });

        await execute(
            taskBody([
                location({ mocked: true }),
                location({
                    coords: {
                        ...location().coords,
                        latitude: 91,
                    },
                }),
            ]),
        );

        assert.equal(commands.length, 0);
    });
});
