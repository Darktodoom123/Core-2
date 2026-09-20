import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CommandOutboxManager } from '../services/commandOutbox';
import { durableAttachmentStorage } from '../services/durableAttachmentStorage';
import {
    isCommandDiscardable,
    isServerOutcomeUncertain,
    projectCommandToDisplay,
    projectOutbox,
} from '../services/outboxProjection';
import { MemoryOutboxRepository } from '../storage/outboxRepository';
import type { OutboxCommand } from '../types/index';

function createCommandFixture(
    overrides: Partial<OutboxCommand> = {},
): OutboxCommand {
    return {
        id: 'cmd-test-1',
        type: 'submit_dvir',
        actorId: 101,
        payload: {
            inspection_type: 'pre_trip',
            asset_code: 'CRN-501',
            has_defects: false,
            photos: ['photo-front.jpg', 'photo-back.jpg'],
        },
        payloadHash: 'hash-test-1',
        priority: 'ordinary',
        attempts: 0,
        state: 'queued',
        createdAt: '2026-09-20T08:00:00.000Z',
        updatedAt: '2026-09-20T08:00:00.000Z',
        ...overrides,
    };
}

describe('Outbox Projection & Synchronization Truthfulness', () => {
    test('projects truthful clean synced state based on actual sync timestamps', () => {
        // Fresh start with no sync history
        const noSyncProj = projectOutbox([], true, true);
        assert.equal(noSyncProj.headerPill.label, 'Synced');
        assert.equal(noSyncProj.headerPill.message, 'Up to date');
        assert.equal(noSyncProj.headerPill.tone, 'online');
        assert.equal(noSyncProj.canSyncNow, false);
        assert.equal(noSyncProj.counts.totalActive, 0);

        // Recent sync (< 60s)
        const now = Date.now();
        const recentSyncAt = new Date(now - 15000).toISOString();
        const recentProj = projectOutbox([], true, true, now, recentSyncAt);
        assert.equal(recentProj.headerPill.label, 'Synced');
        assert.equal(recentProj.headerPill.message, 'Just now');

        // Sync 12 minutes ago
        const olderSyncAt = new Date(now - 12 * 60 * 1000).toISOString();
        const olderProj = projectOutbox([], true, true, now, olderSyncAt);
        assert.equal(olderProj.headerPill.label, 'Synced');
        assert.equal(olderProj.headerPill.message, '12m ago');
    });

    test('projects offline state with connection guidance when offline with no actions', () => {
        const projection = projectOutbox([], false, true);

        assert.equal(projection.headerPill.label, 'Offline');
        assert.equal(projection.headerPill.message, 'Reconnect to sync');
        assert.equal(projection.headerPill.tone, 'offline');
        assert.equal(projection.canSyncNow, false);
        assert.match(
            projection.syncGuidance,
            /Offline — actions are saved safely/i,
        );
    });

    test('projects queued actions with waiting count and enables manual sync when online', () => {
        const commands = [
            createCommandFixture({ id: 'cmd-1', state: 'queued' }),
            createCommandFixture({ id: 'cmd-2', state: 'queued' }),
        ];
        const projection = projectOutbox(commands, true, true);

        assert.equal(projection.headerPill.label, '2 waiting to sync');
        assert.equal(projection.headerPill.tone, 'checking');
        assert.equal(projection.counts.waiting, 2);
        assert.equal(projection.canSyncNow, true);
        assert.equal(projection.sections.active.length, 2);
    });

    test('projects queued actions with offline indicator when device is disconnected', () => {
        const commands = [
            createCommandFixture({ id: 'cmd-1', state: 'queued' }),
        ];
        const projection = projectOutbox(commands, false, true);

        assert.equal(projection.headerPill.label, 'Offline (1 waiting)');
        assert.equal(projection.headerPill.tone, 'offline');
        assert.equal(projection.canSyncNow, false);
        assert.match(projection.syncGuidance, /1 action saved on this device/i);
    });

    test('projects in-flight syncing state with honest stage message', () => {
        const commands = [
            createCommandFixture({
                id: 'cmd-1',
                state: 'syncing',
                stage: 'uploading_photos',
                stageMessage: 'Uploading 2 photos',
            }),
        ];
        const projection = projectOutbox(commands, true, true);

        assert.equal(projection.headerPill.label, 'Syncing action');
        assert.equal(projection.headerPill.message, 'Uploading 2 photos');
        assert.equal(projection.headerPill.tone, 'syncing');
        assert.equal(projection.isProcessing, true);
        assert.equal(projection.canSyncNow, false);
    });

    test('projects attention state when actions have failed or encountered conflicts', () => {
        const commands = [
            createCommandFixture({
                id: 'cmd-failed',
                state: 'failed',
                error: {
                    message: 'Server timeout (504)',
                    retryable: true,
                    code: 'GATEWAY_TIMEOUT',
                },
            }),
            createCommandFixture({
                id: 'cmd-conflict',
                state: 'conflict',
                error: {
                    message: 'Stale version',
                    retryable: false,
                    code: 'stale_version',
                    currentVersion: 4,
                },
            }),
        ];
        const projection = projectOutbox(commands, true, true);

        assert.equal(projection.headerPill.label, '2 need attention');
        assert.equal(projection.headerPill.tone, 'attention');
        assert.equal(projection.counts.attention, 2);
        assert.match(
            projection.syncGuidance,
            /1 conflict and 1 failed action need attention/i,
        );
        assert.equal(projection.sections.attention.length, 2);

        const conflictItem = projection.sections.attention.find(
            (i) => i.id === 'cmd-conflict',
        );
        assert.ok(conflictItem);
        assert.equal(conflictItem.isConflict, true);
        assert.equal(conflictItem.currentVersion, 4);
        assert.equal(conflictItem.retryable, false);
    });

    test('labels unresolved outcomes separately from ordinary failed actions', () => {
        const unresolved = createCommandFixture({
            id: 'cmd-unresolved',
            state: 'unresolved',
            attempts: 1,
            error: {
                code: 'OUTCOME_UNRESOLVED',
                message:
                    'Reconcile the original command before changing evidence.',
                retryable: false,
            },
        });
        const projection = projectOutbox([unresolved], true, true);

        assert.match(
            projection.syncGuidance,
            /1 unresolved outcome need reconciliation/i,
        );
        assert.equal(projection.sections.attention[0]?.retryable, true);
        assert.equal(projection.sections.attention[0]?.canDiscard, false);
    });

    test('groups background GPS telemetry into dedicated summary and isolates from active actions', () => {
        const commands = [
            createCommandFixture({
                id: 'cmd-dvir',
                type: 'submit_dvir',
                state: 'queued',
            }),
            createCommandFixture({
                id: 'cmd-gps-1',
                type: 'share_location',
                state: 'queued',
                payload: { latitude: 14.5995, longitude: 120.9842 },
            }),
            createCommandFixture({
                id: 'cmd-gps-2',
                type: 'share_location',
                state: 'queued',
                payload: { latitude: 14.601, longitude: 120.9855 },
            }),
        ];
        const projection = projectOutbox(commands, true, true);

        // Active section should contain only DVIR, not GPS
        assert.equal(projection.sections.active.length, 1);
        assert.equal(projection.sections.active[0].id, 'cmd-dvir');

        // Telemetry should be grouped in telemetry summary
        assert.ok(projection.sections.telemetry);
        assert.equal(projection.sections.telemetry.count, 2);
        assert.equal(projection.counts.telemetry, 2);
    });

    test('quarantines legacy maintenance work order release commands without allowing replay', () => {
        const legacyCommand = createCommandFixture({
            id: 'legacy-wo-1',
            type: 'release_maintenance_work_order',
            state: 'failed',
            error: {
                message:
                    'Offline work order release commands are deprecated and cannot be replayed.',
                retryable: false,
                code: 'LEGACY_RELEASE_DISALLOWED',
            },
        });

        const display = projectCommandToDisplay(legacyCommand, true);

        assert.equal(display.isQuarantined, true);
        assert.equal(display.retryable, false);
        assert.equal(display.canDiscard, true);
        assert.equal(display.stateLabel, 'Quarantined (cannot replay)');
        assert.match(
            display.explanation,
            /offline work order release commands are deprecated/i,
        );
    });

    test('marks 401 authentication errors as requiring sign in', () => {
        const authCommand = createCommandFixture({
            id: 'auth-err-1',
            state: 'failed',
            error: {
                message: 'Unauthenticated',
                retryable: true,
                code: 'AUTHENTICATION_REQUIRED',
            },
        });

        const display = projectCommandToDisplay(authCommand, true);

        assert.equal(display.isAuthenticationRequired, true);
        assert.equal(display.stateLabel, 'Sign-in required');
        assert.equal(display.retryable, true);
    });

    test('enforces emergency SOS safety: active SOS cannot be discarded across conflict and error states', () => {
        const activeSos = createCommandFixture({
            id: 'sos-active',
            type: 'activate_sos',
            priority: 'emergency',
            state: 'queued',
        });

        const activeDisplay = projectCommandToDisplay(activeSos, true);
        assert.equal(activeDisplay.isEmergency, true);
        assert.equal(activeDisplay.canDiscard, false);
        assert.match(activeDisplay.stateLabel, /unacknowledged/i);
        assert.match(
            activeDisplay.explanation,
            /distress signal NOT yet received or acknowledged/i,
        );

        // Active SOS encountering conflict cannot be discarded
        const conflictSos = createCommandFixture({
            id: 'sos-conflict',
            type: 'activate_sos',
            priority: 'emergency',
            state: 'conflict',
            error: {
                code: 'stale_version',
                message: 'Conflict',
                retryable: false,
            },
        });
        const conflictDisplay = projectCommandToDisplay(conflictSos, true);
        assert.equal(conflictDisplay.canDiscard, false);

        // Active SOS encountering 403 authorization denied cannot be discarded
        const authDeniedSos = createCommandFixture({
            id: 'sos-auth-denied',
            type: 'activate_sos',
            priority: 'emergency',
            state: 'failed',
            error: {
                code: 'AUTHORIZATION_DENIED',
                message: 'Forbidden',
                retryable: false,
            },
        });
        const authDeniedDisplay = projectCommandToDisplay(authDeniedSos, true);
        assert.equal(authDeniedDisplay.canDiscard, false);

        // Expired SOS allows discard with clear radio instructions
        const expiredSos = createCommandFixture({
            id: 'sos-expired',
            type: 'activate_sos',
            priority: 'emergency',
            state: 'expired',
            error: {
                message:
                    'Emergency SOS delivery timed out after 180s without server acknowledgement.',
                retryable: false,
                code: 'SOS_EXPIRED',
            },
        });

        const expiredDisplay = projectCommandToDisplay(expiredSos, true);
        assert.equal(expiredDisplay.isEmergency, true);
        assert.equal(expiredDisplay.canDiscard, true);
        assert.match(
            expiredDisplay.explanation,
            /contact emergency dispatch or supervisor via radio or phone/i,
        );
    });

    test('visibly projects missing attachment errors with guidance to recapture or discard', () => {
        const missingCmd = createCommandFixture({
            id: 'cmd-missing-att',
            state: 'failed',
            error: {
                code: 'MISSING_ATTACHMENTS',
                message:
                    'Required photo attachment is missing from device storage. Please recapture or discard.',
                retryable: false,
            },
        });

        const display = projectCommandToDisplay(missingCmd, true);
        assert.equal(display.stateLabel, 'Missing photo files');
        assert.equal(display.retryable, false);
        assert.equal(display.canDiscard, true);
        assert.match(display.explanation, /missing from device storage/i);
    });
});

