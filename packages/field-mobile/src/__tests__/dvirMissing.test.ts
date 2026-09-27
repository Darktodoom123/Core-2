import assert from 'node:assert/strict';
import test from 'node:test';
import { dvirMissingItems } from '../screens/dvir/dvir-missing.js';

const ready = {
    readingsValid: true,
    shutdownChecksUnanswered: 0,
    remarksMissing: false,
    attested: true,
};

test('nothing is missing on a complete inspection', () => {
    assert.deepEqual(dvirMissingItems(ready), []);
});

test('lists what is missing in the order the sections appear', () => {
    assert.deepEqual(
        dvirMissingItems({
            readingsValid: false,
            shutdownChecksUnanswered: 1,
            remarksMissing: true,
            attested: false,
        }),
        ['engine hours', '1 shutdown check', 'remarks', 'your confirmation'],
    );
});
