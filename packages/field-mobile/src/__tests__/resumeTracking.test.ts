import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldResumeTracking } from '../hooks/useResumeTracking.js';

const base = {
    isLinked: true,
    isSharing: false,
    canShare: true,
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