const testHasher = {
    hash: async (envelope: Record<string, unknown>) => JSON.stringify(envelope),
};

describe('CommandOutboxManager Milestone 6 Safeguards', () => {
    test('discardCommand blocks discarding an in-flight syncing action', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const queuedCmd = createCommandFixture({
            id: 'cmd-syncing',
            actorId: 101,
            state: 'queued',
        });
        await repo.save(queuedCmd);
        await manager.activateActor(101);

        const cmd = manager.getCommands().find((c) => c.id === 'cmd-syncing')!;
        cmd.state = 'syncing';

        await assert.rejects(
            async () => {
                await manager.discardCommand('cmd-syncing');
            },
            {
                message: 'Cannot discard an action that is currently syncing.',
            },
        );
    });

    test('discardCommand blocks discarding an active emergency SOS alert', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const activeSos = createCommandFixture({
            id: 'sos-live',
            actorId: 101,
            type: 'activate_sos',
            priority: 'emergency',
            state: 'queued',
        });
        await repo.save(activeSos);
        await manager.activateActor(101);

        await assert.rejects(
            async () => {
                await manager.discardCommand('sos-live');
            },
            {
                message: 'Active emergency SOS cannot be discarded.',
            },
        );
    });

    test('discardCommand allows discarding an expired SOS alert', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const expiredSos = createCommandFixture({
            id: 'sos-expired',
            actorId: 101,
            type: 'activate_sos',
            priority: 'emergency',
            state: 'expired',
        });
        await repo.save(expiredSos);
        await manager.activateActor(101);

        await manager.discardCommand('sos-expired');
        assert.equal(manager.getCommands().length, 0);
    });

    test('retryAllEligible ignores quarantined commands and retries only valid retryable failures', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const retryableCmd = createCommandFixture({
            id: 'cmd-retryable',
            actorId: 101,
            state: 'failed',
            error: {
                message: 'Network drop',
                retryable: true,
                code: 'NETWORK_TIMEOUT',
            },
        });

        const quarantinedCmd = createCommandFixture({
            id: 'cmd-quarantined',
            actorId: 101,
            type: 'release_maintenance_work_order',
            state: 'failed',
            error: {
                message: 'Deprecated offline release',
                retryable: false,
                code: 'LEGACY_RELEASE_DISALLOWED',
            },
        });

        const nonRetryableCmd = createCommandFixture({
            id: 'cmd-validation-err',
            actorId: 101,
            state: 'failed',
            error: {
                message: 'Validation failed',
                retryable: false,
                code: 'VALIDATION_FAILED',
            },
        });

        await repo.save(retryableCmd);
        await repo.save(quarantinedCmd);
        await repo.save(nonRetryableCmd);
        await manager.activateActor(101);

        // Mock client that succeeds
        const mockClient = {
            post: async () => ({ status: 200 }),
            createDvirInspection: async () => ({ status: 'passed' }),
            executeOutboxCommand: async () => ({ status: 200 }),
        } as any;

        await manager.retryAllEligible(mockClient);

        const allCommands = manager.getCommands();
        const quarantined = allCommands.find((c) => c.id === 'cmd-quarantined');
        const validation = allCommands.find(
            (c) => c.id === 'cmd-validation-err',
        );
        const retryable = allCommands.find((c) => c.id === 'cmd-retryable');

        // Quarantined and validation errors must NOT have been retried or queued
        assert.equal(quarantined?.state, 'failed');
        assert.equal(quarantined?.error?.code, 'LEGACY_RELEASE_DISALLOWED');
        assert.equal(validation?.state, 'failed');

        // Retryable command should have progressed to completed
        assert.equal(retryable?.state, 'completed');
    });

    test('preserves job dependency ordering by deferring subsequent commands when an earlier command is failed or in conflict', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        // Job 202: Command 1 failed
        const job1Cmd1 = createCommandFixture({
            id: 'job202-cmd1',
            jobId: 202,
            type: 'transition_status',
            state: 'failed',
            createdAt: '2026-09-20T08:00:00.000Z',
            error: {
                message: 'Network drop',
                retryable: true,
                code: 'NETWORK_TIMEOUT',
            },
        });

        // Job 202: Command 2 queued (dependent on Command 1)
        const job1Cmd2 = createCommandFixture({
            id: 'job202-cmd2',
            jobId: 202,
            type: 'submit_job_report',
            state: 'queued',
            createdAt: '2026-09-20T08:05:00.000Z',
            payload: { work_summary: 'Shift done' },
        });

        // Job 303: Independent command queued
        const job2Cmd1 = createCommandFixture({
            id: 'job303-cmd1',
            jobId: 303,
            type: 'submit_job_report',
            state: 'queued',
            createdAt: '2026-09-20T08:06:00.000Z',
            payload: { work_summary: 'Independent job done' },
        });

        await repo.save(job1Cmd1);
        await repo.save(job1Cmd2);
        await repo.save(job2Cmd1);
        await manager.activateActor(101);

        const executedCommandIds: string[] = [];
        const mockClient = {
            submitJobReport: async (_payload: any, commandId: string) => {
                executedCommandIds.push(commandId);

                return { success: true };
            },
        } as any;

        const result = await manager.processQueue(mockClient);

        // Job 202 Command 2 must be deferred because Command 1 for Job 202 is failed!
        assert.equal(result.deferred, 1);
        assert.equal(result.completed, 1);

        // Only the independent job 303 command should have executed
        assert.deepEqual(executedCommandIds, ['job303-cmd1']);

        const cmds = manager.getCommands();
        const cmd202_2 = cmds.find((c) => c.id === 'job202-cmd2')!;
        assert.equal(cmd202_2.state, 'queued');

        const cmd303_1 = cmds.find((c) => c.id === 'job303-cmd1')!;
        assert.equal(cmd303_1.state, 'completed');
    });

    test('resolveConflictWithNewVersion locks state immediately to prevent rapid double-tap duplicate creation', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const conflictedCmd = createCommandFixture({
            id: 'conflicted-1',
            jobId: 202,
            type: 'transition_status',
            state: 'conflict',
            expectedVersion: 1,
            payload: { status: 'in_transit' },
            error: {
                code: 'stale_version',
                message: 'Stale version',
                currentVersion: 2,
                retryable: false,
                serverSnapshot: {
                    reference: 'JOB-202',
                    status: { value: 'in_progress', label: 'In Progress' },
                } as any,
            },
        });
        await repo.save(conflictedCmd);
        await manager.activateActor(101);

        let transitionCalls = 0;
        const mockClient = {
            transitionStatus: async () => {
                transitionCalls += 1;

                return { id: 202, version: 2 };
            },
        } as any;

        // Concurrent double-tap
        const [res1, res2] = await Promise.all([
            manager.resolveConflictWithNewVersion(
                'conflicted-1',
                2,
                mockClient,
            ),
            manager.resolveConflictWithNewVersion(
                'conflicted-1',
                2,
                mockClient,
            ),
        ]);

        // One must succeed and the other must return null
        assert.ok(
            (res1 !== null && res2 === null) ||
                (res1 === null && res2 !== null),
        );
        assert.equal(transitionCalls, 1);

        // Exactly one command remaining in the outbox
        assert.equal(manager.getCommands().length, 1);
    });

    test('detects missing attachment file and visibly fails command with MISSING_ATTACHMENTS', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const dvirMissingPhoto = createCommandFixture({
            id: 'cmd-missing-photo',
            type: 'submit_dvir',
            state: 'queued',
            payload: {
                inspection_type: 'pre_trip',
                asset_code: 'CRN-501',
                photos: [
                    {
                        angle: 'front',
                        uri: 'file:///data/user/0/com.core2.fieldmobile/files/attachments/actor_101/missing_photo.jpg',
                    },
                ],
            },
        });
        await repo.save(dvirMissingPhoto);
        await manager.activateActor(101);

        let apiCalled = false;
        const mockClient = {
            createDvirInspection: async () => {
                apiCalled = true;

                return { status: 'ok' };
            },
        } as any;

        const result = await manager.processQueue(mockClient);

        // API should NOT be called with broken/missing attachment
        assert.equal(apiCalled, false);
        assert.equal(result.failed, 1);

        const failedCmd = manager
            .getCommands()
            .find((c) => c.id === 'cmd-missing-photo')!;
        assert.equal(failedCmd.state, 'failed');
        assert.equal(failedCmd.error?.code, 'MISSING_ATTACHMENTS');
        assert.equal(failedCmd.error?.retryable, false);

        // Visible projection
        const display = projectCommandToDisplay(failedCmd, true);
        assert.equal(display.stateLabel, 'Missing photo files');
        assert.equal(display.retryable, false);
        assert.equal(display.canDiscard, true);
    });
});

