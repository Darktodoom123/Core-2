import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CommandOutboxManager } from '../services/commandOutbox';
import { LocationSharingService } from '../services/locationService';
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
