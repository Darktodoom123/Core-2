import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CommandOutboxManager } from '../services/commandOutbox';
import { fixTime, LocationSharingService } from '../services/locationService';
import { MemoryOutboxRepository } from '../storage/outboxRepository';
import type { DispatchJob, User } from '../types/index';

const testHasher = {
    hash: async (env: unknown) => JSON.stringify(env),
};

const activeUser: User = {
    id: 10,
    name: 'Test Operator',
    username: 'operator',
    email: 'operator@example.com',
    role: 'crane_operator',
    is_active: true,
};

const activeJob: DispatchJob = {
    id: 101,
    reference: 'DISP-101',
    title: 'Equipment Delivery',
    client: 'Acme Corp',
    site: 'North Site',
    priority: { value: 'routine', label: 'Routine' },
    status: { value: 'accepted', label: 'Accepted' },
    scheduled_start: null,
    scheduled_end: null,
    site_notes: null,
    requirements: [],
    version: 1,
    capabilities: {
        can_respond: false,
        can_update_status: true,
        can_share_location: true,
    },
};

describe('LocationSharingService Unit Tests', () => {
    test('captures immediately and every 15 seconds until stopped', async (t) => {
        t.mock.timers.enable({ apis: ['setInterval'] });
        const outbox = new CommandOutboxManager({
            repository: new MemoryOutboxRepository(),
            hasher: testHasher,
        });
        await outbox.activateActor(activeUser.id);
        const service = new LocationSharingService(outbox);
        let captures = 0;
        const capture = async () => {
            captures++;

            return { latitude: 14.5995, longitude: 120.9842 };
        };

        try {
            service.startAutoTracking(activeUser, activeJob, capture);
            assert.equal(captures, 1);
            t.mock.timers.tick(14_999);
            assert.equal(captures, 1);
            t.mock.timers.tick(1);
            assert.equal(captures, 2);
            service.stopAutoTracking();
            t.mock.timers.tick(15_000);
            assert.equal(captures, 2);
        } finally {
            service.stopAutoTracking();
        }
    });

    test('does not send the same fix twice when no newer one has arrived', async (t) => {
        t.mock.timers.enable({ apis: ['setInterval'] });
        const outbox = new CommandOutboxManager({
            repository: new MemoryOutboxRepository(),
            hasher: testHasher,
        });
        await outbox.activateActor(activeUser.id);
        const service = new LocationSharingService(outbox);
        const fixes = [
            '2026-09-28T00:53:43.000Z',
            '2026-09-28T00:53:43.000Z',
            '2026-09-28T00:53:59.000Z',
        ];
        let next = 0;
        const capture = async () => ({
            latitude: 14.56,
            longitude: 121.03,
            observedAt: fixes[Math.min(next++, fixes.length - 1)],
        });
        const settle = () => new Promise((resolve) => setImmediate(resolve));

        try {
            service.startAutoTracking(activeUser, activeJob, capture);
            await settle();
            t.mock.timers.tick(15_000);
            await settle();
            t.mock.timers.tick(15_000);
            await settle();

            assert.deepEqual(
                outbox
                    .getCommands()
                    .map(
                        (c) =>
                            (c.payload as { captured_at: string }).captured_at,
                    ),
                ['2026-09-28T00:53:43.000Z', '2026-09-28T00:53:59.000Z'],
            );
        } finally {
            service.stopAutoTracking();
        }
    });

    test('includes the selected assigned asset in automatic location updates', async () => {
        const captured: { payload: Record<string, unknown> | null } = {
            payload: null,
        };
        const outbox = {
            enqueueShareLocation: async (payload: Record<string, unknown>) => {
                captured.payload = payload;

                return { id: 'test-command-id' };
            },
        } as unknown as CommandOutboxManager;
        const service = new LocationSharingService(outbox);

        try {
            service.startAutoTracking(
                activeUser,
                activeJob,
                async () => ({ latitude: 14.5995, longitude: 120.9842 }),
                501,
            );
            await Promise.resolve();
            const queuedPayload = captured.payload;
            assert.ok(queuedPayload);

            assert.equal(
                queuedPayload.operational_asset_id,
                501,
                'automatic telemetry should remain linked to its dispatched unit',
            );
            assert.equal(queuedPayload.dispatch_job_id, activeJob.id);
        } finally {
            service.stopAutoTracking();
        }
    });

    test('reports location capture failures so the field UI can explain why tracking is unavailable', async () => {
        let captureIssue: unknown | null = null;
        const outbox = {
            enqueueShareLocation: async () => ({ id: 'test-command-id' }),
        } as unknown as CommandOutboxManager;
        const service = new LocationSharingService(outbox);

        try {
            service.startAutoTracking(
                activeUser,
                activeJob,
                async () => {
                    throw new Error(
                        'Location permission is not granted in device settings.',
                    );
                },
                501,
                15_000,
                (error) => {
                    captureIssue = error;
                },
            );
            await Promise.resolve();

            assert.ok(captureIssue instanceof Error);
            assert.match(captureIssue.message, /permission/i);
        } finally {
            service.stopAutoTracking();
        }
    });

    test('authorizes location sharing for active user with valid job capabilities', () => {
        const repo = new MemoryOutboxRepository();
        const outbox = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        void outbox.activateActor(activeUser.id);
        const service = new LocationSharingService(outbox);

        assert.equal(service.canShareLocation(activeUser, activeJob), true);
    });

    test('denies location sharing for inactive user or disabled job capability', () => {
        const repo = new MemoryOutboxRepository();
        const outbox = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        const service = new LocationSharingService(outbox);

        const inactiveUser = { ...activeUser, is_active: false };
        assert.equal(service.canShareLocation(inactiveUser, activeJob), false);

        const disabledJob = {
            ...activeJob,
            capabilities: {
                ...activeJob.capabilities,
                can_share_location: false,
            },
        };
        assert.equal(service.canShareLocation(activeUser, disabledJob), false);
    });

    test('enqueues location payload to outbox when shareLocation is invoked', async () => {
        const repo = new MemoryOutboxRepository();
        const outbox = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await outbox.activateActor(activeUser.id);
        const service = new LocationSharingService(outbox);

        const coords = {
            latitude: 14.5995,
            longitude: 120.9842,
            accuracyMetres: 5,
        };
        const result = await service.shareLocation(
            activeUser,
            activeJob,
            null,
            coords,
            'Manual checkin',
        );

        assert.equal(result.success, true);
        assert.ok(result.commandId);

        const pending = outbox.getCommands();
        assert.equal(pending.length, 1);
        assert.equal(pending[0].type, 'share_location');
        assert.equal(
            (pending[0].payload as { latitude: number }).latitude,
            14.5995,
        );
        assert.equal(
            (pending[0].payload as { longitude: number }).longitude,
            120.9842,
        );
    });

    test('stamps a ping with the time the fix was measured, not when it was queued', async () => {
        const outbox = new CommandOutboxManager({
            repository: new MemoryOutboxRepository(),
            hasher: testHasher,
        });
        await outbox.activateActor(activeUser.id);
        const measured = new Date(Date.now() - 90_000).toISOString();

        await new LocationSharingService(outbox).shareLocation(
            activeUser,
            activeJob,
            null,
            { latitude: 14.5, longitude: 121, observedAt: measured },
        );

        assert.equal(
            (outbox.getCommands()[0].payload as { captured_at: string })
                .captured_at,
            measured,
        );
    });

    test('falls back to now for a fix with no time or a time in the future', () => {
        const now = Date.parse('2026-09-28T01:00:00.000Z');

        assert.equal(fixTime(null, now), '2026-09-28T01:00:00.000Z');
        assert.equal(fixTime('not a date', now), '2026-09-28T01:00:00.000Z');
        assert.equal(
            fixTime('2026-09-28T01:05:00.000Z', now),
            '2026-09-28T01:00:00.000Z',
        );
        assert.equal(
            fixTime('2026-09-28T00:59:30.000Z', now),
            '2026-09-28T00:59:30.000Z',
        );
    });

    test('pauseSharing enqueues sharing_enabled=false payload and stops auto tracking', async () => {
        const repo = new MemoryOutboxRepository();
        const outbox = new CommandOutboxManager({
            repository: repo,
            hasher: testHasher,
        });
        await outbox.activateActor(activeUser.id);
        const service = new LocationSharingService(outbox);

        const result = await service.pauseSharing(activeUser, activeJob);
        assert.equal(result.success, true);

        const pending = outbox.getCommands();
        assert.equal(pending.length, 1);
        assert.equal(
            (pending[0].payload as { sharing_enabled: boolean })
                .sharing_enabled,
            false,
        );
    });
});