describe('Milestone 6 Closure: Command-Specific Discard Rules & Attachment Protection', () => {
    test('blocks discard for DVIR reporting defects (has_defects, defect_severity, or defects list)', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const dvirWithDefects = createCommandFixture({
            id: 'dvir-defects-1',
            type: 'submit_dvir',
            payload: { asset_code: 'CRN-501', has_defects: true },
        });
        const dvirCritical = createCommandFixture({
            id: 'dvir-defects-2',
            type: 'submit_dvir',
            payload: { asset_code: 'CRN-501', defect_severity: 'critical' },
        });
        const dvirList = createCommandFixture({
            id: 'dvir-defects-3',
            type: 'submit_dvir',
            payload: { asset_code: 'CRN-501', defects: ['leaking cylinder'] },
        });
        const dvirClean = createCommandFixture({
            id: 'dvir-clean',
            type: 'submit_dvir',
            payload: { asset_code: 'CRN-501', has_defects: false },
        });

        await repo.save(dvirWithDefects);
        await repo.save(dvirCritical);
        await repo.save(dvirList);
        await repo.save(dvirClean);
        await manager.activateActor(101);

        // Discard projection
        assert.equal(isCommandDiscardable(dvirWithDefects).canDiscard, false);
        assert.equal(isCommandDiscardable(dvirCritical).canDiscard, false);
        assert.equal(isCommandDiscardable(dvirList).canDiscard, false);
        assert.equal(isCommandDiscardable(dvirClean).canDiscard, true);

        // Manager discard rejects defect DVIRs
        await assert.rejects(
            () => manager.discardCommand('dvir-defects-1'),
            /Safety DVIR inspections reporting critical defects cannot be discarded locally/i,
        );
        await assert.rejects(
            () => manager.discardCommand('dvir-defects-2'),
            /Safety DVIR inspections reporting critical defects cannot be discarded locally/i,
        );
        await assert.rejects(
            () => manager.discardCommand('dvir-defects-3'),
            /Safety DVIR inspections reporting critical defects cannot be discarded locally/i,
        );

        // Clean DVIR can be discarded
        await manager.discardCommand('dvir-clean');
        assert.equal(manager.getCommand('dvir-clean'), undefined);
    });

    test('blocks discard for failed equipment inspections and maintenance work orders', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const failedEq = createCommandFixture({
            id: 'eq-failed',
            type: 'submit_equipment_inspection',
            payload: { result: 'failed', asset_code: 'CRN-501' },
        });
        const passedEq = createCommandFixture({
            id: 'eq-passed',
            type: 'submit_equipment_inspection',
            payload: { result: 'passed', asset_code: 'CRN-501' },
        });
        const workOrder = createCommandFixture({
            id: 'wo-1',
            type: 'submit_maintenance_work_order',
            payload: { maintenance_work_order_id: 42 },
        });

        await repo.save(failedEq);
        await repo.save(passedEq);
        await repo.save(workOrder);
        await manager.activateActor(101);

        assert.equal(isCommandDiscardable(failedEq).canDiscard, false);
        assert.equal(isCommandDiscardable(workOrder).canDiscard, false);
        assert.equal(isCommandDiscardable(passedEq).canDiscard, true);

        await assert.rejects(
            () => manager.discardCommand('eq-failed'),
            /Equipment inspections with defects cannot be discarded locally/i,
        );
        await assert.rejects(
            () => manager.discardCommand('wo-1'),
            /Maintenance work orders cannot be discarded locally/i,
        );

        await manager.discardCommand('eq-passed');
        assert.equal(manager.getCommand('eq-passed'), undefined);
    });

    test('blocks discard for signed rental handovers and sales deliveries', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const signedHandover = createCommandFixture({
            id: 'handover-signed',
            type: 'submit_rental_handover',
            payload: {
                signee_name: 'John Doe',
                signature_image_path: 'sig.jpg',
            },
        });
        const unsignedHandover = createCommandFixture({
            id: 'handover-unsigned',
            type: 'submit_rental_handover',
            payload: { notes: 'Draft handover' },
        });
        const signedSales = createCommandFixture({
            id: 'sales-signed',
            type: 'submit_sales_delivery',
            payload: { signature: 'sig.png' },
        });

        await repo.save(signedHandover);
        await repo.save(unsignedHandover);
        await repo.save(signedSales);
        await manager.activateActor(101);

        assert.equal(isCommandDiscardable(signedHandover).canDiscard, false);
        assert.equal(isCommandDiscardable(signedSales).canDiscard, false);
        assert.equal(isCommandDiscardable(unsignedHandover).canDiscard, true);

        await assert.rejects(
            () => manager.discardCommand('handover-signed'),
            /Signed custody handovers cannot be discarded/i,
        );
        await assert.rejects(
            () => manager.discardCommand('sales-signed'),
            /Signed custody handovers cannot be discarded/i,
        );

        await manager.discardCommand('handover-unsigned');
        assert.equal(manager.getCommand('handover-unsigned'), undefined);
    });

    test('blocks discard when subsequent dependent commands exist for the same job', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const cmd1 = createCommandFixture({
            id: 'job-step-1',
            jobId: 555,
            createdAt: '2026-09-20T08:00:00.000Z',
            type: 'transition_status',
            payload: { status: 'in_transit' },
        });
        const cmd2 = createCommandFixture({
            id: 'job-step-2',
            jobId: 555,
            createdAt: '2026-09-20T08:05:00.000Z',
            type: 'submit_job_report',
            payload: { work_summary: 'Site report' },
        });

        await repo.save(cmd1);
        await repo.save(cmd2);
        await manager.activateActor(101);

        const allCommands = manager.getCommands();
        // Step 1 cannot be discarded because Step 2 depends on it
        assert.equal(isCommandDiscardable(cmd1, allCommands).canDiscard, false);
        // Step 2 can be discarded (no subsequent dependent steps)
        assert.equal(isCommandDiscardable(cmd2, allCommands).canDiscard, true);

        await assert.rejects(
            () => manager.discardCommand('job-step-1'),
            /subsequent dependent actions exist/i,
        );

        // Discard step 2 first, then step 1 can be discarded
        await manager.discardCommand('job-step-2');
        await manager.discardCommand('job-step-1');
        assert.equal(manager.getCommands().length, 0);
    });

    test('isServerOutcomeUncertain accurately flags timeouts and 502-504 responses after transmission attempts', () => {
        const unattempted = createCommandFixture({
            id: 'cmd-unattempted',
            attempts: 0,
            state: 'queued',
        });
        assert.equal(isServerOutcomeUncertain(unattempted), false);

        const timeoutCmd = createCommandFixture({
            id: 'cmd-timeout',
            attempts: 1,
            state: 'failed',
            error: { code: 'GATEWAY_TIMEOUT', message: 'Timeout' },
        });
        assert.equal(isServerOutcomeUncertain(timeoutCmd), true);

        const badGatewayCmd = createCommandFixture({
            id: 'cmd-502',
            attempts: 1,
            state: 'failed',
            error: { status: 502, message: 'Bad Gateway' },
        });
        assert.equal(isServerOutcomeUncertain(badGatewayCmd), true);

        const validationErrCmd = createCommandFixture({
            id: 'cmd-val',
            attempts: 1,
            state: 'failed',
            error: {
                status: 422,
                code: 'VALIDATION_FAILED',
                message: 'Invalid field',
            },
        });
        assert.equal(isServerOutcomeUncertain(validationErrCmd), false);

        const completedCmd = createCommandFixture({
            id: 'cmd-done',
            attempts: 1,
            state: 'completed',
        });
        assert.equal(isServerOutcomeUncertain(completedCmd), false);
    });

    test('deleteAttachment preserves shared files referenced by other outbox commands', async () => {
        const sharedUri =
            'file:///data/user/0/com.core2.fieldmobile/files/attachments/actor_101/shared_spec.jpg';
        const uniqueUri =
            'file:///data/user/0/com.core2.fieldmobile/files/attachments/actor_101/unique_spec.jpg';

        const cmdA = createCommandFixture({
            id: 'cmd-a',
            payload: { photos: [sharedUri, uniqueUri] },
        });
        const cmdB = createCommandFixture({
            id: 'cmd-b',
            payload: { photos: [sharedUri] },
        });

        const allCommands = [cmdA, cmdB];

        // Shared URI is referenced by cmdB when deleting cmdA -> must NOT delete
        const deletedShared = await durableAttachmentStorage.deleteAttachment(
            sharedUri,
            allCommands,
            'cmd-a',
        );
        assert.equal(
            deletedShared,
            false,
            'Shared attachment must be preserved when referenced by cmdB',
        );

        // Unique URI is NOT referenced by any other command -> deletion allowed
        const deletedUnique = await durableAttachmentStorage.deleteAttachment(
            uniqueUri,
            allCommands,
            'cmd-a',
        );
        assert.equal(
            deletedUnique,
            true,
            'Unique attachment can be deleted safely',
        );
    });
});

