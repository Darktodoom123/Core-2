import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import { SqliteOutboxRepository } from '../storage/outboxRepository';
import type { OutboxDatabase } from '../storage/outboxRepository';
import type { OutboxCommand } from '../types/index';

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

function commandFixture(overrides: Partial<OutboxCommand> = {}): OutboxCommand {
    return {
        id: '3d90db3a-ca3c-4a9f-b36a-138d24d48d58',
        actorId: 17,
        type: 'transition_status',
        jobId: 88,
        assignmentId: null,
        payload: { status: 'arrived' },
        payloadHash: 'safe-payload-hash',
        expectedVersion: 3,
        state: 'queued',
        attempts: 0,
        error: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        lastAttemptAt: null,
        nextAttemptAt: null,
        completedAt: null,
        ...overrides,
    };
}

describe('SqliteOutboxRepository', () => {
    test('survives a database restart at the eight-hour offline boundary', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'core2-outbox-'));
        const databasePath = join(directory, 'field-outbox.sqlite');

        try {
            const firstDatabase = new DatabaseSync(databasePath);
            const firstRepository = new SqliteOutboxRepository(
                async () => new NodeSqliteDatabase(firstDatabase),
            );
            const command = commandFixture();
            await firstRepository.save(command);
            firstDatabase.close();

            const restartedDatabase = new DatabaseSync(databasePath);
            const restartedRepository = new SqliteOutboxRepository(
                async () => new NodeSqliteDatabase(restartedDatabase),
            );
            await restartedRepository.recoverInterrupted(
                command.actorId,
                '2026-08-01T08:00:00.000Z',
            );
            const restored = await restartedRepository.listForActor(
                command.actorId,
            );

            assert.equal(restored.length, 1);
            assert.equal(restored[0].id, command.id);
            assert.equal(restored[0].state, 'queued');
            assert.equal(restored[0].createdAt, command.createdAt);
            assert.equal(restored[0].expectedVersion, command.expectedVersion);
            restartedDatabase.close();
        } finally {
            await rm(directory, { force: true, recursive: true });
        }
    });

    test('persists actor-scoped commands and recovers interrupted sync across repository restart', async () => {
        const database = new NodeSqliteDatabase(new DatabaseSync(':memory:'));
        const repository = new SqliteOutboxRepository(async () => database);
        const command = commandFixture();

        await repository.save(command);
        command.state = 'syncing';
        command.attempts = 1;
        command.lastAttemptAt = '2026-08-01T00:01:00.000Z';
        await repository.save(command);

        const restartedRepository = new SqliteOutboxRepository(
            async () => database,
        );
        await restartedRepository.recoverInterrupted(
            17,
            '2026-08-01T00:02:00.000Z',
        );
        const restored = await restartedRepository.listForActor(17);

        assert.equal(restored.length, 1);
        assert.equal(restored[0].id, command.id);
        assert.equal(restored[0].state, 'queued');
        assert.equal(restored[0].attempts, 1);
        assert.equal(restored[0].error?.code, 'PROCESS_INTERRUPTED');
        assert.deepEqual(await restartedRepository.listForActor(18), []);
    });

    test('quarantines malformed stored payloads instead of replaying them', async () => {
        const nodeDatabase = new DatabaseSync(':memory:');
        const database = new NodeSqliteDatabase(nodeDatabase);
        const repository = new SqliteOutboxRepository(async () => database);
        await repository.initialize();

        nodeDatabase
            .prepare(
                `INSERT INTO field_command_outbox (
                    id, actor_id, command_type, job_id, assignment_id,
                    payload_json, payload_hash, expected_version, state,
                    attempts, error_json, created_at, updated_at,
                    last_attempt_at, next_attempt_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                '3d90db3a-ca3c-4a9f-b36a-138d24d48d59',
                17,
                'transition_status',
                88,
                null,
                '{not-json',
                'invalid',
                3,
                'queued',
                0,
                null,
                '2026-08-01T00:00:00.000Z',
                '2026-08-01T00:00:00.000Z',
                null,
                null,
                null,
            );

        const [malformed] = await repository.listForActor(17);
        assert.equal(malformed.state, 'failed');
        assert.equal(malformed.error?.code, 'MALFORMED_COMMAND');
        assert.equal(malformed.error?.retryable, false);
        assert.deepEqual(malformed.payload, {});
    });
});
