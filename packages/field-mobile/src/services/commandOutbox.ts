import type {
  DispatchJob,
  LocationSharePayload,
  OutboxCommand,
} from '../types/index.js';
import type { FieldApiClient } from './apiClient.js';
import { ApiClientError } from './apiClient.js';

export type OutboxListener = (commands: OutboxCommand[]) => void;

export function createCommandId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.getRandomValues !== 'function') {
    throw new Error('A cryptographically secure random source is required for command IDs.');
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class CommandOutboxManager {
  private commands: Map<string, OutboxCommand> = new Map();
  private listeners: Set<OutboxListener> = new Set();
  private isProcessing = false;

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

  public getCommands(): OutboxCommand[] {
    return Array.from(this.commands.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  public getCommand(id: string): OutboxCommand | undefined {
    return this.commands.get(id);
  }

  public getCommandsForJob(jobId: number): OutboxCommand[] {
    return this.getCommands().filter((cmd) => cmd.jobId === jobId);
  }

  private findExistingCommand(
    type: OutboxCommand['type'],
    jobId: number | null | undefined,
    assignmentId: number | null | undefined,
    payload: Record<string, unknown>,
    expectedVersion?: number | null
  ): OutboxCommand | undefined {
    return this.getCommands().find(
      (command) =>
        command.type === type &&
        command.jobId === jobId &&
        command.assignmentId === assignmentId &&
        command.expectedVersion === expectedVersion &&
        command.state !== 'completed' &&
        JSON.stringify(command.payload) === JSON.stringify(payload)
    );
  }

  public enqueueRespondAssignment(
    jobId: number,
    assignmentId: number,
    responseStatus: 'accepted' | 'rejected',
    reason: string | undefined,
    expectedVersion: number
  ): OutboxCommand {
    const payload = {
      response: responseStatus,
      reason,
    };
    const existing = this.findExistingCommand(
      'respond_assignment',
      jobId,
      assignmentId,
      payload,
      expectedVersion
    );

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const command: OutboxCommand = {
      id: createCommandId(),
      type: 'respond_assignment',
      jobId,
      assignmentId,
      payload,
      expectedVersion,
      state: 'queued',
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
    };

    this.commands.set(command.id, command);
    this.notify();

    return command;
  }

  public enqueueTransitionStatus(
    jobId: number,
    status: string,
    expectedVersion: number
  ): OutboxCommand {
    const payload = { status };
    const existing = this.findExistingCommand(
      'transition_status',
      jobId,
      undefined,
      payload,
      expectedVersion
    );

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const command: OutboxCommand = {
      id: createCommandId(),
      type: 'transition_status',
      jobId,
      payload,
      expectedVersion,
      state: 'queued',
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
    };

    this.commands.set(command.id, command);
    this.notify();

    return command;
  }

  public enqueueShareLocation(payload: LocationSharePayload): OutboxCommand {
    const now = new Date().toISOString();
    const command: OutboxCommand = {
      id: createCommandId(),
      type: 'share_location',
      jobId: payload.dispatch_job_id ?? null,
      payload: payload as unknown as Record<string, unknown>,
      state: 'queued',
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
    };

    this.commands.set(command.id, command);
    this.notify();

    return command;
  }

  public async processQueue(apiClient: FieldApiClient): Promise<void> {
    if (this.isProcessing) {
return;
}

    this.isProcessing = true;

    try {
      const queued = this.getCommands().filter(
        (cmd) => cmd.state === 'queued' || cmd.state === 'failed'
      );

      for (const command of queued) {
        await this.executeCommand(command, apiClient);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public async retryCommand(
    commandId: string,
    apiClient: FieldApiClient
  ): Promise<void> {
    const command = this.commands.get(commandId);

    if (!command) {
return;
}

    command.state = 'queued';
    command.updatedAt = new Date().toISOString();
    this.notify();

    await this.executeCommand(command, apiClient);
  }

  public resolveConflictAcceptServer(commandId: string): void {
    const command = this.commands.get(commandId);

    if (!command) {
return;
}

    // Discard local conflicted command since server snapshot is authoritative
    this.commands.delete(commandId);
    this.notify();
  }

  public async resolveConflictWithNewVersion(
    commandId: string,
    newVersion: number,
    apiClient: FieldApiClient
  ): Promise<void> {
    const command = this.commands.get(commandId);

    if (!command) {
return;
}

    command.expectedVersion = newVersion;
    command.state = 'queued';
    command.error = null;
    command.updatedAt = new Date().toISOString();
    this.notify();

    await this.executeCommand(command, apiClient);
  }

  private async executeCommand(
    command: OutboxCommand,
    apiClient: FieldApiClient
  ): Promise<DispatchJob | unknown | null> {
    command.state = 'syncing';
    command.updatedAt = new Date().toISOString();
    this.notify();

    try {
      let result: DispatchJob | unknown = null;

      if (command.type === 'respond_assignment') {
        result = await apiClient.respondAssignment(
          command.jobId!,
          command.assignmentId!,
          command.payload.response as 'accepted' | 'rejected',
          command.payload.reason as string | undefined,
          command.expectedVersion ?? 1,
          command.id
        );
      } else if (command.type === 'transition_status') {
        result = await apiClient.transitionStatus(
          command.jobId!,
          command.payload.status as string,
          command.expectedVersion ?? 1,
          command.id
        );
      } else if (command.type === 'share_location') {
        result = await apiClient.shareLocation(
          command.payload as unknown as LocationSharePayload,
          command.id
        );
      }

      command.state = 'completed';
      command.error = null;
      command.updatedAt = new Date().toISOString();
      this.notify();

      return result;
    } catch (err: unknown) {
      command.retryCount += 1;
      command.updatedAt = new Date().toISOString();

      if (err instanceof ApiClientError) {
        if (err.status === 409 || err.errorCode === 'stale_version') {
          command.state = 'conflict';
          command.error = {
            message: err.message || 'Version conflict detected on server.',
            code: err.errorCode || 'stale_version',
            currentVersion: err.currentVersion,
            serverSnapshot: err.serverSnapshot,
          };
          this.notify();

          return null;
        }

        command.state = 'failed';
        command.error = {
          message: err.message,
          code: err.errorCode || `HTTP_${err.status}`,
        };
        this.notify();

        return null;
      }

      const fallbackMsg =
        err instanceof Error ? err.message : 'Network failure during sync.';
      command.state = 'failed';
      command.error = {
        message: fallbackMsg,
        code: 'NETWORK_ERROR',
      };
      this.notify();

      return null;
    }
  }

  public clearCompleted(): void {
    for (const [id, cmd] of this.commands.entries()) {
      if (cmd.state === 'completed') {
        this.commands.delete(id);
      }
    }

    this.notify();
  }
}
