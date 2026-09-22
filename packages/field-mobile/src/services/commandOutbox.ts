import {
    ExpoPayloadHasher,
    MemoryOutboxRepository,
} from '../storage/outboxRepository';
import type {
    OutboxRepository,
    PayloadHasher,
} from '../storage/outboxRepository';
import type {
    ActivateSosIncidentPayload,
    DispatchJob,
    JobReportCommandPayload,
    LocationSharePayload,
    OutboxCommand,
    OutboxCommandPriority,
    OutboxCommandType,
    HosCertifyCommandPayload,
    HosDutyStatusCommandPayload,
    HosStartCommandPayload,
    RentalHandoverCommandPayload,
    ReportDelayPayload,
    SalesDeliveryCommandPayload,
} from '../types/index';
import type { FieldApiClient } from './apiClient';
import { ApiClientError } from './apiClient';
import { durableAttachmentStorage } from './durableAttachmentStorage';

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
    sosRetryWindowMs?: number;
}

const completedRetentionMs = 8 * 60 * 60 * 1000;
const maxRetryDelayMs = 5 * 60 * 1000;
export const defaultSosRetryWindowMs = 15 * 60 * 1000;
const sosMaxRetryDelayMs = 30 * 1000;

export async function createCommandId(): Promise<string> {
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
        const crypto = await import('expo-crypto');

        return crypto.randomUUID();
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
    if (command.type === 'activate_sos') {
        return `sos:${command.id}`;
    }

    if (
        command.type === 'start_hos_shift' ||
        command.type === 'change_hos_duty_status' ||
        command.type === 'certify_hos_shift'
    ) {
        return `hos:${command.actorId}`;
    }

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

function isUncertainTransportError(error: unknown): boolean {
    const errorObject =
        typeof error === 'object' && error !== null
            ? (error as Record<string, unknown>)
            : undefined;
    const status =
        error instanceof ApiClientError
            ? error.status
            : typeof errorObject?.status === 'number'
              ? errorObject.status
              : undefined;
    const code =
        error instanceof ApiClientError
            ? error.errorCode
            : typeof errorObject?.code === 'string'
              ? errorObject.code
              : undefined;
    const message =
        error instanceof Error
            ? error.message
            : typeof errorObject?.message === 'string'
              ? errorObject.message
              : String(error ?? '');

    if (
        [
            'TIMEOUT',
            'NETWORK_TIMEOUT',
            'GATEWAY_TIMEOUT',
            'ECONNRESET',
        ].includes(code ?? '') ||
        [408, 502, 503, 504].includes(status ?? 0)
    ) {
        return true;
    }

    const normalizedMessage = message.toLowerCase();

    return (
        normalizedMessage.includes('timeout') ||
        normalizedMessage.includes('timed out') ||
        normalizedMessage.includes('gateway') ||
        normalizedMessage.includes('network request failed') ||
        normalizedMessage.includes('connection reset') ||
        normalizedMessage.includes('econnreset')
    );
}

function isVerifiedServerRejection(command: OutboxCommand): boolean {
    if (command.state !== 'failed' || command.error?.retryable === true) {
        return false;
    }

    if (
        typeof command.error?.status === 'number' &&
        command.error.status >= 400 &&
        command.error.status < 500
    ) {
        return true;
    }

    return [
        'AUTHORIZATION_DENIED',
        'MALFORMED_COMMAND',
        'UNKNOWN_COMMAND_TYPE',
        'VALIDATION_FAILED',
        'UNPROCESSABLE_ENTITY',
        'LEGACY_RELEASE_DISALLOWED',
        'QUARANTINED',
    ].includes(command.error?.code ?? '');
}

export class CommandOutboxManager {
    private commands = new Map<string, OutboxCommand>();
    private listeners = new Set<OutboxListener>();
    private processingActors = new Set<number>();
    private activeActorId: number | null = null;
    private activationSequence = 0;
    private lastCreatedAtMs = 0;
    private lastSuccessfulSyncAt: string | null = null;
    private readonly repository: OutboxRepository;
    private readonly hasher: PayloadHasher;
    private readonly now: () => Date;
    private readonly maxAutomaticAttempts: number;
    private readonly baseRetryDelayMs: number;
    private sosRetryWindowMs: number;

    constructor(options: CommandOutboxOptions = {}) {
        this.repository = options.repository ?? new MemoryOutboxRepository();
        this.hasher = options.hasher ?? new ExpoPayloadHasher();
        this.now = options.now ?? (() => new Date());
        this.maxAutomaticAttempts = options.maxAutomaticAttempts ?? 5;
        this.baseRetryDelayMs = options.baseRetryDelayMs ?? 1_000;
        this.sosRetryWindowMs =
            options.sosRetryWindowMs ?? defaultSosRetryWindowMs;
    }

    public setSosRetryWindowMs(milliseconds: number): void {
        if (Number.isFinite(milliseconds) && milliseconds >= 60_000) {
            this.sosRetryWindowMs = milliseconds;
        }
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

    private requireSameActor(actorId: number): void {
        if (this.activeActorId !== actorId) {
            throw new Error(
                'The authenticated actor changed while queueing the command.',
            );
        }
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

    public getLastSuccessfulSyncAt(): string | null {
        return this.lastSuccessfulSyncAt;
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
        options?: {
            priority?: OutboxCommandPriority;
            expiresAt?: string | null;
        },
    ): Promise<OutboxCommand> {
        const actorId = this.requireActor();
        const payloadHash = await this.payloadHash(
            type,
            jobId,
            assignmentId,
            payload,
            expectedVersion,
        );
        this.requireSameActor(actorId);
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
        const commandId = await createCommandId();
        this.requireSameActor(actorId);
        const command: OutboxCommand = {
            id: commandId,
            actorId,
            type,
            jobId: jobId ?? null,
            assignmentId: assignmentId ?? null,
            payload,
            payloadHash,
            expectedVersion: expectedVersion ?? null,
            priority: options?.priority ?? 'ordinary',
            expiresAt: options?.expiresAt ?? null,
            state: 'queued',
            createdAt: now,
            updatedAt: now,
            attempts: 0,
            lastAttemptAt: null,
            nextAttemptAt: null,
            completedAt: null,
        };

        await this.repository.save(command);

        if (this.activeActorId === actorId) {
            this.commands.set(command.id, command);
            this.notify();
        }

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

    public enqueueActivateSos(
        payload: ActivateSosIncidentPayload,
    ): Promise<OutboxCommand> {
        const activatedAt = Date.parse(payload.device_activated_at);
        const baseTime = Number.isNaN(activatedAt)
            ? this.now().getTime()
            : activatedAt;

        return this.enqueue(
            'activate_sos',
            null,
            null,
            payload as unknown as Record<string, unknown>,
            null,
            {
                priority: 'emergency',
                expiresAt: new Date(
                    baseTime + this.sosRetryWindowMs,
                ).toISOString(),
            },
        );
    }

    public enqueueSubmitJobReport(
        jobId: number,
        payload: JobReportCommandPayload,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'submit_job_report',
            jobId,
            null,
            payload as unknown as Record<string, unknown>,
        );
    }

    public enqueueSubmitDvir(
        payload: Record<string, unknown>,
        jobId?: number | null,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'submit_dvir',
            jobId ?? (payload.dispatch_job_id as number) ?? null,
            null,
            payload,
        );
    }

    public enqueueSubmitRentalHandover(
        payload: RentalHandoverCommandPayload,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'submit_rental_handover',
            payload.dispatch_job_id ?? null,
            null,
            payload as unknown as Record<string, unknown>,
        );
    }

    public enqueueSubmitSalesDelivery(
        payload: SalesDeliveryCommandPayload,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'submit_sales_delivery',
            payload.dispatch_job_id ?? null,
            null,
            payload as unknown as Record<string, unknown>,
        );
    }

    public enqueueSubmitEquipmentInspection(
        payload: Record<string, unknown>,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'submit_equipment_inspection' as OutboxCommandType,
            (payload.dispatch_job_id as number) ?? null,
            null,
            payload,
        );
    }

    public enqueueSubmitMaintenanceWorkOrder(
        payload: Record<string, unknown>,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'submit_maintenance_work_order' as OutboxCommandType,
            (payload.dispatch_job_id as number) ?? null,
            null,
            payload,
        );
    }

    public enqueueReportDelay(
        payload: ReportDelayPayload,
        expectedVersion?: number,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'report_delay',
            payload.dispatch_job_id,
            null,
            payload as unknown as Record<string, unknown>,
            expectedVersion,
        );
    }

    public enqueueStartHosShift(
        payload: HosStartCommandPayload,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'start_hos_shift',
            payload.dispatch_job_id ?? null,
            null,
            payload as unknown as Record<string, unknown>,
        );
    }

    public enqueueChangeHosDutyStatus(
        payload: HosDutyStatusCommandPayload,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'change_hos_duty_status',
            payload.dispatch_job_id ?? null,
            null,
            payload as unknown as Record<string, unknown>,
        );
    }

    public enqueueCertifyHosShift(
        payload: HosCertifyCommandPayload,
    ): Promise<OutboxCommand> {
        return this.enqueue(
            'certify_hos_shift',
            payload.dispatch_job_id ?? null,
            null,
            payload as unknown as Record<string, unknown>,
        );
    }

    private async persist(command: OutboxCommand): Promise<void> {
        command.updatedAt = this.now().toISOString();
        await this.repository.save(command);

        if (this.activeActorId === command.actorId) {
            this.commands.set(command.id, command);
            this.notify();
        }
    }

    public async processQueue(
        apiClient: FieldApiClient,
    ): Promise<OutboxProcessResult> {
        const result = emptyResult();
        const actorId = this.activeActorId;

        if (actorId === null || this.processingActors.has(actorId)) {
            return result;
        }

        this.processingActors.add(actorId);
        const blockedScopes = new Set<string>();

        try {
            for (const command of this.getCommands().sort((left, right) => {
                const leftPriority = left.priority === 'emergency' ? 0 : 1;
                const rightPriority = right.priority === 'emergency' ? 0 : 1;

                return (
                    leftPriority - rightPriority ||
                    Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
                    left.id.localeCompare(right.id)
                );
            })) {
                const scope = commandScope(command);

                if (command.state !== 'queued') {
                    if (
                        command.state === 'failed' ||
                        command.state === 'conflict' ||
                        command.state === 'unresolved' ||
                        command.state === 'syncing'
                    ) {
                        blockedScopes.add(scope);
                    }

                    continue;
                }

                if (
                    command.type === 'activate_sos' &&
                    command.expiresAt &&
                    Date.parse(command.expiresAt) <= this.now().getTime()
                ) {
                    command.state = 'expired';
                    command.nextAttemptAt = null;
                    command.error = {
                        code: 'SOS_EXPIRED',
                        message:
                            'Expired — not delivered. Start a new SOS if help is still needed.',
                        retryable: false,
                    };
                    await this.persist(command);
                    result.failed += 1;

                    continue;
                }

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
            this.processingActors.delete(actorId);
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
            command.actorId !== this.activeActorId ||
            command.type === 'release_maintenance_work_order' ||
            command.error?.code === 'MALFORMED_COMMAND' ||
            command.error?.code === 'LEGACY_RELEASE_DISALLOWED' ||
            command.error?.code === 'AUTHORIZATION_DENIED' ||
            command.error?.code === 'VALIDATION_FAILED' ||
            command.error?.code === 'UNPROCESSABLE_ENTITY' ||
            command.error?.code === 'UNKNOWN_COMMAND_TYPE' ||
            command.error?.code === 'MISSING_ATTACHMENTS' ||
            command.error?.code === 'SOS_EXPIRED' ||
            command.error?.code === 'QUARANTINED' ||
            (command.state === 'unresolved' &&
                Boolean(command.error?.missingAttachmentUri)) ||
            (typeof command.error?.status === 'number' &&
                [400, 401, 403, 404, 405, 422].includes(
                    command.error.status,
                )) ||
            command.state === 'completed' ||
            command.state === 'conflict' ||
            command.state === 'syncing' ||
            command.state === 'expired' ||
            (command.state === 'failed' && command.error?.retryable !== true)
        ) {
            return result;
        }

        // Respect active backoff / Retry-After schedule
        if (
            command.nextAttemptAt &&
            Date.parse(command.nextAttemptAt) > this.now().getTime()
        ) {
            result.deferred += 1;

            return result;
        }

        const actorId = command.actorId;

        if (this.processingActors.has(actorId)) {
            return result;
        }

        // Acquire processing mutex immediately before any async yield to prevent concurrent tap races
        this.processingActors.add(actorId);

        try {
            command.state = 'queued';
            command.error = null;
            command.nextAttemptAt = null;
            await this.persist(command);

            // If there are earlier uncompleted commands for the same job, execute via processQueue
            // to preserve strict dependency ordering
            if (command.jobId !== null && command.jobId !== undefined) {
                const hasEarlierPending = this.getCommands().some(
                    (c) =>
                        c.jobId === command.jobId &&
                        c.id !== command.id &&
                        (Date.parse(c.createdAt) <
                            Date.parse(command.createdAt) ||
                            (Date.parse(c.createdAt) ===
                                Date.parse(command.createdAt) &&
                                c.id.localeCompare(command.id) < 0)) &&
                        c.state !== 'completed',
                );

                if (hasEarlierPending) {
                    this.processingActors.delete(actorId);

                    return this.processQueue(apiClient);
                }
            }

            await this.executeCommand(command, apiClient, result);

            return result;
        } finally {
            this.processingActors.delete(actorId);
        }
    }

    public async retryAllEligible(
        apiClient: FieldApiClient,
    ): Promise<OutboxProcessResult> {
        const actorId = this.activeActorId;

        if (actorId === null || this.processingActors.has(actorId)) {
            return emptyResult();
        }

        this.processingActors.add(actorId);

        try {
            const nowMs = this.now().getTime();

            for (const command of this.getCommands()) {
                if (
                    command.state === 'failed' &&
                    command.error?.retryable === true &&
                    command.type !== 'release_maintenance_work_order' &&
                    command.error?.code !== 'MALFORMED_COMMAND' &&
                    command.error?.code !== 'LEGACY_RELEASE_DISALLOWED' &&
                    command.error?.code !== 'AUTHORIZATION_DENIED' &&
                    command.error?.code !== 'VALIDATION_FAILED' &&
                    command.error?.code !== 'UNPROCESSABLE_ENTITY' &&
                    command.error?.code !== 'UNKNOWN_COMMAND_TYPE' &&
                    command.error?.code !== 'MISSING_ATTACHMENTS' &&
                    command.error?.code !== 'QUARANTINED' &&
                    command.error?.code !== 'AUTHENTICATION_REQUIRED' &&
                    (!command.nextAttemptAt ||
                        Date.parse(command.nextAttemptAt) <= nowMs)
                ) {
                    command.state = 'queued';
                    command.error = null;
                    command.nextAttemptAt = null;
                    await this.persist(command);
                }
            }
        } finally {
            this.processingActors.delete(actorId);
        }

        return this.processQueue(apiClient);
    }

    private assertCommandDiscardable(command: OutboxCommand): void {
        if (command.state === 'syncing') {
            throw new Error(
                'Cannot discard an action that is currently syncing.',
            );
        }

        if (command.state === 'unresolved') {
            throw new Error(
                'This action has an unresolved server outcome and its evidence cannot be discarded until central dispatch reconciles the original command.',
            );
        }

        if (command.type === 'activate_sos' && command.state !== 'expired') {
            throw new Error('Active emergency SOS cannot be discarded.');
        }

        if (command.state !== 'completed') {
            // Safety DVIR inspection with critical defects / lockout cannot be discarded
            if (
                command.type === 'submit_dvir' &&
                (command.payload?.has_defects === true ||
                    command.payload?.hasDefects === true ||
                    command.payload?.safety_status === 'unsafe' ||
                    command.payload?.status === 'unsafe' ||
                    command.payload?.defect_severity === 'critical' ||
                    command.payload?.has_critical_defects === true ||
                    (Array.isArray(command.payload?.defects) &&
                        command.payload.defects.length > 0))
            ) {
                throw new Error(
                    'Safety DVIR inspections reporting critical defects cannot be discarded locally.',
                );
            }

            // Failed equipment inspection cannot be discarded
            if (
                command.type === 'submit_equipment_inspection' &&
                (command.payload?.result === 'failed' ||
                    command.payload?.status === 'failed' ||
                    command.payload?.passed === false ||
                    command.payload?.has_defects === true ||
                    command.payload?.hasDefects === true ||
                    command.payload?.defect_severity === 'critical' ||
                    (Array.isArray(command.payload?.defects) &&
                        command.payload.defects.length > 0))
            ) {
                throw new Error(
                    'Equipment inspections with defects cannot be discarded locally.',
                );
            }

            // Maintenance work order cannot be discarded
            if (command.type === 'submit_maintenance_work_order') {
                throw new Error(
                    'Maintenance work orders cannot be discarded locally.',
                );
            }

            // Signed customer handovers cannot be discarded
            if (
                (command.type === 'submit_rental_handover' ||
                    command.type === 'submit_sales_delivery') &&
                Boolean(
                    command.payload?.signee_name ||
                    command.payload?.signature_image_path ||
                    command.payload?.signature,
                )
            ) {
                throw new Error(
                    'Signed custody handovers cannot be discarded.',
                );
            }

            // Check for dependent commands for the same job (queued, syncing, or retryable failed)
            if (command.jobId !== null && command.jobId !== undefined) {
                const hasDependent = this.getCommands().some(
                    (c) =>
                        c.jobId === command.jobId &&
                        c.id !== command.id &&
                        (Date.parse(c.createdAt) >
                            Date.parse(command.createdAt) ||
                            (Date.parse(c.createdAt) ===
                                Date.parse(command.createdAt) &&
                                c.id.localeCompare(command.id) > 0)) &&
                        (c.state === 'queued' ||
                            c.state === 'syncing' ||
                            (c.state === 'failed' &&
                                c.error?.retryable === true)),
                );

                if (hasDependent) {
                    throw new Error(
                        'Cannot discard this action because subsequent dependent actions exist for this job.',
                    );
                }
            }
        }
    }

    private async cleanupCommandAttachments(
        command: OutboxCommand,
        otherCommands: OutboxCommand[],
    ): Promise<void> {
        const urisToDelete = durableAttachmentStorage.extractAttachmentUris(
            command.payload,
        );

        for (const uri of urisToDelete) {
            if (
                durableAttachmentStorage.isDurableUri(uri) ||
                uri.startsWith('file://')
            ) {
                await durableAttachmentStorage.deleteAttachment(
                    uri,
                    otherCommands,
                    command.id,
                );
            }
        }
    }

    public async resolveConflictAcceptServer(commandId: string): Promise<void> {
        const actorId = this.requireActor();
        const command = this.commands.get(commandId);

        if (command) {
            if (command.actorId !== actorId) {
                return;
            }

            // Apply identical command-specific safety and dependency rules as discardCommand.
            // Critical defects, signed submissions, and prerequisites cannot be silently discarded.
            this.assertCommandDiscardable(command);

            // Clean up unreferenced attachments safely across all retained commands
            const otherCommands = this.getCommands().filter(
                (c) => c.id !== commandId,
            );
            await this.cleanupCommandAttachments(command, otherCommands);
        }

        await this.repository.remove(actorId, commandId);

        if (this.activeActorId === actorId) {
            this.commands.delete(commandId);
            this.notify();
        }
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

        if (conflicted.actorId !== actorId) {
            return null;
        }

        // Require verified current server state
        if (!conflicted.error?.serverSnapshot) {
            throw new Error(
                'Cannot retry action without verified server state. Refresh assignments to reconcile.',
            );
        }

        if (typeof conflicted.error?.currentVersion !== 'number') {
            throw new Error(
                'Cannot retry action without verified current server version.',
            );
        }

        if (
            conflicted.expectedVersion !== null &&
            conflicted.expectedVersion !== undefined &&
            newVersion <= conflicted.expectedVersion
        ) {
            throw new Error(
                `New version (${newVersion}) must be greater than conflicted version (${conflicted.expectedVersion}).`,
            );
        }

        // Prevent blind version increments - newVersion must match the current server version
        if (newVersion !== conflicted.error.currentVersion) {
            throw new Error(
                `New version (${newVersion}) must match verified server version (${conflicted.error.currentVersion}).`,
            );
        }

        const serverStatus = conflicted.error.serverSnapshot.status?.value;

        if (serverStatus === 'cancelled') {
            throw new Error(
                'Cannot retry action: The job was cancelled on the server.',
            );
        }

        if (serverStatus === 'completed') {
            throw new Error(
                'Cannot retry action: The job is already completed on the server.',
            );
        }

        if (
            conflicted.error.serverSnapshot.my_assignment?.response_status ===
            'rejected'
        ) {
            throw new Error(
                'Cannot retry action: Assignment is no longer active on the server.',
            );
        }

        // Lock state immediately to prevent duplicate replacement creation from rapid double-taps
        const previousState = conflicted.state;
        conflicted.state = 'syncing';

        try {
            const replacement = await this.enqueue(
                conflicted.type,
                conflicted.jobId,
                conflicted.assignmentId,
                conflicted.payload,
                newVersion,
                {
                    priority: conflicted.priority,
                    expiresAt: conflicted.expiresAt,
                },
            );
            await this.repository.remove(actorId, commandId);

            if (this.activeActorId === actorId) {
                this.commands.delete(commandId);
                this.notify();
                await this.retryCommand(replacement.id, apiClient);
            }

            return replacement;
        } catch (err) {
            conflicted.state = previousState;

            throw err;
        }
    }

    public async correctCommandAttachment(
        commandId: string,
        oldAttachmentUri: string,
        newAttachmentUri: string,
    ): Promise<OutboxCommand> {
        const actorId = this.requireActor();
        const command = this.commands.get(commandId);

        if (!command) {
            throw new Error(`Command "${commandId}" not found.`);
        }

        if (command.state === 'syncing') {
            throw new Error(
                'Cannot modify an action that is currently syncing.',
            );
        }

        if (command.state === 'completed') {
            throw new Error(
                'This command was already accepted by the server. No authorized attachment correction workflow is available from the mobile outbox.',
            );
        }

        if (oldAttachmentUri === newAttachmentUri) {
            return command;
        }

        // A changed attachment is a changed request. If the original request
        // may have reached the server, keep the original payload and identity
        // intact until a server-side reconciliation result is available.
        if (command.attempts > 0 && !isVerifiedServerRejection(command)) {
            const oldAttachmentIsMissing =
                (oldAttachmentUri.startsWith('file://') ||
                    durableAttachmentStorage.isDurableUri(oldAttachmentUri)) &&
                !(await durableAttachmentStorage.attachmentExists(
                    oldAttachmentUri,
                ));
            const previousError = command.error;

            command.state = 'unresolved';
            command.nextAttemptAt = null;
            command.error = {
                code: 'OUTCOME_UNRESOLVED',
                message:
                    'The original request may have reached central dispatch. Reconcile the original command before replacing or discarding attachment evidence.',
                retryable: false,
                status: previousError?.status,
                missingAttachmentUri:
                    previousError?.missingAttachmentUri ??
                    (oldAttachmentIsMissing ? oldAttachmentUri : undefined),
            };
            await this.persist(command);

            return command;
        }

        const updatedPayload = JSON.parse(
            JSON.stringify(command.payload),
        ) as Record<string, unknown>;

        let replaced = false;

        if (Array.isArray(updatedPayload.photos)) {
            updatedPayload.photos = updatedPayload.photos.map(
                (item: unknown) => {
                    if (typeof item === 'string' && item === oldAttachmentUri) {
                        replaced = true;

                        return newAttachmentUri;
                    }

                    if (typeof item === 'object' && item !== null) {
                        const obj = { ...(item as Record<string, unknown>) };

                        if (obj.uri === oldAttachmentUri) {
                            obj.uri = newAttachmentUri;
                            replaced = true;
                        }

                        if (obj.file_path === oldAttachmentUri) {
                            obj.file_path = newAttachmentUri;
                            replaced = true;
                        }

                        return obj;
                    }

                    return item;
                },
            );
        }

        if (Array.isArray(updatedPayload.attachments)) {
            updatedPayload.attachments = updatedPayload.attachments.map(
                (item: unknown) => {
                    if (typeof item === 'string' && item === oldAttachmentUri) {
                        replaced = true;

                        return newAttachmentUri;
                    }

                    if (typeof item === 'object' && item !== null) {
                        const obj = { ...(item as Record<string, unknown>) };

                        if (obj.uri === oldAttachmentUri) {
                            obj.uri = newAttachmentUri;
                            replaced = true;
                        }

                        if (obj.file_path === oldAttachmentUri) {
                            obj.file_path = newAttachmentUri;
                            replaced = true;
                        }

                        return obj;
                    }

                    return item;
                },
            );
        }

        if (updatedPayload.signature_image_path === oldAttachmentUri) {
            updatedPayload.signature_image_path = newAttachmentUri;
            replaced = true;
        }

        if (updatedPayload.signature === oldAttachmentUri) {
            updatedPayload.signature = newAttachmentUri;
            replaced = true;
        }

        if (!replaced) {
            throw new Error(
                `Attachment "${oldAttachmentUri}" was not found in command payload.`,
            );
        }

        const replacement = await this.enqueue(
            command.type,
            command.jobId,
            command.assignmentId,
            updatedPayload,
            command.expectedVersion,
            {
                priority: command.priority,
                expiresAt: command.expiresAt,
            },
        );

        const otherCommands = this.getCommands().filter(
            (c) => c.id !== commandId && c.id !== replacement.id,
        );

        if (
            durableAttachmentStorage.isDurableUri(oldAttachmentUri) ||
            oldAttachmentUri.startsWith('file://')
        ) {
            await durableAttachmentStorage.deleteAttachment(
                oldAttachmentUri,
                otherCommands,
                commandId,
            );
        }

        await this.repository.remove(actorId, commandId);

        if (this.activeActorId === actorId) {
            this.commands.delete(commandId);
            this.notify();
        }

        return replacement;
    }

    public async discardCommand(commandId: string): Promise<void> {
        const actorId = this.requireActor();
        const command = this.commands.get(commandId);

        if (command) {
            this.assertCommandDiscardable(command);

            // Clean up unreferenced attachments safely across all retained commands
            const otherCommands = this.getCommands().filter(
                (c) => c.id !== commandId,
            );
            await this.cleanupCommandAttachments(command, otherCommands);
        }

        await this.repository.remove(actorId, commandId);

        if (this.activeActorId === actorId) {
            this.commands.delete(commandId);
            this.notify();
        }
    }

    private async executeCommand(
        command: OutboxCommand,
        apiClient: FieldApiClient,
        result: OutboxProcessResult,
    ): Promise<DispatchJob | unknown | null> {
        command.state = 'syncing';
        command.nextAttemptAt = null;

        const rawPhotos =
            (command.payload?.photos as unknown[]) ||
            (command.payload?.attachments as unknown[]);
        const photoList = Array.isArray(rawPhotos) ? rawPhotos : [];

        // Check if any referenced local attachment file is missing
        const attachmentUris = durableAttachmentStorage.extractAttachmentUris(
            command.payload,
        );
        const photoCount = photoList.length || attachmentUris.length;

        let missingAttachmentUri: string | null = null;

        for (const uri of attachmentUris) {
            if (
                uri.startsWith('file://') ||
                durableAttachmentStorage.isDurableUri(uri)
            ) {
                const exists =
                    await durableAttachmentStorage.attachmentExists(uri);

                if (!exists) {
                    missingAttachmentUri = uri;
                    break;
                }
            }
        }

        if (missingAttachmentUri) {
            command.state = 'failed';
            command.stage = null;
            command.stageMessage = null;
            command.nextAttemptAt = null;
            command.error = {
                code: 'MISSING_ATTACHMENTS',
                message: `Required attachment file is missing from device storage (${missingAttachmentUri}). Please recapture or discard.`,
                retryable: false,
                missingAttachmentUri,
            };
            await this.persist(command);
            result.failed += 1;

            return null;
        }

        if (photoCount > 0) {
            command.stage = 'uploading_photos';
            command.stageMessage = `Uploading ${photoCount} photo${photoCount === 1 ? '' : 's'}`;
        } else {
            command.stage = 'submitting_report';
            command.stageMessage = 'Submitting to dispatch';
        }

        await this.persist(command);

        // Count an attempt only once the local preflight has passed and the
        // request is about to cross the network. A missing local file is not a
        // server attempt and must remain safe to replace with a new command.
        command.attempts += 1;
        command.lastAttemptAt = this.now().toISOString();
        await this.persist(command);

        try {
            let response: DispatchJob | unknown = null;

            if (command.type === 'release_maintenance_work_order') {
                command.state = 'failed';
                command.nextAttemptAt = null;
                command.error = {
                    code: 'LEGACY_RELEASE_DISALLOWED',
                    message:
                        'Offline work order release commands are deprecated and cannot be replayed. A new explicit online release action is required.',
                    retryable: false,
                };
                await this.persist(command);
                result.failed += 1;

                return null;
            } else if (command.type === 'respond_assignment') {
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
            } else if (command.type === 'share_location') {
                response = await apiClient.shareLocation(
                    command.payload as unknown as LocationSharePayload,
                    command.id,
                );
            } else if (command.type === 'start_hos_shift') {
                response = await apiClient.startHosShift(
                    command.payload as unknown as HosStartCommandPayload,
                    command.id,
                );
            } else if (command.type === 'change_hos_duty_status') {
                response = await apiClient.updateHosDutyStatus(
                    command.payload as unknown as HosDutyStatusCommandPayload,
                    command.id,
                );
            } else if (command.type === 'certify_hos_shift') {
                response = await apiClient.certifyHosShift(
                    command.payload as unknown as HosCertifyCommandPayload,
                    command.id,
                );
            } else if (command.type === 'activate_sos') {
                response = await apiClient.activateSosIncident(
                    command.payload as unknown as ActivateSosIncidentPayload,
                    command.id,
                );
            } else if (command.type === 'submit_job_report') {
                response = await apiClient.submitJobReport(
                    command.payload as unknown as JobReportCommandPayload,
                    command.id,
                );
            } else if (command.type === 'submit_dvir') {
                response = await apiClient.createDvirInspection(
                    command.payload as unknown as Parameters<
                        typeof apiClient.createDvirInspection
                    >[0],
                    command.id,
                );
            } else if (command.type === 'submit_rental_handover') {
                const payload =
                    command.payload as unknown as RentalHandoverCommandPayload;
                response = await apiClient.submitRentalHandover(
                    payload.reservation_id,
                    payload as unknown as Record<string, unknown>,
                    command.id,
                );
            } else if (command.type === 'submit_sales_delivery') {
                const payload =
                    command.payload as unknown as SalesDeliveryCommandPayload;
                response = await apiClient.submitSalesDelivery(
                    payload.order_id,
                    payload as unknown as Record<string, unknown>,
                    command.id,
                );
            } else if (
                command.type === ('submit_equipment_inspection' as any)
            ) {
                const payload = command.payload as any;
                response = await apiClient.submitEquipmentInspection(
                    payload.operational_asset_id,
                    payload,
                    command.id,
                );
            } else if (
                command.type === ('submit_maintenance_work_order' as any)
            ) {
                const payload = command.payload as any;
                response = await apiClient.submitMaintenanceWorkOrder(
                    payload.operational_asset_id,
                    payload,
                    command.id,
                );
            } else if (command.type === 'report_delay') {
                const payload =
                    command.payload as unknown as ReportDelayPayload;
                response = await apiClient.reportDelay(
                    command.jobId!,
                    payload as unknown as Record<string, unknown>,
                    command.id,
                );
            }

            command.state = 'completed';
            command.stage = null;
            command.stageMessage = null;
            command.error = null;
            command.nextAttemptAt = null;
            command.completedAt = this.now().toISOString();
            this.lastSuccessfulSyncAt = command.completedAt;
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
        command.stage = null;
        command.stageMessage = null;

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
                error.isRateLimited ||
                error.status >= 500
            ) {
                await this.deferRetry(command, result, error);

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

        await this.deferRetry(command, result, error);
    }

    public async processCommand(
        command: OutboxCommand,
        apiClient: FieldApiClient,
        result: OutboxProcessResult = emptyResult(),
    ): Promise<DispatchJob | unknown | null> {
        return this.executeCommand(command, apiClient, result);
    }

    private async deferRetry(
        command: OutboxCommand,
        result: OutboxProcessResult,
        error?: unknown,
    ): Promise<void> {
        if (
            command.type === 'activate_sos' &&
            command.expiresAt &&
            Date.parse(command.expiresAt) <= this.now().getTime()
        ) {
            command.state = 'expired';
            command.nextAttemptAt = null;
            command.error = {
                code: 'SOS_EXPIRED',
                message:
                    'Expired — not delivered. Start a new SOS if help is still needed.',
                retryable: false,
            };
            result.failed += 1;
            await this.persist(command);

            return;
        }

        if (command.attempts >= this.maxAutomaticAttempts) {
            if (isUncertainTransportError(error)) {
                const errorObject =
                    typeof error === 'object' && error !== null
                        ? (error as Record<string, unknown>)
                        : undefined;
                const status =
                    error instanceof ApiClientError
                        ? error.status
                        : typeof errorObject?.status === 'number'
                          ? errorObject.status
                          : undefined;

                command.state = 'unresolved';
                command.nextAttemptAt = null;
                command.error = {
                    code: 'OUTCOME_UNRESOLVED',
                    status,
                    message:
                        'The retry limit was reached after a timeout or connection loss. The original request may have reached central dispatch; reconcile it before changing or discarding its evidence.',
                    retryable: false,
                };
                result.failed += 1;
            } else {
                command.state = 'failed';
                command.nextAttemptAt = null;
                command.error = {
                    code: 'RETRY_EXHAUSTED',
                    message:
                        'Automatic retry limit reached. Review or retry manually.',
                    retryable: true,
                };
                result.failed += 1;
            }
        } else {
            const calculatedDelay = Math.min(
                this.baseRetryDelayMs * 2 ** (command.attempts - 1),
                command.type === 'activate_sos'
                    ? sosMaxRetryDelayMs
                    : maxRetryDelayMs,
            );

            const errObj =
                typeof error === 'object' && error !== null
                    ? (error as Record<string, unknown>)
                    : undefined;

            const isRateLimited = Boolean(
                (error instanceof ApiClientError &&
                    (error.status === 429 || error.isRateLimited)) ||
                errObj?.status === 429 ||
                errObj?.isRateLimited === true,
            );

            const retryAfterSeconds =
                error instanceof ApiClientError
                    ? error.retryAfter
                    : typeof errObj?.retryAfter === 'number'
                      ? errObj.retryAfter
                      : typeof errObj?.retry_after === 'number'
                        ? errObj.retry_after
                        : undefined;

            const delay = isRateLimited
                ? Math.max(calculatedDelay, (retryAfterSeconds ?? 0) * 1000)
                : calculatedDelay;

            const errStatus =
                error instanceof ApiClientError
                    ? error.status
                    : typeof errObj?.status === 'number'
                      ? errObj.status
                      : undefined;
            const rawCode =
                error instanceof ApiClientError
                    ? error.errorCode
                    : typeof errObj?.code === 'string'
                      ? errObj.code
                      : undefined;
            const isTimeout =
                rawCode === 'TIMEOUT' ||
                rawCode === 'NETWORK_TIMEOUT' ||
                rawCode === 'GATEWAY_TIMEOUT' ||
                errStatus === 408 ||
                errStatus === 504;

            command.state = 'queued';
            command.nextAttemptAt = new Date(
                this.now().getTime() + delay,
            ).toISOString();

            if (isRateLimited) {
                command.error = {
                    code: 'RATE_LIMITED',
                    status: errStatus,
                    message: `Rate limit reached. Retry scheduled in ${Math.round(delay / 1000)} seconds.`,
                    retryable: true,
                };
            } else if (isTimeout) {
                command.error = {
                    code: 'NETWORK_TIMEOUT',
                    status: errStatus,
                    message:
                        typeof errObj?.message === 'string'
                            ? errObj.message
                            : 'Network request timed out. This command will retry.',
                    retryable: true,
                };
            } else {
                command.error = {
                    code: 'NETWORK_RETRY_SCHEDULED',
                    status: errStatus,
                    message:
                        typeof errObj?.message === 'string'
                            ? errObj.message
                            : 'Connection unavailable. This command will retry.',
                    retryable: true,
                };
            }

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
        await durableAttachmentStorage.cleanupActorAttachments(actorId);

        if (this.activeActorId === actorId) {
            this.commands.clear();
            this.notify();
        }
    }
}