describe('Milestone 6 Closure: Conflict Reconciliation Strict Validation', () => {
    test('resolveConflictWithNewVersion rejects stale or decremented versions', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const conflictCmd = createCommandFixture({
            id: 'conflict-v3',
            jobId: 202,
            type: 'transition_status',
            expectedVersion: 3,
            state: 'conflict',
            error: {
                code: 'stale_version',
                message: 'Conflict',
                currentVersion: 4,
                serverSnapshot: {
                    reference: 'JOB-202',
                    status: { value: 'in_progress', label: 'In Progress' },
                } as any,
            },
        });
        await repo.save(conflictCmd);
        await manager.activateActor(101);

        const mockClient = { transitionStatus: async () => ({}) } as any;

        // Same version (3 <= 3) must be rejected
        await assert.rejects(
            () =>
                manager.resolveConflictWithNewVersion(
                    'conflict-v3',
                    3,
                    mockClient,
                ),
            /New version \(3\) must be greater than conflicted version \(3\)/i,
        );

        // Decremented version (2 <= 3) must be rejected
        await assert.rejects(
            () =>
                manager.resolveConflictWithNewVersion(
                    'conflict-v3',
                    2,
                    mockClient,
                ),
            /New version \(2\) must be greater than conflicted version \(3\)/i,
        );
    });

    test('resolveConflictWithNewVersion rejects retries when job was cancelled on the server', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const cancelledConflict = createCommandFixture({
            id: 'conflict-cancelled',
            jobId: 202,
            type: 'transition_status',
            expectedVersion: 2,
            state: 'conflict',
            error: {
                code: 'stale_version',
                message: 'Conflict',
                currentVersion: 5,
                serverSnapshot: {
                    reference: 'JOB-202',
                    status: { value: 'cancelled', label: 'Cancelled' },
                } as any,
            },
        });
        await repo.save(cancelledConflict);
        await manager.activateActor(101);

        const mockClient = { transitionStatus: async () => ({}) } as any;

        await assert.rejects(
            () =>
                manager.resolveConflictWithNewVersion(
                    'conflict-cancelled',
                    5,
                    mockClient,
                ),
            /Cannot retry action: The job was cancelled on the server/i,
        );
    });

    test('resolveConflictWithNewVersion generates fresh command ID, updates expectedVersion, and preserves target payload', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const originalId = 'conflict-replace-me';
        const conflictCmd = createCommandFixture({
            id: originalId,
            jobId: 202,
            type: 'transition_status',
            expectedVersion: 2,
            payload: { status: 'in_transit', reason: 'en_route_to_site' },
            state: 'conflict',
            error: {
                code: 'stale_version',
                message: 'Conflict',
                currentVersion: 3,
                serverSnapshot: {
                    reference: 'JOB-202',
                    status: { value: 'in_progress', label: 'In Progress' },
                } as any,
            },
        });
        await repo.save(conflictCmd);
        await manager.activateActor(101);

        let transitionCommandId: string | null = null;
        let transitionVersion: number | null = null;
        const mockClient = {
            transitionStatus: async (
                _jobId: number,
                _status: string,
                ver: number,
                cmdId: string,
            ) => {
                transitionCommandId = cmdId;
                transitionVersion = ver;

                return { id: 202, version: ver };
            },
        } as any;

        const replacement = await manager.resolveConflictWithNewVersion(
            originalId,
            3,
            mockClient,
        );

        assert.ok(replacement);
        // Brand new command UUID v4 must be generated (not reusing originalId)
        assert.notEqual(replacement.id, originalId);
        assert.equal(replacement.expectedVersion, 3);
        assert.equal(replacement.jobId, 202);
        assert.deepEqual(replacement.payload, {
            status: 'in_transit',
            reason: 'en_route_to_site',
        });

        // Old conflicted command must be purged
        assert.equal(manager.getCommand(originalId), undefined);

        // API must have been called with the new command ID and new version
        assert.equal(transitionCommandId, replacement.id);
        assert.equal(transitionVersion, 3);
    });
});

