import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { FieldApiClient } from '../services/apiClient';
import { ApiClientError } from '../services/apiClient';
import { CommandOutboxManager } from '../services/commandOutbox';
import {
    canonicalJson,
    MemoryOutboxRepository,
} from '../storage/outboxRepository';
import type {
    OutboxRepository,
    PayloadHasher,
} from '../storage/outboxRepository';
import type { DispatchJob } from '../types/index';

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
});
