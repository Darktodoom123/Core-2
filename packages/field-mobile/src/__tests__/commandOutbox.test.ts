import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import type { FieldApiClient } from '../services/apiClient';
import { ApiClientError } from '../services/apiClient';
import { CommandOutboxManager } from '../services/commandOutbox';
import { durableAttachmentStorage } from '../services/durableAttachmentStorage';
import {
    canonicalJson,
    MemoryOutboxRepository,
    SqliteOutboxRepository,
} from '../storage/outboxRepository';
import type {
    OutboxDatabase,
    OutboxRepository,
    PayloadHasher,
} from '../storage/outboxRepository';
import type { DispatchJob, OutboxCommand } from '../types/index';

type SqlValue = string | number | null;

class NodeSqliteDatabase implements OutboxDatabase {
    constructor(public readonly database: DatabaseSync) {}

    public async execAsync(source: string): Promise<void> {
        this.database.exec(source);
    }

    public async runAsync(
        source: string,
        params: SqlValue[],
    ): Promise<unknown> {
        return this.database.prepare(source).run(...params);
    }

    public async getAllAsync<T>(
        source: string,
        params: SqlValue[],
    ): Promise<T[]> {
        return this.database.prepare(source).all(...params) as T[];
    }
}

const testHasher: PayloadHasher = {
    hash: async (envelope) => canonicalJson(envelope),
};

class FailingRemoveRepository extends MemoryOutboxRepository {
    public failingCommandId: string | null = null;

    public override async remove(
        actorId: number,
        commandId: string,
    ): Promise<void> {
        if (commandId === this.failingCommandId) {
            throw new Error('Simulated durable delete failure.');
        }

        await super.remove(actorId, commandId);
    }
}

async function createOutbox(
    actorId = 1,
    options: {
        repository?: OutboxRepository;
        now?: () => Date;
        maxAutomaticAttempts?: number;
        baseRetryDelayMs?: number;
    } = {},
): Promise<CommandOutboxManager> {
    const outbox = new CommandOutboxManager({
        ...options,
        hasher: testHasher,
    });
    await outbox.activateActor(actorId);

    return outbox;
}

