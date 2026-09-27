import assert from 'node:assert/strict';
import test from 'node:test';
import {
    queuedHosCommands,
    planDutyCommand,
    serverClockOffsetMs,
} from '../screens/hos/hos-duty-command.js';
import type { OutboxCommand } from '../types/index';

const NOW = Date.parse('2026-09-27T08:00:00.000Z');

const command = (
    type: string,
    state: OutboxCommand['state'],
    payload: Record<string, unknown> = {},
    createdAt = '2026-09-27T07:59:00.000Z',
) =>
    ({
        id: `${type}-${createdAt}`,
        type,
        state,
        payload,
        createdAt,
    }) as unknown as OutboxCommand;

const offShift = {
    status: 'off_shift' as const,
    dutyStatus: 'off_duty' as const,
};
const operating = {
    status: 'on_shift' as const,
    dutyStatus: 'operating' as const,
};

test('going off duty when already off duty sends nothing', () => {
    const plan = planDutyCommand({
        dutyStatus: 'off_duty',
        shift: offShift,
        pending: [],
        phoneNowMs: NOW,
        clockOffsetMs: 0,
    });

    assert.equal(plan.kind, null);
});

test('going off duty during a shift certifies and ends it', () => {
    assert.equal(
        planDutyCommand({
            dutyStatus: 'off_duty',
            shift: operating,
            pending: [],
            phoneNowMs: NOW,
            clockOffsetMs: 0,
        }).kind,
        'certify',
    );
});

test('starting work with no shift starts one; changing during a shift changes status', () => {
    assert.equal(
        planDutyCommand({
            dutyStatus: 'operating',
            shift: offShift,
            pending: [],
            phoneNowMs: NOW,
            clockOffsetMs: 0,
        }).kind,
        'start',
    );
    assert.equal(
        planDutyCommand({
            dutyStatus: 'standby',
            shift: operating,
            pending: [],
            phoneNowMs: NOW,
            clockOffsetMs: 0,
        }).kind,
        'change',
    );
});

test('follows queued commands, not the stale server status', () => {
    const queuedStart = command('start_hos_shift', 'queued', {
        duty_status: 'operating',
        occurred_at: '2026-09-27T07:59:00.000Z',
    });

    assert.equal(
        planDutyCommand({
            dutyStatus: 'off_duty',
            shift: offShift,
            pending: [queuedStart],
            phoneNowMs: NOW,
            clockOffsetMs: 0,
        }).kind,
        'certify',
    );
    assert.equal(
        planDutyCommand({
            dutyStatus: 'driving',
            shift: offShift,
            pending: [queuedStart],
            phoneNowMs: NOW,
            clockOffsetMs: 0,
        }).kind,
        'change',
    );
});

test('stamps the event on the server clock, never in the server future', () => {
    // The phone runs 40 s fast: server time = phone time - 40 s.
    const offset = serverClockOffsetMs('2026-09-27T07:59:20.000Z', NOW);
    const plan = planDutyCommand({
        dutyStatus: 'standby',
        shift: operating,
        pending: [],
        phoneNowMs: NOW,
        clockOffsetMs: offset,
    });

    assert.equal(offset, -40_000);
    assert.equal(plan.occurredAt, '2026-09-27T07:59:20.000Z');
});

test('keeps a new event after the last queued one', () => {
    const plan = planDutyCommand({
        dutyStatus: 'standby',
        shift: operating,
        pending: [
            command('change_hos_duty_status', 'queued', {
                duty_status: 'driving',
                occurred_at: '2026-09-27T08:00:05.000Z',
            }),
        ],
        phoneNowMs: NOW,
        clockOffsetMs: 0,
    });

    assert.equal(plan.occurredAt, '2026-09-27T08:00:05.001Z');
});

test('only queued or sending HoS commands count as pending, oldest first', () => {
    const pending = queuedHosCommands([
        command('change_hos_duty_status', 'failed'),
        command('submit_dvir', 'queued'),
        command('certify_hos_shift', 'queued', {}, '2026-09-27T07:59:30.000Z'),
        command('start_hos_shift', 'syncing', {}, '2026-09-27T07:59:10.000Z'),
    ]);

    assert.deepEqual(
        pending.map((item) => item.type),
        ['start_hos_shift', 'certify_hos_shift'],
    );
});

test('an unreadable server time leaves the phone clock as is', () => {
    assert.equal(serverClockOffsetMs(null, NOW), 0);
    assert.equal(serverClockOffsetMs('not a date', NOW), 0);
});
