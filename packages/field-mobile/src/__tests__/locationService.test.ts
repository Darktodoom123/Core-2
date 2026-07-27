import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { CommandOutboxManager } from '../services/commandOutbox.js';
import { LocationSharingService } from '../services/locationService.js';
import type { DispatchJob, User } from '../types/index.js';

describe('LocationSharingService', () => {
  const activeUser: User = {
    id: 10,
    name: 'Driver Dan',
    email: 'dan@example.com',
    role: 'driver',
    is_active: true,
  };

  const validJob: Partial<DispatchJob> = {
    id: 100,
    reference: 'DISP-100',
    capabilities: {
      can_respond: true,
      can_update_status: true,
      can_share_location: true,
    },
  };

  test('validates server capability contract before queueing location sharing', () => {
    const outbox = new CommandOutboxManager();
    const locationService = new LocationSharingService(outbox);

    const result = locationService.shareLocation(
      activeUser,
      validJob as DispatchJob,
      null,
      { latitude: 37.7749, longitude: -122.4194, accuracyMetres: 5.0 }
    );

    assert.equal(result.success, true);
    assert.ok(result.commandId);

    const commands = outbox.getCommands();
    assert.equal(commands.length, 1);
    assert.equal(commands[0].type, 'share_location');
    assert.equal(commands[0].payload.latitude, 37.7749);
  });

  test('rejects location sharing when server job capability denies it', () => {
    const outbox = new CommandOutboxManager();
    const locationService = new LocationSharingService(outbox);

    const restrictedJob: Partial<DispatchJob> = {
      id: 200,
      capabilities: {
        can_respond: false,
        can_update_status: false,
        can_share_location: false,
      },
    };

    const result = locationService.shareLocation(
      activeUser,
      restrictedJob as DispatchJob,
      null,
      { latitude: 37.7749, longitude: -122.4194 }
    );

    assert.equal(result.success, false);
    assert.match(result.reason || '', /not authorized/i);
    assert.equal(outbox.getCommands().length, 0);
  });
});