describe('Milestone 6 Closure: Retry Scheduling, Actor Isolation & Processing Mutex', () => {
    test('retryCommand defers execution when nextAttemptAt is in the future', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const futureTime = new Date(Date.now() + 60000).toISOString();
        const scheduledCmd = createCommandFixture({
            id: 'cmd-scheduled',
            actorId: 101,
            state: 'failed',
            nextAttemptAt: futureTime,
            error: {
                code: 'RATE_LIMITED',
                message: 'Backing off',
                retryable: true,
            },
        });
        await repo.save(scheduledCmd);
        await manager.activateActor(101);

        let apiCalled = false;
        const mockClient = {
            createDvirInspection: async () => {
                apiCalled = true;

                return {};
            },
        } as any;

        const result = await manager.retryCommand('cmd-scheduled', mockClient);
        assert.equal(
            apiCalled,
            false,
            'API must not be called when backoff is active',
        );
        assert.equal(result.deferred, 1);
        assert.equal(manager.getCommand('cmd-scheduled')?.state, 'failed');
    });

    test('retryCommand blocks non-retryable permanent error codes', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const permanentCodes = [
            'VALIDATION_FAILED',
            'AUTHORIZATION_DENIED',
            'LEGACY_RELEASE_DISALLOWED',
            'MALFORMED_COMMAND',
            'MISSING_ATTACHMENTS',
            'SOS_EXPIRED',
        ];

        for (const code of permanentCodes) {
            const cmd = createCommandFixture({
                id: `cmd-${code}`,
                actorId: 101,
                state: 'failed',
                error: { code, message: 'Permanent failure', retryable: false },
            });
            await repo.save(cmd);
        }

        await manager.activateActor(101);

        let apiCalled = false;
        const mockClient = {
            createDvirInspection: async () => {
                apiCalled = true;

                return {};
            },
        } as any;

        for (const code of permanentCodes) {
            const res = await manager.retryCommand(`cmd-${code}`, mockClient);
            assert.equal(res.completed, 0);
            assert.equal(manager.getCommand(`cmd-${code}`)?.state, 'failed');
        }

        assert.equal(
            apiCalled,
            false,
            'No permanent error codes should trigger API execution',
        );
    });

    test('retryCommand and outbox reject commands belonging to another actor', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });

        // Actor 101 creates a command
        await manager.activateActor(101);
        const cmdActor101 = createCommandFixture({
            id: 'cmd-actor-101',
            actorId: 101,
            state: 'failed',
            error: {
                code: 'NETWORK_TIMEOUT',
                message: 'Timeout',
                retryable: true,
            },
        });
        await repo.save(cmdActor101);
        await manager.activateActor(101);

        // Switch to Actor 202
        await manager.activateActor(202);

        // Actor 202 cannot see or retry Actor 101's command
        assert.equal(manager.getCommand('cmd-actor-101'), undefined);
        assert.equal(manager.getCommands().length, 0);

        let apiCalled = false;
        const mockClient = {
            createDvirInspection: async () => {
                apiCalled = true;

                return {};
            },
        } as any;
        const result = await manager.retryCommand('cmd-actor-101', mockClient);
        assert.equal(result.completed, 0);
        assert.equal(apiCalled, false);
    });
});