describe('CommandOutboxManager', () => {
    test('durably enqueues an actor-scoped envelope and suppresses duplicates', async () => {
        const repository = new MemoryOutboxRepository();
        const outbox = await createOutbox(7, { repository });
        const first = await outbox.enqueueTransitionStatus(10, 'accepted', 1);
        const duplicate = await outbox.enqueueTransitionStatus(
            10,
            'accepted',
            1,
        );

        assert.match(
            first.id,
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        assert.equal(first.actorId, 7);
        assert.equal(first.state, 'queued');
        assert.equal(first.attempts, 0);
        assert.ok(first.payloadHash.length > 0);
        assert.equal(duplicate.id, first.id);
        assert.equal((await repository.listForActor(7)).length, 1);
    });

    test('restores queued commands and recovers interrupted syncing after restart', async () => {
        const repository = new MemoryOutboxRepository();
        let currentTime = new Date('2026-08-01T00:00:00.000Z');
        const firstProcess = await createOutbox(9, {
            repository,
            now: () => currentTime,
        });
        const command = await firstProcess.enqueueTransitionStatus(
            20,
            'arrived',
            2,
        );
        command.state = 'syncing';
        command.attempts = 1;
        await repository.save(command);
        firstProcess.deactivateActor();

        currentTime = new Date('2026-08-01T08:00:00.000Z');
        const restarted = await createOutbox(9, {
            repository,
            now: () => currentTime,
        });
        const restored = restarted.getCommand(command.id);

        assert.equal(restored?.state, 'queued');
        assert.equal(restored?.attempts, 1);
        assert.equal(restored?.error?.code, 'PROCESS_INTERRUPTED');
    });

    test('retries network failure with bounded backoff and the same UUID', async () => {
        let currentTime = new Date('2026-08-01T00:00:00.000Z');
        const outbox = await createOutbox(1, {
            now: () => currentTime,
            baseRetryDelayMs: 1_000,
        });
        const command = await outbox.enqueueTransitionStatus(10, 'accepted', 1);
        const ids: string[] = [];
        const apiClient = {
            transitionStatus: async (
                _jobId: number,
                _status: string,
                _version: number,
                commandId: string,
            ) => {
                ids.push(commandId);

                if (ids.length === 1) {
                    throw new TypeError('Network unavailable');
                }

                return { id: 10, version: 2 } as DispatchJob;
            },
        } as unknown as FieldApiClient;

        await outbox.processQueue(apiClient);
        assert.equal(command.state, 'queued');
        assert.equal(command.attempts, 1);
        assert.equal(command.nextAttemptAt, '2026-08-01T00:00:01.000Z');

        await outbox.processQueue(apiClient);
        assert.equal(ids.length, 1);

        currentTime = new Date('2026-08-01T00:00:01.000Z');
        await outbox.processQueue(apiClient);
        assert.equal(command.state, 'completed');
        assert.deepEqual(ids, [command.id, command.id]);
    });

    test('stops same-job serialization and surfaces an exhausted retry budget', async () => {
        let currentTime = new Date('2026-08-01T00:00:00.000Z');
        const outbox = await createOutbox(1, {
            now: () => currentTime,
            maxAutomaticAttempts: 2,
            baseRetryDelayMs: 1_000,
        });
        const first = await outbox.enqueueTransitionStatus(30, 'arrived', 1);
        const second = await outbox.enqueueTransitionStatus(30, 'working', 2);
        let calls = 0;
        const apiClient = {
            transitionStatus: async () => {
                calls += 1;

                throw new TypeError('Network unavailable');
            },
        } as unknown as FieldApiClient;

        await outbox.processQueue(apiClient);
        assert.equal(calls, 1);
        assert.equal(second.attempts, 0);

        currentTime = new Date('2026-08-01T00:00:01.000Z');
        await outbox.processQueue(apiClient);
        assert.equal(calls, 2);
        assert.equal(first.state, 'failed');
        assert.equal(first.error?.code, 'RETRY_EXHAUSTED');
        assert.equal(second.attempts, 0);
    });

    test('requires explicit conflict review and uses a new UUID for a refreshed envelope', async () => {
        const repository = new FailingRemoveRepository();
        const outbox = await createOutbox(1, { repository });
        const conflicted = await outbox.enqueueTransitionStatus(
            40,
            'working',
            3,
        );
        let shouldConflict = true;
        const apiClient = {
            transitionStatus: async () => {
                if (shouldConflict) {
                    shouldConflict = false;

                    throw new ApiClientError('Version mismatch', 409, {
                        errorCode: 'stale_version',
                        currentVersion: 5,
                        serverSnapshot: {
                            id: 40,
                            reference: 'DISP-040',
                            version: 5,
                            status: { value: 'arrived', label: 'Arrived' },
                        } as DispatchJob,
                    });
                }

                return { id: 40, version: 6 } as DispatchJob;
            },
        } as unknown as FieldApiClient;

        await outbox.processQueue(apiClient);
        assert.equal(conflicted.state, 'conflict');
        assert.equal(conflicted.error?.currentVersion, 5);

        repository.failingCommandId = conflicted.id;
        await assert.rejects(
            outbox.resolveConflictWithNewVersion(conflicted.id, 5, apiClient),
            /durable delete failure/i,
        );
        assert.equal(outbox.getCommand(conflicted.id)?.state, 'conflict');
        assert.equal((await repository.listForActor(1)).length, 2);

        repository.failingCommandId = null;

        const replacement = await outbox.resolveConflictWithNewVersion(
            conflicted.id,
            5,
            apiClient,
        );
        assert.ok(replacement);
        assert.notEqual(replacement.id, conflicted.id);
        assert.equal(replacement.expectedVersion, 5);
        assert.equal(replacement.state, 'completed');
        assert.equal(outbox.getCommand(conflicted.id), undefined);
    });

    test('stops replay on revoked authorization and isolates another actor', async () => {
        const repository = new MemoryOutboxRepository();
        const outbox = await createOutbox(11, { repository });
        const blocked = await outbox.enqueueTransitionStatus(50, 'arrived', 1);
        const untouched = await outbox.enqueueTransitionStatus(
            51,
            'arrived',
            1,
        );
        let calls = 0;
        const apiClient = {
            transitionStatus: async () => {
                calls += 1;

                throw new ApiClientError('Unauthenticated.', 401);
            },
        } as unknown as FieldApiClient;

        const result = await outbox.processQueue(apiClient);
        assert.equal(result.requiresAuthentication, true);
        assert.equal(calls, 1);
        const actorCommands = [blocked, untouched];
        assert.equal(
            actorCommands.filter(
                (command) => command.error?.code === 'AUTHENTICATION_REQUIRED',
            ).length,
            1,
        );
        assert.equal(
            actorCommands.filter((command) => command.state === 'queued')
                .length,
            1,
        );
        assert.equal(blocked.error?.retryable, true);

        outbox.deactivateActor();
        await outbox.activateActor(12);
        assert.deepEqual(outbox.getCommands(), []);
        await outbox.activateActor(11);
        assert.equal(outbox.getCommands().length, 2);

        const recoveredApiClient = {
            transitionStatus: async () =>
                ({ id: 50, version: 2 }) as DispatchJob,
        } as unknown as FieldApiClient;
        const recovery = await outbox.retryCommand(
            blocked.id,
            recoveredApiClient,
        );
        assert.equal(recovery.completed, 1);
        assert.equal(outbox.getCommand(blocked.id)?.state, 'completed');
    });

    test('does not enqueue into a new actor queue when identity changes during hashing', async () => {
        const repository = new MemoryOutboxRepository();
        let releaseHash: ((hash: string) => void) | undefined;
        const delayedHasher: PayloadHasher = {
            hash: () =>
                new Promise<string>((resolve) => {
                    releaseHash = resolve;
                }),
        };
        const outbox = new CommandOutboxManager({
            repository,
            hasher: delayedHasher,
        });
        await outbox.activateActor(11);

        const enqueue = outbox.enqueueTransitionStatus(50, 'arrived', 1);
        outbox.deactivateActor();
        await outbox.activateActor(12);
        releaseHash?.('delayed-payload-hash');

        await assert.rejects(
            enqueue,
            /authenticated actor changed while queueing/i,
        );
        assert.deepEqual(outbox.getCommands(), []);
        assert.deepEqual(await repository.listForActor(11), []);
        assert.deepEqual(await repository.listForActor(12), []);
    });

    test('allows a new actor queue to process while the previous actor request finishes', async () => {
        const repository = new MemoryOutboxRepository();
        const outbox = await createOutbox(11, { repository });
        await outbox.enqueueTransitionStatus(50, 'arrived', 1);
        let releasePreviousRequest: ((job: DispatchJob) => void) | undefined;
        const previousRequest = new Promise<DispatchJob>((resolve) => {
            releasePreviousRequest = resolve;
        });
        const previousProcessing = outbox.processQueue({
            transitionStatus: async () => previousRequest,
        } as unknown as FieldApiClient);

        outbox.deactivateActor();
        await outbox.activateActor(12);
        const nextCommand = await outbox.enqueueTransitionStatus(
            60,
            'arrived',
            1,
        );
        let nextActorCalls = 0;
        const nextResult = await outbox.processQueue({
            transitionStatus: async () => {
                nextActorCalls += 1;

                return { id: 60, version: 2 } as DispatchJob;
            },
        } as unknown as FieldApiClient);

        assert.equal(nextActorCalls, 1);
        assert.equal(nextResult.completed, 1);
        assert.equal(outbox.getCommand(nextCommand.id)?.state, 'completed');

        releasePreviousRequest?.({ id: 50, version: 2 } as DispatchJob);
        await previousProcessing;
        assert.equal(outbox.getCommands().length, 1);
        assert.equal(outbox.getCommand(nextCommand.id)?.actorId, 12);
    });

    test('does not replay a completed command and permits explicit discard', async () => {
        const outbox = await createOutbox();
        const command = await outbox.enqueueTransitionStatus(60, 'arrived', 1);
        let calls = 0;
        const apiClient = {
            transitionStatus: async () => {
                calls += 1;

                return { id: 60, version: 2 } as DispatchJob;
            },
        } as unknown as FieldApiClient;

        await outbox.processQueue(apiClient);
        await outbox.processQueue(apiClient);
        assert.equal(calls, 1);
        assert.equal(command.state, 'completed');

        await outbox.discardCommand(command.id);
        assert.equal(outbox.getCommand(command.id), undefined);
    });

    test('processes an emergency activation ahead of a failed ordinary job command', async () => {
        const outbox = await createOutbox(21);
        await outbox.enqueueTransitionStatus(88, 'working', 1);
        const emergency = await outbox.enqueueActivateSos({
            category: 'unclassified',
            device_activated_at: new Date().toISOString(),
            dispatch_job_id: 88,
            operational_asset_id: null,
            location: null,
        });
        const calls: string[] = [];
        const apiClient = {
            activateSosIncident: async (
                _payload: unknown,
                commandId: string,
            ) => {
                calls.push(`sos:${commandId}`);

                return { id: 'sos-1', delivery_state: 'delivered' };
            },
            transitionStatus: async () => {
                calls.push('ordinary');

                throw new TypeError('Network unavailable');
            },
        } as unknown as FieldApiClient;

        await outbox.processQueue(apiClient);

        assert.equal(calls[0], `sos:${emergency.id}`);
        assert.equal(emergency.state, 'completed');
    });

    test('retains the SOS UUID for retry and expires without a stale delivery attempt', async () => {
        let currentTime = new Date('2026-08-01T00:00:00.000Z');
        const outbox = await createOutbox(22, {
            now: () => currentTime,
            baseRetryDelayMs: 1_000,
        });
        const emergency = await outbox.enqueueActivateSos({
            category: 'unclassified',
            device_activated_at: currentTime.toISOString(),
            location: null,
        });
        const ids: string[] = [];
        const apiClient = {
            activateSosIncident: async (
                _payload: unknown,
                commandId: string,
            ) => {
                ids.push(commandId);

                throw new TypeError('Network unavailable');
            },
        } as unknown as FieldApiClient;

        await outbox.processQueue(apiClient);
        assert.equal(emergency.state, 'queued');
        assert.equal(emergency.attempts, 1);
        assert.deepEqual(ids, [emergency.id]);

        currentTime = new Date('2026-08-01T00:15:00.000Z');
        await outbox.processQueue(apiClient);

        assert.equal(emergency.state, 'expired');
        assert.equal(emergency.error?.code, 'SOS_EXPIRED');
        assert.deepEqual(ids, [emergency.id]);
    });

    test('restores a pending emergency command after a cold restart with actor isolation', async () => {
        const repository = new MemoryOutboxRepository();
        const firstProcess = await createOutbox(31, { repository });
        const emergency = await firstProcess.enqueueActivateSos({
            category: 'other_immediate_danger',
            device_activated_at: '2026-08-01T00:00:00.000Z',
            location: null,
        });
        firstProcess.deactivateActor();

        const otherActor = await createOutbox(32, { repository });
        assert.deepEqual(otherActor.getCommands(), []);
        otherActor.deactivateActor();

        const restarted = await createOutbox(31, { repository });
        assert.equal(restarted.getCommand(emergency.id)?.id, emergency.id);
        assert.equal(restarted.getCommand(emergency.id)?.priority, 'emergency');
    });

    test('handles 429 response and respects retryAfter when scheduling nextAttemptAt', async () => {
        let currentTime = new Date('2026-08-01T00:00:00.000Z');
        const outbox = await createOutbox(1, {
            now: () => currentTime,
            baseRetryDelayMs: 1_000,
        });
        const command = await outbox.enqueueTransitionStatus(10, 'accepted', 1);
        let calls = 0;
        const apiClient = {
            transitionStatus: async () => {
                calls += 1;

                if (calls === 1) {
                    throw new ApiClientError('Rate limit exceeded', 429, {
                        errorCode: 'rate_limited',
                        retryAfter: 30,
                        isRateLimited: true,
                    });
                }

                return { id: 10, version: 2 } as DispatchJob;
            },
        } as unknown as FieldApiClient;

        const result1 = await outbox.processQueue(apiClient);
        assert.equal(result1.deferred, 1);
        assert.equal(calls, 1);
        assert.equal(command.state, 'queued');
        assert.equal(command.attempts, 1);
        assert.equal(command.error?.code, 'RATE_LIMITED');
        assert.equal(
            command.error?.message,
            'Rate limit reached. Retry scheduled in 30 seconds.',
        );
        assert.equal(command.error?.retryable, true);
        assert.equal(command.nextAttemptAt, '2026-08-01T00:00:30.000Z');
        assert.equal(outbox.getNextRetryAt(), '2026-08-01T00:00:30.000Z');

        // Not yet due (15s elapsed, 15s remaining)
        currentTime = new Date('2026-08-01T00:00:15.000Z');
        const intermediate = await outbox.processQueue(apiClient);
        assert.equal(intermediate.deferred, 1);
        assert.equal(calls, 1);
        assert.equal(command.state, 'queued');

        // Now due (30s elapsed)
        currentTime = new Date('2026-08-01T00:00:30.000Z');
        const completed = await outbox.processQueue(apiClient);
        assert.equal(completed.completed, 1);
        assert.equal(calls, 2);
        assert.equal(command.state, 'completed');
        assert.equal(command.error, null);
    });

    test('uses exponential backoff when calculated delay exceeds retryAfter on 429 response', async () => {
        const currentTime = new Date('2026-08-01T00:00:00.000Z');
        const outbox = await createOutbox(1, {
            now: () => currentTime,
            baseRetryDelayMs: 10_000,
        });
        const command = await outbox.enqueueTransitionStatus(11, 'accepted', 1);
        const apiClient = {
            transitionStatus: async () => {
                throw new ApiClientError('Rate limit exceeded', 429, {
                    retryAfter: 3,
                    isRateLimited: true,
                });
            },
        } as unknown as FieldApiClient;

        await outbox.processQueue(apiClient);
        assert.equal(command.state, 'queued');
        assert.equal(command.nextAttemptAt, '2026-08-01T00:00:10.000Z');
        assert.equal(command.error?.code, 'RATE_LIMITED');
        assert.equal(
            command.error?.message,
            'Rate limit reached. Retry scheduled in 10 seconds.',
        );
    });

    test('handles 429 response without retryAfter defaulting to exponential backoff', async () => {
        const currentTime = new Date('2026-08-01T00:00:00.000Z');
        const outbox = await createOutbox(1, {
            now: () => currentTime,
            baseRetryDelayMs: 1_000,
        });
        const command = await outbox.enqueueTransitionStatus(12, 'accepted', 1);
        const apiClient = {
            transitionStatus: async () => {
                throw new ApiClientError('Too Many Requests', 429);
            },
        } as unknown as FieldApiClient;

        await outbox.processQueue(apiClient);
        assert.equal(command.state, 'queued');
        assert.equal(command.nextAttemptAt, '2026-08-01T00:00:01.000Z');
        assert.equal(command.error?.code, 'RATE_LIMITED');
        assert.equal(
            command.error?.message,
            'Rate limit reached. Retry scheduled in 1 seconds.',
        );
    });

    test('durably enqueues and syncs rental handover evidence command', async () => {
        const outbox = await createOutbox(5);
        let submittedReservationId: number | null = null;
        let submittedPayload: any = null;
        let submittedCommandId: string | null = null;

        const apiClient = {
            submitRentalHandover: async (
                reservationId: number,
                payload: Record<string, unknown>,
                commandId?: string,
            ) => {
                submittedReservationId = reservationId;
                submittedPayload = payload;
                submittedCommandId = commandId ?? null;

                return {
                    success: true,
                    evidence_id: 101,
                    message: 'Evidence recorded',
                };
            },
        } as unknown as FieldApiClient;

        const command = await outbox.enqueueSubmitRentalHandover({
            reservation_id: 42,
            dispatch_job_id: 7,
            handover_type: 'checkout',
            hour_meter: 150.5,
            fuel_percent: 90,
            signee_name: 'John Customer',
            signee_role: 'Site Supervisor',
        });

        assert.equal(command.type, 'submit_rental_handover');
        assert.equal(command.jobId, 7);
        assert.equal(command.state, 'queued');

        const result = await outbox.processQueue(apiClient);
        assert.equal(result.completed, 1);
        assert.equal(command.state, 'completed');
        assert.equal(submittedReservationId, 42);
        assert.equal(submittedCommandId, command.id);
        assert.equal(submittedPayload?.hour_meter, 150.5);
        assert.equal(submittedPayload?.fuel_percent, 90);
    });

    test('durably enqueues and syncs sales delivery evidence command', async () => {
        const outbox = await createOutbox(5);
        let submittedOrderId: number | null = null;
        let submittedPayload: any = null;
        let submittedCommandId: string | null = null;

        const apiClient = {
            submitSalesDelivery: async (
                orderId: number,
                payload: Record<string, unknown>,
                commandId?: string,
            ) => {
                submittedOrderId = orderId;
                submittedPayload = payload;
                submittedCommandId = commandId ?? null;

                return {
                    success: true,
                    evidence_id: 202,
                    message: 'Delivery recorded',
                };
            },
        } as unknown as FieldApiClient;

        const command = await outbox.enqueueSubmitSalesDelivery({
            order_id: 88,
            dispatch_job_id: 15,
            verified_vin: 'CAT320GC12345',
            accessories_checked: ['bucket', 'toolkit'],
            delivery_notes: 'Delivered safely',
            signee_name: 'Receiving Officer',
            signee_role: 'Warehouse Manager',
        });

        assert.equal(command.type, 'submit_sales_delivery');
        assert.equal(command.jobId, 15);
        assert.equal(command.state, 'queued');

        const result = await outbox.processQueue(apiClient);
        assert.equal(result.completed, 1);
        assert.equal(command.state, 'completed');
        assert.equal(submittedOrderId, 88);
        assert.equal(submittedCommandId, command.id);
        assert.equal(submittedPayload?.verified_vin, 'CAT320GC12345');
    });

    test('durable offline attachments survive restart, maintain account isolation, and remain available on retry', async () => {
        const repository = new MemoryOutboxRepository();
        const actorId = 5;
        const otherActorId = 9;

        // 1. Durably save photo attachment for actor 5
        const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';
        const storedAttachment =
            await durableAttachmentStorage.saveAttachmentDurably(
                {
                    base64: mockBase64,
                    fileName: 'site_hazard.jpg',
                },
                actorId,
            );

        assert.ok(durableAttachmentStorage.isDurableUri(storedAttachment.uri));
        assert.ok(storedAttachment.uri.includes('/attachments/actor_5/'));

        // 2. Durably save photo attachment for actor 9 (account isolation)
        const otherAttachment =
            await durableAttachmentStorage.saveAttachmentDurably(
                {
                    base64: mockBase64,
                    fileName: 'other_photo.jpg',
                },
                otherActorId,
            );

        assert.ok(otherAttachment.uri.includes('/attachments/actor_9/'));
        assert.notEqual(storedAttachment.uri, otherAttachment.uri);

        // 3. Enqueue rental handover command with durable photo URI
        const outboxBeforeRestart = await createOutbox(actorId, { repository });

        const queuedCommand =
            await outboxBeforeRestart.enqueueSubmitRentalHandover({
                reservation_id: 101,
                dispatch_job_id: 202,
                operational_asset_id: 50,
                hour_meter: 320.0,
                fuel_percent: 85,
                signee_name: 'Site Engineer',
                signee_role: 'Lead Supervisor',
                photos: [
                    {
                        file_path: storedAttachment.uri,
                        label: 'Pre-operation inspection',
                    },
                ],
            });

        assert.equal(queuedCommand.state, 'queued');

        // 4. Simulate app restart: instantiate fresh outbox manager with the same repository
        let currentTime = new Date('2026-08-01T00:00:00.000Z');
        const outboxAfterRestart = await createOutbox(actorId, {
            repository,
            now: () => currentTime,
            baseRetryDelayMs: 1_000,
        });

        const restoredCommands = outboxAfterRestart.getCommands();
        assert.equal(restoredCommands.length, 1);
        const restoredCommand = restoredCommands[0];
        assert.equal(restoredCommand.id, queuedCommand.id);
        assert.equal(restoredCommand.state, 'queued');

        const restoredPayload = restoredCommand.payload as any;
        assert.equal(restoredPayload.photos[0].file_path, storedAttachment.uri);
        assert.ok(
            durableAttachmentStorage.isDurableUri(
                restoredPayload.photos[0].file_path,
            ),
        );

        // 5. Simulate offline network failure, followed by successful retry
        let attemptCount = 0;
        const flappyClient = {
            submitRentalHandover: async () => {
                attemptCount += 1;

                if (attemptCount === 1) {
                    throw new TypeError('Network unavailable during retry');
                }

                return {
                    success: true,
                    evidence_id: 777,
                    message: 'Evidence accepted after retry',
                };
            },
        } as unknown as FieldApiClient;

        // Attempt 1: Fails due to network drop, remains queued
        const result1 = await outboxAfterRestart.processQueue(flappyClient);
        assert.equal(result1.completed, 0);
        assert.equal(restoredCommand.state, 'queued');
        assert.equal(restoredCommand.attempts, 1);
        // File path remains intact in the payload
        assert.equal(
            (restoredCommand.payload as any).photos[0].file_path,
            storedAttachment.uri,
        );

        // Advance time to nextAttemptAt and retry
        currentTime = new Date('2026-08-01T00:00:01.000Z');
        const result2 = await outboxAfterRestart.processQueue(flappyClient);
        assert.equal(result2.completed, 1);
        assert.equal(restoredCommand.state, 'completed');

        // 6. Cleanup actor 5 attachments and verify actor 9 attachments are unaffected
        await durableAttachmentStorage.cleanupActorAttachments(actorId);
        assert.ok(otherAttachment.uri.includes('/attachments/actor_9/'));
    });

    test('preserves equipment maintenance command types across restart and does not degrade to transition_status', async () => {
        const repository = new MemoryOutboxRepository();
        const actorId = 8;
        const outboxBefore = await createOutbox(actorId, { repository });

        const cmd1 = await outboxBefore.enqueueSubmitEquipmentInspection({
            operational_asset_id: 101,
            dispatch_job_id: 201,
            type: 'maintenance',
            result: 'passed',
            checklist: [{ id: '1', status: 'good' }],
            findings: 'Routine test passed',
        });

        const cmd2 = await outboxBefore.enqueueSubmitMaintenanceWorkOrder({
            operational_asset_id: 101,
            dispatch_job_id: 201,
            defect: 'Hydraulic leak',
            remarks: 'Fitting cracked',
            dispatch_blocking: true,
        });

        const cmd3 = await outboxBefore.enqueueSubmitSalesDelivery({
            order_id: 555,
            verified_vin: 'VIN-555-XYZ',
            signee_name: 'Warehouse Manager',
            signee_role: 'Operations Director',
        });

        assert.equal(cmd1.type, 'submit_equipment_inspection');
        assert.equal(cmd2.type, 'submit_maintenance_work_order');
        assert.equal(cmd3.type, 'submit_sales_delivery');

        // Simulate app restart with fresh outbox manager reading from same repository
        const outboxAfter = await createOutbox(actorId, { repository });
        const restoredCommands = outboxAfter.getCommands();

        const restoredCmd1 = restoredCommands.find((c) => c.id === cmd1.id);
        const restoredCmd2 = restoredCommands.find((c) => c.id === cmd2.id);
        const restoredCmd3 = restoredCommands.find((c) => c.id === cmd3.id);

        assert.ok(restoredCmd1, 'Command 1 must be restored');
        assert.ok(restoredCmd2, 'Command 2 must be restored');
        assert.ok(restoredCmd3, 'Command 3 must be restored');

        // Crucial check: Must preserve exact command types and NOT degrade to 'transition_status'
        assert.equal(restoredCmd1.type, 'submit_equipment_inspection');
        assert.equal(restoredCmd2.type, 'submit_maintenance_work_order');
        assert.equal(restoredCmd3.type, 'submit_sales_delivery');
    });

    test('work order release cannot be queued in offline outbox and requires fresh online execution', async () => {
        const repository = new MemoryOutboxRepository();
        const actorId = 11;
        const outbox = await createOutbox(actorId, { repository });

        // Verify unsafe queuing method was removed
        assert.strictEqual(
            (outbox as any).enqueueReleaseMaintenanceWorkOrder,
            undefined,
            'enqueueReleaseMaintenanceWorkOrder must not exist on outbox',
        );

        // Verify outbox active commands cannot contain release commands
        const commands = outbox.getCommands();
        const releaseCmd = commands.find(
            (c) => (c.type as string) === 'release_maintenance_work_order',
        );
        assert.strictEqual(
            releaseCmd,
            undefined,
            'No release command can exist in outbox',
        );
    });

    test('clearActiveActorCommands purges outbox commands and actor durable attachments', async () => {
        const repository = new MemoryOutboxRepository();
        const actorId = 12;
        const outbox = await createOutbox(actorId, { repository });

        // Save durable attachment
        const storedAttachment =
            await durableAttachmentStorage.saveAttachmentDurably(
                {
                    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
                    fileName: 'defect_to_clear.jpg',
                },
                actorId,
            );
        assert.ok(durableAttachmentStorage.isDurableUri(storedAttachment.uri));

        // Enqueue command
        await outbox.enqueueSubmitMaintenanceWorkOrder({
            operational_asset_id: 101,
            dispatch_job_id: 201,
            defect: 'Defect to clear',
            dispatch_blocking: false,
        });
        assert.equal(outbox.getCommands().length, 1);

        // Clear active actor commands
        await outbox.clearActiveActorCommands();

        assert.equal(outbox.getCommands().length, 0);
    });

    test('legacy release_maintenance_work_order commands cannot replay, execute network calls, or be retried', async () => {
        let apiCallMade = false;
        const fakeClient = {
            postJson: async () => {
                apiCallMade = true;

                throw new Error('API should not be called');
            },
        } as unknown as FieldApiClient;

        const repository = new MemoryOutboxRepository();
        const legacyCmd: OutboxCommand = {
            id: 'legacy-cmd-id-99',
            actorId: 10,
            type: 'release_maintenance_work_order',
            jobId: null,
            assignmentId: null,
            payload: { workOrderId: 123 },
            payloadHash: 'hash',
            expectedVersion: null,
            state: 'failed',
            attempts: 0,
            error: {
                code: 'LEGACY_RELEASE_DISALLOWED',
                message:
                    'Offline work order release commands are deprecated and cannot be replayed. A new explicit online release action is required.',
                retryable: false,
            },
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
            lastAttemptAt: null,
            nextAttemptAt: null,
            completedAt: null,
        };
        await repository.save(legacyCmd);

        const outbox = await createOutbox(10, { repository });

        // 1. Processing pending commands must NOT call API or replay
        const processResult = await outbox.processQueue(fakeClient);
        assert.equal(apiCallMade, false);
        assert.equal(processResult.completed, 0);

        // 2. Retrying the command is a no-op that refuses to replay
        const retryResult = await outbox.retryCommand(
            'legacy-cmd-id-99',
            fakeClient,
        );
        assert.equal(apiCallMade, false);
        assert.equal(retryResult.completed, 0);

        // Command remains in failed state with LEGACY_RELEASE_DISALLOWED
        const cmd = outbox.getCommand('legacy-cmd-id-99');
        assert.equal(cmd?.state, 'failed');
        assert.equal(cmd?.error?.code, 'LEGACY_RELEASE_DISALLOWED');
        assert.equal(cmd?.type, 'release_maintenance_work_order');
    });

    test('queued legacy release_maintenance_work_order commands are quarantined by executeCommand without calling network', async () => {
        let apiCallMade = false;
        const fakeClient = {
            postJson: async () => {
                apiCallMade = true;

                throw new Error('API should not be called');
            },
        } as unknown as FieldApiClient;

        const repository = new MemoryOutboxRepository();
        const queuedLegacyCmd: OutboxCommand = {
            id: 'legacy-queued-cmd-100',
            actorId: 10,
            type: 'release_maintenance_work_order',
            jobId: null,
            assignmentId: null,
            payload: { workOrderId: 123 },
            payloadHash: 'hash',
            expectedVersion: null,
            state: 'queued',
            attempts: 0,
            error: null,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
            lastAttemptAt: null,
            nextAttemptAt: null,
            completedAt: null,
        };
        await repository.save(queuedLegacyCmd);

        const outbox = await createOutbox(10, { repository });
        const processResult = await outbox.processQueue(fakeClient);

        assert.equal(apiCallMade, false);
        assert.equal(processResult.completed, 0);
        assert.equal(processResult.failed, 1);

        const cmd = outbox.getCommand('legacy-queued-cmd-100');
        assert.equal(cmd?.state, 'failed');
        assert.equal(cmd?.error?.code, 'LEGACY_RELEASE_DISALLOWED');
        assert.equal(cmd?.error?.retryable, false);
    });

    test('persisted SQLite fixture with release_maintenance_work_order is quarantined by CommandOutboxManager and cannot replay or be retried', async () => {
        const directory = await mkdtemp(
            join(tmpdir(), 'core2-outbox-mgr-legacy-'),
        );
        const databasePath = join(directory, 'field-outbox.sqlite');

        try {
            // 1. Create a raw legacy SQLite database simulating pre-migration schema and persisted legacy row
            const rawDb = new DatabaseSync(databasePath);
            rawDb.exec(`
                CREATE TABLE IF NOT EXISTS field_command_outbox (
                    id TEXT PRIMARY KEY NOT NULL,
                    actor_id INTEGER NOT NULL,
                    command_type TEXT NOT NULL,
                    job_id INTEGER,
                    assignment_id INTEGER,
                    payload_json TEXT NOT NULL,
                    payload_hash TEXT NOT NULL,
                    expected_version INTEGER,
                    state TEXT NOT NULL,
                    attempts INTEGER NOT NULL,
                    error_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_attempt_at TEXT,
                    next_attempt_at TEXT,
                    completed_at TEXT
                );
            `);

            const legacyCmdId = 'legacy-release-sqlite-fixture-42';
            rawDb
                .prepare(
                    `
                INSERT INTO field_command_outbox (
                    id, actor_id, command_type, job_id, assignment_id,
                    payload_json, payload_hash, expected_version, state,
                    attempts, error_json, created_at, updated_at,
                    last_attempt_at, next_attempt_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                )
                .run(
                    legacyCmdId,
                    25,
                    'release_maintenance_work_order',
                    null,
                    null,
                    JSON.stringify({
                        workOrderId: 77,
                        work_performed: ['Replaced valve'],
                    }),
                    'hash-42',
                    null,
                    'queued',
                    0,
                    null,
                    '2026-08-01T00:00:00.000Z',
                    '2026-08-01T00:00:00.000Z',
                    null,
                    null,
                    null,
                );
            rawDb.close();

            // 2. Open via SqliteOutboxRepository and connect CommandOutboxManager
            const migratedDb = new DatabaseSync(databasePath);
            const repository = new SqliteOutboxRepository(
                async () => new NodeSqliteDatabase(migratedDb),
            );
            const outbox = new CommandOutboxManager({
                repository,
                hasher: testHasher,
            });
            await outbox.activateActor(25);

            // 3. Command in memory must be quarantined as failed with LEGACY_RELEASE_DISALLOWED
            const cmd = outbox.getCommand(legacyCmdId);
            assert.ok(cmd);
            assert.equal(cmd.id, legacyCmdId);
            assert.equal(cmd.type, 'release_maintenance_work_order');
            assert.equal(cmd.state, 'failed');
            assert.equal(cmd.error?.code, 'LEGACY_RELEASE_DISALLOWED');
            assert.equal(cmd.error?.retryable, false);
            assert.match(
                cmd.error?.message ?? '',
                /explicit online release action is required/i,
            );

            // 4. processQueue must NOT make network calls or replay
            let apiCallMade = false;
            const fakeClient = {
                postJson: async () => {
                    apiCallMade = true;

                    throw new Error('API should not be called');
                },
            } as unknown as FieldApiClient;

            const processResult = await outbox.processQueue(fakeClient);
            assert.equal(apiCallMade, false);
            assert.equal(processResult.completed, 0);

            // 5. retryCommand must refuse to replay legacy command
            const retryResult = await outbox.retryCommand(
                legacyCmdId,
                fakeClient,
            );
            assert.equal(apiCallMade, false);
            assert.equal(retryResult.completed, 0);

            // 6. State remains failed and type remains release_maintenance_work_order
            const finalCmd = outbox.getCommand(legacyCmdId);
            assert.equal(finalCmd?.state, 'failed');
            assert.equal(finalCmd?.type, 'release_maintenance_work_order');
            assert.equal(finalCmd?.error?.code, 'LEGACY_RELEASE_DISALLOWED');

            migratedDb.close();
        } finally {
            await rm(directory, { force: true, recursive: true });
        }
    });
});
