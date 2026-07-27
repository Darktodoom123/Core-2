import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import type { FieldApiClient} from '../services/apiClient.js';
import { ApiClientError } from '../services/apiClient.js';
import { CommandOutboxManager } from '../services/commandOutbox.js';
import type { DispatchJob } from '../types/index.js';

describe('CommandOutboxManager', () => {
  test('enqueues command with valid UUID and initial queued state', () => {
    const outbox = new CommandOutboxManager();
    const cmd = outbox.enqueueTransitionStatus(10, 'accepted', 1);

    assert.match(
      cmd.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    assert.equal(cmd.state, 'queued');
    assert.equal(cmd.jobId, 10);
    assert.equal(cmd.expectedVersion, 1);
  });

  test('reuses an existing pending command for duplicate submissions', () => {
    const outbox = new CommandOutboxManager();
    const first = outbox.enqueueTransitionStatus(10, 'accepted', 1);
    const duplicate = outbox.enqueueTransitionStatus(10, 'accepted', 1);

    assert.equal(duplicate.id, first.id);
    assert.equal(outbox.getCommands().length, 1);
  });

  test('retries failed commands using identical command UUID idempotency key', async () => {
    const outbox = new CommandOutboxManager();
    const cmd = outbox.enqueueTransitionStatus(10, 'accepted', 1);
    const initialId = cmd.id;

    let callsCount = 0;
    const mockApiClient = {
      transitionStatus: async (jobId: number, status: string, ver: number, cmdId: string) => {
        callsCount++;
        assert.equal(cmdId, initialId);

        if (callsCount === 1) {
          throw new Error('Network timeout');
        }

        return {
          id: 10,
          reference: 'DISP-010',
          version: 2,
          status: { value: 'accepted', label: 'Accepted' },
        } as DispatchJob;
      },
    } as unknown as FieldApiClient;

    // First attempt fails -> state becomes 'failed'
    await outbox.processQueue(mockApiClient);
    assert.equal(outbox.getCommand(initialId)?.state, 'failed');
    assert.equal(outbox.getCommand(initialId)?.retryCount, 1);

    // Retry uses same command UUID -> succeeds -> state becomes 'completed'
    await outbox.retryCommand(initialId, mockApiClient);
    assert.equal(outbox.getCommand(initialId)?.state, 'completed');
    assert.equal(callsCount, 2);
  });

  test('handles 409 Conflict without duplicate retries and sets actionable conflict state', async () => {
    const outbox = new CommandOutboxManager();
    const cmd = outbox.enqueueRespondAssignment(15, 101, 'accepted', undefined, 2);

    const mockApiClient = {
      respondAssignment: async () => {
        throw new ApiClientError('Version mismatch', 409, {
          errorCode: 'stale_version',
          currentVersion: 4,
          serverSnapshot: {
            id: 15,
            reference: 'DISP-015',
            version: 4,
            status: { value: 'working', label: 'Working' },
          } as DispatchJob,
        });
      },
    } as unknown as FieldApiClient;

    await outbox.processQueue(mockApiClient);

    const updated = outbox.getCommand(cmd.id);
    assert.equal(updated?.state, 'conflict');
    assert.equal(updated?.error?.code, 'stale_version');
    assert.equal(updated?.error?.currentVersion, 4);
    assert.equal(updated?.error?.serverSnapshot?.version, 4);
  });

  test('allows resolving conflict by accepting server state', () => {
    const outbox = new CommandOutboxManager();
    const cmd = outbox.enqueueTransitionStatus(20, 'arrived', 1);

    outbox.resolveConflictAcceptServer(cmd.id);
    assert.equal(outbox.getCommand(cmd.id), undefined);
  });

  test('allows resolving conflict with new server version retry', async () => {
    const outbox = new CommandOutboxManager();
    const cmd = outbox.enqueueTransitionStatus(20, 'arrived', 1);

    let usedVersion: number | null = null;
    const mockApiClient = {
      transitionStatus: async (_j: number, _s: string, ver: number) => {
        usedVersion = ver;

        return { id: 20, version: 4 } as DispatchJob;
      },
    } as unknown as FieldApiClient;

    await outbox.resolveConflictWithNewVersion(cmd.id, 3, mockApiClient);

    assert.equal(usedVersion, 3);
    assert.equal(outbox.getCommand(cmd.id)?.state, 'completed');
  });
});
