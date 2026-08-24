import type {
    CommandErrorDetails,
    OutboxCommand,
    OutboxCommandState,
    OutboxCommandType,
} from '../types/index';

type SqlValue = string | number | null;

export interface OutboxDatabase {
    execAsync(source: string): Promise<void>;
    runAsync(source: string, params: SqlValue[]): Promise<unknown>;
    getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
}

export type OutboxDatabaseFactory = () => Promise<OutboxDatabase>;

export interface OutboxRepository {
    initialize(): Promise<void>;
    listForActor(actorId: number): Promise<OutboxCommand[]>;
    save(command: OutboxCommand): Promise<void>;
    remove(actorId: number, commandId: string): Promise<void>;
    clearActor(actorId: number): Promise<void>;
    clearCompletedBefore(
        actorId: number,
        completedBefore: string,
    ): Promise<void>;
    recoverInterrupted(actorId: number, recoveredAt: string): Promise<void>;
}

export interface PayloadHasher {
    hash(envelope: Record<string, unknown>): Promise<string>;
}

const commandTypes: OutboxCommandType[] = [
    'respond_assignment',
    'transition_status',
    'share_location',
    'activate_sos',
];
const commandStates: OutboxCommandState[] = [
    'queued',
    'syncing',
    'failed',
    'conflict',
    'completed',
    'expired',
];

interface OutboxRow {
    id: string;
    actor_id: number;
    command_type: string;
    job_id: number | null;
    assignment_id: number | null;
    payload_json: string;
    payload_hash: string;
    expected_version: number | null;
    state: string;
    priority?: string | null;
    expires_at?: string | null;
    attempts: number;
    error_json: string | null;
    created_at: string;
    updated_at: string;
    last_attempt_at: string | null;
    next_attempt_at: string | null;
    completed_at: string | null;
}

function cloneCommand(command: OutboxCommand): OutboxCommand {
    return JSON.parse(JSON.stringify(command)) as OutboxCommand;
}

function safeTimestamp(value: string | null, fallback: string): string {
    return value && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function deserializeRow(row: OutboxRow): OutboxCommand {
    const fallbackTimestamp = new Date(0).toISOString();
    const type = commandTypes.includes(row.command_type as OutboxCommandType)
        ? (row.command_type as OutboxCommandType)
        : 'transition_status';
    const state = commandStates.includes(row.state as OutboxCommandState)
        ? (row.state as OutboxCommandState)
        : 'failed';

    try {
        const payload = JSON.parse(row.payload_json) as unknown;
        const error = row.error_json
            ? (JSON.parse(row.error_json) as CommandErrorDetails)
            : null;

        if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
            throw new Error('Invalid payload shape');
        }

        return {
            id: row.id,
            actorId: row.actor_id,
            type,
            jobId: row.job_id,
            assignmentId: row.assignment_id,
            payload: payload as Record<string, unknown>,
            payloadHash: row.payload_hash,
            expectedVersion: row.expected_version,
            state,
            priority: row.priority === 'emergency' ? 'emergency' : 'ordinary',
            expiresAt: row.expires_at ?? null,
            attempts: Math.max(0, row.attempts),
            error,
            createdAt: safeTimestamp(row.created_at, fallbackTimestamp),
            updatedAt: safeTimestamp(row.updated_at, fallbackTimestamp),
            lastAttemptAt: row.last_attempt_at,
            nextAttemptAt: row.next_attempt_at,
            completedAt: row.completed_at,
        };
    } catch {
        return {
            id: row.id,
            actorId: row.actor_id,
            type,
            jobId: row.job_id,
            assignmentId: row.assignment_id,
            payload: {},
            payloadHash: row.payload_hash || 'invalid',
            expectedVersion: row.expected_version,
            state: 'failed',
            priority: row.priority === 'emergency' ? 'emergency' : 'ordinary',
            expiresAt: row.expires_at ?? null,
            attempts: Math.max(0, row.attempts),
            error: {
                code: 'MALFORMED_COMMAND',
                message:
                    'A stored command is malformed and cannot be replayed.',
                retryable: false,
            },
            createdAt: safeTimestamp(row.created_at, fallbackTimestamp),
            updatedAt: safeTimestamp(row.updated_at, fallbackTimestamp),
            lastAttemptAt: row.last_attempt_at,
            nextAttemptAt: null,
            completedAt: null,
        };
    }
}

