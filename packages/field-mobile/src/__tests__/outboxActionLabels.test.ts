import assert from 'node:assert/strict';
import test from 'node:test';
import { getHumanReadableActionType } from '../services/outboxProjection.js';
import type { OutboxCommand } from '../types/index.js';

const command = (
    type: OutboxCommand['type'],
    payload: Record<string, unknown> = {},
): OutboxCommand =>
    ({
        id: `cmd-${type}`,
        type,
        actorId: 1,
        payload,
        payloadHash: 'hash',
        priority: 'ordinary',
        attempts: 0,
        state: 'failed',
        createdAt: '2026-09-27T00:00:00Z',
        updatedAt: '2026-09-27T00:00:00Z',
    }) as OutboxCommand;

test('Hours of Service commands get plain names, not the raw command type', () => {
    const start = getHumanReadableActionType(command('start_hos_shift'));
    const change = getHumanReadableActionType(
        command('change_hos_duty_status', { duty_status: 'on_break' }),
    );
    const certify = getHumanReadableActionType(command('certify_hos_shift'));

    assert.equal(start.title, 'Start shift');
    assert.equal(change.title, 'Duty status change');
    assert.equal(change.subtitle, 'To: On Break');
    assert.equal(certify.title, 'Shift certification');

    for (const label of [start, change, certify]) {
        assert.doesNotMatch(label.title, /^Action:/);
        assert.notEqual(label.subtitle, 'Unrecognized action type');
        assert.equal(label.reference, 'Hours of Service');
    }
});

test('an unknown command still reads as a saved action, not developer text', () => {
    const unknown = getHumanReadableActionType(
        command('some_new_type' as OutboxCommand['type']),
    );

    assert.equal(unknown.title, 'Saved action');
    assert.doesNotMatch(unknown.subtitle, /Unrecognized/);
});
