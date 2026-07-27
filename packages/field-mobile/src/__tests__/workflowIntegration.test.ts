import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import type { FieldApiClient } from '../services/apiClient.js';
import { ApiClientError } from '../services/apiClient.js';
import { CommandOutboxManager } from '../services/commandOutbox.js';
import type { DispatchJob, DispatchStatus, User } from '../types/index.js';

describe('Field Mobile Workflow Integration', () => {
  const activeWorker: User = {
    id: 1,
    name: 'Field Technician Alex',
    email: 'alex@example.com',
    role: 'field_technician',
    is_active: true,
  };

  test('completes full assignment accept and forward-only progression workflow', async () => {
    const outbox = new CommandOutboxManager();

    // Mock API server database state
    let serverJob: DispatchJob = {
      id: 50,
      reference: 'DISP-INTEG-050',
      client: 'Tech Industries',
      title: 'Generator Maintenance',
      site: 'Data Center B',
      priority: { value: 'priority', label: 'Priority' },
      status: { value: 'dispatched', label: 'Dispatched' },
      version: 1,
      my_assignment: {
        id: 105,
        response_status: 'pending',
        response_status_label: 'Pending',
      },
      progression: {
        current: { value: 'dispatched', label: 'Dispatched' },
        steps: [
          { status: { value: 'dispatched', label: 'Dispatched' }, state: 'current' },
          { status: { value: 'accepted', label: 'Accepted' }, state: 'upcoming' },
          { status: { value: 'en_route', label: 'En Route' }, state: 'upcoming' },
          { status: { value: 'arrived', label: 'Arrived' }, state: 'upcoming' },
          { status: { value: 'working', label: 'Working' }, state: 'upcoming' },
          { status: { value: 'completed', label: 'Completed' }, state: 'upcoming' },
        ],
        next: {
          status: { value: 'accepted', label: 'Accepted' },
          action_label: 'Accept Job Responsibility',
          confirmation_title: 'Accept this job?',
          confirmation_message: 'Confirm assignment',
        },
        message: 'Advance only when ready.',
      },
      capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
      },
    };

    const mockApiClient = {
      fetchAssignedJobs: async () => [serverJob],
      fetchJobDetail: async (id: number) => {
        assert.equal(id, 50);

        return serverJob;
      },
      respondAssignment: async (
        jobId: number,
        assignId: number,
        _resp: 'accepted' | 'rejected',
        _r: string | undefined,
        ver: number,
        cmdId: string
      ) => {
        assert.equal(jobId, 50);
        assert.equal(assignId, 105);
        assert.ok(cmdId);

        if (ver !== serverJob.version) {
          throw new ApiClientError('Version conflict', 409, {
            errorCode: 'stale_version',
            currentVersion: serverJob.version,
            serverSnapshot: serverJob,
          });
        }

        serverJob = {
          ...serverJob,
          version: serverJob.version + 1,
          my_assignment: {
            ...serverJob.my_assignment!,
            response_status: 'accepted',
            response_status_label: 'Accepted',
          },
        };

        return serverJob;
      },
      transitionStatus: async (
        jobId: number,
        status: string,
        ver: number,
        cmdId: string
      ) => {
        assert.equal(jobId, 50);
        assert.ok(cmdId);

        if (ver !== serverJob.version) {
          throw new ApiClientError('Version conflict', 409, {
            errorCode: 'stale_version',
            currentVersion: serverJob.version,
            serverSnapshot: serverJob,
          });
        }

        serverJob = {
          ...serverJob,
          version: serverJob.version + 1,
          status: { value: status as DispatchStatus, label: status },
        };

        return serverJob;
      },
    } as unknown as FieldApiClient;

    // Step 1: Fetch active assignments for worker
    assert.ok(activeWorker.is_active);
    const jobs = await mockApiClient.fetchAssignedJobs();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].my_assignment?.response_status, 'pending');

    // Step 2: Accept assignment
    const acceptCmd = outbox.enqueueRespondAssignment(
      jobs[0].id,
      jobs[0].my_assignment!.id,
      'accepted',
      undefined,
      jobs[0].version
    );
    assert.equal(acceptCmd.state, 'queued');

    await outbox.processQueue(mockApiClient);
    assert.equal(acceptCmd.state, 'completed');
    assert.equal(serverJob.version, 2);
    assert.equal(serverJob.my_assignment?.response_status, 'accepted');

    // Step 3: Forward progression: Dispatched -> Accepted -> En Route
    const stepCmd = outbox.enqueueTransitionStatus(
      serverJob.id,
      'en_route',
      serverJob.version
    );
    await outbox.processQueue(mockApiClient);

    assert.equal(stepCmd.state, 'completed');
    assert.equal(serverJob.version, 3);
    assert.equal(serverJob.status.value, 'en_route');
  });

  test('detects version conflict and resolves via retry with updated server version', async () => {
    const outbox = new CommandOutboxManager();
    let serverVersion = 10;

    const mockApiClient = {
      transitionStatus: async (jobId: number, status: string, ver: number) => {
        if (ver !== serverVersion) {
          throw new ApiClientError('Version mismatch', 409, {
            errorCode: 'stale_version',
            currentVersion: serverVersion,
            serverSnapshot: {
              id: jobId,
              reference: 'DISP-CONFLICT-100',
              version: serverVersion,
              status: { value: 'arrived', label: 'Arrived' },
            } as DispatchJob,
          });
        }

        serverVersion++;

        return {
          id: jobId,
          version: serverVersion,
          status: { value: status, label: status },
        } as DispatchJob;
      },
    } as unknown as FieldApiClient;

    // Worker attempts transition with stale version 9 (server is at 10)
    const cmd = outbox.enqueueTransitionStatus(100, 'working', 9);

    await outbox.processQueue(mockApiClient);

    // Assert command enters conflict state with server details
    assert.equal(cmd.state, 'conflict');
    assert.equal(cmd.error?.currentVersion, 10);

    // Resolve conflict by updating to current server version (10) and retrying
    await outbox.resolveConflictWithNewVersion(cmd.id, 10, mockApiClient);

    assert.equal(cmd.state, 'completed');
    assert.equal(serverVersion, 11);
  });
});