describe('Milestone 6 Closure: Attachment Recapture & Payload Identity', () => {
    test('correctCommandAttachment updates photo URI, generates new command ID, and preserves payload target', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const oldUri = 'file:///data/user/0/missing_front.jpg';
        const newUri = 'file:///data/user/0/recaptured_front.jpg';

        const cmd = createCommandFixture({
            id: 'cmd-corrupt-photo',
            type: 'submit_dvir',
            jobId: 789,
            state: 'failed',
            payload: {
                asset_code: 'CRN-501',
                photos: [
                    { angle: 'front', uri: oldUri },
                    {
                        angle: 'back',
                        uri: 'file:///data/user/0/valid_back.jpg',
                    },
                ],
            },
            error: {
                code: 'MISSING_ATTACHMENTS',
                message: 'Missing file',
                retryable: false,
            },
        });
        await repo.save(cmd);
        await manager.activateActor(101);

        const corrected = await manager.correctCommandAttachment(
            'cmd-corrupt-photo',
            oldUri,
            newUri,
        );

        // Verified new UUID command ID
        assert.ok(corrected);
        assert.notEqual(corrected.id, 'cmd-corrupt-photo');
        assert.equal(corrected.jobId, 789);
        assert.equal(corrected.state, 'queued');

        // Payload photos updated
        const photos = corrected.payload.photos as any[];
        assert.equal(photos[0].uri, newUri);
        assert.equal(photos[1].uri, 'file:///data/user/0/valid_back.jpg');

        // Old command removed
        assert.equal(manager.getCommand('cmd-corrupt-photo'), undefined);
    });

    test('preserves command ID on retrying exact replayed payload to leverage backend idempotency', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const originalCommandId = 'cmd-idempotent-replay';
        const netFailCmd = createCommandFixture({
            id: originalCommandId,
            type: 'submit_dvir',
            state: 'failed',
            payload: { asset_code: 'CRN-501', has_defects: false },
            error: {
                code: 'NETWORK_TIMEOUT',
                message: 'Network lost',
                retryable: true,
            },
        });
        await repo.save(netFailCmd);
        await manager.activateActor(101);

        let receivedCommandId: string | null = null;
        const mockClient = {
            createDvirInspection: async (_payload: any, cmdId: string) => {
                receivedCommandId = cmdId;

                return { status: 'passed' };
            },
        } as any;

        const result = await manager.retryCommand(
            originalCommandId,
            mockClient,
        );
        assert.equal(result.completed, 1);
        // The command ID sent to the backend must be the EXACT original ID
        assert.equal(receivedCommandId, originalCommandId);
    });
});

describe('Milestone 6 Closure Check 1: Shared Attachment Retention Across All Retained States', () => {
    test('discarding command A preserves shared attachments across failed, conflict, auth-blocked, and dependent commands', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const sharedFile = await durableAttachmentStorage.saveAttachmentDurably(
            { base64: 'shared-data', fileName: 'shared-defect.jpg' },
            101,
        );
        const uniqueFileA =
            await durableAttachmentStorage.saveAttachmentDurably(
                { base64: 'unique-data-a', fileName: 'unique-a.jpg' },
                101,
            );

        // Command A references both uniqueFileA and sharedFile
        const cmdA = createCommandFixture({
            id: 'cmd-a-discardable',
            actorId: 101,
            type: 'transition_status',
            jobId: 10,
            state: 'failed',
            payload: {
                status: 'in_progress',
                photos: [sharedFile.uri, uniqueFileA.uri],
            },
            error: {
                code: 'NETWORK_ERROR',
                message: 'Temporary network failure',
                retryable: true,
            },
        });
        await repo.save(cmdA);

        // Test 1: Command B is in state 'failed'
        const cmdBFailed = createCommandFixture({
            id: 'cmd-b-failed',
            actorId: 101,
            type: 'submit_dvir',
            jobId: 20,
            state: 'failed',
            payload: {
                asset_code: 'EQ-01',
                photos: [sharedFile.uri],
            },
            error: {
                code: 'NETWORK_ERROR',
                message: 'Failed to upload earlier',
                retryable: true,
            },
        });
        await repo.save(cmdBFailed);
        await manager.activateActor(101);

        // Discard Command A
        await manager.discardCommand('cmd-a-discardable');

        // Verify uniqueFileA was deleted, but sharedFile was PRESERVED
        assert.equal(
            await durableAttachmentStorage.attachmentExists(uniqueFileA.uri),
            false,
        );
        assert.equal(
            await durableAttachmentStorage.attachmentExists(sharedFile.uri),
            true,
        );

        // Verify Command B can recover and sync without MISSING_ATTACHMENTS error
        const mockClient = {
            createDvirInspection: async () => ({ status: 'passed' }),
        } as any;
        const result = await manager.retryCommand('cmd-b-failed', mockClient);
        assert.equal(result.completed, 1);
        assert.equal(manager.getCommand('cmd-b-failed')?.state, 'completed');
    });

    test('resolveConflictAcceptServer preserves shared attachments when peer command is in conflict or authentication-blocked', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const sharedFile = await durableAttachmentStorage.saveAttachmentDurably(
            { base64: 'shared-data-2', fileName: 'shared-evidence.jpg' },
            101,
        );

        // Discardable non-critical conflict
        const cmdConflictA = createCommandFixture({
            id: 'cmd-conflict-a',
            actorId: 101,
            type: 'transition_status',
            jobId: 50,
            state: 'conflict',
            payload: {
                status: 'arrived',
                photos: [sharedFile.uri],
            },
            error: {
                code: 'stale_version',
                message: 'Stale version',
                currentVersion: 2,
            },
        });

        // Peer command blocked on authentication
        const cmdAuthBlocked = createCommandFixture({
            id: 'cmd-auth-blocked',
            actorId: 101,
            type: 'submit_dvir',
            jobId: 60,
            state: 'failed',
            payload: {
                asset_code: 'TRK-900',
                photos: [sharedFile.uri],
            },
            error: {
                code: 'AUTHENTICATION_REQUIRED',
                message: 'Sign in again',
                retryable: true,
            },
        });

        await repo.save(cmdConflictA);
        await repo.save(cmdAuthBlocked);
        await manager.activateActor(101);

        // Accept server update for Command A
        await manager.resolveConflictAcceptServer('cmd-conflict-a');
        assert.equal(manager.getCommand('cmd-conflict-a'), undefined);

        // Shared file must remain intact
        assert.equal(
            await durableAttachmentStorage.attachmentExists(sharedFile.uri),
            true,
        );

        // When user authenticates, cmdAuthBlocked retries and recovers successfully
        const mockClient = {
            createDvirInspection: async () => ({ status: 'passed' }),
        } as any;
        const result = await manager.retryCommand(
            'cmd-auth-blocked',
            mockClient,
        );
        assert.equal(result.completed, 1);
        assert.equal(
            manager.getCommand('cmd-auth-blocked')?.state,
            'completed',
        );
    });

    test('preserves shared attachments for subsequent dependent queued commands', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const sharedPhoto =
            await durableAttachmentStorage.saveAttachmentDurably(
                { base64: 'photo-bytes', fileName: 'walkaround.jpg' },
                101,
            );

        // Initial command for Job 77
        const cmd1 = createCommandFixture({
            id: 'cmd-job-77-step1',
            jobId: 77,
            actorId: 101,
            type: 'transition_status',
            createdAt: '2026-09-20T08:00:00.000Z',
            state: 'failed',
            payload: {
                status: 'en_route',
                photos: [sharedPhoto.uri],
            },
            error: {
                code: 'VALIDATION_FAILED',
                message: 'Invalid status',
                retryable: false,
            },
        });

        // Independent command for Job 88 that also uses the walkaround photo
        const cmdJob88 = createCommandFixture({
            id: 'cmd-job-88-queued',
            jobId: 88,
            actorId: 101,
            type: 'submit_dvir',
            createdAt: '2026-09-20T08:05:00.000Z',
            state: 'queued',
            payload: {
                asset_code: 'EQ-88',
                photos: [sharedPhoto.uri],
            },
        });

        await repo.save(cmd1);
        await repo.save(cmdJob88);
        await manager.activateActor(101);

        // Discarding cmd1 does NOT purge sharedPhoto because cmdJob88 is queued and needs it
        await manager.discardCommand('cmd-job-77-step1');
        assert.equal(
            await durableAttachmentStorage.attachmentExists(sharedPhoto.uri),
            true,
        );

        // cmdJob88 can process normally without missing attachment error
        const mockClient = {
            createDvirInspection: async () => ({ status: 'passed' }),
        } as any;
        const result = await manager.processQueue(mockClient);
        assert.equal(result.completed, 1);
        assert.equal(
            manager.getCommand('cmd-job-88-queued')?.state,
            'completed',
        );
    });
});

