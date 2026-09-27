import assert from 'node:assert/strict';
import test from 'node:test';
import { endShiftStepFor } from '../screens/hos/hos-end-shift.js';

test('with no linked machine, the shift just ends', () => {
    assert.equal(endShiftStepFor(null, false), 'end');
    assert.equal(endShiftStepFor('', true), 'end');
});

test('a linked machine needs its post-trip inspection first', () => {
    assert.equal(endShiftStepFor('CRN-101', false), 'post_trip');
});

test('after the post-trip, ending the shift releases the machine', () => {
    assert.equal(endShiftStepFor('CRN-101', true), 'release');
});
