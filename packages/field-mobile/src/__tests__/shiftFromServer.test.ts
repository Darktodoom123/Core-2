import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { shiftStateFromServer } from '../navigation/shiftFromServer';
import type { CurrentHosShiftResponse, HosClocks } from '../types/index';

const shift = (clocks: Partial<HosClocks>): CurrentHosShiftResponse => ({
    shift: null,
    clocks: {
        shift_active: true,
        shift_status: 'active',
        current_duty_status: 'standby',
        started_at: '2026-09-27T14:45:28.000Z',
        hours_elapsed: 10.4,
        ...clocks,
    },
});

describe('shiftStateFromServer', () => {
    test('maps an active shift to its duty and start time', () => {
        const state = shiftStateFromServer(
            shift({ current_duty_status: 'on_break', break_minutes: 12 }),
        );

        assert.ok(state);
        assert.equal(state.shiftInfo.dutyStatus, 'on_break');
        assert.equal(state.shiftInfo.status, 'on_break');
        assert.equal(state.shiftInfo.breakMinutes, 12);
        assert.equal(state.startedAtIso, '2026-09-27T14:45:28.000Z');
    });

    test('maps no active shift to off duty', () => {
        const state = shiftStateFromServer(shift({ shift_active: false }));

        assert.ok(state);
        assert.equal(state.shiftInfo.dutyStatus, 'off_duty');
        assert.equal(state.shiftInfo.status, 'off_shift');
        assert.equal(state.startedAtIso, null);
    });

    test('changes nothing for an answer without clocks', () => {
        assert.equal(shiftStateFromServer(null), null);
        assert.equal(
            shiftStateFromServer({
                shift: null,
            } as unknown as CurrentHosShiftResponse),
            null,
        );
    });
});