describe('Milestone 6 Closure Check 2: Unknown Server Outcomes & Attachment Correction Idempotency', () => {
    test('server acceptance followed by response loss keeps changed attachment content unresolved until exact replay reconciles', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const oldFile = await durableAttachmentStorage.saveAttachmentDurably(
            { base64: 'initial-dvir-bytes', fileName: 'initial_dvir.jpg' },
            101,
        );
        const newFile = await durableAttachmentStorage.saveAttachmentDurably(
            {
                base64: 'recaptured-dvir-bytes',
                fileName: 'recaptured_dvir.jpg',
            },
            101,
        );

        const oldUri = oldFile.uri;
        const newUri = newFile.uri;

        // Server-side simulated database for idempotency verification
        const serverDb: Array<{
            commandId: string;
            assetCode: string;
            recordId: number;
        }> = [];
        let autoIncId = 1000;

        // Mock client simulating:
        // Request 1: Server accepts, writes to DB, but socket timeout drops response before client receives it
        // Request 2 (Retry after attachment correction): Server receives same commandId, detects existing record, returns it without creating duplicate
        let attemptCount = 0;
        const mockClient = {
            createDvirInspection: async (payload: any, cmdId: string) => {
                attemptCount += 1;
                const existing = serverDb.find((r) => r.commandId === cmdId);

                if (existing) {
                    // Backend IdempotentCommandService returns the existing business record
                    return {
                        id: existing.recordId,
                        status: 'passed',
                        is_duplicate: true,
                    };
                }

                // First attempt: Server creates record, but network drops before response can be sent
                autoIncId += 1;
                serverDb.push({
                    commandId: cmdId,
                    assetCode: payload.asset_code,
                    recordId: autoIncId,
                });

                if (attemptCount === 1) {
                    const timeoutErr: any = new Error(
                        'Network request timed out',
                    );
                    timeoutErr.code = 'TIMEOUT';
                    timeoutErr.status = 408;

                    throw timeoutErr;
                }

                return { id: autoIncId, status: 'passed' };
            },
        } as any;

        // Enqueue command
        const command = await manager.enqueueSubmitDvir({
            asset_code: 'CRN-999',
            has_defects: false,
            photos: [oldUri],
        });
        const originalCommandId = command.id;

        // Attempt 1: Network times out after server wrote record
        await manager.processQueue(mockClient);
        const postAttempt1 = manager.getCommand(originalCommandId)!;
        assert.equal(postAttempt1.attempts, 1);
        assert.equal(postAttempt1.state, 'queued'); // Backing off for retry
        assert.equal(isServerOutcomeUncertain(postAttempt1), true);
        assert.equal(
            serverDb.length,
            1,
            'Server wrote initial record before losing connection',
        );

        // Replacing content after an uncertain transmission must not mutate
        // the original payload or claim that the replacement was accepted.
        const corrected = await manager.correctCommandAttachment(
            originalCommandId,
            oldUri,
            newUri,
        );

        assert.equal(
            corrected.id,
            originalCommandId,
            'The original command remains the evidence record while outcome is unresolved',
        );
        assert.equal(corrected.state, 'unresolved');
        assert.equal(corrected.error?.code, 'OUTCOME_UNRESOLVED');
        assert.equal((corrected.payload.photos as string[])[0], oldUri);

        // Reconcile by replaying the original unchanged payload with the same ID.
        const result = await manager.retryCommand(
            originalCommandId,
            mockClient,
        );
        assert.equal(result.completed, 1);

        // Verification: Exactly 1 record on server - NO DUPLICATE BUSINESS RECORD CREATED!
        assert.equal(
            serverDb.length,
            1,
            'Server must contain exactly 1 business record, idempotently deduplicated',
        );
        assert.equal(serverDb[0].commandId, originalCommandId);
        assert.equal(manager.getCommand(originalCommandId)?.state, 'completed');
    });

    test('marks a no-status connection reset as unresolved after retry exhaustion', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
            maxAutomaticAttempts: 1,
        });
        await manager.activateActor(101);

        const command = await manager.enqueueSubmitDvir({
            asset_code: 'CRN-998',
            has_defects: false,
        });
        const connectionReset = new Error('socket hang up: ECONNRESET');
        (connectionReset as Error & { code?: string }).code = 'ECONNRESET';

        const result = await manager.processQueue({
            createDvirInspection: async () => {
                throw connectionReset;
            },
        } as any);

        const unresolved = manager.getCommand(command.id)!;
        assert.equal(result.failed, 1);
        assert.equal(unresolved.state, 'unresolved');
        assert.equal(unresolved.error?.code, 'OUTCOME_UNRESOLVED');
        assert.equal(unresolved.error?.status, undefined);
        assert.equal(isServerOutcomeUncertain(unresolved), true);
    });

    test('missing attachment plus an uncertain outcome preserves evidence and makes no replacement request', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const oldUri = 'file:///data/user/0/missing-after-timeout.jpg';
        const replacementUri =
            'file:///data/user/0/recaptured-after-timeout.jpg';
        const command = createCommandFixture({
            id: 'cmd-unknown-missing-attachment',
            state: 'queued',
            attempts: 1,
            payload: { asset_code: 'CRN-999', photos: [oldUri] },
            error: {
                code: 'NETWORK_TIMEOUT',
                message: 'Connection reset after submission.',
                retryable: true,
            },
        });
        await repo.save(command);
        await manager.activateActor(101);

        let apiCalls = 0;
        const mockClient = {
            createDvirInspection: async () => {
                apiCalls += 1;

                return { status: 'unexpected' };
            },
        } as any;

        const unresolved = await manager.correctCommandAttachment(
            command.id,
            oldUri,
            replacementUri,
        );

        assert.equal(unresolved.id, command.id);
        assert.equal(unresolved.state, 'unresolved');
        assert.equal(unresolved.error?.code, 'OUTCOME_UNRESOLVED');
        assert.equal(unresolved.error?.missingAttachmentUri, oldUri);
        assert.equal((unresolved.payload.photos as string[])[0], oldUri);
        assert.equal(
            (await manager.retryCommand(command.id, mockClient)).completed,
            0,
        );
        assert.equal(apiCalls, 0);
        await assert.rejects(
            manager.discardCommand(command.id),
            /unresolved server outcome/i,
        );
    });

    test('unattempted commands generate fresh identity on attachment correction', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const oldUri = 'file:///data/user/0/unattempted_old.jpg';
        const newUri = 'file:///data/user/0/unattempted_new.jpg';

        const unattempted = await manager.enqueueSubmitDvir({
            asset_code: 'CRN-123',
            photos: [oldUri],
        });
        assert.equal(unattempted.attempts, 0);

        const corrected = await manager.correctCommandAttachment(
            unattempted.id,
            oldUri,
            newUri,
        );

        // Because attempts === 0, creating a fresh replacement identity is safe and expected
        assert.notEqual(corrected.id, unattempted.id);
        assert.equal(manager.getCommand(unattempted.id), undefined);
        assert.equal(manager.getCommand(corrected.id)?.state, 'queued');
    });
});

