import {
    ExpoPayloadHasher,
    MemoryOutboxRepository,
} from '../storage/outboxRepository';
import type {
    OutboxRepository,
    PayloadHasher,
} from '../storage/outboxRepository';
import type {
    DispatchJob,
    LocationSharePayload,
    OutboxCommand,
    OutboxCommandType,
} from '../types/index';
import type { FieldApiClient } from './apiClient';
import { ApiClientError } from './apiClient';

export type OutboxListener = (commands: OutboxCommand[]) => void;

export interface OutboxProcessResult {
    completed: number;
    conflicts: number;
    failed: number;
    deferred: number;
    requiresAuthentication: boolean;
}

export interface CommandOutboxOptions {
    repository?: OutboxRepository;
    hasher?: PayloadHasher;
    now?: () => Date;
    maxAutomaticAttempts?: number;
    baseRetryDelayMs?: number;
}

const completedRetentionMs = 8 * 60 * 60 * 1000;
const maxRetryDelayMs = 5 * 60 * 1000;

export function createCommandId(): string {
    if (
        typeof globalThis.crypto !== 'undefined' &&
        typeof globalThis.crypto.randomUUID === 'function'
    ) {
        return globalThis.crypto.randomUUID();
    }

    if (
        typeof globalThis.crypto === 'undefined' ||
        typeof globalThis.crypto.getRandomValues !== 'function'
    ) {
        throw new Error(
            'A cryptographically secure random source is required for command IDs.',
        );
    }

    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function commandScope(command: OutboxCommand): string {
    return command.jobId === null || command.jobId === undefined
        ? `command:${command.id}`
        : `job:${command.jobId}`;
}

function emptyResult(): OutboxProcessResult {
    return {
        completed: 0,
        conflicts: 0,
        failed: 0,
        deferred: 0,
        requiresAuthentication: false,
    };
}

export class CommandOutboxManager {
    private commands = new Map<string, OutboxCommand>();
    private listeners = new Set<OutboxListener>();
    private isProcessing = false;
    private activeActorId: number | null = null;
    private activationSequence = 0;
    private lastCreatedAtMs = 0;
    private readonly repository: OutboxRepository;
    private readonly hasher: PayloadHasher;
    private readonly now: () => Date;
    private readonly maxAutomaticAttempts: number;
    private readonly baseRetryDelayMs: number;

    constructor(options: CommandOutboxOptions = {}) {
        this.repository = options.repository ?? new MemoryOutboxRepository();
        this.hasher = options.hasher ?? new ExpoPayloadHasher();
        this.now = options.now ?? (() => new Date());
        this.maxAutomaticAttempts = options.maxAutomaticAttempts ?? 5;
        this.baseRetryDelayMs = options.baseRetryDelayMs ?? 1_000;
    }

    public subscribe(listener: OutboxListener): () => void {
        this.listeners.add(listener);
        listener(this.getCommands());

        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        const list = this.getCommands();

        for (const listener of this.listeners) {
            listener(list);
        }
    }

    public async activateActor(actorId: number): Promise<void> {
        const sequence = ++this.activationSequence;
        const now = this.now().toISOString();
        await this.repository.initialize();
        await this.repository.recoverInterrupted(actorId, now);
        await this.repository.clearCompletedBefore(
            actorId,
            new Date(this.now().getTime() - completedRetentionMs).toISOString(),
        );
        const restored = await this.repository.listForActor(actorId);

        if (sequence !== this.activationSequence) {
            return;
        }

        this.activeActorId = actorId;
        this.commands = new Map(
            restored.map((command) => [command.id, command]),
        );
        this.lastCreatedAtMs = restored.reduce(
            (latest, command) =>
                Math.max(latest, Date.parse(command.createdAt) || 0),
            0,
        );
        this.notify();
    }

    public deactivateActor(): void {
        this.activationSequence += 1;
        this.activeActorId = null;
        this.lastCreatedAtMs = 0;
        this.commands.clear();
        this.notify();
    }

    private requireActor(): number {
        if (this.activeActorId === null) {
            throw new Error(
                'An authenticated actor is required for the outbox.',
            );
        }

        return this.activeActorId;
    }

    public getCommands(): OutboxCommand[] {
        return Array.from(this.commands.values()).sort(
            (a, b) =>
                new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime() || a.id.localeCompare(b.id),
        );
    }

    public getCommand(id: string): OutboxCommand | undefined {
        return this.commands.get(id);
    }

    public getCommandsForJob(jobId: number): OutboxCommand[] {
        return this.getCommands().filter((command) => command.jobId === jobId);
    }

    public getNextRetryAt(): string | null {
        return (
            this.getCommands()
                .filter(
                    (command) =>
                        command.state === 'queued' && command.nextAttemptAt,
                )
                .map((command) => command.nextAttemptAt!)
                .sort()[0] ?? null
        );
    }

    private async payloadHash(
        type: OutboxCommandType,
        jobId: number | null | undefined,
        assignmentId: number | null | undefined,
        payload: Record<string, unknown>,
        expectedVersion?: number | null,
    ): Promise<string> {
        return this.hasher.hash({
            type,
            jobId: jobId ?? null,
            assignmentId: assignmentId ?? null,
            payload,
            expectedVersion: expectedVersion ?? null,
        });
    }

    private async enqueue(
        type: OutboxCommandType,
        jobId: number | null | undefined,
        assignmentId: number | null | undefined,
        payload: Record<string, unknown>,
        expectedVersion?: number | null,
    ): Promise<OutboxCommand> {
        const actorId = this.requireActor();
        const payloadHash = await this.payloadHash(
            type,
            jobId,
            assignmentId,
            payload,
            expectedVersion,
        );
        const existing = this.getCommands().find(
            (command) =>
                command.type === type &&
                command.payloadHash === payloadHash &&
                command.state !== 'completed',
        );

        if (existing) {
            return existing;
        }

        const createdAtMs = Math.max(
            this.now().getTime(),
            this.lastCreatedAtMs + 1,
        );
        this.lastCreatedAtMs = createdAtMs;
        const now = new Date(createdAtMs).toISOString();
        const command: OutboxCommand = {
            id: createCommandId(),
            actorId,
            type,
            jobId: jobId ?? null,
            assignmentId: assignmentId ?? null,
            payload,
            payloadHash,
            expectedVersion: expectedVersion ?? null,
            state: 'queued',
            createdAt: now,
            updatedAt: now,
            attempts: 0,
            lastAttemptAt: null,
            nextAttemptAt: null,
            completedAt: null,
        };

        await this.repository.save(command);
        this.commands.set(command.id, command);
        this.notify();

        return command;
    }

    public enqueueRespondAssignment(
        jobId: number,
        assignmentId: number,
        responseStatus: 'accepted' | 'rejected',
        reason: string | undefined,
        expectedVersion: number,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'respond_assignment',
            jobId,
            assignmentId,
            { response: responseStatus, reason },
            expectedVersion,
        );
    }

    public enqueueTransitionStatus(
        jobId: number,
        status: string,
        expectedVersion: number,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'transition_status',
            jobId,
            null,
            { status },
            expectedVersion,
        );
    }

    public enqueueShareLocation(
        payload: LocationSharePayload,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'share_location',
            payload.dispatch_job_id ?? null,
            null,
            payload as unknown as Record<string, unknown>,
        );
    }

    private async persist(command: OutboxCommand): Promise<void> {
        command.updatedAt = this.now().toISOString();
        await this.repository.save(command);
        this.commands.set(command.id, command);
        this.notify();
    }

    public async processQueue(
        apiClient: FieldApiClient,
    ): Promise<OutboxProcessResult> {
        const result = emptyResult();

        if (this.isProcessing || this.activeActorId === null) {
            return result;
        }

        this.isProcessing = true;
        const blockedScopes = new Set<string>();

        try {
            for (const command of this.getCommands()) {
                if (command.state !== 'queued') {
                    continue;
                }

                const scope = commandScope(command);
                const dueAt = command.nextAttemptAt
                    ? Date.parse(command.nextAttemptAt)
                    : 0;

                if (blockedScopes.has(scope) || dueAt > this.now().getTime()) {
                    blockedScopes.add(scope);
                    result.deferred += 1;
                    continue;
                }

                if (command.attempts >= this.maxAutomaticAttempts) {
                    command.state = 'failed';
                    command.nextAttemptAt = null;
                    command.error = {
                        code: 'RETRY_EXHAUSTED',
                        message:
                            'Automatic retry limit reached. Review or retry manually.',
                        retryable: true,
                    };
                    await this.persist(command);
                    result.failed += 1;
                    blockedScopes.add(scope);
                    continue;
                }

                await this.executeCommand(command, apiClient, result);

                if (result.requiresAuthentication) {
                    break;
                }

                if (this.commands.get(command.id)?.state !== 'completed') {
                    blockedScopes.add(scope);
                }
            }

            return result;
        } finally {
            this.isProcessing = false;
        }
    }

    public async retryCommand(
        commandId: string,
        apiClient: FieldApiClient,
    ): Promise<OutboxProcessResult> {
        const result = emptyResult();
        const command = this.commands.get(commandId);

        if (
            !command ||
            command.error?.code === 'MALFORMED_COMMAND' ||
            command.state === 'completed' ||
            command.state === 'conflict' ||
            command.state === 'syncing' ||
            (command.state === 'failed' && command.error?.retryable !== true)
        ) {
            return result;
        }

        command.state = 'queued';
        command.error = null;
        command.nextAttemptAt = null;
        await this.persist(command);
        await this.executeCommand(command, apiClient, result);

        return result;
    }

    public async resolveConflictAcceptServer(commandId: string): Promise<void> {
        const actorId = this.requireActor();
        await this.repository.remove(actorId, commandId);
        this.commands.delete(commandId);
        this.notify();
    }

    public async resolveConflictWithNewVersion(
        commandId: string,
        newVersion: number,
        apiClient: FieldApiClient,
    ): Promise<OutboxCommand | null> {
        const actorId = this.requireActor();
        const conflicted = this.commands.get(commandId);

        if (!conflicted || conflicted.state !== 'conflict') {
            return null;
        }

        const replacement = await this.enqueue(
            conflicted.type,
            conflicted.jobId,
            conflicted.assignmentId,
            conflicted.payload,
            newVersion,
        );
        await this.repository.remove(actorId, commandId);
        this.commands.delete(commandId);
        this.notify();
        await this.retryCommand(replacement.id, apiClient);

        return replacement;
    }

    public async discardCommand(commandId: string): Promise<void> {
        const actorId = this.requireActor();
        await this.repository.remove(actorId, commandId);
        this.commands.delete(commandId);
        this.notify();
    }

    private async executeCommand(
        command: OutboxCommand,
        apiClient: FieldApiClient,
        result: OutboxProcessResult,
    ): Promise<DispatchJob | unknown | null> {
        command.state = 'syncing';
        command.attempts += 1;
        command.lastAttemptAt = this.now().toISOString();
        command.nextAttemptAt = null;
        await this.persist(command);

        try {
            let response: DispatchJob | unknown = null;

            if (command.type === 'respond_assignment') {
                response = await apiClient.respondAssignment(
                    command.jobId!,
                    command.assignmentId!,
                    command.payload.response as 'accepted' | 'rejected',
                    command.payload.reason as string | undefined,
                    command.expectedVersion ?? 1,
                    command.id,
                );
            } else if (command.type === 'transition_status') {
                response = await apiClient.transitionStatus(
                    command.jobId!,
                    command.payload.status as string,
                    command.expectedVersion ?? 1,
                    command.id,
                );
            } else {
                response = await apiClient.shareLocation(
                    command.payload as unknown as LocationSharePayload,
                    command.id,
                );
            }

            command.state = 'completed';
            command.error = null;
            command.nextAttemptAt = null;
            command.completedAt = this.now().toISOString();
            await this.persist(command);
            result.completed += 1;

            return response;
        } catch (error: unknown) {
            await this.handleExecutionFailure(command, error, result);

            return null;
        }
    }

    private async handleExecutionFailure(
        command: OutboxCommand,
        error: unknown,
        result: OutboxProcessResult,
    ): Promise<void> {
        if (error instanceof ApiClientError) {
            if (error.status === 409 || error.errorCode === 'stale_version') {
                command.state = 'conflict';
                command.error = {
                    message:
                        error.message ||
                        'This command conflicts with newer server state.',
                    code: error.errorCode || 'stale_version',
                    currentVersion: error.currentVersion,
                    serverSnapshot: error.serverSnapshot,
                    retryable: false,
                };
                await this.persist(command);
                result.conflicts += 1;

                return;
            }

            if (error.status === 401 || error.status === 403) {
                command.state = 'failed';
                command.error = {
                    code:
                        error.status === 401
                            ? 'AUTHENTICATION_REQUIRED'
                            : 'AUTHORIZATION_DENIED',
                    message:
                        error.status === 401
                            ? 'Sign in again before reviewing queued commands.'
                            : 'This account is not authorized to replay the command.',
                    retryable: error.status === 401,
                };
                await this.persist(command);
                result.failed += 1;
                result.requiresAuthentication = true;

                return;
            }

            if (error.status === 422) {
                command.state = 'failed';
                command.error = {
                    code: error.errorCode || 'VALIDATION_FAILED',
                    message:
                        error.message ||
                        'The server rejected this command. Review or discard it.',
                    retryable: false,
                };
                await this.persist(command);
                result.failed += 1;

                return;
            }

            if (
                error.status === 408 ||
                error.status === 425 ||
                error.status === 429 ||
                error.status >= 500
            ) {
                await this.deferRetry(command, result);

                return;
            }

            command.state = 'failed';
            command.error = {
                code: error.errorCode || `HTTP_${error.status}`,
                message: 'The server rejected this command.',
                retryable: false,
            };
            await this.persist(command);
            result.failed += 1;

            return;
        }

        await this.deferRetry(command, result);
    }

    private async deferRetry(
        command: OutboxCommand,
        result: OutboxProcessResult,
    ): Promise<void> {
        if (command.attempts >= this.maxAutomaticAttempts) {
            command.state = 'failed';
            command.nextAttemptAt = null;
            command.error = {
                code: 'RETRY_EXHAUSTED',
                message:
                    'Automatic retry limit reached. Review or retry manually.',
                retryable: true,
            };
            result.failed += 1;
        } else {
            const delay = Math.min(
                this.baseRetryDelayMs * 2 ** (command.attempts - 1),
                maxRetryDelayMs,
            );
            command.state = 'queued';
            command.nextAttemptAt = new Date(
                this.now().getTime() + delay,
            ).toISOString();
            command.error = {
                code: 'NETWORK_RETRY_SCHEDULED',
                message: 'Connection unavailable. This command will retry.',
                retryable: true,
            };
            result.deferred += 1;
        }

        await this.persist(command);
    }

    public async clearCompleted(): Promise<void> {
        const actorId = this.requireActor();

        for (const command of this.getCommands()) {
            if (command.state === 'completed') {
                await this.repository.remove(actorId, command.id);
                this.commands.delete(command.id);
            }
        }

        this.notify();
    }

    public async clearActiveActorCommands(): Promise<void> {
        const actorId = this.requireActor();
        await this.repository.clearActor(actorId);
        this.commands.clear();
        this.notify();
    }
}