export function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
    }

    if (value !== null && typeof value === 'object') {
        return `{${Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(
                ([key, item]) =>
                    `${JSON.stringify(key)}:${canonicalJson(item)}`,
            )
            .join(',')}}`;
    }

    return JSON.stringify(value) ?? 'null';
}

export class ExpoPayloadHasher implements PayloadHasher {
    public async hash(envelope: Record<string, unknown>): Promise<string> {
        const crypto = await import('expo-crypto');

        return crypto.digestStringAsync(
            crypto.CryptoDigestAlgorithm.SHA256,
            canonicalJson(envelope),
        );
    }
}

export class MemoryOutboxRepository implements OutboxRepository {
    private commands = new Map<string, OutboxCommand>();

    public async initialize(): Promise<void> {}

    public async listForActor(actorId: number): Promise<OutboxCommand[]> {
        return Array.from(this.commands.values())
            .filter((command) => command.actorId === actorId)
            .map(cloneCommand);
    }

    public async save(command: OutboxCommand): Promise<void> {
        this.commands.set(command.id, cloneCommand(command));
    }

    public async remove(actorId: number, commandId: string): Promise<void> {
        if (this.commands.get(commandId)?.actorId === actorId) {
            this.commands.delete(commandId);
        }
    }

    public async clearActor(actorId: number): Promise<void> {
        for (const [id, command] of this.commands) {
            if (command.actorId === actorId) {
                this.commands.delete(id);
            }
        }
    }

    public async clearCompletedBefore(
        actorId: number,
        completedBefore: string,
    ): Promise<void> {
        for (const [id, command] of this.commands) {
            if (
                command.actorId === actorId &&
                command.state === 'completed' &&
                command.completedAt &&
                command.completedAt < completedBefore
            ) {
                this.commands.delete(id);
            }
        }
    }

    public async recoverInterrupted(
        actorId: number,
        recoveredAt: string,
    ): Promise<void> {
        for (const command of this.commands.values()) {
            if (command.actorId === actorId && command.state === 'syncing') {
                command.state = 'queued';
                command.updatedAt = recoveredAt;
                command.nextAttemptAt = null;
                command.error = {
                    code: 'PROCESS_INTERRUPTED',
                    message: 'Sync was interrupted and is ready to retry.',
                    retryable: true,
                };
            }
        }
    }
}

async function openDefaultDatabase(): Promise<OutboxDatabase> {
    const sqlite = await import('expo-sqlite');

    return sqlite.openDatabaseAsync('core2-field-outbox.db');
}

export class SqliteOutboxRepository implements OutboxRepository {
    private databasePromise: Promise<OutboxDatabase> | null = null;
    private initializePromise: Promise<void> | null = null;

    constructor(
        private readonly databaseFactory: OutboxDatabaseFactory = openDefaultDatabase,
    ) {}

    private database(): Promise<OutboxDatabase> {
        this.databasePromise ??= this.databaseFactory();

        return this.databasePromise;
    }

    public initialize(): Promise<void> {
        this.initializePromise ??= this.initializeSchema();

        return this.initializePromise;
    }

    private async initializeSchema(): Promise<void> {
        const database = await this.database();

        await database.execAsync(`
            PRAGMA journal_mode = WAL;
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
                priority TEXT NOT NULL DEFAULT 'ordinary',
                expires_at TEXT,
                attempts INTEGER NOT NULL DEFAULT 0,
                error_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_attempt_at TEXT,
                next_attempt_at TEXT,
                completed_at TEXT
            );
            CREATE INDEX IF NOT EXISTS field_command_outbox_actor_state_idx
                ON field_command_outbox (actor_id, state, created_at);
            CREATE INDEX IF NOT EXISTS field_command_outbox_actor_job_idx
                ON field_command_outbox (actor_id, job_id, created_at);
        `);

        // Existing field installs predate emergency priority. SQLite does not
        // support IF NOT EXISTS for columns, so these guarded migrations keep
        // ordinary outbox data intact during a cold start upgrade.
        try {
            await database.execAsync(
                "ALTER TABLE field_command_outbox ADD COLUMN priority TEXT NOT NULL DEFAULT 'ordinary'",
            );
        } catch {
            // Column already exists.
        }

        try {
            await database.execAsync(
                'ALTER TABLE field_command_outbox ADD COLUMN expires_at TEXT',
            );
        } catch {
            // Column already exists.
        }
    }

