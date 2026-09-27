import assert from 'node:assert/strict';
import test from 'node:test';
import { postTripDoneThisShift } from '../screens/hos/hos-post-trip-status.js';
import type { OutboxCommand } from '../types/index.js';

const SHIFT_START = '2026-09-27T06:00:00+08:00';

function dvirCommand(overrides: Partial<OutboxCommand> = {}): OutboxCommand {
    return {
        id: 'cmd-1',
        actorId: 7,
        type: 'submit_dvir',
        payload: { inspection_type: 'post_trip', asset_code: 'CRN-101' },
        payloadHash: 'hash',
        state: 'queued',
        createdAt: '2026-09-27T17:00:00+08:00',
        updatedAt: '2026-09-27T17:00:00+08:00',
        attempts: 0,
        ...overrides,
    };
}

const base = {
    assetCode: 'CRN-101',
    shiftStartedAt: SHIFT_START,
    serverInspections: [],
    outboxCommands: [],
};

test('nothing recorded means the post-trip is still needed', () => {
    assert.equal(postTripDoneThisShift(base), false);
});

test('a post-trip the server has from this shift counts, e.g. done on another phone', () => {
    assert.equal(
        postTripDoneThisShift({
            ...base,
            serverInspections: [
                {
                    type: 'post_trip',
                    asset_code: 'CRN-101',
                    completed_at: '2026-09-27T16:30:00+08:00',
                },
            ],
        }),
        true,
    );
});

test('a post-trip from an earlier shift, a pre-trip, or another unit does not count', () => {
    assert.equal(
        postTripDoneThisShift({
            ...base,
            serverInspections: [
                {
                    type: 'post_trip',
                    asset_code: 'CRN-101',
                    completed_at: '2026-09-26T17:00:00+08:00',
                },
                {
                    type: 'pre_trip',
                    asset_code: 'CRN-101',
                    completed_at: '2026-09-27T06:10:00+08:00',
                },
                {
                    type: 'post_trip',
                    asset_code: 'CRN-202',
                    completed_at: '2026-09-27T16:30:00+08:00',
                },
            ],
        }),
        false,
    );
});

test('a post-trip saved on this phone and waiting to send counts after a restart', () => {
    assert.equal(
        postTripDoneThisShift({ ...base, outboxCommands: [dvirCommand()] }),
        true,
    );
    assert.equal(
        postTripDoneThisShift({
            ...base,
            outboxCommands: [dvirCommand({ state: 'failed' })],
        }),
        true,
    );
});

test('a post-trip the server rejected or that expired does not count', () => {
    assert.equal(
        postTripDoneThisShift({
            ...base,
            outboxCommands: [
                dvirCommand({ state: 'conflict' }),
                dvirCommand({ state: 'expired' }),
                dvirCommand({ state: 'unresolved' }),
            ],
        }),
        false,
    );
});

test('without a known unit or shift start it is never assumed done', () => {
    const outboxCommands = [dvirCommand()];
    assert.equal(
        postTripDoneThisShift({ ...base, assetCode: null, outboxCommands }),
        false,
    );
    assert.equal(
        postTripDoneThisShift({
            ...base,
            shiftStartedAt: null,
            outboxCommands,
        }),
        false,
    );
});
