import assert from 'node:assert/strict';
import test from 'node:test';
import { hosSyncSummary } from '../screens/hos/hos-sync-summary.js';
import type { OutboxCommand } from '../types/index';

const command = (
    id: string,
    type: string,
    state: OutboxCommand['state'],
    payload: Record<string, unknown> = {},
    error: OutboxCommand['error'] = null,
) =>
    ({
        id,
        type,
        state,
        payload,
        error,
        createdAt: `2026-09-27T08:00:0${id}.000Z`,
    }) as unknown as OutboxCommand;

test('nothing to show when every duty change reached the server', () => {
    assert.equal(
        hosSyncSummary([
            command('1', 'change_hos_duty_status', 'completed'),
            command('2', 'submit_dvir', 'queued'),
        ]),
        null,
    );
});

test('names a rejected change and its reason, with later ones held behind it', () => {
    const summary = hosSyncSummary([
        command(
            '1',
            'start_hos_shift',
            'failed',
            { duty_status: 'operating' },
            {
                message: 'The duty event cannot occur in the future.',
                status: 422,
                retryable: false,
            },
        ),
        command('2', 'certify_hos_shift', 'queued'),
    ]);

    assert.deepEqual(summary?.problem, {
        id: '1',
        what: 'Start shift · Operating',
        kind: 'rejected',
        reason: 'The duty event cannot occur in the future.',
    });
    assert.deepEqual(summary?.waiting, [
        { id: '2', what: 'Off duty · end shift' },
    ]);
});

test('a change that only ran out of retries is stalled, not rejected', () => {
    const summary = hosSyncSummary([
        command(
            '1',
            'change_hos_duty_status',
            'failed',
            { duty_status: 'on_break' },
            {
                code: 'RETRY_EXHAUSTED',
                message: 'Automatic retry limit reached.',
                retryable: true,
            },
        ),
    ]);

    assert.equal(summary?.problem?.kind, 'stalled');
    assert.equal(summary?.problem?.what, 'Break');
});

test('lists changes still waiting to send, oldest first', () => {
    const summary = hosSyncSummary([
        command('2', 'change_hos_duty_status', 'queued', {
            duty_status: 'standby',
        }),
        command('1', 'change_hos_duty_status', 'syncing', {
            duty_status: 'driving',
        }),
    ]);

    assert.equal(summary?.problem, null);
    assert.deepEqual(
        summary?.waiting.map((item) => item.what),
        ['Driving', 'Standby'],
    );
});