describe('Milestone 6 Closure Check 3: Accept Server Consistency & Discard Rules', () => {
    test('resolveConflictAcceptServer rejects discarding safety DVIR with critical defects', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const criticalDvir = createCommandFixture({
            id: 'conflict-critical-dvir',
            type: 'submit_dvir',
            state: 'conflict',
            payload: {
                asset_code: 'CRN-501',
                has_defects: true,
                defect_severity: 'critical',
                defects: [{ item: 'brakes', severity: 'critical' }],
            },
            error: {
                code: 'stale_version',
                message: 'Conflict',
                currentVersion: 4,
            },
        });
        await repo.save(criticalDvir);
        await manager.activateActor(101);

        // Accept Server MUST reject discarding critical defect evidence
        await assert.rejects(
            () => manager.resolveConflictAcceptServer('conflict-critical-dvir'),
            /Safety DVIR inspections reporting critical defects cannot be discarded locally/i,
        );

        // Evidence remains recoverable on device
        assert.ok(manager.getCommand('conflict-critical-dvir'));

        // UI projection must reflect that discard is blocked with explanation
        const display = projectCommandToDisplay(criticalDvir, true);
        assert.equal(display.canDiscard, false);
        assert.match(
            display.discardBlockReason || '',
            /Safety DVIR inspections reporting defects cannot be discarded locally/i,
        );
        assert.match(display.explanation, /Required next action:/i);
    });

    test('resolveConflictAcceptServer rejects discarding signed custody handovers', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const signedHandover = createCommandFixture({
            id: 'conflict-signed-handover',
            type: 'submit_rental_handover',
            state: 'conflict',
            payload: {
                signee_name: 'Jane Smith',
                signature: 'file:///data/user/0/sig.png',
            },
            error: {
                code: 'stale_version',
                message: 'Conflict',
                currentVersion: 5,
            },
        });
        await repo.save(signedHandover);
        await manager.activateActor(101);

        await assert.rejects(
            () =>
                manager.resolveConflictAcceptServer('conflict-signed-handover'),
            /Signed custody handovers cannot be discarded/i,
        );
        assert.ok(manager.getCommand('conflict-signed-handover'));

        const display = projectCommandToDisplay(signedHandover, true);
        assert.equal(display.canDiscard, false);
        assert.match(
            display.discardBlockReason || '',
            /Signed custody handovers cannot be discarded/i,
        );
    });

    test('resolveConflictAcceptServer rejects discarding prerequisite commands when subsequent dependent actions exist', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const prerequisiteCmd = createCommandFixture({
            id: 'prereq-conflict',
            jobId: 505,
            type: 'transition_status',
            state: 'conflict',
            createdAt: '2026-09-20T09:00:00.000Z',
            payload: { status: 'arrived' },
            error: {
                code: 'stale_version',
                message: 'Conflict',
                currentVersion: 3,
            },
        });
        const dependentCmd = createCommandFixture({
            id: 'dependent-queued',
            jobId: 505,
            type: 'transition_status',
            state: 'queued',
            createdAt: '2026-09-20T09:05:00.000Z',
            payload: { status: 'working' },
        });

        await repo.save(prerequisiteCmd);
        await repo.save(dependentCmd);
        await manager.activateActor(101);

        await assert.rejects(
            () => manager.resolveConflictAcceptServer('prereq-conflict'),
            /Cannot discard this action because subsequent dependent actions exist for this job/i,
        );
        assert.ok(manager.getCommand('prereq-conflict'));

        const all = manager.getCommands();
        const display = projectCommandToDisplay(
            prerequisiteCmd,
            true,
            Date.now(),
            all,
        );
        assert.equal(display.canDiscard, false);
        assert.match(
            display.discardBlockReason || '',
            /subsequent dependent actions exist for this job/i,
        );
    });

    test('resolveConflictAcceptServer succeeds for non-critical discardable conflicts and cleans up attachments', async () => {
        const repo = new MemoryOutboxRepository();
        const manager = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await manager.activateActor(101);

        const discardablePhoto =
            await durableAttachmentStorage.saveAttachmentDurably(
                {
                    base64: 'photo-bytes-discard',
                    fileName: 'discard-temp.jpg',
                },
                101,
            );

        const discardableCmd = createCommandFixture({
            id: 'conflict-clean-discard',
            type: 'transition_status',
            state: 'conflict',
            payload: {
                status: 'en_route',
                photos: [discardablePhoto.uri],
            },
            error: {
                code: 'stale_version',
                message: 'Conflict',
                currentVersion: 3,
            },
        });
        await repo.save(discardableCmd);
        await manager.activateActor(101);

        await manager.resolveConflictAcceptServer('conflict-clean-discard');
        assert.equal(manager.getCommand('conflict-clean-discard'), undefined);
        assert.equal(
            await durableAttachmentStorage.attachmentExists(
                discardablePhoto.uri,
            ),
            false,
        );
    });
});
