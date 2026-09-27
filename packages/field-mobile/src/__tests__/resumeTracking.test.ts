import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldResumeTracking } from '../hooks/useResumeTracking.js';
import { pauseAppliesTo } from '../hooks/useTrackingPause.js';

const base = {
    isLinked: true,
    isSharing: false,
    canShare: true,
    pausedByOperator: false,
    shiftInfo: { status: 'on_shift' as const, hoursElapsed: 3 },
};

test('a restored link on a running shift resumes tracking', () => {
    assert.equal(shouldResumeTracking(base), true);
    assert.equal(
        shouldResumeTracking({
            ...base,
            shiftInfo: { status: 'standby', hoursElapsed: 3 },
        }),
        true,
    );
});

test('offline after a reboot the shift is unknown, and tracking still resumes', () => {
    assert.equal(
        shouldResumeTracking({
            ...base,
            shiftInfo: { status: 'off_shift', hoursElapsed: undefined },
        }),
        true,
    );
});

test('on a break or off shift, tracking stays off', () => {
    assert.equal(
        shouldResumeTracking({
            ...base,
            shiftInfo: { status: 'on_break', hoursElapsed: 3 },
        }),
        false,
    );
    assert.equal(
        shouldResumeTracking({
            ...base,
            shiftInfo: { status: 'off_shift', hoursElapsed: null },
        }),
        false,
    );
});

test('nothing to do when unlinked, already tracking, or the job forbids sharing', () => {
    assert.equal(shouldResumeTracking({ ...base, isLinked: false }), false);
    assert.equal(shouldResumeTracking({ ...base, isSharing: true }), false);
    assert.equal(shouldResumeTracking({ ...base, canShare: false }), false);
});

test('a pause the operator made before the restart keeps tracking off', () => {
    assert.equal(
        shouldResumeTracking({ ...base, pausedByOperator: true }),
        false,
    );
});

test('tracking waits until the saved pause has been read', () => {
    assert.equal(
        shouldResumeTracking({ ...base, pausedByOperator: undefined }),
        false,
    );
});

test('a pause counts only for the unit it was made on', () => {
    const link = { assetCode: 'CRN-101', linkedAt: '2026-09-28T06:00:00.000Z' };
    const pause = {
        assetCode: 'CRN-101',
        pausedAt: '2026-09-28T09:00:00.000Z',
    };

    assert.equal(pauseAppliesTo(pause, link), true);
    assert.equal(pauseAppliesTo(null, link), false);
    assert.equal(pauseAppliesTo(pause, null), false);
    assert.equal(
        pauseAppliesTo(pause, { ...link, assetCode: 'CRN-202' }),
        false,
    );
});