    public async listForActor(actorId: number): Promise<OutboxCommand[]> {
        await this.initialize();
        const database = await this.database();
        const rows = await database.getAllAsync<OutboxRow>(
            `SELECT * FROM field_command_outbox
             WHERE actor_id = ?
             ORDER BY created_at ASC, id ASC`,
            [actorId],
        );

        return rows.map(deserializeRow);
    }

    public async save(command: OutboxCommand): Promise<void> {
        await this.initialize();
        const database = await this.database();

        await database.runAsync(
            `INSERT INTO field_command_outbox (
                id, actor_id, command_type, job_id, assignment_id,
                payload_json, payload_hash, expected_version, state, attempts,
                priority, expires_at, error_json, created_at, updated_at,
                last_attempt_at, next_attempt_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                actor_id = excluded.actor_id,
                command_type = excluded.command_type,
                job_id = excluded.job_id,
                assignment_id = excluded.assignment_id,
                payload_json = excluded.payload_json,
                payload_hash = excluded.payload_hash,
                expected_version = excluded.expected_version,
                state = excluded.state,
                priority = excluded.priority,
                expires_at = excluded.expires_at,
                attempts = excluded.attempts,
                error_json = excluded.error_json,
                updated_at = excluded.updated_at,
                last_attempt_at = excluded.last_attempt_at,
                next_attempt_at = excluded.next_attempt_at,
                completed_at = excluded.completed_at`,
            [
                command.id,
                command.actorId,
                command.type,
                command.jobId ?? null,
                command.assignmentId ?? null,
                JSON.stringify(command.payload),
                command.payloadHash,
                command.expectedVersion ?? null,
                command.state,
                command.attempts,
                command.priority ?? 'ordinary',
                command.expiresAt ?? null,
                command.error ? JSON.stringify(command.error) : null,
                command.createdAt,
                command.updatedAt,
                command.lastAttemptAt ?? null,
                command.nextAttemptAt ?? null,
                command.completedAt ?? null,
            ],
        );
    }

    public async remove(actorId: number, commandId: string): Promise<void> {
        await this.initialize();
        const database = await this.database();
        await database.runAsync(
            'DELETE FROM field_command_outbox WHERE actor_id = ? AND id = ?',
            [actorId, commandId],
        );
    }

    public async clearActor(actorId: number): Promise<void> {
        await this.initialize();
        const database = await this.database();
        await database.runAsync(
            'DELETE FROM field_command_outbox WHERE actor_id = ?',
            [actorId],
        );
    }

    public async clearCompletedBefore(
        actorId: number,
        completedBefore: string,
    ): Promise<void> {
        await this.initialize();
        const database = await this.database();
        await database.runAsync(
            `DELETE FROM field_command_outbox
             WHERE actor_id = ? AND state = 'completed' AND completed_at < ?`,
            [actorId, completedBefore],
        );
    }

    public async recoverInterrupted(
        actorId: number,
        recoveredAt: string,
    ): Promise<void> {
        await this.initialize();
        const database = await this.database();
        await database.runAsync(
            `UPDATE field_command_outbox
             SET state = 'queued', updated_at = ?, next_attempt_at = NULL,
                 error_json = ?
             WHERE actor_id = ? AND state = 'syncing'`,
            [
                recoveredAt,
                JSON.stringify({
                    code: 'PROCESS_INTERRUPTED',
                    message: 'Sync was interrupted and is ready to retry.',
                    retryable: true,
                }),
                actorId,
            ],
        );
    }
}

export function createDefaultOutboxRepository(): OutboxRepository {
    return new SqliteOutboxRepository();
}
